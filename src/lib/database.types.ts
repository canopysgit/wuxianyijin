/**
 * Supabase数据库类型定义
 * 这个文件将由Supabase CLI生成
 * 暂时提供基础类型定义
 */

export interface Database {
  public: {
    Tables: {
      salary_records: {
        Row: {
          id: string
          employee_id: string
          hire_date: string
          salary_month: string
          basic_salary: number
          gross_salary: number
          actual_ss_payment: number | null
          actual_hf_payment: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          hire_date: string
          salary_month: string
          basic_salary: number
          gross_salary: number
          actual_ss_payment?: number | null
          actual_hf_payment?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          hire_date?: string
          salary_month?: string
          basic_salary?: number
          gross_salary?: number
          actual_ss_payment?: number | null
          actual_hf_payment?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      policy_rules: {
        Row: {
          id: string
          city: string
          year: number
          period: string
          effective_start: string
          effective_end: string
          ss_base_floor: number
          ss_base_cap: number
          hf_base_floor: number
          hf_base_cap: number
          pension_rate_enterprise: number
          medical_rate_enterprise: number
          unemployment_rate_enterprise: number
          injury_rate_enterprise: number
          maternity_rate_enterprise: number
          hf_rate_enterprise: number
          pension_rate_employee: number
          medical_rate_employee: number
          unemployment_rate_employee: number
          hf_rate_employee: number
          medical_note: string | null
          hf_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          city?: string
          year: number
          period: string
          effective_start: string
          effective_end: string
          ss_base_floor: number
          ss_base_cap: number
          hf_base_floor: number
          hf_base_cap: number
          pension_rate_enterprise: number
          medical_rate_enterprise: number
          unemployment_rate_enterprise: number
          injury_rate_enterprise: number
          maternity_rate_enterprise: number
          hf_rate_enterprise: number
          pension_rate_employee?: number
          medical_rate_employee?: number
          unemployment_rate_employee?: number
          hf_rate_employee?: number
          medical_note?: string | null
          hf_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          city?: string
          year?: number
          period?: string
          effective_start?: string
          effective_end?: string
          ss_base_floor?: number
          ss_base_cap?: number
          hf_base_floor?: number
          hf_base_cap?: number
          pension_rate_enterprise?: number
          medical_rate_enterprise?: number
          unemployment_rate_enterprise?: number
          injury_rate_enterprise?: number
          maternity_rate_enterprise?: number
          hf_rate_enterprise?: number
          pension_rate_employee?: number
          medical_rate_employee?: number
          unemployment_rate_employee?: number
          hf_rate_employee?: number
          medical_note?: string | null
          hf_note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calculation_results: {
        Row: {
          id: string
          employee_id: string
          calculation_month: string
          employee_category: string
          calculation_assumption: string
          reference_salary: number
          ss_base: number
          hf_base: number
          theoretical_ss_payment: number
          theoretical_hf_payment: number
          theoretical_total: number
          actual_total: number | null
          compliance_gap: number | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          calculation_month: string
          employee_category: string
          calculation_assumption: string
          reference_salary: number
          ss_base: number
          hf_base: number
          theoretical_ss_payment: number
          theoretical_hf_payment: number
          theoretical_total: number
          actual_total?: number | null
          compliance_gap?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          calculation_month?: string
          employee_category?: string
          calculation_assumption?: string
          reference_salary?: number
          ss_base?: number
          hf_base?: number
          theoretical_ss_payment?: number
          theoretical_hf_payment?: number
          theoretical_total?: number
          actual_total?: number | null
          compliance_gap?: number | null
          created_at?: string
        }
      }
      import_logs: {
        Row: {
          id: string
          file_name: string
          import_type: string
          records_imported: number
          records_updated: number
          records_failed: number
          error_details: any | null
          import_duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          file_name: string
          import_type: string
          records_imported: number
          records_updated: number
          records_failed: number
          error_details?: any | null
          import_duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          file_name?: string
          import_type?: string
          records_imported?: number
          records_updated?: number
          records_failed?: number
          error_details?: any | null
          import_duration_ms?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_employee_status: {
        Args: {
          start_month: string
          end_month: string
        }
        Returns: {
          employee_id: string
          hire_date: string
          last_salary_month: string
          is_active: boolean
          total_months: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
