const XLSX = require('xlsx');

// 导入修复后的解析函数
function excelDateToJSDate(excelDate) {
  // 使用UTC时间避免时区偏移问题
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  // Excel epoch: 1899年12月30日 (UTC)
  const excelEpochUTC = Date.UTC(1899, 11, 30);
  const resultUTC = excelEpochUTC + excelDate * millisecondsPerDay;
  
  // 创建UTC日期，然后转为本地日期但保持日期不变
  const utcDate = new Date(resultUTC);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

function parseDateValue(value) {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    // Excel日期序列号 - 使用修复后的函数
    return excelDateToJSDate(value);
  }
  
  if (typeof value === 'string') {
    const dateStr = value.trim();
    
    // 支持格式：YYYY/MM/DD
    const match = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JS月份从0开始
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    
    // 最后尝试原生解析
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  throw new Error(`无法解析日期值: ${value}`);
}

function parseNumberValue(value) {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const numStr = value.trim().replace(/,/g, '');
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  if (value === null || value === undefined || value === '') {
    return 0; // 空值默认为0
  }
  
  throw new Error(`无法解析数值: ${value}`);
}

function extractMonthFromSheetName(sheetName) {
  const match = sheetName.match(/(\d{4})年(\d{1,2})月/);
  if (!match) {
    throw new Error(`无法从工作表名称 "${sheetName}" 中提取年月信息`);
  }
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  
  if (month < 1 || month > 12) {
    throw new Error(`工作表 "${sheetName}" 中的月份 ${month} 不合法`);
  }
  
  return { year, month };
}

function findHeaderRow(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  
  const expectedColumns = {
    sequenceNumber: ['序号'],
    employeeId: ['工号'],
    hireDate: ['入厂时间'], 
    basicSalary: ['正常工作时间工资'],
    grossSalary: ['应发工资合计']
  };
  
  // 只检查第一行（表头）
  const row = 0;
  const columnMap = {};
  let foundColumns = 0;
  
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = worksheet[cellRef];
    
    if (cell && cell.v) {
      const cellValue = cell.v.toString().trim();
      const columnLetter = XLSX.utils.encode_col(col);
      
      // 检查是否匹配预期列名
      for (const [key, patterns] of Object.entries(expectedColumns)) {
        if (patterns.some(pattern => cellValue === pattern)) {
          columnMap[key] = columnLetter;
          foundColumns++;
          break;
        }
      }
    }
  }
  
  const requiredColumns = ['employeeId', 'hireDate', 'basicSalary', 'grossSalary'];
  const foundRequired = requiredColumns.filter(col => columnMap[col]).length;
  
  if (foundRequired >= 4) {
    return { headerRow: row, columnMap };
  }
  
  throw new Error(`未找到所有必需的列，只找到 ${foundRequired}/4 列`);
}

