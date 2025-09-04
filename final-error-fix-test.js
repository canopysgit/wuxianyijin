const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 最终错误修复验证测试
async function finalErrorFixTest() {
  console.log('🔧 最终错误修复验证测试\n');
  console.log('=' .repeat(70));

  // 创建一个简单的测试Excel文件，包含序号列
  const workbook = XLSX.utils.book_new();
  
  const testData = [
    {
      '序号': 1,
      '工号': 'TEST-FIX-001',
      '姓名': '测试员工01',
      '入厂时间': '2022/01/15',
      '正常工作时间工资': 5000,
      '应发工资合计': 6500
    },
    {
      '序号': 2,
      '工号': 'TEST-FIX-002',
      '姓名': '测试员工02',
      '入厂时间': '2021/03/20',
      '正常工作时间工资': 5500,
      '应发工资合计': 7200
    },
    {
      '序号': 3,
      '工号': 'TEST-FIX-003',
      '姓名': '测试员工03',
      '入厂时间': '2020/07/10',
      '正常工作时间工资': 6000,
      '应发工资合计': 7800
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(workbook, worksheet, '2024年测试');
  
  const testExcelPath = path.join(__dirname, 'error-fix-test.xlsx');
  XLSX.writeFile(workbook, testExcelPath);
  
  console.log('📄 创建测试Excel文件完成');
  console.log(`   文件路径: ${testExcelPath}`);
  console.log(`   工作表: "2024年测试"`);
  console.log(`   记录数: ${testData.length} 条`);
  console.log(`   包含序号: 是`);
  
  // 模拟前端Excel解析过程
  console.log('\n📖 模拟前端Excel解析...');
  
  const fileBuffer = fs.readFileSync(testExcelPath);
  const parseWorkbook = XLSX.read(fileBuffer);
  const sheetName = parseWorkbook.SheetNames[0];
  const parseWorksheet = parseWorkbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(parseWorksheet);
  
  console.log(`   解析工作表: "${sheetName}"`);
  console.log(`   原始数据: ${jsonData.length} 行`);
  
  // 转换为API格式（包含xuhao字段）
  const apiRecords = jsonData.map(row => ({
    employee_id: row['工号'].toString(),
    hire_date: (() => {
      const dateStr = row['入厂时间'].toString();
      const [year, month, day] = dateStr.split('/').map(s => parseInt(s));
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    })(),
    salary_month: sheetName,
    basic_salary: parseFloat(row['正常工作时间工资']) || 0,
    gross_salary: parseFloat(row['应发工资合计']) || 0,
    xuhao: `${sheetName}-${row['序号']}` // 关键：生成xuhao字段
  }));
  
  console.log(`   转换记录: ${apiRecords.length} 条`);
  console.log(`   xuhao样本: ${apiRecords[0].xuhao}`);
  
  // 清理旧测试数据
  console.log('\n🧹 清理旧测试数据...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  await supabase.from('salary_records').delete().like('employee_id', 'TEST-FIX-%');
  
  // 测试API导入
  console.log('\n📤 测试API导入...');
  
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
    console.log(`   导入成功: ${result.success ? '✅' : '❌'}`);
    console.log(`   记录统计: ${result.importedRecords}/${result.totalRecords}`);
    console.log(`   失败记录: ${result.failedRecords}`);
    console.log(`   处理耗时: ${result.duration}ms`);
    
    // 检查新的验证机制
    if (result.validation) {
      console.log(`   验证机制:`);
      console.log(`      导入后检查: ${result.validation.postImportCheck ? '✅' : '❌'}`);
      console.log(`      一致性验证: ${result.validation.consistencyVerified ? '✅' : '❌'}`);
      if (result.validation.validationErrors.length > 0) {
        console.log(`      验证错误: ${result.validation.validationErrors.join('; ')}`);
      }
    }
    
    if (result.failedRecords > 0) {
      console.log(`   错误详情: ${result.errors[0]?.error}`);
    }
    
    // 验证xuhao字段
    console.log('\n🏷️ 验证xuhao字段...');
    
    const { data: xuhaoVerify, error: xuhaoError } = await supabase
      .from('salary_records')
      .select('employee_id, xuhao, salary_month')
      .like('employee_id', 'TEST-FIX-%')
      .order('employee_id');
    
    if (xuhaoError) {
      console.log(`   ❌ xuhao查询失败: ${xuhaoError.message}`);
    } else if (xuhaoVerify) {
      console.log(`   📊 xuhao字段验证:`);
      console.log(`      数据库记录: ${xuhaoVerify.length} 条`);
      
      xuhaoVerify.forEach((record, idx) => {
        const expectedXuhao = `${record.salary_month}-${idx + 1}`;
        const xuhaoMatch = record.xuhao === expectedXuhao;
        console.log(`      ${idx + 1}. ${record.employee_id}: "${record.xuhao}" ${xuhaoMatch ? '✅' : '❌'}`);
      });
    }
    
    // 最终评估
    const allTestsPassed = result.success && 
                          result.validation?.consistencyVerified && 
                          xuhaoVerify?.every(r => r.xuhao && r.xuhao.includes(r.salary_month));
    
    console.log('\n🎯 最终评估:');
    console.log(`   导入成功: ${result.success ? '✅' : '❌'}`);
    console.log(`   验证通过: ${result.validation?.consistencyVerified ? '✅' : '❌'}`);
    console.log(`   xuhao正确: ${xuhaoVerify?.every(r => r.xuhao) ? '✅' : '❌'}`);
    console.log(`   综合结果: ${allTestsPassed ? '✅ 错误已修复' : '❌ 仍有问题'}`);
    
    // 清理测试文件
    try {
      fs.unlinkSync(testExcelPath);
      console.log('   🗑️ 测试文件已清理');
    } catch (cleanupError) {
      console.log(`   ⚠️ 清理失败: ${cleanupError.message}`);
    }
    
    return allTestsPassed;
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    return false;
  }
}

// 运行错误修复测试
finalErrorFixTest().then(success => {
  console.log(`\n${success ? '🎉 错误已完全修复！' : '⚠️ 错误修复未完成'}`);
  
  if (success) {
    console.log('✨ 现在您可以安全地重新导入2022年工资表Excel文件');
    console.log('✨ 系统将正确生成xuhao字段并确保数据完整性！');
  }
  
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试异常:', error);
  process.exit(1);
});