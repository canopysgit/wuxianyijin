import { supabase } from './supabase';
import { SalaryRecord, SheetData, ExcelParseResult } from './excel';

/**
 * 数据导入相关接口定义
 */
export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  updatedRecords: number;
  failedRecords: number;
  errors: ImportError[];
  duration: number;
  // 新增验证字段
  preValidation: {
    expectedRecords: number;
    parsedRecords: number;
    parseSuccess: boolean;
  };
  postValidation?: {
    databaseRecords: number;
    consistencyCheck: boolean;
    validationErrors: string[];
  };
}

export interface ImportError {
  employeeId: string;
  salaryMonth: string;
  error: string;
  data?: any;
}

/**
 * 工资记录数据库格式
 */
export interface DBSalaryRecord {
  employee_id: string;
  hire_date: string; // ISO日期字符串
  salary_month: string; // Sheet名称，如"2022年4月"
  basic_salary: number;
  gross_salary: number;
  xuhao?: string; // 序号组合，如"2022年4月-123"
  xuhao2?: number; // 原始表格序号，纯数字格式
}

/**
 * 将前端SalaryRecord转换为数据库格式
 */
function convertToDBFormat(record: SalaryRecord, sheetName: string): DBSalaryRecord {
  // 生成序号组合字段
  const xuhao = record.sequenceNumber ? `${sheetName}-${record.sequenceNumber}` : undefined;
  
  return {
    employee_id: record.employeeId,
    hire_date: record.hireDate.toISOString().split('T')[0],
    salary_month: sheetName, // 直接使用Sheet名称，如"2022年4月"
    basic_salary: record.basicSalary,
    gross_salary: record.grossSalary,
    xuhao,
    xuhao2: record.sequenceNumber // 原始表格序号，纯数字格式
  };
}

/**
 * 批量导入工资记录到数据库 (通过API)
 */
export async function importSalaryRecords(
  records: SalaryRecord[],
  sheetName: string,
  batchSize: number = 100
): Promise<ImportResult> {
  const startTime = Date.now();
  
  try {
    // 将记录转换为数据库格式
    const dbRecords = records.map(record => convertToDBFormat(record, sheetName));
    
    // 调用API进行导入
    const response = await fetch('/api/import-salary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: dbRecords }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API请求失败: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 转换API响应为ImportResult格式
    return {
      success: result.success,
      totalRecords: result.totalRecords,
      importedRecords: result.importedRecords,
      updatedRecords: 0, // 暂时无法区分插入和更新
      failedRecords: result.failedRecords,
      errors: result.errors.map((error: any) => ({
        employeeId: error.employeeId,
        salaryMonth: error.salaryMonth,
        error: error.error
      })),
      duration: result.duration,
      preValidation: {
        expectedRecords: records.length,
        parsedRecords: records.length,
        parseSuccess: true
      },
      postValidation: result.validation ? {
        databaseRecords: result.importedRecords,
        consistencyCheck: result.validation.consistencyVerified,
        validationErrors: result.validation.validationErrors || []
      } : undefined
    };
    
  } catch (error: any) {
    return {
      success: false,
      totalRecords: records.length,
      importedRecords: 0,
      updatedRecords: 0,
      failedRecords: records.length,
      errors: [{
        employeeId: 'unknown',
        salaryMonth: sheetName,
        error: error.message || '导入过程发生未知错误'
      }],
      duration: Date.now() - startTime,
      preValidation: {
        expectedRecords: records.length,
        parsedRecords: records.length,
        parseSuccess: false
      },
      postValidation: {
        databaseRecords: 0,
        consistencyCheck: false,
        validationErrors: [error.message || '导入过程发生未知错误']
      }
    };
  }
}

/**
 * 导入完整Excel文件数据
 */
export async function importExcelData(parseResult: ExcelParseResult): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  
  for (const sheet of parseResult.sheets) {
    if (sheet.records.length > 0) {
      const result = await importSalaryRecords(sheet.records, sheet.sheetName);
      results.push(result);
      
      // 记录导入日志
      await logImportResult(parseResult.fileName, sheet.sheetName, result);
    }
  }
  
  return results;
}

/**
 * 记录导入日志
 */
async function logImportResult(fileName: string, sheetName: string, result: ImportResult): Promise<void> {
  try {
    // 暂时跳过日志记录，直接打印到控制台
    console.log('导入结果:', {
      fileName: `${fileName} - ${sheetName}`,
      importType: 'salary_data', 
      recordsImported: result.importedRecords,
      recordsUpdated: result.updatedRecords,
      recordsFailed: result.failedRecords,
      errorDetails: result.errors.length > 0 ? result.errors : null,
      importDurationMs: result.duration
    });
    
    // TODO: 当import_logs表可用时恢复
    // await supabase.from('import_logs').insert({
    //   file_name: `${fileName} - ${sheetName}`,
    //   import_type: 'salary_data',
    //   records_imported: result.importedRecords,
    //   records_updated: result.updatedRecords,
    //   records_failed: result.failedRecords,
    //   error_details: result.errors.length > 0 ? result.errors : null,
    //   import_duration_ms: result.duration
    // });
  } catch (error) {
    console.error('记录导入日志失败:', error);
  }
}

/**
 * 检查员工数据统计
 */
export async function getEmployeeStats(): Promise<{
  totalEmployees: number;
  totalRecords: number;
  monthRange: { start: string; end: string };
  yearStats: Record<string, number>;
}> {
  try {
    // 获取基础统计
    const { count: totalRecords } = await supabase
      .from('salary_records')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalEmployees } = await supabase
      .from('salary_records')
      .select('employee_id', { count: 'exact', head: true });
    
    // 获取时间范围
    const { data: monthRange } = await supabase
      .from('salary_records')
      .select('salary_month')
      .order('salary_month', { ascending: true })
      .limit(1)
      .single();
    
    const { data: monthRangeEnd } = await supabase
      .from('salary_records')
      .select('salary_month')
      .order('salary_month', { ascending: false })
      .limit(1)
      .single();
    
    // 获取按年统计
    const { data: yearData } = await supabase
      .from('salary_records')
      .select('salary_month')
      .order('salary_month');
    
    const yearStats: Record<string, number> = {};
    if (yearData) {
      yearData.forEach(record => {
        const year = new Date(record.salary_month).getFullYear().toString();
        yearStats[year] = (yearStats[year] || 0) + 1;
      });
    }
    
    return {
      totalEmployees: totalEmployees || 0,
      totalRecords: totalRecords || 0,
      monthRange: {
        start: monthRange?.salary_month || '',
        end: monthRangeEnd?.salary_month || ''
      },
      yearStats
    };
    
  } catch (error) {
    console.error('获取员工统计失败:', error);
    return {
      totalEmployees: 0,
      totalRecords: 0,
      monthRange: { start: '', end: '' },
      yearStats: {}
    };
  }
}

/**
 * 获取导入历史记录
 */
export async function getImportHistory(): Promise<any[]> {
  try {
    // 暂时返回空数组，当import_logs表可用时恢复
    console.log('导入历史功能暂时禁用');
    return [];
    
    // TODO: 当import_logs表可用时恢复
    // const { data, error } = await supabase
    //   .from('import_logs')
    //   .select('*')
    //   .order('created_at', { ascending: false })
    //   .limit(50);
    
    // if (error) throw error;
    // return data || [];
  } catch (error) {
    console.error('获取导入历史失败:', error);
    return [];
  }
}