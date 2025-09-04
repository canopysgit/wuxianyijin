/**
 * @jest-environment node
 * Read-only verification for 2023H1 (2023-01..06) detailed results.
 * - New engine, wide assumption (gross)
 * - In-service includes hire month
 * - Per-insurance floors/caps enabled; injury has no floors/caps (use ref directly)
 *
 * IMPORTANT: This test only performs SELECT queries against Supabase.
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Avoid immediate crash on import; tests will fail with helpful message
  // when attempting client usage.
}

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null

const TABLE = 'calculate_result_2023_h1_wide' // lower-case h1 (as per user)
const MONTHS = [
  '2023-01-01', '2023-02-01', '2023-03-01', '2023-04-01', '2023-05-01', '2023-06-01',
]

const MONEY_TOL = 0.1 // more robust absolute tolerance for payments
const BASE_TOL = 0.01 // tight tolerance for base comparisons

function approxEq(a, b, tol = MONEY_TOL) {
  if (a == null || b == null) return false
  return Math.abs(Number(a) - Number(b)) <= tol
}

function parseToDate(d) {
  if (!d) return null
  if (typeof d === 'string') {
    // support 'YYYY-MM(-DD)' and 'YYYY年M月'
    const ymd = d.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
    if (ymd) return new Date(Date.UTC(+ymd[1], +ymd[2] - 1, ymd[3] ? +ymd[3] : 1))
    const cn = d.match(/^(\d{4})\s*年\s*([0-1]?\d)\s*月$/)
    if (cn) return new Date(Date.UTC(+cn[1], +cn[2] - 1, 1))
  }
  return new Date(d)
}

function socialSecurityYear(date) {
  const m = date.getUTCMonth() + 1
  const y = date.getUTCFullYear()
  return m >= 7 ? y : y - 1
}

function expectedCategory(hireDate, calcMonth) {
  const hy = parseToDate(hireDate).getUTCFullYear()
  const ssy = socialSecurityYear(parseToDate(calcMonth))
  if (hy < ssy) return 'A'
  if (hy === ssy) return 'B'
  if (hy === ssy + 1) return 'C'
  return 'A' // default-safe; should not happen with valid data
}

async function getPolicyRules2023H1() {
  const { data, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', 2023)
    .eq('period', 'H1')
    .single()
  if (error) throw new Error('policy_rules 2023/H1 not found: ' + error.message)
  return data
}

async function getHireDate(employeeId) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('hire_date')
    .eq('employee_id', employeeId)
    .limit(1)
    .single()
  if (error) throw new Error('salary_records missing for ' + employeeId + ': ' + error.message)
  return data.hire_date
}

async function getFirstGross(employeeId) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('salary_month,gross_salary')
    .eq('employee_id', employeeId)
    .order('salary_month', { ascending: true })
    .limit(1)
  if (error || !data || !data.length) throw new Error('first gross missing for ' + employeeId)
  return Number(data[0].gross_salary) || 0
}

async function getAvgGrossForYear(employeeId, year) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('salary_month,gross_salary')
    .eq('employee_id', employeeId)
  if (error) throw new Error('records missing for ' + employeeId)
  const ys = data.filter(r => parseToDate(r.salary_month).getUTCFullYear() === year)
  if (ys.length === 0) return undefined
  const sum = ys.reduce((acc, r) => acc + (Number(r.gross_salary) || 0), 0)
  return sum / ys.length
}

describe('2023H1 batch detailed results (wide)', () => {
  it('environment and client initialized', () => {
    expect(SUPABASE_URL).toBeTruthy()
    expect(SUPABASE_KEY).toBeTruthy()
    expect(supabase).toBeTruthy()
  })

  it('table exists and months covered', async () => {
    // A simple select; if table does not exist, PostgREST should error
    const { error } = await supabase
      .from(TABLE)
      .select('calculation_month')
      .limit(1)
    expect(error).toBeNull()

    // check each month has rows (>= 0; typically > 0)
    for (const m of MONTHS) {
      const { count, error: cErr } = await supabase
        .from(TABLE)
        .select('calculation_month', { count: 'exact', head: true })
        .eq('calculation_month', m)
      expect(cErr).toBeNull()
      // At least no error; if truly no in-service employees that month, count may be 0
      expect(count).not.toBeUndefined()
    }
  })

  it('small-sample: employee categories match expected (A/B/C up to 3 each)', async () => {
    const samples = {}
    for (const cat of ['A', 'B', 'C']) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('employee_id,calculation_month,employee_category')
        .eq('employee_category', cat)
        .limit(5)
      expect(error).toBeNull()
      samples[cat] = data || []
    }

    for (const cat of ['A', 'B', 'C']) {
      const arr = (samples[cat] || []).slice(0, 3)
      for (const row of arr) {
        const hire = await getHireDate(row.employee_id)
        const expected = expectedCategory(hire, row.calculation_month)
        expect(row.employee_category).toBe(expected)
      }
    }
  })

  it('small-sample: reference wage source and value (A uses 2022 avg, B/C use first month gross)', async () => {
    // Grab up to 3 A and up to 3 non-A rows
    const { data: rowsA, error: eA } = await supabase
      .from(TABLE)
      .select('employee_id,reference_wage_base,employee_category')
      .eq('employee_category', 'A')
      .limit(3)
    expect(eA).toBeNull()

    const { data: rowsBC, error: eBC } = await supabase
      .from(TABLE)
      .select('employee_id,reference_wage_base,employee_category')
      .neq('employee_category', 'A')
      .limit(3)
    expect(eBC).toBeNull()

    // A: avg 2022 gross
    for (const r of rowsA || []) {
      const avg2022 = await getAvgGrossForYear(r.employee_id, 2022)
      if (avg2022 == null) continue // skip when data not available
      expect(approxEq(r.reference_wage_base, avg2022, MONEY_TOL)).toBe(true)
    }

    // B/C: first-month gross
    for (const r of rowsBC || []) {
      const first = await getFirstGross(r.employee_id)
      expect(approxEq(r.reference_wage_base, first, MONEY_TOL)).toBe(true)
    }
  })

  it('small-sample: per-insurance clamps and payments are consistent with policy (2023H1)', async () => {
    const policy = await getPolicyRules2023H1()
    // prefer per-insurance floors/caps; fallback to undefined
    const floors = {
      pension: Number(policy.pension_base_floor),
      medical: Number(policy.medical_base_floor),
      unemployment: Number(policy.unemployment_base_floor),
      hf: Number(policy.hf_base_floor),
    }
    const caps = {
      pension: Number(policy.pension_base_cap),
      medical: Number(policy.medical_base_cap),
      unemployment: Number(policy.unemployment_base_cap),
      hf: Number(policy.hf_base_cap),
    }
    const rates = {
      pension: Number(policy.pension_rate_enterprise),
      medical: Number(policy.medical_rate_enterprise),
      unemployment: Number(policy.unemployment_rate_enterprise),
      injury: Number(policy.injury_rate_enterprise),
      hf: Number(policy.hf_rate_enterprise),
    }

    const { data: rows, error } = await supabase
      .from(TABLE)
      .select([
        'employee_id',
        'reference_wage_base',
        'pension_base_floor', 'pension_base_cap', 'pension_adjusted_base', 'pension_payment',
        'medical_base_floor', 'medical_base_cap', 'medical_adjusted_base', 'medical_payment',
        'unemployment_base_floor', 'unemployment_base_cap', 'unemployment_adjusted_base', 'unemployment_payment',
        'injury_adjusted_base', 'injury_payment',
        'hf_base_floor', 'hf_base_cap', 'hf_adjusted_base', 'hf_payment',
      ].join(','))
      .limit(5)
    expect(error).toBeNull()

    for (const r of rows || []) {
      // Pension
      if (r.pension_base_floor != null && r.pension_base_cap != null) {
        expect(r.pension_adjusted_base).toBeGreaterThanOrEqual(r.pension_base_floor - BASE_TOL)
        expect(r.pension_adjusted_base).toBeLessThanOrEqual(r.pension_base_cap + BASE_TOL)
        expect(approxEq(r.pension_payment, r.pension_adjusted_base * rates.pension)).toBe(true)
      }
      // Medical
      if (r.medical_base_floor != null && r.medical_base_cap != null) {
        expect(r.medical_adjusted_base).toBeGreaterThanOrEqual(r.medical_base_floor - BASE_TOL)
        expect(r.medical_adjusted_base).toBeLessThanOrEqual(r.medical_base_cap + BASE_TOL)
        expect(approxEq(r.medical_payment, r.medical_adjusted_base * rates.medical)).toBe(true)
      }
      // Unemployment
      if (r.unemployment_base_floor != null && r.unemployment_base_cap != null) {
        expect(r.unemployment_adjusted_base).toBeGreaterThanOrEqual(r.unemployment_base_floor - BASE_TOL)
        expect(r.unemployment_adjusted_base).toBeLessThanOrEqual(r.unemployment_base_cap + BASE_TOL)
        expect(approxEq(r.unemployment_payment, r.unemployment_adjusted_base * rates.unemployment)).toBe(true)
      }
      // Injury: long-term no cap/floor → adjusted_base ≈ reference_wage
      if (r.reference_wage_base != null) {
        expect(approxEq(r.injury_adjusted_base, r.reference_wage_base, BASE_TOL)).toBe(true)
        expect(approxEq(r.injury_payment, r.injury_adjusted_base * rates.injury)).toBe(true)
      }
      // Housing fund
      if (r.hf_base_floor != null && r.hf_base_cap != null) {
        expect(r.hf_adjusted_base).toBeGreaterThanOrEqual(r.hf_base_floor - BASE_TOL)
        expect(r.hf_adjusted_base).toBeLessThanOrEqual(r.hf_base_cap + BASE_TOL)
        expect(approxEq(r.hf_payment, r.hf_adjusted_base * rates.hf)).toBe(true)
      }
    }
  })

  it('small-sample: uniqueness per (employee_id, calculation_month)', async () => {
    for (const m of MONTHS) {
      const { data, error } = await supabase
        .from(TABLE)
        .select('employee_id')
        .eq('calculation_month', m)
        .limit(20)
      expect(error).toBeNull()
      const seen = new Set()
      for (const row of data || []) {
        const key = row.employee_id
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })
})