// 测试修复后的解析功能
function testFixedParsing() {
  console.log('🧪 测试修复后的Excel解析功能...\n');
  
  const testFile = '数据/8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx';
  const workbook = XLSX.readFile(testFile);
  const sheetName = '2022年12月';
  const worksheet = workbook.Sheets[sheetName];
  
  try {
    console.log(`📋 解析工作表: ${sheetName}`);
    
    // 查找表头
    const { headerRow, columnMap } = findHeaderRow(worksheet);
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    console.log(`   📊 数据范围: ${worksheet['!ref']}`);
    console.log(`   📍 表头行: ${headerRow + 1}`);
    console.log(`   📏 总数据行数: ${range.e.r - headerRow}`);
    
    // 获取最大序号（如果存在序号列）
    let maxSequenceNumber = 0;
    if (columnMap.sequenceNumber) {
      for (let row = headerRow + 1; row <= range.e.r; row++) {
        const cellRef = `${columnMap.sequenceNumber}${row + 1}`;
        const cell = worksheet[cellRef];
        if (cell && cell.v && typeof cell.v === 'number') {
          maxSequenceNumber = Math.max(maxSequenceNumber, cell.v);
        }
      }
      console.log(`   📋 检测到序号列，最大序号: ${maxSequenceNumber}`);
    }
    
    const records = [];
    const stats = {
      totalRows: range.e.r - headerRow,
      processedRows: 0,
      validRecords: 0,
      emptyRows: 0,
      errorRows: 0,
      errors: []
    };
    
    // 解析所有数据行
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      stats.processedRows++;
      
      try {
        // 检查是否是空行
        let hasAnyData = false;
        const cellValues = {};
        
        for (const [key, col] of Object.entries(columnMap)) {
          const cellRef = `${col}${row + 1}`;
          const cell = worksheet[cellRef];
          cellValues[key] = cell?.v;
          
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
            hasAnyData = true;
          }
        }
        
        if (!hasAnyData) {
          stats.emptyRows++;
          console.log(`   行${row + 1}: 跳过空行`);
          continue;
        }
        
        // 严格验证必填字段
        const missingFields = [];
        if (!cellValues.employeeId || cellValues.employeeId === '') missingFields.push('工号');
        if (!cellValues.hireDate || cellValues.hireDate === '') missingFields.push('入厂时间');
        if (cellValues.basicSalary === undefined || cellValues.basicSalary === null || cellValues.basicSalary === '') missingFields.push('正常工作时间工资');
        if (cellValues.grossSalary === undefined || cellValues.grossSalary === null || cellValues.grossSalary === '') missingFields.push('应发工资合计');
        
        if (missingFields.length > 0) {
          stats.errorRows++;
          console.log(`   行${row + 1}: ❌ 缺少必填字段: ${missingFields.join(', ')}`);
          continue;
        }
        
        // 解析字段
        const employeeId = cellValues.employeeId.toString().trim();
        const hireDate = parseDateValue(cellValues.hireDate);
        const basicSalary = parseNumberValue(cellValues.basicSalary);
        const grossSalary = parseNumberValue(cellValues.grossSalary);
        
        // 数据验证
        if (basicSalary < 0 || grossSalary < 0) {
          stats.errorRows++;
          console.log(`   行${row + 1}: ❌ 工资不能为负数`);
          continue;
        }
        
        // 检查基本工资>应发工资的情况，记录警告但允许导入
        if (basicSalary > grossSalary) {
          // 从sheet名获取工资月份
          const { year, month } = extractMonthFromSheetName(sheetName);
          const salaryMonth = new Date(year, month - 1, 1);
          
          // 检查是否是当月入职的员工
          const isCurrentMonthHire = hireDate >= salaryMonth && 
            hireDate < new Date(salaryMonth.getFullYear(), salaryMonth.getMonth() + 1, 1);
          
          if (isCurrentMonthHire) {
            console.log(`   行${row + 1}: ⚠️  当月入职员工 ${employeeId} 基本工资>应发工资（${basicSalary}>${grossSalary}），已允许导入`);
          } else {
            console.log(`   行${row + 1}: ⚠️  特殊情况 ${employeeId} 基本工资>应发工资（${basicSalary}>${grossSalary}），已允许导入`);
          }
        }
        
        records.push({
          employeeId,
          hireDate,
          basicSalary,
          grossSalary
        });
        
        stats.validRecords++;
        
        // 只显示前5条和最后5条的详细信息
        if (stats.validRecords <= 5 || stats.validRecords > records.length - 5) {
          console.log(`   行${row + 1}: ✅ ${employeeId} | ${hireDate.toISOString().split('T')[0]} | ￥${basicSalary} | ￥${grossSalary}`);
        }
        
      } catch (error) {
        stats.errorRows++;
        console.log(`   行${row + 1}: ❌ 解析异常: ${error.message}`);
      }
    }
    
    // 序号校验：检查导入数量是否与最大序号匹配
    if (maxSequenceNumber > 0 && stats.validRecords !== maxSequenceNumber) {
      console.warn(`⚠️ 序号校验警告：预期导入 ${maxSequenceNumber} 条记录，实际导入 ${stats.validRecords} 条记录`);
    } else if (maxSequenceNumber > 0) {
      console.log(`✅ 序号校验通过：成功导入 ${stats.validRecords} 条记录，与最大序号 ${maxSequenceNumber} 匹配`);
    }
    
    console.log(`\n📈 最终统计结果:`);
    console.log(`   ✅ 成功解析: ${stats.validRecords} 条记录`);
    console.log(`   ⏭️ 跳过空行: ${stats.emptyRows} 行`);
    console.log(`   ❌ 错误数据: ${stats.errorRows} 行`);
    console.log(`   📊 数据完整性: ${((stats.validRecords / stats.totalRows) * 100).toFixed(1)}%`);
    
    if (maxSequenceNumber > 0 && stats.validRecords !== maxSequenceNumber) {
      console.warn(`⚠️ 序号校验失败: 期望导入 ${maxSequenceNumber} 条，实际导入 ${stats.validRecords} 条`);
    } else if (stats.validRecords !== stats.totalRows - stats.emptyRows) {
      console.warn(`⚠️ 数据处理警告: 期望 ${stats.totalRows - stats.emptyRows} 条，实际 ${stats.validRecords} 条`);
    }
    
  } catch (error) {
    console.error(`❌ 解析失败:`, error.message);
  }
}

testFixedParsing();