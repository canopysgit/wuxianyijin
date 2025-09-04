const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 数据丢失分析系统
async function analyzeDataLoss() {
  console.log('🔍 数据丢失深度分析系统\n');
  console.log('=' .repeat(80));

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 第1步: 分析原始Excel文件
  console.log('📊 第1步: 分析原始Excel文件');
  
  const excelFile = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  
  if (!fs.existsSync(excelFile)) {
    console.error('❌ 原始Excel文件不存在');
    return false;
  }
  
  console.log(`   📄 文件路径: ${excelFile}`);
  console.log(`   📦 文件大小: ${(fs.statSync(excelFile).size / 1024 / 1024).toFixed(2)} MB`);
  
  const workbook = XLSX.readFile(excelFile);
  const sheetNames = workbook.SheetNames;
  
  console.log(`   📋 工作表数量: ${sheetNames.length}`);
  console.log(`   📋 工作表列表: [${sheetNames.join(', ')}]`);
  
  // 分析每个工作表的原始数据
  const originalSheetData = [];
  let totalOriginalRecords = 0;
  
  for (const sheetName of sheetNames) {
    console.log(`\n   🔍 分析工作表: "${sheetName}"`);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`      总行数: ${jsonData.length}`);
    
    // 查找表头行
    let headerRow = null;
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.toString().includes('工号'))) {
        headerRow = row;
        headerIndex = i;
        break;
      }
    }
    
    if (!headerRow) {
      console.log(`      ❌ 未找到表头行`);
      continue;
    }
    
    console.log(`      表头位置: 第${headerIndex + 1}行`);
    
    // 查找关键列
    const colMapping = {
      sequenceNumber: headerRow.findIndex(h => h && h.toString().includes('序号')),
      employeeId: headerRow.findIndex(h => h && h.toString().includes('工号')),
      hireDate: headerRow.findIndex(h => h && h.toString().includes('入厂时间')),
      basicSalary: headerRow.findIndex(h => h && h.toString().includes('正常工作时间工资')),
      grossSalary: headerRow.findIndex(h => h && h.toString().includes('应发工资合计'))
    };
    
    console.log(`      列映射: 序号=${colMapping.sequenceNumber}, 工号=${colMapping.employeeId}, 入厂=${colMapping.hireDate}, 基本=${colMapping.basicSalary}, 应发=${colMapping.grossSalary}`);
    
    // 分析数据行
    const dataRows = jsonData.slice(headerIndex + 1);
    console.log(`      数据行总数: ${dataRows.length}`);
    
    // 统计有效记录
    let validRecords = 0;
    let emptyRows = 0;
    let invalidRows = 0;
    const sequenceNumbers = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // 检查是否是空行
      const hasData = row.some(cell => cell && cell.toString().trim() !== '');
      if (!hasData) {
        emptyRows++;
        continue;
      }
      
      // 检查关键字段
      const employeeId = row[colMapping.employeeId];
      const hireDate = row[colMapping.hireDate];
      const basicSalary = row[colMapping.basicSalary];
      const grossSalary = row[colMapping.grossSalary];
      const sequenceNumber = row[colMapping.sequenceNumber];
      
      if (employeeId && hireDate && basicSalary !== undefined && grossSalary !== undefined) {
        validRecords++;
        if (sequenceNumber) {
          sequenceNumbers.push(parseInt(sequenceNumber) || 0);
        }
      } else {
        invalidRows++;
        if (i < 5) { // 显示前5个无效行的详情
          console.log(`         无效行${i+1}: 工号=${employeeId || '缺失'}, 入厂=${hireDate || '缺失'}, 基本=${basicSalary || '缺失'}, 应发=${grossSalary || '缺失'}`);
        }
      }
    }
    
    // 序号分析
    let maxSequence = 0;
    let sequenceGaps = [];
    if (sequenceNumbers.length > 0) {
      maxSequence = Math.max(...sequenceNumbers);
      const sortedSequences = [...new Set(sequenceNumbers)].sort((a, b) => a - b);
      
      for (let i = 1; i <= maxSequence; i++) {
        if (!sortedSequences.includes(i)) {
          sequenceGaps.push(i);
        }
      }
    }
    
    console.log(`      有效记录: ${validRecords}`);
    console.log(`      空行: ${emptyRows}`);
    console.log(`      无效行: ${invalidRows}`);
    console.log(`      最大序号: ${maxSequence}`);
    console.log(`      序号缺口: ${sequenceGaps.length > 0 ? sequenceGaps.slice(0, 10).join(', ') + (sequenceGaps.length > 10 ? '...' : '') : '无'}`);
    
    originalSheetData.push({
      sheetName,
      totalRows: dataRows.length,
      validRecords,
      emptyRows,
      invalidRows,
      maxSequence,
      sequenceGaps: sequenceGaps.length,
      colMapping
    });
    
    totalOriginalRecords += validRecords;
  }
  
  console.log(`\n📊 原始数据汇总:`);
  console.log(`   总工作表: ${originalSheetData.length}`);
  console.log(`   总有效记录: ${totalOriginalRecords}`);
  console.log(`   前端显示: 2688 条`);
  console.log(`   差异: ${totalOriginalRecords - 2688} 条`);
  
  // 第2步: 分析当前数据库状态
  console.log('\n🗄️ 第2步: 分析当前数据库状态');
  
  const { count: dbTotalCount } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   数据库总记录: ${dbTotalCount}`);
  
  // 按salary_month分组统计
  const { data: monthlyData } = await supabase
    .from('salary_records')
    .select('salary_month')
    .order('salary_month');
  
  const monthCounts = {};
  monthlyData?.forEach(record => {
    monthCounts[record.salary_month] = (monthCounts[record.salary_month] || 0) + 1;
  });
  
  console.log(`\n   📅 按月份统计 (数据库中):`);
  Object.entries(monthCounts).forEach(([month, count]) => {
    console.log(`      "${month}": ${count} 条`);
  });
  
  // 第3步: 对比分析找出丢失数据
  console.log('\n🔍 第3步: 对比分析找出丢失的记录');
  
  console.log(`   📊 数据流失分析:`);
  console.log(`      Excel原始: ${totalOriginalRecords} 条`);
  console.log(`      前端显示: 2688 条`);
  console.log(`      数据库实际: ${dbTotalCount} 条`);
  console.log(`      前端→数据库流失: ${2688 - dbTotalCount} 条`);
  console.log(`      Excel→前端差异: ${totalOriginalRecords - 2688} 条`);
  
  // 按工作表对比
  console.log(`\n   📋 分工作表对比分析:`);
  
  let identifiedLoss = 0;
  
  for (const sheetInfo of originalSheetData) {
    // 查找数据库中对应的记录数
    const dbSheetCount = monthCounts[sheetInfo.sheetName] || 0;
    const originalCount = sheetInfo.validRecords;
    const loss = originalCount - dbSheetCount;
    
    console.log(`      "${sheetInfo.sheetName}":`);
    console.log(`         Excel原始: ${originalCount} 条`);
    console.log(`         数据库: ${dbSheetCount} 条`);
    console.log(`         流失: ${loss} 条 ${loss > 0 ? '❌' : '✅'}`);
    
    if (loss > 0) {
      console.log(`         序号信息: 最大=${sheetInfo.maxSequence}, 缺口=${sheetInfo.sequenceGaps}个`);
      console.log(`         数据质量: 空行=${sheetInfo.emptyRows}, 无效=${sheetInfo.invalidRows}`);
      identifiedLoss += loss;
    }
  }
  
  console.log(`\n   💡 流失记录分析:`);
  console.log(`      已识别流失: ${identifiedLoss} 条`);
  console.log(`      预期流失: ${2688 - dbTotalCount} 条`);
  console.log(`      分析准确性: ${identifiedLoss === (2688 - dbTotalCount) ? '✅ 完全匹配' : '⚠️ 需进一步调查'}`);
  
  // 第4步: 检查具体的丢失记录
  console.log('\n🎯 第4步: 检查具体的丢失记录');
  
  // 找出丢失最多的工作表
  const lossAnalysis = originalSheetData
    .map(sheet => ({
      sheetName: sheet.sheetName,
      originalCount: sheet.validRecords,
      dbCount: monthCounts[sheet.sheetName] || 0,
      loss: sheet.validRecords - (monthCounts[sheet.sheetName] || 0)
    }))
    .filter(sheet => sheet.loss > 0)
    .sort((a, b) => b.loss - a.loss);
  
  console.log(`   📉 数据流失排行 (前5个):`);
  lossAnalysis.slice(0, 5).forEach((sheet, index) => {
    console.log(`      ${index + 1}. "${sheet.sheetName}": 流失 ${sheet.loss} 条 (${sheet.originalCount}→${sheet.dbCount})`);
  });
  
  // 如果有显著流失，进一步分析
  if (lossAnalysis.length > 0) {
    const topLossSheet = lossAnalysis[0];
    console.log(`\n   🔬 深入分析最严重流失工作表: "${topLossSheet.sheetName}"`);
    
    // 获取该Sheet的数据库记录
    const { data: dbRecords } = await supabase
      .from('salary_records')
      .select('employee_id, hire_date, salary_month, basic_salary, gross_salary')
      .eq('salary_month', topLossSheet.sheetName)
      .order('employee_id');
    
    console.log(`      数据库记录: ${dbRecords?.length || 0} 条`);
    
    if (dbRecords && dbRecords.length > 0) {
      console.log(`      记录样本:`);
      dbRecords.slice(0, 3).forEach((record, i) => {
        console.log(`         ${i+1}. ${record.employee_id} | ${record.hire_date} | ¥${record.basic_salary} | ¥${record.gross_salary}`);
      });
    }
    
    // 重新解析该工作表查看原始数据
    const worksheet = workbook.Sheets[topLossSheet.sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // 查找表头
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i];
      if (row.some(cell => cell && cell.toString().includes('工号'))) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex >= 0) {
      const headerRow = jsonData[headerIndex];
      const colMapping = {
        sequenceNumber: headerRow.findIndex(h => h && h.toString().includes('序号')),
        employeeId: headerRow.findIndex(h => h && h.toString().includes('工号')),
        hireDate: headerRow.findIndex(h => h && h.toString().includes('入厂时间')),
        basicSalary: headerRow.findIndex(h => h && h.toString().includes('正常工作时间工资')),
        grossSalary: headerRow.findIndex(h => h && h.toString().includes('应发工资合计'))
      };
      
      console.log(`\n      🔬 原始数据重新解析:`);
      const dataRows = jsonData.slice(headerIndex + 1);
      
      let validCount = 0;
      let problemRows = [];
      
      for (let i = 0; i < Math.min(dataRows.length, 50); i++) { // 分析前50行
        const row = dataRows[i];
        
        const employeeId = row[colMapping.employeeId];
        const hireDate = row[colMapping.hireDate];
        const basicSalary = row[colMapping.basicSalary];
        const grossSalary = row[colMapping.grossSalary];
        const sequenceNumber = row[colMapping.sequenceNumber];
        
        if (employeeId && hireDate && basicSalary !== undefined && grossSalary !== undefined) {
          validCount++;
          
          // 检查该记录是否在数据库中
          const dbRecord = dbRecords?.find(db => db.employee_id === employeeId.toString());
          if (!dbRecord) {
            problemRows.push({
              rowIndex: i + headerIndex + 2, // Excel行号 (1-based + header)
              sequenceNumber,
              employeeId: employeeId.toString(),
              hireDate,
              basicSalary,
              grossSalary,
              issue: '数据库中缺失'
            });
          }
        } else {
          problemRows.push({
            rowIndex: i + headerIndex + 2,
            sequenceNumber,
            employeeId: employeeId?.toString() || '缺失',
            issue: '数据不完整'
          });
        }
      }
      
      console.log(`      分析记录: ${Math.min(dataRows.length, 50)} 条`);
      console.log(`      有效记录: ${validCount} 条`);
      console.log(`      问题记录: ${problemRows.length} 条`);
      
      if (problemRows.length > 0) {
        console.log(`\n      🚨 问题记录详情 (前10个):`);
        problemRows.slice(0, 10).forEach((problem, idx) => {
          console.log(`         ${idx+1}. 行${problem.rowIndex}: ${problem.employeeId} | 序号=${problem.sequenceNumber} | 问题: ${problem.issue}`);
        });
      }
    }
  }
  
  // 第5步: 分析可能的原因
  console.log('\n💡 第5步: 分析可能的数据流失原因');
  
  const lossReasons = [
    '🔍 Excel解析阶段数据过滤过于严格',
    '🔍 API批量导入过程中部分记录被忽略',
    '🔍 数据库唯一约束导致重复记录被拒绝',
    '🔍 日期格式问题导致部分记录解析失败',
    '🔍 工资数值格式问题导致验证失败',
    '🔍 批量处理过程中的并发问题',
    '🔍 内存不足导致大文件处理丢失数据'
  ];
  
  console.log('   可能原因分析:');
  lossReasons.forEach((reason, index) => {
    console.log(`      ${index + 1}. ${reason}`);
  });
  
  // 第6步: 生成修复建议
  console.log('\n🛠️ 第6步: 修复建议');
  
  const fixSuggestions = [
    '增强Excel解析日志，记录每行的处理结果',
    '实现导入前后记录数量严格验证',
    '添加失败记录的详细错误信息收集',
    '实现分批导入时的数量跟踪',
    '添加序号连续性验证机制',
    '创建数据恢复和重试机制'
  ];
  
  console.log('   修复策略:');
  fixSuggestions.forEach((suggestion, index) => {
    console.log(`      ${index + 1}. ${suggestion}`);
  });
  
  // 最终报告
  console.log('\n' + '='.repeat(80));
  console.log('📊 数据丢失分析报告');
  console.log('='.repeat(80));
  
  console.log(`原始Excel记录: ${totalOriginalRecords} 条`);
  console.log(`前端显示记录: 2688 条`);
  console.log(`数据库记录: ${dbTotalCount} 条`);
  console.log(`确认流失: ${2688 - dbTotalCount} 条`);
  console.log(`流失比例: ${(((2688 - dbTotalCount) / 2688) * 100).toFixed(2)}%`);
  
  console.log(`\n最严重流失: "${lossAnalysis[0]?.sheetName || '未知'}" (${lossAnalysis[0]?.loss || 0}条)`);
  console.log(`主要原因: 需要通过增强日志系统进一步确定`);
  console.log(`紧急程度: ${((2688 - dbTotalCount) / 2688) > 0.05 ? '🔴 高' : '🟡 中'}`);
  
  return {
    totalOriginal: totalOriginalRecords,
    frontendShown: 2688,
    databaseActual: dbTotalCount,
    confirmedLoss: 2688 - dbTotalCount,
    mostProblematicSheet: lossAnalysis[0]?.sheetName,
    needsDetailedLogging: true
  };
}

// 运行数据丢失分析
analyzeDataLoss().then(result => {
  if (result) {
    console.log(`\n🎯 分析完成！发现 ${result.confirmedLoss} 条记录流失，需要增强导入验证机制。`);
  }
  process.exit(0);
}).catch(error => {
  console.error('\n❌ 分析失败:', error);
  process.exit(1);
});