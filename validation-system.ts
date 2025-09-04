import { supabase } from './src/lib/supabase';
import { SalaryRecord, SheetData, ExcelParseResult, ParseStats } from './src/lib/excel';
import { ImportResult, ImportError, DBSalaryRecord } from './src/lib/database';

/**
 * 导入验证系统 - 确保数据完整性
 */

export interface ValidationReport {
  stage: 'pre-import' | 'post-import';
  sheetName: string;
  passed: boolean;
  expectedCount: number;
  actualCount: number;
  discrepancy: number;
  issues: ValidationIssue[];
  timestamp: Date;
}

export interface ValidationIssue {
  type: 'missing-records' | 'duplicate-sequence' | 'sequence-gap' | 'data-mismatch' | 'database-error';
  severity: 'error' | 'warning' | 'info';
  description: string;
  affectedRecords?: string[];
  suggestedAction?: string;
}

export interface ComprehensiveValidation {
  overallSuccess: boolean;
  preImportValidation: ValidationReport[];
  postImportValidation: ValidationReport[];
  summary: {
    totalExpected: number;
    totalImported: number;
    totalFailed: number;
    consistencyRate: number;
    criticalIssues: number;
  };
}

/**
 * 导入前验证：检查Excel解析结果
 */
export function validatePreImport(parseResult: ExcelParseResult): ValidationReport[] {
  const validationReports: ValidationReport[] = [];
  
  for (const sheet of parseResult.sheets) {
    const report: ValidationReport = {
      stage: 'pre-import',
      sheetName: sheet.sheetName,
      passed: true,
      expectedCount: sheet.stats.totalRows,
      actualCount: sheet.records.length,
      discrepancy: sheet.stats.totalRows - sheet.records.length,
      issues: [],
      timestamp: new Date()
    };
    
    // 检查记录数量匹配
    if (sheet.stats.totalRows !== sheet.records.length) {
      report.passed = false;
      report.issues.push({
        type: 'missing-records',
        severity: 'error',
        description: `预期解析 ${sheet.stats.totalRows} 条记录，实际只解析了 ${sheet.records.length} 条`,
        suggestedAction: '检查Excel文件格式和数据完整性'
      });
    }
    
    // 检查序号连续性
    if (sheet.stats.sequenceValidation) {
      const seqValidation = sheet.stats.sequenceValidation;
      
      if (seqValidation.hasSequenceColumn && !seqValidation.continuousSequence) {
        report.issues.push({
          type: 'sequence-gap',
          severity: 'warning',
          description: `序号不连续，发现 ${sheet.stats.sequenceGaps?.length || 0} 个缺口`,
          suggestedAction: '确认是否有员工离职或数据缺失'
        });
      }
      
      if (seqValidation.duplicateSequences.length > 0) {
        report.passed = false;
        report.issues.push({
          type: 'duplicate-sequence',
          severity: 'error',
          description: `发现重复序号: ${seqValidation.duplicateSequences.join(', ')}`,
          affectedRecords: seqValidation.duplicateSequences.map(s => s.toString()),
          suggestedAction: '检查Excel文件中的序号列，确保唯一性'
        });
      }
    }
    
    // 检查解析错误
    if (sheet.stats.errorRows > 0) {
      const errorRate = (sheet.stats.errorRows / sheet.stats.totalRows) * 100;
      report.issues.push({
        type: 'data-mismatch',
        severity: errorRate > 10 ? 'error' : 'warning',
        description: `${sheet.stats.errorRows} 行数据解析失败 (${errorRate.toFixed(1)}%)`,
        suggestedAction: '检查数据格式，特别是日期和数值字段'
      });
      
      if (errorRate > 10) {
        report.passed = false;
      }
    }
    
    validationReports.push(report);
  }
  
  return validationReports;
}

/**
 * 导入后验证：检查数据库中的实际记录数
 */
