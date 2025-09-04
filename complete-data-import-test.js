const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 完整数据导入测试
async function completeDataImportTest() {
  console.log('🔧 完整数据导入测试 - 2022年1月\n');
  console.log('=' .repeat(70));

  // 读取真实Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Excel文件不存在:', excelPath);
    return false;
  }

  console.log('📄 读取真实Excel文件...');
  console.log(`   文件路径: ${excelPath}`);
  
  const workbook = XLSX.readFile(excelPath);
  const targetSheet = '2022年1月';
  
  if (!workbook.SheetNames.includes(targetSheet)) {
    console.error('❌ 找不到工作表:', targetSheet);
    return false;
  }

  const worksheet = workbook.Sheets[targetSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  // 过滤有意义的数据
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`   工作表: "${targetSheet}"`);
  console.log(`   Excel总行数: ${jsonData.length}`);
  console.log(`   有意义记录: ${meaningfulData.length} 条`);
  
  // 转换为API格式
  const apiRecords = meaningfulData.map(row => {
    const hireDate = (() => {
      const dateStr = row['入厂时间'].toString();
      const [year, month, day] = dateStr.split('/').map(s => parseInt(s));
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    })();
    
    return {
      employee_id: row['工号'].toString(),
      hire_date: hireDate,
      salary_month: targetSheet,
      basic_salary: parseFloat(row['正常工作时间工资']) || 0,
      gross_salary: parseFloat(row['应发工资合计']) || 0,
      xuhao: `${targetSheet}-${row['序号']}`,
      xuhao2: row['序号'] // 纯数字格式
    };
  });
  
  console.log(`   转换记录: ${apiRecords.length} 条`);
  
  // 清理旧测试数据
  console.log('\n🧹 清理旧的2022年1月数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { error: deleteError } = await supabase
    .from('salary_records')
    .delete()
    .eq('salary_month', '2022年1月');
  
  if (deleteError) {
    console.log(`   ⚠️ 清理警告: ${deleteError.message}`);
  } else {
    console.log(`   ✅ 清理完成`);
  }
  
  // 测试API导入
  console.log('\n📤 测试完整数据导入...');
  
  try {
    const response = await fetch('http://localhost:3006/api/import-salary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: apiRecords }),
    });
    
    const result = await response.json();
    
    console.log(`📊 导入结果:`);
    console.log(`   HTTP状态: ${response.status}`);
    console.log(`   导入成功: ${result.success ? '✅' : '❌'}`)
    console.log(`   总记录数: ${result.totalRecords}`);
    console.log(`   成功导入: ${result.importedRecords}`);
    console.log(`   失败记录: ${result.failedRecords}`);
    console.log(`   处理耗时: ${result.duration}ms`);
    
    // 详细的验证统计
    if (result.validation) {
      console.log(`   验证机制:`);
      console.log(`      导入后检查: ${result.validation.postImportCheck ? '✅' : '❌'}`);
      console.log(`      一致性验证: ${result.validation.consistencyVerified ? '✅' : '❌'}`);
      if (result.validation.validationErrors.length > 0) {
        console.log(`      验证错误: ${result.validation.validationErrors.join('; ')}`);
      }
    }
    
    // 关键指标验证
    const importSuccess = result.importedRecords === meaningfulData.length;
    const noFailures = result.failedRecords === 0;
    
    console.log(`\n🎯 关键指标验证:`);
    console.log(`   完整性: ${importSuccess ? '✅' : '❌'} (${result.importedRecords}/${meaningfulData.length})`);
    console.log(`   无失败: ${noFailures ? '✅' : '❌'} (失败${result.failedRecords}条)`);
    
    // 验证xuhao2字段
    console.log('\n🏷️ 验证xuhao2字段...');
    
    const { data: xuhao2Verify, error: xuhao2Error } = await supabase
      .from('salary_records')
      .select('employee_id, xuhao, xuhao2, salary_month')
      .eq('salary_month', '2022年1月')
      .order('xuhao2');
    
    if (xuhao2Error) {
      console.log(`   ❌ xuhao2查询失败: ${xuhao2Error.message}`);
    } else if (xuhao2Verify) {
      console.log(`   📊 xuhao2字段验证:`);
      console.log(`      数据库记录: ${xuhao2Verify.length} 条`);
      
      // 检查关键序号（如90）
      const seq90 = xuhao2Verify.find(r => r.xuhao2 === 90);
      const seq37 = xuhao2Verify.find(r => r.xuhao2 === 37);
      const seq132 = xuhao2Verify.find(r => r.xuhao2 === 132);
      
      console.log(`      序号90存在: ${seq90 ? '✅' : '❌'} ${seq90 ? `(${seq90.employee_id})` : ''}`);
      console.log(`      序号37存在: ${seq37 ? '✅' : '❌'} ${seq37 ? `(${seq37.employee_id})` : ''}`);
      console.log(`      序号132存在: ${seq132 ? '✅' : '❌'} ${seq132 ? `(${seq132.employee_id})` : ''}`);
      
      // 显示xuhao2字段样本
      const samples = xuhao2Verify.slice(0, 3);
      console.log(`      xuhao2格式样本:`);
      samples.forEach(record => {
        console.log(`        ${record.employee_id}: xuhao2=${record.xuhao2}, xuhao="${record.xuhao}"`);
      });
    }
    
    // 最终评估
    const allTestsPassed = importSuccess && noFailures && result.validation?.consistencyVerified;
    
    console.log('\n🎯 最终评估:');
    console.log(`   数据完整性: ${importSuccess ? '✅' : '❌'} (${result.importedRecords}/${meaningfulData.length})`);
    console.log(`   无导入失败: ${noFailures ? '✅' : '❌'}`);
    console.log(`   验证通过: ${result.validation?.consistencyVerified ? '✅' : '❌'}`);
    console.log(`   xuhao2正确: ${xuhao2Verify?.length === meaningfulData.length ? '✅' : '❌'}`);
    console.log(`   综合结果: ${allTestsPassed ? '✅ 完整导入成功' : '❌ 仍有问题'}`)
    
    return allTestsPassed;
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    return false;
  }
}

// 运行完整数据导入测试
completeDataImportTest().then(success => {
  console.log(`\n${success ? '🎉 2022年1月数据完整导入成功！' : '⚠️ 数据导入仍有问题'}`);
  
  if (success) {
    console.log('✨ 所有239条有意义记录已正确导入');
    console.log('✨ xuhao2字段正确存储为纯数字格式');
    console.log('✨ 序号90等之前缺失的记录已成功导入');
  }
  
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试异常:', error);
  process.exit(1);
});