const { createClient } = require('@supabase/supabase-js');

async function verifyDatabaseFinal() {
  console.log('=== 五险一金系统 数据库最终验证 ===\n');
  
  const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODkwODYsImV4cCI6MjA2ODA2NTA4Nn0.8HBJYIfll7SWOMIR02Kx30pnhxRWfE31uN_Cz03faK8';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. 检查测试员工数据是否存在
    console.log('🔍 检查测试员工数据...');
    const testEmployeeIds = ['DF-2389', 'DF-2127', 'DF-0793'];
    
    for (const employeeId of testEmployeeIds) {
      const { data, error } = await supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`❌ 查询员工 ${employeeId} 失败:`, error);
        continue;
      }
      
      if (data && data.length > 0) {
        const record = data[0];
        console.log(`✅ 员工 ${employeeId}:`);
        console.log(`   入职日期: ${record.hire_date}`);
        console.log(`   工资月份: ${record.salary_month}`);
        console.log(`   基本工资: ￥${record.basic_salary}`);
        console.log(`   应发工资: ￥${record.gross_salary}`);
        console.log(`   创建时间: ${record.created_at}`);
        console.log(`   记录总数: ${data.length}`);
      } else {
        console.log(`⚠️ 员工 ${employeeId}: 未找到记录`);
      }
    }
    
    // 2. 统计总体数据
    console.log('\n📊 数据库总体统计...');
    
    const { count: totalRecords } = await supabase
      .from('salary_records')
      .select('*', { count: 'exact', head: true });
    
    console.log(`总记录数: ${totalRecords}`);
    
    // 获取唯一员工数
    const { data: uniqueEmployees } = await supabase
      .from('salary_records')
      .select('employee_id')
      .order('employee_id');
    
    if (uniqueEmployees) {
      const uniqueIds = new Set(uniqueEmployees.map(r => r.employee_id));
      console.log(`唯一员工数: ${uniqueIds.size}`);
    }
    
    // 3. 按创建时间查看最新记录
    console.log('\n🕐 最新的10条记录:');
    const { data: recentRecords } = await supabase
      .from('salary_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentRecords) {
      recentRecords.forEach((record, index) => {
        console.log(`${index + 1}. ${record.employee_id} | ${record.salary_month} | ￥${record.basic_salary}/￥${record.gross_salary} | ${record.created_at}`);
      });
    }
    
    // 4. 检查数据完整性
    console.log('\n🔎 数据完整性检查...');
    
    // 检查是否有空值
    const { data: nullChecks } = await supabase
      .from('salary_records')
      .select('employee_id, hire_date, salary_month, basic_salary, gross_salary')
      .or('employee_id.is.null,hire_date.is.null,salary_month.is.null,basic_salary.is.null,gross_salary.is.null');
    
    if (nullChecks && nullChecks.length > 0) {
      console.log(`❌ 发现 ${nullChecks.length} 条记录包含空值:`);
      nullChecks.forEach(record => {
        console.log('   ', record);
      });
    } else {
      console.log('✅ 所有记录字段完整，无空值');
    }
    
    // 检查负数工资
    const { data: negativeChecks } = await supabase
      .from('salary_records')
      .select('*')
      .or('basic_salary.lt.0,gross_salary.lt.0');
    
    if (negativeChecks && negativeChecks.length > 0) {
      console.log(`⚠️ 发现 ${negativeChecks.length} 条记录包含负数工资:`);
      negativeChecks.forEach(record => {
        console.log(`   ${record.employee_id}: 基本工资=${record.basic_salary}, 应发工资=${record.gross_salary}`);
      });
    } else {
      console.log('✅ 所有工资数据均为非负数');
    }
    
    // 5. 验证测试数据的具体数值
    console.log('\n🎯 验证测试文件数据的准确性...');
    
    const expectedData = [
      { employee_id: 'DF-2389', basic_salary: 40115, gross_salary: 68825.67, hire_date: '2017-03-31' },
      { employee_id: 'DF-2127', basic_salary: 5500, gross_salary: 16390, hire_date: '2015-08-03' },
      { employee_id: 'DF-0793', basic_salary: 5544, gross_salary: 13179.5, hire_date: '2010-07-07' }
    ];
    
    let verificationPassed = true;
    
    for (const expected of expectedData) {
      const { data: actualRecords } = await supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', expected.employee_id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (actualRecords && actualRecords.length > 0) {
        const actual = actualRecords[0];
        const salaryMatch = Math.abs(actual.basic_salary - expected.basic_salary) < 0.01 && 
                           Math.abs(actual.gross_salary - expected.gross_salary) < 0.01;
        const hireDateMatch = actual.hire_date === expected.hire_date;
        
        if (salaryMatch && hireDateMatch) {
          console.log(`✅ ${expected.employee_id}: 数据验证通过`);
        } else {
          console.log(`❌ ${expected.employee_id}: 数据验证失败`);
          console.log(`   期望: 基本工资=${expected.basic_salary}, 应发工资=${expected.gross_salary}, 入职日期=${expected.hire_date}`);
          console.log(`   实际: 基本工资=${actual.basic_salary}, 应发工资=${actual.gross_salary}, 入职日期=${actual.hire_date}`);
          verificationPassed = false;
        }
      } else {
        console.log(`❌ ${expected.employee_id}: 未找到记录`);
        verificationPassed = false;
      }
    }
    
    // 6. 政策规则数据检查
    console.log('\n📋 政策规则数据检查...');
    const { data: policyRules } = await supabase
      .from('policy_rules')
      .select('*')
      .order('year', { ascending: true });
    
    if (policyRules) {
      console.log(`✅ 政策规则记录数: ${policyRules.length}`);
      policyRules.forEach(rule => {
        console.log(`   ${rule.city} ${rule.year}年${rule.period}: 社保基数 ${rule.ss_base_floor}-${rule.ss_base_cap}, 公积金基数 ${rule.hf_base_floor}-${rule.hf_base_cap}`);
      });
    } else {
      console.log('⚠️ 未找到政策规则数据');
    }
    
    return {
      success: verificationPassed,
      totalRecords: totalRecords || 0,
      testDataVerified: verificationPassed,
      policyRulesCount: policyRules ? policyRules.length : 0
    };
    
  } catch (error) {
    console.error('❌ 数据库验证失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行数据库验证
verifyDatabaseFinal()
  .then(result => {
    console.log('\n=== 数据库验证总结 ===');
    console.log(`验证状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`总记录数: ${result.totalRecords}`);
    console.log(`测试数据验证: ${result.testDataVerified ? '✅ 通过' : '❌ 失败'}`);
    console.log(`政策规则数: ${result.policyRulesCount}`);
    
    if (result.success) {
      console.log('\n🎉 数据库验证全部通过！');
    }
  })
  .catch(error => {
    console.error('数据库验证脚本执行错误:', error);
    process.exit(1);
  });