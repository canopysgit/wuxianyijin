import * as XLSX from 'xlsx';

/**
 * Excel文件解析相关接口定义
 */
export interface ExcelParseResult {
  fileName: string;
  year: number;
  sheets: SheetData[];
}

export interface SheetData {
  sheetName: string;
  records: SalaryRecord[];
  stats: ParseStats;
}

export interface SalaryRecord {
  employeeId: string;
  hireDate: Date;
  basicSalary: number;
  grossSalary: number;
  sequenceNumber?: number; // Excel中的序号
}

export interface ParseError {
  row: number;
  column: string;
  value: any;
  error: string;
}

/**
 * 从文件名中提取年份
 */
export function extractYearFromFileName(fileName: string): number {
  const match = fileName.match(/(\d{4})年?工资/);
  if (!match) {
    throw new Error(`无法从文件名 "${fileName}" 中提取年份`);
  }
  return parseInt(match[1], 10);
}

/**
 * 从工作表名称中提取年月信息
 */
export function extractMonthFromSheetName(sheetName: string): { year: number; month: number } {
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

/**
 * 将Excel日期序列号转换为JavaScript Date对象
 */
export function excelDateToJSDate(excelDate: number): Date {
  // Excel使用1900年1月1日作为起始日期，但有个bug认为1900年是闰年
  // 使用XLSX库内置的日期转换，然后转为UTC日期
  const excelDateObj = XLSX.SSF.parse_date_code(excelDate);
  // 创建UTC日期避免时区偏移
  return new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
}

/**
 * 安全地解析日期值，支持多种日期格式
 */
export function parseDateValue(value: any): Date {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    // Excel日期序列号
    return excelDateToJSDate(value);
  }
  
  if (typeof value === 'string') {
    // 尝试解析字符串日期
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
        const month = parseInt(match[2], 10) - 1; // JavaScript月份从0开始
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

/**
 * 安全地解析数值
 */
export function parseNumberValue(value: any): number {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const numStr = value.trim().replace(/,/g, ''); // 移除千分位逗号
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  throw new Error(`无法解析数值: ${value}`);
}

/**
 * 查找表头行并返回列映射
 */
export function findHeaderRow(worksheet: XLSX.WorkSheet): { headerRow: number; columnMap: Record<string, string> } {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  
  // 预期的列名（支持中英文和变体）
  const expectedColumns = {
    sequenceNumber: ['序号', '编号', 'No', 'Number', '#'],
    employeeId: ['工号', '员工工号', '编号', 'ID', 'Employee ID'],
    hireDate: ['入厂时间', '入职时间', '入职日期', 'Hire Date'],
    basicSalary: ['正常工作时间工资', '基本工资', 'Basic Salary'],
    grossSalary: ['应发工资合计', '应发工资', '总工资', 'Gross Salary']
  };
  
  // 从前10行中查找表头
  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 9); row++) {
    const columnMap: Record<string, string> = {};
    let foundColumns = 0;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellRef];
      
      if (cell && cell.v) {
        const cellValue = cell.v.toString().trim();
        const columnLetter = XLSX.utils.encode_col(col);
        
        // 检查是否匹配预期列名
        for (const [key, patterns] of Object.entries(expectedColumns)) {
          if (patterns.some(pattern => cellValue.includes(pattern) || pattern.includes(cellValue))) {
            columnMap[key] = columnLetter;
            foundColumns++;
            break;
          }
        }
      }
    }
    
    // 如果找到了所有必需的列（除了序号列是可选的），返回结果
    const requiredColumns = ['employeeId', 'hireDate', 'basicSalary', 'grossSalary'];
    const foundRequired = requiredColumns.filter(col => columnMap[col]).length;
    
    if (foundRequired >= 4) {
      return { headerRow: row, columnMap };
    }
  }
  
  throw new Error('未找到有效的表头行，请检查Excel文件格式');
}

/**
 * 工作表解析统计信息
 */
export interface ParseStats {
  totalRows: number;
  processedRows: number;
  validRecords: number;
  emptyRows: number;
  errorRows: number;
  errors: ParseError[];
  maxSequenceNumber?: number; // 最大序号
  sequenceGaps?: number[]; // 序号缺口
  sequenceValidation: {
    hasSequenceColumn: boolean;
    continuousSequence: boolean;
    duplicateSequences: number[];
  };
}

/**
 * 解析单个工作表的数据
 */
