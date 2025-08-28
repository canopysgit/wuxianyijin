/**
 * 五险一金尽职调查系统 - TypeScript类型定义
 */

// 员工相关类型
export interface Employee {
  id: string
  employee_id: string // 工号
  hire_date: Date // 入职日期
  name?: string // 员工姓名 (脱敏)
  created_at: Date
}

// 工资记录类型
export interface SalaryRecord {
  id: string
  employee_id: string // 工号
  hire_date: Date // 入职日期
  salary_month: Date // 工资月份
  basic_salary: number // 正常工作时间工资 (窄口径基数)
  gross_salary: number // 应发工资合计 (宽口径基数)
  actual_ss_payment?: number // 实际社保缴纳额
  actual_hf_payment?: number // 实际公积金缴纳额
  created_at: Date
}

// 政策规则类型
export interface PolicyRules {
  id: string
  city: string // 城市
  year: number // 年份 (2023, 2024)
  period: 'H1' | 'H2' // 期间 (上半年/下半年)
  effective_start: Date // 生效开始日期
  effective_end: Date // 生效结束日期

  // 基数上下限
  ss_base_floor: number // 社保基数下限
  ss_base_cap: number // 社保基数上限
  hf_base_floor: number // 公积金基数下限
  hf_base_cap: number // 公积金基数上限

  // 企业缴费比例
  pension_rate_enterprise: number // 养老保险企业比例
  medical_rate_enterprise: number // 医疗保险企业比例
  unemployment_rate_enterprise: number // 失业保险企业比例
  injury_rate_enterprise: number // 工伤保险企业比例
  maternity_rate_enterprise: number // 生育保险企业比例
  hf_rate_enterprise: number // 住房公积金企业比例

  // 员工缴费比例 (用于完整性)
  pension_rate_employee: number
  medical_rate_employee: number
  unemployment_rate_employee: number
  hf_rate_employee: number

  // 备注信息
  medical_note?: string // 医疗保险备注
  hf_note?: string // 公积金备注

  created_at: Date
  updated_at: Date
}

// 计算结果类型
export interface CalculationResult {
  id: string
  employee_id: string // 员工工号
  calculation_month: Date // 计算月份
  employee_category: 'A' | 'B' | 'C' // 员工类别
  calculation_assumption: 'wide' | 'narrow' // 计算假设 (宽口径/窄口径)
  reference_salary: number // 参考工资
  ss_base: number // 社保基数
  hf_base: number // 公积金基数
  theoretical_ss_payment: number // 理论社保应缴
  theoretical_hf_payment: number // 理论公积金应缴
  theoretical_total: number // 理论总计
  actual_total?: number // 实际缴纳总计
  compliance_gap?: number // 合规缺口
  created_at: Date
}

// 导入日志类型
export interface ImportLog {
  id: string
  file_name: string // Excel文件名
  import_type: 'salary_data' | 'policy_rules' // 导入类型
  records_imported: number // 导入记录数
  records_updated: number // 更新记录数
  records_failed: number // 失败记录数
  error_details?: Record<string, any> // 错误详情
  import_duration_ms?: number // 导入耗时
  created_at: Date
}

// Excel解析相关类型
export interface ExcelParseResult {
  fileName: string // 文件名
  year: number // 年份
  sheets: SheetData[] // 每个sheet的解析结果
}

export interface SheetData {
  sheetName: string // sheet名称
  salaryMonth: Date // 工资月份 (从sheet名推导)
  records: SalaryRecord[] // 该月所有员工记录
}

// 政策规则导入类型
export interface PolicyRuleImport {
  city: string
  year: number
  period: 'H1' | 'H2'
  effectiveStart: Date // 从年份+期间自动推导
  effectiveEnd: Date // 从年份+期间自动推导

  // 基数上下限
  ssBaseFloor: number
  ssBaseCap: number
  hfBaseFloor: number
  hfBaseCap: number

  // 企业缴费比例 (小数形式)
  pensionRateEnterprise: number
  medicalRateEnterprise: number
  unemploymentRateEnterprise: number
  injuryRateEnterprise: number
  maternityRateEnterprise: number
  hfRateEnterprise: number

  // 备注信息
  medicalNote?: string
  hfNote?: string
}

// API响应类型
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  success: boolean
}

// 计算引擎输入输出类型
export interface CalculationInput {
  employeeId: string
  calculationMonth: Date
  assumption: 'wide' | 'narrow'
}

export interface ContributionBreakdown {
  pension: number // 养老保险
  medical: number // 医疗保险
  unemployment: number // 失业保险
  injury: number // 工伤保险
  maternity: number // 生育保险
  housingFund: number // 住房公积金
  total: number // 总计
}

// 员工状态类型
export interface EmployeeStatus {
  employee_id: string
  hire_date: Date
  last_salary_month: Date
  is_active: boolean
  total_months: number
}

// 合规分析类型
export interface ComplianceAnalysis {
  employeeId: string
  employeeName?: string
  totalGap: number // 总缺口
  ssGap: number // 社保缺口
  hfGap: number // 公积金缺口
  riskLevel: 'low' | 'medium' | 'high' // 风险等级
  monthlyBreakdown: {
    month: Date
    theoreticalAmount: number
    actualAmount: number
    gap: number
  }[]
}

// 前端组件Props类型
export interface DataImportProps {
  importType: 'salary' | 'policy'
  onImportComplete: (result: ImportLog) => void
}

export interface CalculatorProps {
  employees: Employee[]
  onCalculationComplete: (results: CalculationResult[]) => void
}

export interface ResultsTableProps {
  results: CalculationResult[]
  loading?: boolean
}

export interface ComplianceAnalysisProps {
  analysisData: ComplianceAnalysis[]
}