export async function validatePostImport(
  parseResult: ExcelParseResult, 
  importResults: ImportResult[]
): Promise<ValidationReport[]> {
  const validationReports: ValidationReport[] = [];
  
  for (let i = 0; i < parseResult.sheets.length; i++) {
    const sheet = parseResult.sheets[i];
    const importResult = importResults[i];
    
    const report: ValidationReport = {
      stage: 'post-import',
      sheetName: sheet.sheetName,
      passed: true,
      expectedCount: sheet.records.length,
      actualCount: importResult.importedRecords,
      discrepancy: sheet.records.length - importResult.importedRecords,
      issues: [],
      timestamp: new Date()
    };
    
    try {
      // 查询数据库中的实际记录数
      const { count: dbCount, error: countError } = await supabase
        .from('salary_records')
        .select('*', { count: 'exact', head: true })
        .eq('salary_month', sheet.sheetName);
      
      if (countError) {
        report.passed = false;
        report.issues.push({
          type: 'database-error',
          severity: 'error',
          description: `数据库查询失败: ${countError.message}`,
          suggestedAction: '检查数据库连接和权限设置'
        });
      } else {
        report.actualCount = dbCount || 0;
        report.discrepancy = report.expectedCount - report.actualCount;
        
        // 检查数量一致性
        if (report.discrepancy !== 0) {
          report.passed = false;
          report.issues.push({
            type: 'missing-records',
            severity: 'error',
            description: `数据库记录数不匹配: 预期 ${report.expectedCount}，实际 ${report.actualCount}，差异 ${report.discrepancy}`,
            suggestedAction: '重新导入或检查导入过程中的错误'
          });
        }
        
        // 如果有序号，验证序号的完整性
        if (sheet.stats.sequenceValidation?.hasSequenceColumn) {
          const { data: xuhaoSample, error: xuhaoError } = await supabase
            .from('salary_records')
            .select('xuhao, employee_id')
            .eq('salary_month', sheet.sheetName)
            .not('xuhao', 'is', null)
            .limit(10);
          
          if (!xuhaoError && xuhaoSample) {
            const hasXuhao = xuhaoSample.length > 0;
            const xuhaoFormat = hasXuhao ? xuhaoSample[0].xuhao?.startsWith(sheet.sheetName + '-') : false;
            
            if (hasXuhao && !xuhaoFormat) {
              report.issues.push({
                type: 'data-mismatch',
                severity: 'warning',
                description: 'xuhao字段格式不正确',
                suggestedAction: '检查序号组合逻辑'
              });
            } else if (!hasXuhao) {
              report.issues.push({
                type: 'missing-records',
                severity: 'info',
                description: '未找到xuhao字段数据，可能Excel中无序号列',
                suggestedAction: '确认Excel文件是否包含序号列'
              });
            }
          }
        }
      }
      
    } catch (error) {
      report.passed = false;
      report.issues.push({
        type: 'database-error',
        severity: 'error',
        description: `验证过程异常: ${error instanceof Error ? error.message : '未知错误'}`,
        suggestedAction: '检查系统状态和网络连接'
      });
    }
    
    validationReports.push(report);
  }
  
  return validationReports;
}

/**
 * 综合验证：整合导入前后的验证结果
 */
export function generateComprehensiveValidation(
  preReports: ValidationReport[],
  postReports: ValidationReport[]
): ComprehensiveValidation {
  const allReports = [...preReports, ...postReports];
  const totalExpected = preReports.reduce((sum, report) => sum + report.expectedCount, 0);
  const totalImported = postReports.reduce((sum, report) => sum + report.actualCount, 0);
  const totalFailed = totalExpected - totalImported;
  const consistencyRate = totalExpected > 0 ? (totalImported / totalExpected) * 100 : 0;
  const criticalIssues = allReports.reduce((sum, report) => 
    sum + report.issues.filter(issue => issue.severity === 'error').length, 0
  );
  
  const overallSuccess = preReports.every(r => r.passed) && 
                        postReports.every(r => r.passed) && 
                        criticalIssues === 0;
  
  return {
    overallSuccess,
    preImportValidation: preReports,
    postImportValidation: postReports,
    summary: {
      totalExpected,
      totalImported,
      totalFailed,
      consistencyRate,
      criticalIssues
    }
  };
}

/**
 * 生成验证报告
 */
export function generateValidationReport(validation: ComprehensiveValidation): string {
  const lines: string[] = [];
  
  lines.push('📊 导入验证报告');
  lines.push('='.repeat(60));
  
  // 总体概况
  lines.push(`\n📈 总体概况:`);
  lines.push(`   预期记录: ${validation.summary.totalExpected} 条`);
  lines.push(`   实际导入: ${validation.summary.totalImported} 条`);
  lines.push(`   导入失败: ${validation.summary.totalFailed} 条`);
  lines.push(`   一致性率: ${validation.summary.consistencyRate.toFixed(2)}%`);
  lines.push(`   关键问题: ${validation.summary.criticalIssues} 个`);
  lines.push(`   整体状态: ${validation.overallSuccess ? '✅ 成功' : '❌ 失败'}`);
  
  // 详细报告
  lines.push(`\n📋 详细验证结果:`);
  
  for (const report of validation.preImportValidation) {
    lines.push(`\n   📥 导入前验证 - "${report.sheetName}":`);
    lines.push(`      状态: ${report.passed ? '✅ 通过' : '❌ 失败'}`);
    lines.push(`      预期: ${report.expectedCount} 条, 解析: ${report.actualCount} 条`);
    
    if (report.issues.length > 0) {
      lines.push(`      问题:`);
      for (const issue of report.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`         ${icon} ${issue.description}`);
        if (issue.suggestedAction) {
          lines.push(`            建议: ${issue.suggestedAction}`);
        }
      }
    }
  }
  
  for (const report of validation.postImportValidation) {
    lines.push(`\n   📤 导入后验证 - "${report.sheetName}":`);
    lines.push(`      状态: ${report.passed ? '✅ 通过' : '❌ 失败'}`);
    lines.push(`      预期: ${report.expectedCount} 条, 数据库: ${report.actualCount} 条`);
    
    if (report.issues.length > 0) {
      lines.push(`      问题:`);
      for (const issue of report.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`         ${icon} ${issue.description}`);
        if (issue.suggestedAction) {
          lines.push(`            建议: ${issue.suggestedAction}`);
        }
      }
    }
  }
  
  lines.push('\n' + '='.repeat(60));
  return lines.join('\n');
}

/**
 * 强制验证模式：只有通过验证才允许导入成功
 */
export function enforceValidation(validation: ComprehensiveValidation): boolean {
  if (!validation.overallSuccess) {
    console.error('🚫 验证失败，导入被阻止');
    console.error(generateValidationReport(validation));
    return false;
  }
  
  console.log('✅ 验证通过，允许导入');
  return true;
}

export { ValidationReport, ValidationIssue, ComprehensiveValidation };