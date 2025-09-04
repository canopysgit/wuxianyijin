const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 分析2022年7月缺失数据
async function analyze2022July() {
  console.log('🔍 分析2022年7月缺失数据\n');
  console.log('=' .repeat(70));

  // Excel日期解析函数
  function excelDateToJSDate(excelDate) {
    const excelDateObj = XLSX.SSF.parse_date_code(excelDate);
    return new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
  }

  function parseDateValue(value) {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'number') {
      return excelDateToJSDate(value);
    }
    
    if (typeof value === 'string') {
      const dateStr = value.trim();
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
      
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    throw new Error(`无法解析日期值: ${value}`);
  }

  // 读取Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const targetSheet = '2022年7月';
  
  if (!workbook.SheetNames.includes(targetSheet)) {
    console.error('❌ 找不到工作表:', targetSheet);
    console.log('可用工作表:', workbook.SheetNames);
    return;
  }

  const worksheet = workbook.Sheets[targetSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📄 Excel原始数据:`);
  console.log(`   工作表: "${targetSheet}"`);
  console.log(`   总行数: ${jsonData.length}`);
  
  // 过滤有意义的数据
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`   有意义记录: ${meaningfulData.length} 条`);
  
  // 模拟完整解析过程
  const validRecords = [];
  const parseErrors = [];
  const duplicateEmployees = {};
  
  meaningfulData.forEach((row, index) => {
    const sequenceNumber = row['序号'];
    const employeeId = row['工号'];
    
    // 记录重复员工
    if (!duplicateEmployees[employeeId]) {
      duplicateEmployees[employeeId] = [];
    }
    duplicateEmployees[employeeId].push({
      序号: sequenceNumber,
      入厂时间: row['入厂时间'],
      基本工资: row['正常工作时间工资'],
      应发工资: row['应发工资合计']
    });
    
    try {
      const hireDate = parseDateValue(row['入厂时间']);
      const basicSalary = parseFloat(row['正常工作时间工资']) || 0;
      const grossSalary = parseFloat(row['应发工资合计']) || 0;
      
      // 基础验证
      if (basicSalary < 0 || grossSalary < 0) {
        throw new Error('工资不能为负数');
      }
      
      const currentDate = new Date();
      if (hireDate > currentDate) {
        throw new Error('入职日期不能是未来时间');
      }
      
      validRecords.push({
        sequenceNumber,
        employeeId,
        hireDate: hireDate.toISOString().split('T')[0],
        basicSalary,
        grossSalary,
        isSpecialCase: basicSalary > grossSalary
      });
      
    } catch (error) {
      parseErrors.push({
        序号: sequenceNumber,
        工号: employeeId,
        原始数据: {
          入厂时间: row['入厂时间'],
          基本工资: row['正常工作时间工资'],
          应发工资: row['应发工资合计']
        },
        错误原因: error.message
      });
    }
  });
  
  // 统计重复员工
  const duplicates = Object.entries(duplicateEmployees)
    .filter(([id, records]) => records.length > 1)
    .map(([id, records]) => ({ employeeId: id, records }));
  
  console.log(`\n📊 解析统计:`);
  console.log(`   成功解析: ${validRecords.length} 条`);
  console.log(`   解析错误: ${parseErrors.length} 条`);
  console.log(`   重复员工: ${duplicates.length} 个 (共${duplicates.reduce((sum, dup) => sum + dup.records.length, 0)}条记录)`);
  
  // 显示重复员工详情
  if (duplicates.length > 0) {
    console.log(`\n👥 重复员工详情:`);
    duplicates.forEach((dup, idx) => {
      console.log(`   ${idx + 1}. ${dup.employeeId} (${dup.records.length}条记录):`);
      dup.records.forEach((record, recordIdx) => {
        console.log(`      序号${record.序号}: 入厂时间${record.入厂时间} | ￥${record.基本工资}/￥${record.应发工资}`);
      });
    });
  }
  
  // 显示解析错误
  if (parseErrors.length > 0) {
    console.log(`\n❌ 解析错误详情:`);
    parseErrors.forEach((error, idx) => {
      console.log(`   ${idx + 1}. 序号${error.序号} | ${error.工号}`);
      console.log(`      入厂时间: "${error.原始数据.入厂时间}" (类型: ${typeof error.原始数据.入厂时间})`);
      console.log(`      错误: ${error.错误原因}`);
    });
  }
  
  // 查询数据库记录
  console.log(`\n🗄️ 查询数据库记录...`);
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { count: dbCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .eq('salary_month', '2022年7月');
  
  console.log(`   数据库记录: ${dbCount} 条`);
  console.log(`   Excel有意义记录: ${meaningfulData.length} 条`);
  console.log(`   解析成功记录: ${validRecords.length} 条`);
  
  // 计算预期的数据库记录数（去除重复后）
  const uniqueEmployees = Object.keys(duplicateEmployees).length;
  const expectedDbRecords = uniqueEmployees; // 每个员工只保留一条
  
  console.log(`   唯一员工数: ${uniqueEmployees} 个`);
  console.log(`   预期数据库记录: ${expectedDbRecords} 条`);
  console.log(`   实际差异: ${expectedDbRecords - (dbCount || 0)} 条`);
  
  // 如果差异不等于解析错误数，说明还有其他问题
  const unexplainedMissing = (expectedDbRecords - (dbCount || 0)) - parseErrors.length;
  
  if (unexplainedMissing > 0) {
    console.log(`\n⚠️ 未解释的缺失: ${unexplainedMissing} 条`);
    console.log(`   可能原因: API层或数据库层的其他验证/约束`);
    
    // 获取数据库中的所有序号，找出具体缺失的
    const { data: dbRecords } = await supabase
      .from('salary_records')
      .select('xuhao2, employee_id')
      .eq('salary_month', '2022年7月')
      .order('xuhao2');
    
    if (dbRecords) {
      const dbSequences = dbRecords.map(r => r.xuhao2).filter(x => x);
      const allExcelSequences = meaningfulData.map(r => r['序号']).filter(x => x);
      const missingSequences = allExcelSequences.filter(seq => !dbSequences.includes(seq));
      
      console.log(`   所有缺失序号: ${missingSequences.join(', ')}`);
      
      // 分析每个缺失序号的具体情况
      missingSequences.forEach(seq => {
        const excelRecord = meaningfulData.find(r => r['序号'] === seq);
        if (excelRecord) {
          const isDuplicate = duplicates.some(dup => 
            dup.records.some(r => r.序号 === seq)
          );
          const hasParseError = parseErrors.some(err => err.序号 === seq);
          
          let reason = '未知原因';
          if (isDuplicate) reason = '重复员工，被覆盖';
          else if (hasParseError) reason = '解析错误';
          
          console.log(`   序号${seq}: ${excelRecord['工号']} | ${reason}`);
        }
      });
    }
  } else {
    console.log(`\n✅ 缺失原因已明确:`);
    console.log(`   重复员工被覆盖: ${duplicates.reduce((sum, dup) => sum + (dup.records.length - 1), 0)} 条`);
    console.log(`   解析错误: ${parseErrors.length} 条`);
    console.log(`   总缺失: ${(expectedDbRecords - (dbCount || 0))} 条`);
  }
}

analyze2022July().catch(console.error);