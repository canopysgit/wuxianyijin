const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 实现Excel日期解析逻辑
function excelDateToJSDate(excelDate) {
  // Excel日期序列号转换，XLSX库内置转换
  const excelDateObj = XLSX.SSF.parse_date_code(excelDate);
  return new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
}

function parseDateValue(value) {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    // Excel日期序列号
    return excelDateToJSDate(value);
  }
  
  if (typeof value === 'string') {
    const dateStr = value.trim();
    
    // 支持格式：YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
    const patterns = [
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
      /^(\d{4})年(\d{1,2})月(\d{1,2})日$/
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        return new Date(Date.UTC(year, month, day));
      }
    }
    
    // 最后尝试原生Date解析
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  throw new Error(`无法解析日期值: ${value}`);
}

// 真实Excel解析测试
async function realExcelParsingTest() {
  console.log('🔧 真实Excel解析测试 - 完整流程\n');
  console.log('=' .repeat(70));

  // 读取真实Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Excel文件不存在:', excelPath);
    return false;
  }

  console.log('📄 使用真实Excel解析逻辑...');
  console.log(`   文件路径: ${excelPath}`);
  
  try {
    // 读取文件为Buffer (模拟前端上传)
    const fileBuffer = fs.readFileSync(excelPath);
    const fileName = '2022年工资表汇总-脱敏 数值版.xlsx';
    
    console.log(`   文件大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // 手动解析Excel (模拟parseExcelFile逻辑)
    const workbook = XLSX.read(fileBuffer);
    const targetSheet = '2022年1月';
    
    if (!workbook.SheetNames.includes(targetSheet)) {
      throw new Error(`找不到工作表: ${targetSheet}`);
    }
    
    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // 过滤和转换数据
    const records = [];
    const errors = [];
    
    jsonData.forEach((row, index) => {
      const employeeId = row['工号'];
      if (!employeeId || employeeId.toString().trim() === '') {
        return; // 跳过空行
      }
      
      try {
        const hireDate = parseDateValue(row['入厂时间']);
        const basicSalary = parseFloat(row['正常工作时间工资']) || 0;
        const grossSalary = parseFloat(row['应发工资合计']) || 0;
        const sequenceNumber = row['序号'];
        
        // 简单验证
        if (basicSalary < 0 || grossSalary < 0) {
          throw new Error('工资不能为负数');
        }
        
        records.push({
          employeeId: employeeId.toString(),
          hireDate,
          basicSalary,
          grossSalary,
          sequenceNumber
        });
        
      } catch (error) {
        errors.push({
          row: index + 1,
          employeeId: employeeId,
          error: error.message
        });
      }
    });
    
    const parseResult = {
      fileName,
      year: 2022,
      sheets: [{
        sheetName: targetSheet,
        salaryMonth: new Date(2022, 0, 1), // 2022年1月
        records
      }]
    };
    
    console.log(`\n📊 解析结果统计:`);
    console.log(`   文件名: ${parseResult.fileName}`);
    console.log(`   解析年份: ${parseResult.year}`);
    console.log(`   工作表数量: ${parseResult.sheets.length}`);
    
    // 查找2022年1月的数据
    const jan2022Sheet = parseResult.sheets.find(sheet => sheet.sheetName === '2022年1月');
    
    if (!jan2022Sheet) {
      console.error('❌ 找不到2022年1月工作表');
      return false;
    }
    
    console.log(`\n📅 2022年1月解析详情:`);
    console.log(`   工作表名: "${jan2022Sheet.sheetName}"`);
    console.log(`   解析记录: ${jan2022Sheet.records.length} 条`);
    console.log(`   工资月份: ${jan2022Sheet.salaryMonth.toISOString().split('T')[0]}`);
    
    // 检查之前有问题的序号
    const problemSequences = [37, 71, 85, 90, 115, 132, 145, 147, 148, 152, 166];
    console.log(`\n🔍 检查问题序号记录:`);
    
    problemSequences.forEach(seqNum => {
      const record = jan2022Sheet.records.find(r => r.sequenceNumber === seqNum);
      if (record) {
        console.log(`   ✅ 序号${seqNum}: ${record.employeeId} | ${record.hireDate.toISOString().split('T')[0]} | ￥${record.basicSalary}/￥${record.grossSalary}`);
      } else {
        console.log(`   ❌ 序号${seqNum}: 未找到记录`);
      }
    });
    
    // 清理旧数据
    console.log('\n🧹 清理旧的2022年1月数据...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    await supabase.from('salary_records').delete().eq('salary_month', '2022年1月');
    
    // 使用database.ts的导入逻辑
    console.log('\n📤 使用标准导入逻辑...');
    
    const { importSalaryRecords } = require('./src/lib/database.ts');
    const importResult = await importSalaryRecords(jan2022Sheet.records, jan2022Sheet.sheetName);
    
    console.log(`📊 导入结果:`);
    console.log(`   导入成功: ${importResult.success ? '✅' : '❌'}`);
    console.log(`   总记录数: ${importResult.totalRecords}`);
    console.log(`   成功导入: ${importResult.importedRecords}`);
    console.log(`   失败记录: ${importResult.failedRecords}`);
    console.log(`   处理耗时: ${importResult.duration}ms`);
    
    if (importResult.postValidation) {
      console.log(`   验证结果: ${importResult.postValidation.consistencyCheck ? '✅' : '❌'}`);
      if (importResult.postValidation.validationErrors.length > 0) {
        console.log(`   验证错误: ${importResult.postValidation.validationErrors.join('; ')}`);
      }
    }
    
    // 验证关键序号
    console.log('\n🏷️ 验证关键序号导入...');
    
    const { data: keyRecords } = await supabase
      .from('salary_records')
      .select('employee_id, xuhao2, basic_salary, gross_salary')
      .eq('salary_month', '2022年1月')
      .in('xuhao2', problemSequences)
      .order('xuhao2');
    
    if (keyRecords) {
      console.log(`   关键序号导入情况:`);
      problemSequences.forEach(seqNum => {
        const dbRecord = keyRecords.find(r => r.xuhao2 === seqNum);
        if (dbRecord) {
          const isSpecialCase = dbRecord.basic_salary > dbRecord.gross_salary;
          console.log(`   ✅ 序号${seqNum}: ${dbRecord.employee_id} | ￥${dbRecord.basic_salary}/￥${dbRecord.gross_salary} ${isSpecialCase ? '(特殊情况)' : ''}`);
        } else {
          console.log(`   ❌ 序号${seqNum}: 数据库中未找到`);
        }
      });
    }
    
    // 最终完整性检查
    const { count: finalCount } = await supabase
      .from('salary_records')
      .select('*', { count: 'exact', head: true })
      .eq('salary_month', '2022年1月');
    
    const completeSuccess = finalCount === jan2022Sheet.records.length;
    
    console.log('\n🎯 最终完整性检查:');
    console.log(`   Excel解析记录: ${jan2022Sheet.records.length} 条`);
    console.log(`   数据库保存记录: ${finalCount} 条`);
    console.log(`   完整性验证: ${completeSuccess ? '✅ 100%完整' : `❌ 缺失${jan2022Sheet.records.length - (finalCount || 0)}条`}`);
    
    return completeSuccess;
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error('详细错误:', error);
    return false;
  }
}

// 运行真实Excel解析测试
realExcelParsingTest().then(success => {
  console.log(`\n${success ? '🎉 Excel解析和导入完全成功！' : '⚠️ 仍有问题需要解决'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试异常:', error);
  process.exit(1);
});