export function parseWorksheet(worksheet: XLSX.WorkSheet, sheetName: string): SheetData & { stats: ParseStats } {
  try {
    
    const { headerRow, columnMap } = findHeaderRow(worksheet);
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    
    const records: SalaryRecord[] = [];
    const errors: ParseError[] = [];
    
    // 统计信息初始化
    const stats: ParseStats = {
      totalRows: range.e.r - headerRow, // 除去表头的总行数
      processedRows: 0,
      validRecords: 0,
      emptyRows: 0,
      errorRows: 0,
      errors: [],
      maxSequenceNumber: 0,
      sequenceGaps: [],
      sequenceValidation: {
        hasSequenceColumn: !!columnMap.sequenceNumber,
        continuousSequence: true,
        duplicateSequences: []
      }
    };
    
    console.log(`📊 开始解析工作表 "${sheetName}"，数据行数: ${stats.totalRows}`);
    
    // 序号分析和验证
    const sequenceNumbers: number[] = [];
    const sequenceCounts: Record<number, number> = {};
    
    // 重复员工ID跟踪
    const employeeIdCounts: Record<string, number> = {};
    
    if (columnMap.sequenceNumber) {
      console.log(`📋 检测到序号列，开始分析序号连续性...`);
      
      for (let row = headerRow + 1; row <= range.e.r; row++) {
        const cellRef = `${columnMap.sequenceNumber}${row + 1}`;
        const cell = worksheet[cellRef];
        if (cell && cell.v && typeof cell.v === 'number') {
          const seqNum = cell.v;
          sequenceNumbers.push(seqNum);
          sequenceCounts[seqNum] = (sequenceCounts[seqNum] || 0) + 1;
          stats.maxSequenceNumber = Math.max(stats.maxSequenceNumber || 0, seqNum);
        }
      }
      
      // 检查重复序号
      for (const [seqStr, count] of Object.entries(sequenceCounts)) {
        if (count > 1) {
          stats.sequenceValidation.duplicateSequences.push(parseInt(seqStr));
        }
      }
      
      // 检查序号缺口
      if (stats.maxSequenceNumber && stats.maxSequenceNumber > 0) {
        const uniqueSequences = Array.from(new Set(sequenceNumbers)).sort((a, b) => a - b);
        stats.sequenceGaps = [];
        
        for (let i = 1; i <= stats.maxSequenceNumber; i++) {
          if (!uniqueSequences.includes(i)) {
            stats.sequenceGaps.push(i);
          }
        }
        
        stats.sequenceValidation.continuousSequence = stats.sequenceGaps.length === 0;
      }
      
      console.log(`📋 序号分析: 最大=${stats.maxSequenceNumber}, 缺口=${stats.sequenceGaps?.length || 0}个, 重复=${stats.sequenceValidation.duplicateSequences.length}个`);
    }
    
    // 从表头后一行开始解析数据
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      stats.processedRows++;
      
      try {
        // 检查是否是空行 - 更严格的空行检查
        let hasAnyData = false;
        const cellValues: Record<string, any> = {};
        
        // 检查所有关键列是否有数据
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
        const missingFields: string[] = [];
        if (!cellValues.employeeId || cellValues.employeeId === '') missingFields.push('工号');
        if (!cellValues.hireDate || cellValues.hireDate === '') missingFields.push('入厂时间');
        if (cellValues.basicSalary === undefined || cellValues.basicSalary === null || cellValues.basicSalary === '') missingFields.push('正常工作时间工资');
        if (cellValues.grossSalary === undefined || cellValues.grossSalary === null || cellValues.grossSalary === '') missingFields.push('应发工资合计');
        
        if (missingFields.length > 0) {
          const error: ParseError = {
            row: row + 1,
            column: 'validation',
            value: JSON.stringify(cellValues),
            error: `缺少必填字段: ${missingFields.join(', ')}`
          };
          errors.push(error);
          stats.errors.push(error);
          stats.errorRows++;
          console.log(`   行${row + 1}: ${error.error}`);
          continue;
        }
        
        // 解析各个字段
        const originalEmployeeId = cellValues.employeeId.toString().trim();
        const hireDate = parseDateValue(cellValues.hireDate);
        const basicSalary = parseNumberValue(cellValues.basicSalary);
        const grossSalary = parseNumberValue(cellValues.grossSalary);
        
        // 处理重复员工ID：为重复记录添加后缀
        let employeeId = originalEmployeeId;
        employeeIdCounts[originalEmployeeId] = (employeeIdCounts[originalEmployeeId] || 0) + 1;
        
        if (employeeIdCounts[originalEmployeeId] > 1) {
          employeeId = `${originalEmployeeId}-${employeeIdCounts[originalEmployeeId]}`;
          console.log(`   行${row + 1}: 🔄 重复员工ID处理 ${originalEmployeeId} -> ${employeeId}`);
        }
        
        // 解析序号（如果存在）
        let sequenceNumber: number | undefined;
        if (cellValues.sequenceNumber && typeof cellValues.sequenceNumber === 'number') {
          sequenceNumber = cellValues.sequenceNumber;
        }
        
        // 数据验证
        if (basicSalary < 0 || grossSalary < 0) {
          const error: ParseError = {
            row: row + 1,
            column: 'salary',
            value: `基本工资: ${basicSalary}, 应发工资: ${grossSalary}`,
            error: '工资不能为负数'
          };
          errors.push(error);
          stats.errors.push(error);
          stats.errorRows++;
          console.log(`   行${row + 1}: ${error.error}`);
          continue;
        }
        
        // 检查基本工资>应发工资的情况，记录警告但允许导入
        if (basicSalary > grossSalary) {
          console.log(`   行${row + 1}: ⚠️  特殊情况 ${employeeId} 基本工资>应发工资（${basicSalary}>${grossSalary}），已允许导入`);
        }
        
        // 验证入职日期合理性
        const currentDate = new Date();
        if (hireDate > currentDate) {
          const error: ParseError = {
            row: row + 1,
            column: 'hireDate',
            value: hireDate.toISOString().split('T')[0],
            error: '入职日期不能是未来时间'
          };
          errors.push(error);
          stats.errors.push(error);
          stats.errorRows++;
          console.log(`   行${row + 1}: ${error.error}`);
          continue;
        }
        
        const record: SalaryRecord = {
          employeeId,
          hireDate,
          basicSalary,
          grossSalary
        };

        if (sequenceNumber !== undefined) {
          record.sequenceNumber = sequenceNumber;
        }

        records.push(record);
        
        stats.validRecords++;
        const seqDisplay = sequenceNumber ? ` | 序号${sequenceNumber}` : '';
        console.log(`   行${row + 1}: ✅ ${employeeId} | ${hireDate.toISOString().split('T')[0]} | ￥${basicSalary} | ￥${grossSalary}${seqDisplay}`);
        
      } catch (error) {
        const parseError: ParseError = {
          row: row + 1,
          column: 'parsing',
          value: 'exception',
          error: error instanceof Error ? error.message : '未知解析错误'
        };
        errors.push(parseError);
        stats.errors.push(parseError);
        stats.errorRows++;
        console.log(`   行${row + 1}: ❌ ${parseError.error}`);
      }
    }
    
    // 打印解析统计信息
    console.log(`📈 "${sheetName}" 解析完成:`);
    console.log(`   总行数: ${stats.totalRows}`);
    console.log(`   处理行数: ${stats.processedRows}`);
    console.log(`   有效记录: ${stats.validRecords}`);
    console.log(`   空行: ${stats.emptyRows}`);
    console.log(`   错误行: ${stats.errorRows}`);
    
    if (stats.errorRows > 0) {
      console.warn(`⚠️ 发现 ${stats.errorRows} 行错误数据`);
      stats.errors.forEach((error, index) => {
        console.warn(`   错误${index + 1}: 行${error.row} - ${error.error}`);
      });
    }
    
    // 序号校验：检查导入数量是否与最大序号匹配
    if (stats.maxSequenceNumber && stats.maxSequenceNumber > 0 && stats.validRecords !== stats.maxSequenceNumber) {
      console.warn(`⚠️ 序号校验警告：预期导入 ${stats.maxSequenceNumber} 条记录，实际导入 ${stats.validRecords} 条记录`);
      const sequenceError: ParseError = {
        row: 0,
        column: 'validation',
        value: `预期${stats.maxSequenceNumber}条，实际${stats.validRecords}条`,
        error: `序号校验失败：导入数量与序号不匹配`
      };
      stats.errors.push(sequenceError);
    } else if (stats.maxSequenceNumber && stats.maxSequenceNumber > 0) {
      console.log(`✅ 序号校验通过：成功导入 ${stats.validRecords} 条记录，与最大序号 ${stats.maxSequenceNumber} 匹配`);
    }
    
    // 记录错误但不阻止解析，让用户在UI中决定如何处理
    if (stats.errorRows > 0) {
      console.warn(`⚠️ 警告：发现 ${stats.errorRows} 行错误数据，这些数据将被跳过`);
    }
    
    return {
      sheetName,
      records,
      stats
    };
    
  } catch (error) {
    throw new Error(`解析工作表 "${sheetName}" 失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 解析Excel文件
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const fileName = file.name;
        const year = extractYearFromFileName(fileName);
        
        const sheets: SheetData[] = [];
        
        for (const sheetName of workbook.SheetNames) {
          try {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = parseWorksheet(worksheet, sheetName);
            sheets.push(sheetData);
          } catch (error) {
            console.error(`跳过工作表 "${sheetName}":`, error);
          }
        }
        
        if (sheets.length === 0) {
          reject(new Error('没有找到有效的工作表数据'));
          return;
        }
        
        resolve({
          fileName,
          year,
          sheets
        });
        
      } catch (error) {
        reject(new Error(`解析Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 验证Excel文件格式
 */
export function validateExcelFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return { valid: false, error: '请选择Excel文件（.xlsx或.xls格式）' };
  }
  
  // 检查文件名格式
  try {
    extractYearFromFileName(file.name);
  } catch (error) {
    return { valid: false, error: '文件名应包含年份信息，如"2023年工资表.xlsx"' };
  }
  
  // 检查文件大小（50MB限制）
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件大小不能超过50MB' };
  }
  
  return { valid: true };
}