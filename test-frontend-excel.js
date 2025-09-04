// 测试前端Excel解析功能
const fs = require('fs');
const path = require('path');

// 模拟浏览器File对象
class MockFile {
  constructor(buffer, name, options = {}) {
    this.buffer = buffer;
    this.name = name;
    this.type = options.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    this.size = buffer.length;
  }

  arrayBuffer() {
    return Promise.resolve(this.buffer);
  }
}

// 模拟全局File构造函数
global.File = MockFile;

async function testFrontendExcel() {
  console.log('🖥️ 测试前端Excel解析功能...\n');

  try {
    // 动态导入TypeScript模块
    const { parseExcelFile, validateExcelFile } = await import('./src/lib/excel.ts');
    
    // 读取测试文件
    const testFilePath = path.join(__dirname, '数据', 'test file.xlsx');
    const fileBuffer = fs.readFileSync(testFilePath);
    const file = new MockFile(fileBuffer, 'test file.xlsx');

    console.log(`📁 文件信息: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    // 验证文件
    const validation = validateExcelFile(file);
    console.log(`📋 文件验证: ${validation.valid ? '✅ 通过' : '❌ 失败'}`);
    if (!validation.valid) {
      console.log(`   错误: ${validation.error}`);
      return false;
    }

    // 解析文件
    console.log('📊 开始解析Excel文件...');
    const parseResult = await parseExcelFile(file);
    
    console.log(`✅ 解析成功!`);
    console.log(`📄 文件名: ${parseResult.fileName}`);
    console.log(`📅 年份: ${parseResult.year}`);
    console.log(`📊 工作表数: ${parseResult.sheets.length}`);

    // 显示每个工作表的详细信息
    parseResult.sheets.forEach((sheet, index) => {
      console.log(`\n📋 工作表 ${index + 1}: ${sheet.sheetName}`);
      console.log(`   📅 工资月份: ${sheet.salaryMonth.toISOString().split('T')[0]}`);
      console.log(`   📈 记录数: ${sheet.records.length}`);
      
      if (sheet.stats) {
        console.log(`   📊 统计: 总行数=${sheet.stats.totalRows}, 有效=${sheet.stats.validRecords}, 错误=${sheet.stats.errorRows}`);
      }

      // 显示前3条记录
      sheet.records.slice(0, 3).forEach((record, i) => {
        console.log(`   👤 记录${i+1}: ${record.employeeId} | 入职: ${record.hireDate.toISOString().split('T')[0]} | 基本: ¥${record.basicSalary} | 应发: ¥${record.grossSalary}`);
      });
    });

    // 验证日期是否正确
    const hasDateIssues = parseResult.sheets.some(sheet => 
      sheet.records.some(record => {
        const hireYear = record.hireDate.getFullYear();
        return hireYear < 2000 || hireYear > 2025; // 检查异常年份
      })
    );

    console.log(`\n🔍 日期验证: ${hasDateIssues ? '❌ 发现异常日期' : '✅ 日期正常'}`);

    // 验证工资月份是否正确
    const correctSalaryMonth = parseResult.sheets.every(sheet => {
      const monthStr = sheet.salaryMonth.toISOString().split('T')[0];
      return monthStr.endsWith('-01'); // 应该是月份的第一天
    });

    console.log(`📅 工资月份验证: ${correctSalaryMonth ? '✅ 正确' : '❌ 错误'}`);

    console.log('\n🎯 前端解析测试结果:');
    const success = validation.valid && parseResult.sheets.length > 0 && !hasDateIssues && correctSalaryMonth;
    console.log(`总体状态: ${success ? '✅ 完全正常' : '❌ 存在问题'}`);

    return success;

  } catch (error) {
    console.error('❌ 前端测试失败:', error);
    return false;
  }
}

testFrontendExcel().then(success => {
  console.log(`\n🏁 前端测试${success ? '成功' : '失败'}`);
  process.exit(success ? 0 : 1);
});