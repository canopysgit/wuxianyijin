/*
  Calculate 2023-01 (H1) detailed results for employees who have salary records in '2023年1月'.
  - New engine logic; wide assumption (gross)
  - Category by social-security year (July switch); hire-month considered in-service
  - Per-insurance floors/caps; injury not clamped (adjusted_base = reference_wage)
  - All numeric outputs rounded to 2 decimals
  - Writes to table 'calculate_result_2023_h1_wide' with calculation_month as text '202301'
  - Salary month strictly matched by Chinese string '2023年1月'
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Ensure URL and SUPABASE_SERVICE_ROLE_KEY exist in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const TABLE = 'calculate_result_2023_h1_wide'
const SALARY_MONTH_CN = '2023年1月'
const CALC_MONTH_TEXT = '202301'
const CALC_DATE = new Date(Date.UTC(2023, 0, 1)) // use UTC for classification only; never stored

function round2(n) {
  if (n == null || isNaN(n)) return 0
  return Number.parseFloat(Number(n).toFixed(2))
}

function parseChineseMonth(s) {
  if (!s) return new Date('Invalid')
  if (typeof s === 'string') {
    let m = s.match(/^(\d{4})\s*年\s*([0-1]?\d)\s*月$/)
    if (m) return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1))
    m = s.match(/^(\d{4})-(\d{1,2})$/)
    if (m) return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1))
  }
  const d = new Date(s)
  return d
}

function ssYear(d) {
  const m = d.getUTCMonth() + 1
  const y = d.getUTCFullYear()
  return m >= 7 ? y : y - 1
}

function determineCategory(hireDate, calcDate) {
  const hy = new Date(hireDate).getUTCFullYear()
  const ssy = ssYear(calcDate)
  if (hy < ssy) return 'A'
  if (hy === ssy) return 'B'
  if (hy === ssy + 1) return 'C'
  throw new Error(`Invalid hire year ${hy} vs ssYear ${ssy}`)
}

async function getPolicyRules2023H1() {
  const { data, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', 2023)
    .eq('period', 'H1')
    .single()
  if (error || !data) throw new Error('policy_rules 2023/H1 not found: ' + (error && error.message))
  return data
}

async function getEmployeesForJan() {
  // Distinct employees who have salary record in '2023年1月'
  const { data, error } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date')
    .eq('salary_month', SALARY_MONTH_CN)
  if (error) throw new Error('Query employees for 2023年1月 failed: ' + error.message)
  const map = new Map()
  for (const r of data || []) {
    if (!map.has(r.employee_id)) map.set(r.employee_id, r)
  }
  return Array.from(map.values())
}

async function getAllRecords(employeeId) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('salary_month, gross_salary, hire_date')
    .eq('employee_id', employeeId)
  if (error) throw new Error('Fetch records failed for ' + employeeId + ': ' + error.message)
  return data || []
}

function computeFirstGross(records) {
  if (!records.length) return 0
  let first = records[0]
  for (const r of records) {
    if (parseChineseMonth(r.salary_month) < parseChineseMonth(first.salary_month)) first = r
  }
  return Number(first.gross_salary) || 0
}

function computeAvgGrossForYear(records, year) {
  const ys = records.filter(r => parseChineseMonth(r.salary_month).getUTCFullYear() === year)
  if (!ys.length) return undefined
  const sum = ys.reduce((acc, r) => acc + (Number(r.gross_salary) || 0), 0)
  return sum / ys.length
}

function clamp(val, floor, cap) {
  if (floor == null || cap == null || isNaN(floor) || isNaN(cap)) return val
  return Math.min(Math.max(val, Number(floor)), Number(cap))
}

function pick(valA, fallback) {
  return (valA == null || isNaN(valA)) ? fallback : valA
}

function buildAdjustments(ref, rules) {
  // Choose per-insurance floors/caps; fallback to ss_base for the three insurances if needed
  const pensionFloor = pick(Number(rules.pension_base_floor), Number(rules.ss_base_floor))
  const pensionCap = pick(Number(rules.pension_base_cap), Number(rules.ss_base_cap))
  const medicalFloor = pick(Number(rules.medical_base_floor), Number(rules.ss_base_floor))
  const medicalCap = pick(Number(rules.medical_base_cap), Number(rules.ss_base_cap))
  const unempFloor = pick(Number(rules.unemployment_base_floor), Number(rules.ss_base_floor))
  const unempCap = pick(Number(rules.unemployment_base_cap), Number(rules.ss_base_cap))
  const hfFloor = Number(rules.hf_base_floor)
  const hfCap = Number(rules.hf_base_cap)

  // Adjusted bases (round to 2 decimals)
  const pensionBase = round2(clamp(ref, pensionFloor, pensionCap))
  const medicalBase = round2(clamp(ref, medicalFloor, medicalCap))
  const unempBase = round2(clamp(ref, unempFloor, unempCap))
  // Injury: not clamped → use ref directly
  const injuryBase = round2(ref)
  const hfBase = round2(clamp(ref, hfFloor, hfCap))

  // Payments (round to 2 decimals)
  const pension = round2(pensionBase * Number(rules.pension_rate_enterprise))
  const medical = round2(medicalBase * Number(rules.medical_rate_enterprise))
  const unemployment = round2(unempBase * Number(rules.unemployment_rate_enterprise))
  const injury = round2(injuryBase * Number(rules.injury_rate_enterprise))
  const hf = round2(hfBase * Number(rules.hf_rate_enterprise))

  return {
    pension: { floor: pensionFloor, cap: pensionCap, adjusted: pensionBase, payment: pension },
    medical: { floor: medicalFloor, cap: medicalCap, adjusted: medicalBase, payment: medical },
    unemployment: { floor: unempFloor, cap: unempCap, adjusted: unempBase, payment: unemployment },
    injury: { floor: injuryBase, cap: injuryBase, adjusted: injuryBase, payment: injury }, // store floor/cap as ref to indicate no clamp
    hf: { floor: hfFloor, cap: hfCap, adjusted: hfBase, payment: hf },
  }
}

async function main() {
  const start = Date.now()
  console.log('🚀 Calculating 2023-01 (wide) into', TABLE)
  const policy = await getPolicyRules2023H1()
  const emps = await getEmployeesForJan()
  console.log(`Found ${emps.length} employees with salary in ${SALARY_MONTH_CN}`)

  const batchSize = 100
  let success = 0
  let fail = 0
  const failed = []

  for (let i = 0; i < emps.length; i += batchSize) {
    const chunk = emps.slice(i, i + batchSize)
    const rows = []
    for (const e of chunk) {
      try {
        const records = await getAllRecords(e.employee_id)
        if (!records.length) {
          throw new Error('no salary records')
        }
        const hireDate = records[0].hire_date || e.hire_date
        const category = determineCategory(hireDate, CALC_DATE)
        const firstGross = computeFirstGross(records)
        const avg2022 = computeAvgGrossForYear(records, 2022)

        let ref = null
        let refCat = ''
        if (category === 'A') {
          if (avg2022 == null) throw new Error('missing 2022 avg for A category')
          ref = avg2022
          refCat = '2022年平均工资'
        } else {
          ref = firstGross
          refCat = '入职首月工资'
        }
        const refRounded = round2(ref)
        const adj = buildAdjustments(refRounded, policy)
        const total = round2(adj.pension.payment + adj.medical.payment + adj.unemployment.payment + adj.injury.payment + adj.hf.payment)

        rows.push({
          employee_id: e.employee_id,
          calculation_month: CALC_MONTH_TEXT,
          employee_category: category,
          reference_wage_base: refRounded,
          reference_wage_category: refCat,

          pension_base_floor: adj.pension.floor,
          pension_base_cap: adj.pension.cap,
          pension_adjusted_base: adj.pension.adjusted,

          medical_base_floor: adj.medical.floor,
          medical_base_cap: adj.medical.cap,
          medical_adjusted_base: adj.medical.adjusted,

          unemployment_base_floor: adj.unemployment.floor,
          unemployment_base_cap: adj.unemployment.cap,
          unemployment_adjusted_base: adj.unemployment.adjusted,

          injury_base_floor: adj.injury.floor,
          injury_base_cap: adj.injury.cap,
          injury_adjusted_base: adj.injury.adjusted,

          hf_base_floor: adj.hf.floor,
          hf_base_cap: adj.hf.cap,
          hf_adjusted_base: adj.hf.adjusted,

          pension_payment: adj.pension.payment,
          medical_payment: adj.medical.payment,
          unemployment_payment: adj.unemployment.payment,
          injury_payment: adj.injury.payment,
          hf_payment: adj.hf.payment,
          theoretical_total: total,
        })
      } catch (err) {
        fail += 1
        failed.push({ employee_id: e.employee_id, error: err.message })
      }
    }

    if (rows.length) {
      const { error } = await supabase
        .from(TABLE)
        .insert(rows, { returning: 'minimal' })
      if (error) {
        console.error('Batch insert failed:', error.message)
        // keep recording failed employees for visibility
        for (const r of rows) failed.push({ employee_id: r.employee_id, error: 'insert failed: ' + error.message })
        fail += rows.length
      } else {
        success += rows.length
        console.log(`Inserted ${rows.length} rows (${success} total)`)
      }
    }
  }

  console.log(`\nDone. Success=${success}, Fail=${fail}, Time=${((Date.now()-start)/1000).toFixed(2)}s`)
  if (failed.length) {
    console.log('Failed examples (up to 10):', failed.slice(0, 10))
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
