/*
  Efficient batch calculator for 2023 H1 (Feb-Jun) wide results.
  - Strictly matches salary_month: '2023年2月'..'2023年6月'
  - calculation_month stored as text: '202302'..'202306'
  - Category by SS-year (July switch), hire month considered in-service
  - Per-insurance floors/caps (pension/medical/unemployment/hf); injury not clamped
  - Round adjusted bases and payments to 2 decimals
  - Pre-fetch rules once; pre-fetch salary records for involved employees (chunked)
  - Delete existing target months before insert, then insert in batches
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Ensure URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const MONTHS = [
  { text: '202302', cn: '2023年2月', date: new Date(Date.UTC(2023, 1, 1)) },
  { text: '202303', cn: '2023年3月', date: new Date(Date.UTC(2023, 2, 1)) },
  { text: '202304', cn: '2023年4月', date: new Date(Date.UTC(2023, 3, 1)) },
  { text: '202305', cn: '2023年5月', date: new Date(Date.UTC(2023, 4, 1)) },
  { text: '202306', cn: '2023年6月', date: new Date(Date.UTC(2023, 5, 1)) },
]

const TABLE = 'calculate_result_2023_h1_wide'

function round2(n) { return Number.parseFloat(Number(n ?? 0).toFixed(2)) }

function parseChineseMonth(s) {
  if (!s) return new Date('Invalid')
  if (typeof s === 'string') {
    const m = s.match(/^(\d{4})\s*年\s*([0-1]?\d)\s*月$/)
    if (m) return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1))
    const ymd = s.match(/^(\d{4})-(\d{1,2})$/)
    if (ymd) return new Date(Date.UTC(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, 1))
  }
  return new Date(s)
}

function ssYear(d) { const m = d.getUTCMonth() + 1; const y = d.getUTCFullYear(); return m >= 7 ? y : y - 1 }
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

async function listEmployeesByMonth(monthCN) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('employee_id, hire_date')
    .eq('salary_month', monthCN)
  if (error) throw new Error('Query employees for ' + monthCN + ' failed: ' + error.message)
  const map = new Map()
  for (const r of data || []) if (!map.has(r.employee_id)) map.set(r.employee_id, r)
  return Array.from(map.values())
}

async function fetchRecordsForEmployees(empIds) {
  // chunked .in() queries
  const chunkSize = 1000
  const rows = []
  for (let i = 0; i < empIds.length; i += chunkSize) {
    const chunk = empIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('salary_records')
      .select('employee_id, salary_month, gross_salary, hire_date')
      .in('employee_id', chunk)
    if (error) throw new Error('Fetch salary_records failed: ' + error.message)
    rows.push(...(data || []))
  }
  return rows
}

function buildEmpStats(allRows) {
  // Group by employee_id
  const byEmp = new Map()
  for (const r of allRows) {
    let e = byEmp.get(r.employee_id)
    if (!e) {
      e = { employee_id: r.employee_id, records: [], hire_date: r.hire_date }
      byEmp.set(r.employee_id, e)
    }
    e.records.push(r)
    if (!e.hire_date && r.hire_date) e.hire_date = r.hire_date
  }
  // Derive stats
  for (const e of byEmp.values()) {
    // firstGross
    let first = e.records[0]
    for (const r of e.records) if (parseChineseMonth(r.salary_month) < parseChineseMonth(first.salary_month)) first = r
    e.firstGross = Number(first.gross_salary) || 0
    // avg2022
    const y2022 = e.records.filter(r => parseChineseMonth(r.salary_month).getUTCFullYear() === 2022)
    if (y2022.length) e.avg2022 = y2022.reduce((a, r) => a + (Number(r.gross_salary) || 0), 0) / y2022.length
  }
  return byEmp
}

function pick(valA, fallback) { return (valA == null || isNaN(valA)) ? fallback : valA }
function clamp(val, floor, cap) { if (floor == null || cap == null || isNaN(floor) || isNaN(cap)) return val; return Math.min(Math.max(val, Number(floor)), Number(cap)) }

function buildAdjustments(ref, rules) {
  const pensionFloor = pick(Number(rules.pension_base_floor), Number(rules.ss_base_floor))
  const pensionCap = pick(Number(rules.pension_base_cap), Number(rules.ss_base_cap))
  const medicalFloor = pick(Number(rules.medical_base_floor), Number(rules.ss_base_floor))
  const medicalCap = pick(Number(rules.medical_base_cap), Number(rules.ss_base_cap))
  const unempFloor = pick(Number(rules.unemployment_base_floor), Number(rules.ss_base_floor))
  const unempCap = pick(Number(rules.unemployment_base_cap), Number(rules.ss_base_cap))
  const hfFloor = Number(rules.hf_base_floor)
  const hfCap = Number(rules.hf_base_cap)

  const pensionBase = round2(clamp(ref, pensionFloor, pensionCap))
  const medicalBase = round2(clamp(ref, medicalFloor, medicalCap))
  const unempBase = round2(clamp(ref, unempFloor, unempCap))
  const injuryBase = round2(ref) // no clamp
  const hfBase = round2(clamp(ref, hfFloor, hfCap))

  const pension = round2(pensionBase * Number(rules.pension_rate_enterprise))
  const medical = round2(medicalBase * Number(rules.medical_rate_enterprise))
  const unemployment = round2(unempBase * Number(rules.unemployment_rate_enterprise))
  const injury = round2(injuryBase * Number(rules.injury_rate_enterprise))
  const hf = round2(hfBase * Number(rules.hf_rate_enterprise))

  return {
    pension: { floor: pensionFloor, cap: pensionCap, adjusted: pensionBase, payment: pension },
    medical: { floor: medicalFloor, cap: medicalCap, adjusted: medicalBase, payment: medical },
    unemployment: { floor: unempFloor, cap: unempCap, adjusted: unempBase, payment: unemployment },
    injury: { floor: injuryBase, cap: injuryBase, adjusted: injuryBase, payment: injury },
    hf: { floor: hfFloor, cap: hfCap, adjusted: hfBase, payment: hf },
  }
}

async function main() {
  console.log('🚀 Calculating 2023 H1 months (Feb-Jun) into', TABLE)
  const rules = await getPolicyRules2023H1()

  // 1) List employees per month and build union
  const empByMonth = new Map() // key=YYYYMM, val=Set(employee_id)
  const unionSet = new Set()
  for (const m of MONTHS) {
    const list = await listEmployeesByMonth(m.cn)
    const set = new Set(list.map(x => x.employee_id))
    empByMonth.set(m.text, set)
    list.forEach(x => unionSet.add(x.employee_id))
    console.log(`${m.cn} employees: ${set.size}`)
  }

  const allEmpIds = Array.from(unionSet)
  console.log('Union employees:', allEmpIds.length)

  // 2) Pre-fetch all salary records for union employees and build stats
  // Only fetch 2022 records to compute avg2022 (lower data volume)
  async function fetch2022ForEmployees(empIds) {
    const months2022 = ['2022年1月','2022年2月','2022年3月','2022年4月','2022年5月','2022年6月','2022年7月','2022年8月','2022年9月','2022年10月','2022年11月','2022年12月']
    const chunkSize = 1000
    const rows = []
    for (let i = 0; i < empIds.length; i += chunkSize) {
      const chunk = empIds.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from('salary_records')
        .select('employee_id, salary_month, gross_salary, hire_date')
        .in('employee_id', chunk)
        .in('salary_month', months2022)
      if (error) throw new Error('Fetch 2022 salary records failed: ' + error.message)
      rows.push(...(data || []))
    }
    return rows
  }

  // Fetch minimal rows to compute firstGross (earliest record per employee)
  async function fetchEarliestPerEmployee(empIds) {
    const chunkSize = 1000
    const rows = []
    for (let i = 0; i < empIds.length; i += chunkSize) {
      const chunk = empIds.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from('salary_records')
        .select('employee_id, salary_month, gross_salary, hire_date')
        .in('employee_id', chunk)
      if (error) throw new Error('Fetch earliest salary records failed: ' + error.message)
      rows.push(...(data || []))
    }
    // reduce to earliest only
    const earliest = new Map()
    for (const r of rows) {
      const prev = earliest.get(r.employee_id)
      if (!prev || parseChineseMonth(r.salary_month) < parseChineseMonth(prev.salary_month)) earliest.set(r.employee_id, r)
    }
    return Array.from(earliest.values())
  }

  const rows2022 = allEmpIds.length ? await fetch2022ForEmployees(allEmpIds) : []
  const earliestRows = allEmpIds.length ? await fetchEarliestPerEmployee(allEmpIds) : []
  // Build stats map
  const statsMap = new Map()
  // avg2022
  const byEmp2022 = new Map()
  for (const r of rows2022) {
    const arr = byEmp2022.get(r.employee_id) || []
    arr.push(r)
    byEmp2022.set(r.employee_id, arr)
  }
  for (const empId of allEmpIds) {
    const recs2022 = byEmp2022.get(empId) || []
    let avg2022
    if (recs2022.length) {
      const sum = recs2022.reduce((a, r) => a + (Number(r.gross_salary) || 0), 0)
      avg2022 = sum / recs2022.length
    }
    statsMap.set(empId, { employee_id: empId, avg2022, firstGross: undefined, hire_date: (recs2022[0]?.hire_date) })
  }
  // earliest (firstGross)
  for (const r of earliestRows) {
    const e = statsMap.get(r.employee_id) || { employee_id: r.employee_id }
    e.firstGross = Number(r.gross_salary) || 0
    e.hire_date = e.hire_date || r.hire_date
    statsMap.set(r.employee_id, e)
  }

  // 3) Clean existing rows for target months
  const targetMonths = MONTHS.map(m => m.text)
  {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .in('calculation_month', targetMonths)
    if (error) {
      console.error('Delete target months failed:', error.message)
      // continue; not fatal
    } else {
      console.log('Cleared target months:', targetMonths.join(','))
    }
  }

  // 4) Build rows per month and insert in batches
  let total = 0, success = 0, fail = 0
  const failed = []
  const batchSize = 5000

  for (const m of MONTHS) {
    const set = empByMonth.get(m.text) || new Set()
    const rows = []
    for (const empId of set) {
      try {
        const st = statsMap.get(empId)
        if (!st) throw new Error('missing stats')
        const category = determineCategory(st.hire_date, m.date)
        let ref = null, refCat = ''
        if (category === 'A') {
          if (st.avg2022 == null) throw new Error('missing 2022 avg for A')
          ref = st.avg2022; refCat = '2022年平均工资'
        } else { ref = st.firstGross; refCat = '入职首月工资' }
        const refRounded = round2(ref)
        const adj = buildAdjustments(refRounded, rules)
        const totalPay = round2(adj.pension.payment + adj.medical.payment + adj.unemployment.payment + adj.injury.payment + adj.hf.payment)
        rows.push({
          employee_id: empId,
          calculation_month: m.text,
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
          theoretical_total: totalPay,
        })
      } catch (e) {
        fail += 1
        failed.push({ employee_id: empId, month: m.text, error: e.message })
      }
      total += 1
    }

    // Insert in large batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)
      if (!chunk.length) continue
      const { error } = await supabase.from(TABLE).insert(chunk, { returning: 'minimal' })
      if (error) {
        console.error(`Insert failed for ${m.text}:`, error.message)
        fail += chunk.length
      } else {
        success += chunk.length
        console.log(`Inserted ${chunk.length} rows for ${m.text} (success=${success})`)
      }
    }
  }

  console.log(`\nDone. total=${total}, success=${success}, fail=${fail}`)
  if (failed.length) console.log('Failures (up to 20):', failed.slice(0, 20))
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
