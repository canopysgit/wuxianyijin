/**
 * 批量计算2023年H1期间所有员工的五险一金 (宽口径)
 * 
 * 业务需求:
 * 1. 计算2023年1-6月期间任意一个月有工资记录的所有员工
 * 2. 为每个员工计算每个月的详细五险一金数据
 * 3. 保存到 calculate_result_2023_h1_wide 表
 * 4. 全量重计算模式 (清空现有数据后重新计算)
 * 5. 错误容错处理 (记录失败员工，继续处理其他员工)
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// 兼容本地与生产的环境变量命名
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

// Supabase客户端初始化
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 引入计算引擎
const fs = require('fs');

// 动态加载计算函数 (模拟ES模块加载)
async function loadCalculator() {
  const calculatorPath = path.join(__dirname, 'src', 'lib', 'newCalculator.ts');
  
  // 为了在Node.js中使用TypeScript模块，我们需要内联主要函数
  return {
    // 确定社保年度 (简化后不再需要ABC分类)
    getSocialSecurityYear: function(calculationMonth) {
      const calculationMonthNum = calculationMonth.getMonth() + 1;
      const calculationYear = calculationMonth.getFullYear();
      
      if (calculationMonthNum >= 7) {
        return calculationYear; // 7-12月属于当年社保年度
      } else {
        return calculationYear - 1; // 1-6月属于上一年社保年度
      }
    },

    // 参考工资选择 (基于jishu.md新规则)
    selectReferenceWageAndCategory: async function(employeeId, hireDate, calculationMonth, assumption) {
      const hireYear = hireDate.getFullYear();
      const calculationMonthNum = calculationMonth.getMonth() + 1;
      const calculationYear = calculationMonth.getFullYear();
      
      // 确定社保年度
      let socialSecurityYear;
      if (calculationMonthNum >= 7) {
        socialSecurityYear = calculationYear;
      } else {
        socialSecurityYear = calculationYear - 1;
      }
      
      // 基于jishu.md的二元选择规则
      if (hireYear < socialSecurityYear) {
        // 社保年度开始前入职：使用(社保年度-1)年均工资
        let targetYear = socialSecurityYear - 1;
        
        // 特殊处理：2023年H1期间使用2022年平均工资替代2021年
        if (calculationYear === 2023 && calculationMonthNum <= 6 && targetYear === 2021) {
          targetYear = 2022; // 用2022年平均工资替代2021年
        }
        
        const avgWage = await getEmployeeAverageSalary(employeeId, targetYear, assumption);
        return {
          wage: avgWage,
          category: `${targetYear}年平均工资`
        };
      } else {
        // 社保年度内或之后入职：使用入职首月工资
        const firstSalary = await getEmployeeFirstMonthSalary(employeeId, assumption);
        return {
          wage: firstSalary,
          category: '入职首月工资'
        };
      }
    },

    // 计算各险种调整后基数
    calculateInsuranceAdjustedBases: function(referenceWageBase, rules) {
      const pensionAdjusted = Math.min(Math.max(referenceWageBase, rules.pension_base_floor), rules.pension_base_cap);
      const pension = {
        original_base: referenceWageBase,
        floor: rules.pension_base_floor,
        cap: rules.pension_base_cap,
        adjusted_base: pensionAdjusted,
        payment: pensionAdjusted * rules.pension_rate_enterprise
      };
      
      const medicalAdjusted = Math.min(Math.max(referenceWageBase, rules.medical_base_floor), rules.medical_base_cap);
      const medical = {
        original_base: referenceWageBase,
        floor: rules.medical_base_floor,
        cap: rules.medical_base_cap,
        adjusted_base: medicalAdjusted,
        payment: medicalAdjusted * rules.medical_rate_enterprise
      };
      
      const unemploymentAdjusted = Math.min(Math.max(referenceWageBase, rules.unemployment_base_floor), rules.unemployment_base_cap);
      const unemployment = {
        original_base: referenceWageBase,
        floor: rules.unemployment_base_floor,
        cap: rules.unemployment_base_cap,
        adjusted_base: unemploymentAdjusted,
        payment: unemploymentAdjusted * rules.unemployment_rate_enterprise
      };
      
      const injuryAdjusted = Math.min(Math.max(referenceWageBase, rules.injury_base_floor), rules.injury_base_cap);
      const injury = {
        original_base: referenceWageBase,
        floor: rules.injury_base_floor,
        cap: rules.injury_base_cap,
        adjusted_base: injuryAdjusted,
        payment: injuryAdjusted * rules.injury_rate_enterprise
      };
      
      const hfAdjusted = Math.min(Math.max(referenceWageBase, rules.hf_base_floor), rules.hf_base_cap);
      const hf = {
        original_base: referenceWageBase,
        floor: rules.hf_base_floor,
        cap: rules.hf_base_cap,
        adjusted_base: hfAdjusted,
        payment: hfAdjusted * rules.hf_rate_enterprise
      };
      
      return { pension, medical, unemployment, injury, hf };
    }
  };
}

// 获取员工平均工资
async function getEmployeeAverageSalary(employeeId, year, assumption) {
  const { data: records, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId);
    
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`);
  }
  
  // 筛选指定年份的记录
  const yearRecords = records.filter(record => {
    const salaryMonth = record.salary_month;
    return salaryMonth.includes(`${year}年`);
  });
  
  if (yearRecords.length === 0) {
    throw new Error(`员工 ${employeeId} 在 ${year} 年没有工资记录`);
  }
  
  // 根据假设选择工资字段
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary';
  const totalSalary = yearRecords.reduce((sum, record) => sum + (record[salaryField] || 0), 0);
  
  return totalSalary / yearRecords.length;
}

// 获取员工入职首月工资 (已更新为基于社保起始月份)
// 获取员工首月工资 (基于社保起始月份)
async function getEmployeeFirstMonthSalary(employeeId, assumption) {
  const { data: records, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('employee_id', employeeId);
    
  if (error || !records || records.length === 0) {
    throw new Error(`员工 ${employeeId} 没有工资记录`);
  }
  
  // 获取入职日期
  const hireDate = new Date(records[0].hire_date);
  const hireDay = hireDate.getDate();
  
  // 确定社保起始月份
  let socialSecurityStartMonth;
  if (hireDay <= 15) {
    // 15号及以前入职，当月开始缴社保
    socialSecurityStartMonth = new Date(hireDate.getFullYear(), hireDate.getMonth(), 1);
  } else {
    // 15号之后入职，次月开始缴社保
    socialSecurityStartMonth = new Date(hireDate.getFullYear(), hireDate.getMonth() + 1, 1);
  }
  
  // 将社保起始月份转换为中文格式以匹配salary_month
  const targetMonthChinese = `${socialSecurityStartMonth.getFullYear()}年${socialSecurityStartMonth.getMonth() + 1}月`;
  
  // 查找社保起始月份的工资记录
  const targetRecord = records.find(record => record.salary_month === targetMonthChinese);
  
  if (!targetRecord) {
    throw new Error(`员工 ${employeeId} 社保起始月份 ${targetMonthChinese} 没有工资记录`);
  }
  
  const salaryField = assumption === 'wide' ? 'gross_salary' : 'basic_salary';
  return targetRecord[salaryField] || 0;
}

// 解析中文日期
function parseChineseDate(chineseDateStr) {
  if (!chineseDateStr) return null;
  
  const match = chineseDateStr.match(/(\d{4})年(\d{1,2})月/);
  if (!match) return null;
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  
  return new Date(year, month - 1, 1);
}

// 获取政策规则
async function getPolicyRules(year, period) {
  const { data: rules, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', year)
    .eq('period', period)
    .single();
    
  if (error || !rules) {
    throw new Error(`未找到 ${year} 年 ${period} 期间的政策规则`);
  }
  
  return rules;
}

// 主计算函数
async function calculateEmployeeMonth(employeeId, calculationMonth, calculationMonthText, assumption, calculator, rules) {
  try {
    // 1. 获取员工基本信息
    const { data: salaryRecords, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId);
      
    if (salaryError || !salaryRecords || salaryRecords.length === 0) {
      throw new Error(`员工 ${employeeId} 没有工资记录`);
    }
    
    // 获取员工入职日期
    const hireDate = new Date(salaryRecords[0].hire_date);
    
    // 2. 确定社保年度
    const socialSecurityYear = calculator.getSocialSecurityYear(calculationMonth);
    
    // 3. 选择参考工资和类别 (使用新的简化算法)
    const { wage: referenceWageBase, category: wageCategory } = await calculator.selectReferenceWageAndCategory(
      employeeId,
      hireDate,
      calculationMonth,
      assumption
    );
    
    // 4. 计算各险种调整后基数和缴费
    const adjustments = calculator.calculateInsuranceAdjustedBases(referenceWageBase, rules);
    
    // 5. 计算总计
    const theoreticalTotal = 
      adjustments.pension.payment +
      adjustments.medical.payment +
      adjustments.unemployment.payment +
      adjustments.injury.payment +
      adjustments.hf.payment;
    
    // 6. 构造计算结果
    const result = {
      employee_id: employeeId,
      calculation_month: calculationMonthText, // YYYYMM格式 (如: 202301)
      employee_category: hireDate.getFullYear() < socialSecurityYear ? '老员工' : '新员工', // 简化分类
      
      reference_wage_base: referenceWageBase,
      reference_wage_category: wageCategory,
      
      pension_base_floor: adjustments.pension.floor,
      pension_base_cap: adjustments.pension.cap,
      pension_adjusted_base: adjustments.pension.adjusted_base,
      
      medical_base_floor: adjustments.medical.floor,
      medical_base_cap: adjustments.medical.cap,
      medical_adjusted_base: adjustments.medical.adjusted_base,
      
      unemployment_base_floor: adjustments.unemployment.floor,
      unemployment_base_cap: adjustments.unemployment.cap,
      unemployment_adjusted_base: adjustments.unemployment.adjusted_base,
      
      injury_base_floor: adjustments.injury.floor,
      injury_base_cap: adjustments.injury.cap,
      injury_adjusted_base: adjustments.injury.adjusted_base,
      
      hf_base_floor: adjustments.hf.floor,
      hf_base_cap: adjustments.hf.cap,
      hf_adjusted_base: adjustments.hf.adjusted_base,
      
      pension_payment: adjustments.pension.payment,
      medical_payment: adjustments.medical.payment,
      unemployment_payment: adjustments.unemployment.payment,
      injury_payment: adjustments.injury.payment,
      hf_payment: adjustments.hf.payment,
      theoretical_total: theoreticalTotal
    };
    
    return result;
    
  } catch (error) {
    throw new Error(`计算员工 ${employeeId} 在 ${calculationMonthText} 失败: ${error.message}`);
  }
}

// 批量计算主函数
async function batchCalculate2023H1() {
  const startTime = Date.now();
  console.log('🚀 开始批量计算2023年H1期间所有员工...');
  
  try {
    // 1. 清空现有数据
    console.log('🗑️ 清空现有数据...');
    const { error: deleteError } = await supabase
      .from('calculate_result_2023_h1_wide')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录
      
    if (deleteError) {
      console.error('❌ 清空数据失败:', deleteError.message);
      return;
    }
    console.log('✅ 现有数据已清空');
    
    // 2. 获取2023年H1期间有记录的所有员工
    console.log('🔍 查找2023年H1期间在职员工...');
    const { data: employeeData, error: employeeError } = await supabase
      .from('salary_records')
      .select('employee_id, hire_date')
      .like('salary_month', '2023年%')
      .in('salary_month', ['2023年1月', '2023年2月', '2023年3月', '2023年4月', '2023年5月', '2023年6月']);
      
    if (employeeError) {
      console.error('❌ 查询员工失败:', employeeError.message);
      return;
    }
    
    // 去重获取唯一员工列表
    const uniqueEmployees = employeeData.reduce((acc, record) => {
      if (!acc.find(emp => emp.employee_id === record.employee_id)) {
        acc.push({
          employee_id: record.employee_id,
          hire_date: new Date(record.hire_date)
        });
      }
      return acc;
    }, []);
    
    console.log(`📊 找到 ${uniqueEmployees.length} 个员工需要计算`);
    
    // 3. 获取政策规则
    console.log('📋 获取2023年H1政策规则...');
    const rules = await getPolicyRules(2023, 'H1');
    console.log('✅ 政策规则获取成功');
    
    // 4. 加载计算引擎
    console.log('⚙️ 初始化计算引擎...');
    const calculator = await loadCalculator();
    console.log('✅ 计算引擎加载成功');
    
    // 5. 批量计算
    const assumption = 'wide'; // 宽口径假设
    const monthsData = [
      { salaryMonth: '2023年1月', calculationMonth: '202301', dateObj: new Date(2023, 0, 1) },
      { salaryMonth: '2023年2月', calculationMonth: '202302', dateObj: new Date(2023, 1, 1) },
      { salaryMonth: '2023年3月', calculationMonth: '202303', dateObj: new Date(2023, 2, 1) },
      { salaryMonth: '2023年4月', calculationMonth: '202304', dateObj: new Date(2023, 3, 1) },
      { salaryMonth: '2023年5月', calculationMonth: '202305', dateObj: new Date(2023, 4, 1) },
      { salaryMonth: '2023年6月', calculationMonth: '202306', dateObj: new Date(2023, 5, 1) }
    ];
    
    let totalCalculations = 0;
    let successfulCalculations = 0;
    let failedEmployees = [];
    const batchSize = 2000; // 每批处理2000条记录 (性能优化)
    
    console.log(`\n🧮 开始计算 ${uniqueEmployees.length} 个员工 × ${monthsData.length} 个月 = ${uniqueEmployees.length * monthsData.length} 条记录`);
    
    // 分批处理员工
    for (let i = 0; i < uniqueEmployees.length; i += batchSize) {
      const batch = uniqueEmployees.slice(i, i + batchSize);
      console.log(`\n📦 处理第 ${Math.floor(i/batchSize) + 1} 批员工 (${i + 1}-${Math.min(i + batchSize, uniqueEmployees.length)})...`);
      
      const batchResults = [];
      
      // 处理当前批次的员工
      for (const employee of batch) {
        const employeeResults = [];
        
        // 为每个员工计算每个月的数据
        for (const monthData of monthsData) {
          try {
            // 检查该员工在该月是否有工资记录
            const { data: monthRecord } = await supabase
              .from('salary_records')
              .select('salary_month')
              .eq('employee_id', employee.employee_id)
              .eq('salary_month', monthData.salaryMonth)
              .single();
              
            if (monthRecord) {
              // 该员工在该月有记录，进行计算
              const result = await calculateEmployeeMonth(
                employee.employee_id,
                monthData.dateObj,
                monthData.calculationMonth,
                assumption,
                calculator,
                rules
              );
              employeeResults.push(result);
              totalCalculations++;
            }
          } catch (error) {
            console.error(`❌ 员工 ${employee.employee_id} ${monthData.salaryMonth}计算失败:`, error.message);
            failedEmployees.push({
              employee_id: employee.employee_id,
              month: monthData.salaryMonth,
              error: error.message
            });
            totalCalculations++;
          }
        }
        
        // 将该员工的所有月份结果加入批次
        batchResults.push(...employeeResults);
      }
      
      // 批量插入当前批次结果
      if (batchResults.length > 0) {
        const { data: insertData, error: insertError } = await supabase
          .from('calculate_result_2023_h1_wide')
          .insert(batchResults, { returning: 'minimal' });
          
        if (insertError) {
          console.error('❌ 批量插入失败:', insertError.message);
          // 记录整个批次失败
          batch.forEach(emp => {
            failedEmployees.push({
              employee_id: emp.employee_id,
              month: '整批次',
              error: `数据库插入失败: ${insertError.message}`
            });
          });
        } else {
          successfulCalculations += batchResults.length;
          console.log(`✅ 批次插入成功: ${batchResults.length} 条记录`);
        }
      }
      
      // 显示进度
      const progress = ((i + batchSize) / uniqueEmployees.length * 100).toFixed(1);
      console.log(`📈 进度: ${Math.min(i + batchSize, uniqueEmployees.length)}/${uniqueEmployees.length} 员工 (${progress}%)`);
    }
    
    // 6. 计算总结
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 ===== 批量计算总结 =====');
    console.log(`⏱️ 总耗时: ${duration} 秒`);
    console.log(`👥 员工数量: ${uniqueEmployees.length}`);
    console.log(`📅 计算月份: ${months.length} 个月`);
    console.log(`🧮 总计算数: ${totalCalculations}`);
    console.log(`✅ 成功计算: ${successfulCalculations}`);
    console.log(`❌ 失败计算: ${totalCalculations - successfulCalculations}`);
    
    // 7. 失败记录详情
    if (failedEmployees.length > 0) {
      console.log('\n🚨 ===== 失败员工清单 =====');
      console.log(`失败员工数量: ${new Set(failedEmployees.map(f => f.employee_id)).size}`);
      
      // 按员工分组显示失败原因
      const failuresByEmployee = failedEmployees.reduce((acc, failure) => {
        if (!acc[failure.employee_id]) {
          acc[failure.employee_id] = [];
        }
        acc[failure.employee_id].push({
          month: failure.month,
          error: failure.error
        });
        return acc;
      }, {});
      
      Object.entries(failuresByEmployee).forEach(([employeeId, failures]) => {
        console.log(`\n员工 ${employeeId}:`);
        failures.forEach(failure => {
          console.log(`  - ${failure.month}: ${failure.error}`);
        });
      });
    }
    
    // 8. 验证结果
    console.log('\n🔍 ===== 结果验证 =====');
    const { data: finalCount, error: countError } = await supabase
      .from('calculate_result_2023_h1_wide')
      .select('count(*)', { count: 'exact', head: true });
      
    if (!countError) {
      console.log(`✅ calculate_result_2023_h1_wide 表中共有 ${finalCount} 条记录`);
    }
    
    // 抽样验证几条记录
    const { data: sampleData, error: sampleError } = await supabase
      .from('calculate_result_2023_h1_wide')
      .select('employee_id, calculation_month, employee_category, reference_wage_base, theoretical_total')
      .order('employee_id, calculation_month')
      .limit(5);
      
    if (!sampleError && sampleData.length > 0) {
      console.log('\n📋 抽样记录验证:');
      sampleData.forEach(record => {
        console.log(`  ${record.employee_id} ${record.calculation_month}: ${record.employee_category}类, ¥${record.reference_wage_base} → ¥${record.theoretical_total.toFixed(2)}`);
      });
    }
    
    console.log('\n🎉 批量计算完成！');
    
    return {
      total_employees: uniqueEmployees.length,
      total_calculations: totalCalculations,
      successful_calculations: successfulCalculations,
      failed_calculations: totalCalculations - successfulCalculations,
      failed_employees: failedEmployees,
      duration_seconds: parseFloat(duration)
    };
    
  } catch (error) {
    console.error('💥 批量计算过程出现严重错误:', error.message);
    throw error;
  }
}

// 执行批量计算
(async () => {
  try {
    const result = await batchCalculate2023H1();
    console.log('\n✨ 批量计算任务执行完成');
  } catch (error) {
    console.error('💥 批量计算任务失败:', error.message);
    process.exit(1);
  }
})();
