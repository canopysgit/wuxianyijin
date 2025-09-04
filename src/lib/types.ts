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

// 工资记录类型 (数据库记录)
export interface SalaryRecord {
  id: string
  employee_id: string // 工号
  hire_date: Date // 入职日期
  salary_month: string // 工资月份 (Sheet名称，如"2022年4月")
  basic_salary: number // 正常工作时间工资 (窄口径基数)
  gross_salary: number // 应发工资合计 (宽口径基数)
  actual_ss_payment?: number // 实际社保缴纳额
  actual_hf_payment?: number // 实际公积金缓纳额
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

  // 基数上下限 - 分险种
  pension_base_floor: number // 养老保险基数下限
  pension_base_cap: number // 养老保险基数上限
  medical_base_floor: number // 医疗保险基数下限
  medical_base_cap: number // 医疗保险基数上限
  unemployment_base_floor: number // 失业保险基数下限
  unemployment_base_cap: number // 失业保险基数上限
  injury_base_floor: number // 工伤保险基数下限
  injury_base_cap: number // 工伤保险基数上限
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

// 新的8张分表计算结果类型 (统一结构)
export interface CalculationResultNew {
  id: string
  employee_id: string // 员工工号
  calculation_month: Date // 计算月份
  employee_category: 'A' | 'B' | 'C' // 员工类别
  
  // 参考工资基础信息
  reference_wage_base: number // 参考工资基数(调整前)
  reference_wage_category: string // 参考工资类别("2022年平均工资"等)
  
  // 养老保险调整过程
  pension_base_floor: number // 养老保险基数下限
  pension_base_cap: number // 养老保险基数上限
  pension_adjusted_base: number // 养老保险调整后基数
  
  // 医疗保险调整过程
  medical_base_floor: number // 医疗保险基数下限
  medical_base_cap: number // 医疗保险基数上限
  medical_adjusted_base: number // 医疗保险调整后基数
  
  // 失业保险调整过程
  unemployment_base_floor: number // 失业保险基数下限
  unemployment_base_cap: number // 失业保险基数上限
  unemployment_adjusted_base: number // 失业保险调整后基数
  
  // 工伤保险调整过程
  injury_base_floor: number // 工伤保险基数下限
  injury_base_cap: number // 工伤保险基数上限
  injury_adjusted_base: number // 工伤保险调整后基数
  
  // 住房公积金调整过程
  hf_base_floor: number // 公积金基数下限
  hf_base_cap: number // 公积金基数上限
  hf_adjusted_base: number // 公积金调整后基数
  
  // 各险种缴费金额
  pension_payment: number // 养老保险应缴
  medical_payment: number // 医疗保险应缴
  unemployment_payment: number // 失业保险应缴
  injury_payment: number // 工伤保险应缴
  hf_payment: number // 住房公积金应缴
  theoretical_total: number // 理论总计
  
  created_at: Date
}

// 保留原有类型以兼容现有代码
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

// Excel解析相关类型 (主要定义在 excel.ts 中)
// ExcelParseResult 和 SheetData 接口已移至 src/lib/excel.ts

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

// 8张表的类型定义
export type CalculationTable = 
  | 'calculate_result_2023_H1_wide'
  | 'calculate_result_2023_H1_narrow'
  | 'calculate_result_2023_H2_wide' 
  | 'calculate_result_2023_H2_narrow'
  | 'calculate_result_2024_H1_wide'
  | 'calculate_result_2024_H1_narrow'
  | 'calculate_result_2024_H2_wide'
  | 'calculate_result_2024_H2_narrow'

// 参考工资类别枚举
export type ReferenceWageCategory = 
  | '2022年平均工资'
  | '2023年平均工资'
  | '入职首月工资'

// 计算周期类型
export interface CalculationPeriod {
  year: number
  period: 'H1' | 'H2'
  assumption: 'wide' | 'narrow'
  tableName: CalculationTable
}

// 险种基数调整结果
export interface InsuranceBaseAdjustment {
  original_base: number // 原始参考工资基数
  floor: number // 下限
  cap: number // 上限
  adjusted_base: number // 调整后基数
  payment: number // 应缴金额
}

// 完整的计算调整过程
export interface CalculationAdjustmentProcess {
  reference_wage_base: number
  reference_wage_category: ReferenceWageCategory
  pension: InsuranceBaseAdjustment
  medical: InsuranceBaseAdjustment
  unemployment: InsuranceBaseAdjustment
  injury: InsuranceBaseAdjustment
  hf: InsuranceBaseAdjustment
  theoretical_total: number
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

// 查询系统相关类型
export interface QueryRequest {
  employeeId?: string // 员工ID（可选，空则查所有）
  periods: string[]   // 时间期间多选 ['2023H1', '2024H1', ...]
}

export interface QueryResponse {
  wideResults: CalculationResultNew[]
  narrowResults: CalculationResultNew[]
  statistics: QueryStatistics
}

export interface QueryStatistics {
  totalRecords: number
  employeeCount: number
  periodRange: string
  wideCount: number
  narrowCount: number
}

// 配对显示的数据行类型
export interface PairedCalculationRow {
  employee_id: string
  calculation_month: Date
  monthKey: string // YYYY-MM 格式用于排序
  wide?: CalculationResultNew // 宽口径数据（可能为空）
  narrow?: CalculationResultNew // 窄口径数据（可能为空）
}

// 查询面板组件Props
export interface QueryPanelProps {
  onQuery: (request: QueryRequest) => void
  loading: boolean
}

// 结果表格组件Props  
export interface QueryResultsTableProps {
  pairedRows: PairedCalculationRow[]
  loading: boolean
  onExport: () => void
  onRowExpand: (row: PairedCalculationRow, type: 'wide' | 'narrow') => void
}

// 统计栏组件Props
export interface QueryStatisticsBarProps {
  statistics: QueryStatistics | null
  loading: boolean
}

// 详情展开组件Props
export interface CalculationDetailProps {
  result: CalculationResultNew
  type: 'wide' | 'narrow'
  onClose: () => void
}

// 排序配置
export interface SortConfig {
  field: 'employee_id' | 'calculation_month'
  direction: 'asc' | 'desc'
}

// 多字段排序配置
export interface MultiSortConfig {
  primary: SortConfig
  secondary?: SortConfig
}
