/**
 * Supabase客户端配置
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少Supabase环境变量。请检查NEXT_PUBLIC_SUPABASE_URL和NEXT_PUBLIC_SUPABASE_ANON_KEY是否已设置。'
  )
}

// 创建普通客户端（用于读取操作）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})

// 创建管理员客户端（用于写入操作，绕过RLS）
export const supabaseAdmin = typeof window === 'undefined' && supabaseServiceRoleKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    })
  : supabase

// 导出数据库操作的辅助函数
export const db = {
  // 工资记录相关操作
  salaryRecords: {
    async getAll() {
      return supabase.from('salary_records').select('*')
    },

    async getByEmployeeId(employeeId: string) {
      return supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', employeeId)
        .order('salary_month', { ascending: true })
    },

    async getByMonth(month: Date) {
      const monthStr = month.toISOString().slice(0, 7) + '-01'
      return supabase
        .from('salary_records')
        .select('*')
        .eq('salary_month', monthStr)
    },

    async batchUpsert(records: any[]) {
      return supabase.from('salary_records').upsert(records as any, {
        onConflict: 'employee_id,salary_month',
        ignoreDuplicates: false,
      })
    },
  },

  // 政策规则相关操作
  policyRules: {
    async getAll() {
      return supabase.from('policy_rules').select('*')
    },

    async getByYearAndPeriod(year: number, period: 'H1' | 'H2') {
      return supabase
        .from('policy_rules')
        .select('*')
        .eq('year', year)
        .eq('period', period)
        .single()
    },

    async getByDate(date: Date) {
      const dateStr = date.toISOString().slice(0, 10)
      return supabase
        .from('policy_rules')
        .select('*')
        .lte('effective_start', dateStr)
        .gte('effective_end', dateStr)
        .single()
    },
  },

  // 计算结果相关操作
  calculationResults: {
    async getAll() {
      return supabase.from('calculation_results').select('*')
    },

    async getByEmployeeId(employeeId: string) {
      return supabase
        .from('calculation_results')
        .select('*')
        .eq('employee_id', employeeId)
        .order('calculation_month', { ascending: true })
    },

    async batchInsert(results: any[]) {
      return supabase.from('calculation_results').insert(results as any)
    },
  },

  // 导入日志相关操作
  importLogs: {
    async getAll() {
      return supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
    },

    async create(log: any) {
      return supabase.from('import_logs').insert(log as any).single()
    },
  },
}
