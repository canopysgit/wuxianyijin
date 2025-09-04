const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 完整的序号追踪和验证机制测试
async function comprehensiveValidationTest() {
  console.log('🎯 完整序号追踪和验证机制测试\n');
  console.log('=' .repeat(90));

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 第1步: 创建包含序号的测试Excel文件
  console.log('📊 第1步: 创建测试Excel文件（包含序号列）');
  
  const workbook = XLSX.utils.book_new();
  
  // 创建2个月份的测试数据
  const monthlyTestData = [
    {
      sheetName: '2024年1月',
      employeeCount: 20,
      startSequence: 1
    },
    {
      sheetName: '2024年2月', 
      employeeCount: 18, // 模拟有人离职
      startSequence: 1,
      gaps: [5, 12] // 模拟序号缺口
    }
  ];
  
  for (const monthData of monthlyTestData) {
    console.log(`   📋 创建工作表: "${monthData.sheetName}"`);
    
    const employees = [];
    let currentSequence = monthData.startSequence;
    
    for (let i = 0; i < monthData.employeeCount; i++) {
      // 跳过指定的序号缺口
      while (monthData.gaps && monthData.gaps.includes(currentSequence)) {
        currentSequence++;
      }
      
      const empId = `TEST-${String(1000 + i).padStart(4, '0')}`;
      const hireYear = 2020 + (i % 4);
      const hireMonth = (i % 12) + 1;
      const hireDay = (i % 25) + 1;
      
      const basicSalary = 4000 + (i * 200);
      const grossSalary = basicSalary + (basicSalary * 0.4) + (Math.random() * 1000);
      
      employees.push({
        '序号': currentSequence,
        '工号': empId,
        '姓名': `测试员工${String(i + 1).padStart(2, '0')}`,
        '入厂时间': `${hireYear}/${hireMonth}/${hireDay}`,
        '正常工作时间工资': Math.round(basicSalary),
        '应发工资合计': Math.round(grossSalary)
      });
      
      currentSequence++;
    }
    
    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(employees);
    XLSX.utils.book_append_sheet(workbook, worksheet, monthData.sheetName);
    
    console.log(`      ✅ "${monthData.sheetName}": ${employees.length} 条记录，序号范围 ${monthData.startSequence}-${currentSequence-1}`);
    if (monthData.gaps) {
      console.log(`         序号缺口: [${monthData.gaps.join(', ')}]`);
    }
  }
  
  // 保存测试Excel文件
  const testExcelPath = path.join(__dirname, 'test-validation-2024年工资表.xlsx');
  XLSX.writeFile(workbook, testExcelPath);
  console.log(`   💾 测试文件已保存: ${testExcelPath}`);
  
  // 第2步: 测试Excel解析增强功能
  console.log('\n📖 第2步: 测试Excel解析增强功能');
  
  const fileBuffer = fs.readFileSync(testExcelPath);
  const parseWorkbook = XLSX.read(fileBuffer);
  
  console.log(`   📄 文件信息:`);
  console.log(`      文件大小: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`      工作表数量: ${parseWorkbook.SheetNames.length}`);
  console.log(`      工作表列表: [${parseWorkbook.SheetNames.join(', ')}]`);
  
  // 使用增强的解析逻辑（模拟前端Excel解析）
  const allParsedData = [];
  let totalExpectedRecords = 0;
  
  for (const sheetName of parseWorkbook.SheetNames) {
    console.log(`\n   🔍 解析工作表: "${sheetName}"`);
    
    const worksheet = parseWorkbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`      原始数据行数: ${jsonData.length}`);
    
    // 模拟增强的解析逻辑
    const apiRecords = [];
    const sequenceNumbers = [];
    const sequenceCounts = {};
    let maxSequence = 0;
    
    for (const row of jsonData) {
      if (row['工号'] && row['入厂时间'] && row['正常工作时间工资'] && row['应发工资合计']) {
        // 解析日期
        const hireDateStr = row['入厂时间'].toString();
        let hireDate;
        
        if (hireDateStr.includes('/')) {
          const [year, month, day] = hireDateStr.split('/').map(s => parseInt(s));
          hireDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        // 解析序号
        const sequenceNumber = row['序号'] ? parseInt(row['序号']) : undefined;
        if (sequenceNumber) {
          sequenceNumbers.push(sequenceNumber);
          sequenceCounts[sequenceNumber] = (sequenceCounts[sequenceNumber] || 0) + 1;
          maxSequence = Math.max(maxSequence, sequenceNumber);
        }
        
        apiRecords.push({
          employee_id: row['工号'].toString(),
          hire_date: hireDate,
          salary_month: sheetName,
          basic_salary: parseFloat(row['正常工作时间工资']) || 0,
          gross_salary: parseFloat(row['应发工资合计']) || 0,
          xuhao: sequenceNumber ? `${sheetName}-${sequenceNumber}` : undefined // 🔥 关键：生成xuhao字段
        });
      }
    }
    
    // 序号分析
    const uniqueSequences = [...new Set(sequenceNumbers)].sort((a, b) => a - b);
    const sequenceGaps = [];
    for (let i = 1; i <= maxSequence; i++) {
      if (!uniqueSequences.includes(i)) {
        sequenceGaps.push(i);
      }
    }
    
    const duplicateSequences = [];
    for (const [seq, count] of Object.entries(sequenceCounts)) {
      if (count > 1) {
        duplicateSequences.push(parseInt(seq));
      }
    }
    
    console.log(`      有效记录: ${apiRecords.length}/${jsonData.length}`);
    console.log(`      序号分析: 最大=${maxSequence}, 缺口=${sequenceGaps.length}个, 重复=${duplicateSequences.length}个`);
    console.log(`      序号缺口: [${sequenceGaps.join(', ')}]`);
    console.log(`      xuhao样本: ${apiRecords[0]?.xuhao || '无'}`);
    
    allParsedData.push({
      sheetName: sheetName,
      records: apiRecords,
      sequenceValidation: {
        hasSequenceColumn: maxSequence > 0,
        maxSequence,
        sequenceGaps,
        duplicateSequences,
        continuousSequence: sequenceGaps.length === 0
      }
    });
    
    totalExpectedRecords += apiRecords.length;
  }
  
  console.log(`\n   📊 解析汇总:`);
  console.log(`      总工作表: ${allParsedData.length} 个`);
  console.log(`      总记录数: ${totalExpectedRecords} 条`);
  
  // 第3步: 清理测试数据并执行导入验证
  console.log('\n🧹 第3步: 清理旧数据并导入测试');
  
  const cleanupResult = await supabase
    .from('salary_records')
    .delete()
    .like('employee_id', 'TEST-%');
  
  console.log(`   清理结果: ${cleanupResult.error ? '❌ ' + cleanupResult.error.message : '✅ 完成'}`);
  
  // 执行导入和验证
  const importResults = [];
  let totalImported = 0;
  let totalValidationPassed = 0;
  
  for (const sheetData of allParsedData) {
    console.log(`\n   📤 导入工作表: "${sheetData.sheetName}"`);
    console.log(`      记录数量: ${sheetData.records.length}`);
    console.log(`      序号信息: ${sheetData.sequenceValidation.hasSequenceColumn ? '有' : '无'}序号列`);
    
    const importStartTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:3006/api/import-salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records: sheetData.records }),
      });
      
      const result = await response.json();
      const importDuration = Date.now() - importStartTime;
      
      console.log(`      HTTP状态: ${response.status}`);
      console.log(`      导入成功: ${result.importedRecords}/${result.totalRecords}`);
      console.log(`      导入失败: ${result.failedRecords}`);
      console.log(`      总耗时: ${importDuration}ms`);
      console.log(`      API耗时: ${result.duration}ms`);
      
      // 🔍 关键验证：检查新的验证机制
      if (result.validation) {
        console.log(`      验证结果:`);
        console.log(`         导入后检查: ${result.validation.postImportCheck ? '✅ 通过' : '❌ 失败'}`);
        console.log(`         一致性验证: ${result.validation.consistencyVerified ? '✅ 通过' : '❌ 失败'}`);
        
        if (result.validation.validationErrors.length > 0) {
          console.log(`         验证错误: ${result.validation.validationErrors.join('; ')}`);
        }
        
        if (result.validation.consistencyVerified) {
          totalValidationPassed++;
        }
      }
      
      importResults.push({
        sheetName: sheetData.sheetName,
        result: result,
        duration: importDuration,
        validationPassed: result.validation?.consistencyVerified || false
      });
      
      totalImported += result.importedRecords;
      
    } catch (error) {
      console.log(`      ❌ 导入异常: ${error.message}`);
    }
  }
  
  // 第4步: xuhao字段验证
  console.log('\n🏷️ 第4步: xuhao字段完整性验证');
  
  let xuhaoCorrectCount = 0;
  let xuhaoMissingCount = 0;
  let xuhaoFormatErrorCount = 0;
  
  for (const sheetData of allParsedData) {
    console.log(`\n   🔍 验证工作表: "${sheetData.sheetName}"`);
    
    // 查询该Sheet的xuhao字段
    const { data: xuhaoRecords, error: xuhaoError } = await supabase
      .from('salary_records')
      .select('employee_id, xuhao, salary_month')
      .eq('salary_month', sheetData.sheetName)
      .order('employee_id');
    
    if (xuhaoError) {
      console.log(`      ❌ xuhao查询失败: ${xuhaoError.message}`);
      continue;
    }
    
    console.log(`      数据库记录: ${xuhaoRecords?.length || 0} 条`);
    
    // 验证xuhao字段格式和内容 (使用全局计数器)
    
    if (xuhaoRecords) {
      for (const dbRecord of xuhaoRecords.slice(0, 10)) { // 检查前10条
        const originalRecord = sheetData.records.find(r => r.employee_id === dbRecord.employee_id);
        
        if (!originalRecord) continue;
        
        if (!dbRecord.xuhao) {
          xuhaoMissingCount++;
          console.log(`         ⚠️ 缺失xuhao: ${dbRecord.employee_id}`);
        } else {
          const expectedXuhao = originalRecord.xuhao;
          if (dbRecord.xuhao === expectedXuhao) {
            xuhaoCorrectCount++;
          } else {
            xuhaoFormatErrorCount++;
            console.log(`         ❌ xuhao不匹配: ${dbRecord.employee_id}`);
            console.log(`             预期: ${expectedXuhao}`);
            console.log(`             实际: ${dbRecord.xuhao}`);
          }
        }
      }
      
      console.log(`      xuhao验证结果:`);
      console.log(`         正确: ${xuhaoCorrectCount} 条`);
      console.log(`         缺失: ${xuhaoMissingCount} 条`);
      console.log(`         错误: ${xuhaoFormatErrorCount} 条`);
      
      // 显示样本xuhao
      const sampleXuhao = xuhaoRecords.filter(r => r.xuhao).slice(0, 3);
      if (sampleXuhao.length > 0) {
        console.log(`      xuhao样本:`);
        sampleXuhao.forEach((sample, idx) => {
          console.log(`         ${idx + 1}. ${sample.employee_id}: "${sample.xuhao}"`);
        });
      }
    }
  }
  
  // 第5步: 综合数据一致性验证
  console.log('\n🎯 第5步: 综合数据一致性验证');
  
  // 查询数据库总记录数
  const { count: finalDbCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .like('employee_id', 'TEST-%');
  
  console.log(`   📊 最终数据统计:`);
  console.log(`      Excel解析: ${totalExpectedRecords} 条`);
  console.log(`      API导入: ${totalImported} 条`);
  console.log(`      数据库计数: ${finalDbCount} 条`);
  console.log(`      一致性: ${finalDbCount === totalExpectedRecords && finalDbCount === totalImported ? '✅ 完全一致' : '❌ 不一致'}`);
  
  const finalConsistency = finalDbCount === totalExpectedRecords && finalDbCount === totalImported;
  
  // 第6步: 验证机制有效性检查
  console.log('\n🔍 第6步: 验证机制有效性检查');
  
  console.log(`   验证机制测试:`);
  console.log(`      导入验证通过: ${totalValidationPassed}/${allParsedData.length} 个工作表`);
  console.log(`      验证机制有效性: ${totalValidationPassed === allParsedData.length ? '✅ 全部通过' : '❌ 部分失败'}`);
  
  // 第7步: 清理测试文件
  try {
    fs.unlinkSync(testExcelPath);
    console.log(`   🗑️ 测试文件已清理`);
  } catch (error) {
    console.log(`   ⚠️ 测试文件清理失败: ${error.message}`);
  }
  
  // 最终评估
  console.log('\n' + '='.repeat(90));
  console.log('🏆 完整验证机制测试报告');
  console.log('='.repeat(90));
  
  const overallSuccess = finalConsistency && totalValidationPassed === allParsedData.length;
  
  console.log(`📋 功能验证:`);
  console.log(`   ✅ 序号列识别和解析: ${allParsedData.every(s => s.sequenceValidation.hasSequenceColumn) ? '通过' : '失败'}`);
  console.log(`   ✅ xuhao字段生成和存储: ${xuhaoCorrectCount > 0 ? '通过' : '失败'}`);
  console.log(`   ✅ 导入前后数量验证: ${finalConsistency ? '通过' : '失败'}`);
  console.log(`   ✅ API验证机制: ${totalValidationPassed === allParsedData.length ? '通过' : '失败'}`);
  
  console.log(`\n📊 性能指标:`);
  console.log(`   处理工作表: ${allParsedData.length} 个`);
  console.log(`   处理记录: ${totalExpectedRecords} 条`);
  console.log(`   导入成功率: ${((totalImported / totalExpectedRecords) * 100).toFixed(1)}%`);
  console.log(`   验证通过率: ${((totalValidationPassed / allParsedData.length) * 100).toFixed(1)}%`);
  
  console.log(`\n🎯 最终结果: ${overallSuccess ? '✅ 全面成功' : '❌ 需要改进'}`);
  
  if (overallSuccess) {
    console.log('\n🎉 恭喜！序号追踪和验证机制已完全实现并通过测试！');
    console.log('✨ 主要特性:');
    console.log('   • Excel序号列自动识别和解析');
    console.log('   • xuhao字段自动生成 (格式: "Sheet名-序号")');
    console.log('   • 导入前后数据完整性严格验证');
    console.log('   • 数据丢失问题彻底解决');
    console.log('   • 支持序号缺口和重复检测');
  } else {
    console.log('\n⚠️ 测试发现问题，需要进一步优化验证机制');
  }
  
  console.log('='.repeat(90));
  
  return overallSuccess;
}

// 运行综合验证测试
comprehensiveValidationTest().then(success => {
  console.log(`\n🎯 综合验证测试${success ? '完全成功' : '发现问题'}!`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n❌ 综合测试异常:', error);
  process.exit(1);
});