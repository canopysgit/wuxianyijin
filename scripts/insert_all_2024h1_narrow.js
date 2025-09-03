/*
  Bulk insert 2024 H1 (202401-202406) narrow-calculation rows into
  calculate_result_2024_h1_narrow for employees who have salary
  records in 2024 H1. If reference base missing (avg_2022 & first
  both null), skip and write to a local JSON file for review.

  Usage:
    node scripts/insert_all_2024h1_narrow.js
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const DEFAULT_URL = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const DEFAULT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

function round2(n) { if (n == null || isNaN(n)) return 0; return Number.parseFloat(Number(n).toFixed(2)) }
function clamp(val, floor, cap) {
  let v = Number(val)
  const f = floor == null ? null : Number(floor)
  const c = cap == null ? null : Number(cap)
  if (f == null && c == null) return v
  if (f != null && v < f) v = f
  if (c != null && v > c) v = c
  return v
}
function months2024H1() { return ['202401','202402','202403','202404','202405','202406'] }

async function getPolicy() {
  const { data, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', 2024)
    .eq('period', 'H1')
    .single()
  if (error || !data) throw new Error('policy_rules 2024/H1 not found: ' + (error && error.message))
  return data
}

async function getEmployeeIdsWithH1Salary() {
  const { data, error } = await supabase
    .from('salary_records')
    .select('employee_id')
    .gte('salary_month_std', '202401')
    .lte('salary_month_std', '202406')
  if (error) throw new Error('query salary_records failed: ' + error.message)
  const set = new Set(); for (const r of data || []) set.add(r.employee_id); return Array.from(set)
}

async function getBaselines(employeeIds) {
  const result = new Map(); const chunkSize = 1000
  for (let i = 0; i < employeeIds.length; i += chunkSize) {
    const chunk = employeeIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('employee_baseline')
      .select('employee_id, hire_date, avg_wage_narrow_2022, first_month_base_narrow')
      .in('employee_id', chunk)
    if (error) throw new Error('query employee_baseline failed: ' + error.message)
    for (const b of data || []) result.set(b.employee_id, b)
  }
  return result
}

async function deleteExisting(employeeIds) {
  const chunkSize = 500
  for (let i = 0; i < employeeIds.length; i += chunkSize) {
    const chunk = employeeIds.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('calculate_result_2024_h1_narrow')
      .delete()
      .in('employee_id', chunk)
      .gte('calculation_month', '202401')
      .lte('calculation_month', '202406')
    if (error) throw new Error('delete existing failed: ' + error.message)
  }
}

async function insertRows(rows) {
  const chunkSize = 1000
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('calculate_result_2024_h1_narrow')
      .insert(chunk, { returning: 'minimal' })
    if (error) throw new Error('insert failed: ' + error.message)
  }
}

async function main() {
  const start = Date.now()
  console.log('🚀 Bulk insert 2024 H1 narrow for employees with H1 salary records')

  const policy = await getPolicy()
  const floors = {
    pension: policy.pension_base_floor ?? policy.ss_base_floor,
    medical: policy.medical_base_floor ?? policy.ss_base_floor,
    unemployment: policy.unemployment_base_floor ?? policy.ss_base_floor,
    hf: policy.hf_base_floor,
  }
  const caps = {
    pension: policy.pension_base_cap ?? policy.ss_base_cap,
    medical: policy.medical_base_cap ?? policy.ss_base_cap,
    unemployment: policy.unemployment_base_cap ?? policy.ss_base_cap,
    hf: policy.hf_base_cap,
  }
  const rates = {
    pension: Number(policy.pension_rate_enterprise),
    medical: Number(policy.medical_rate_enterprise),
    unemployment: Number(policy.unemployment_rate_enterprise),
    injury: Number(policy.injury_rate_enterprise),
    hf: Number(policy.hf_rate_enterprise),
  }

  const empIds = await getEmployeeIdsWithH1Salary(); console.log(`👥 Employees in 2024H1 salary: ${empIds.length}`)
  if (!empIds.length) { console.log('Nothing to do'); return }
  const baselines = await getBaselines(empIds)

  const rows = []; const missings = []
  for (const empId of empIds) {
    const b = baselines.get(empId); if (!b) continue
    // 2024H1 属于 2023社保年度；hire_year < 2023 使用 2022年均，否则首月基数
    const hireYear = new Date(b.hire_date).getUTCFullYear()
    const pref = hireYear < 2023 ? 'avg2022' : 'first'
    const avg22 = (b.avg_wage_narrow_2022 == null ? null : Number(b.avg_wage_narrow_2022))
    const first = (b.first_month_base_narrow == null ? null : Number(b.first_month_base_narrow))

    let refBase = (pref === 'avg2022') ? avg22 : first
    if ((refBase == null || isNaN(refBase)) && pref === 'avg2022' && first != null) refBase = first
    if ((refBase == null || isNaN(refBase)) && pref === 'first' && avg22 != null) refBase = avg22
    if (refBase == null || isNaN(refBase)) {
      missings.push({ period: '2024H1', assumption: 'narrow', employee_id: empId, hire_date: b.hire_date, preferred_source: pref, details: 'avg_wage_narrow_2022 and first_month_base_narrow both null' })
      continue
    }
    const ref = round2(refBase)
    const refCat = (hireYear < 2023) ? '2022年平均工资' : '入职首月工资'

    for (const ym of months2024H1()) {
      const pensionAdj = round2(clamp(ref, floors.pension, caps.pension))
      const medicalAdj = round2(clamp(ref, floors.medical, caps.medical))
      const unempAdj = round2(clamp(ref, floors.unemployment, caps.unemployment))
      const injuryAdj = ref // no clamp
      const hfAdj = round2(clamp(ref, floors.hf, caps.hf))

      const pensionPay = round2(pensionAdj * rates.pension)
      const medicalPay = round2(medicalAdj * rates.medical)
      const unempPay = round2(unempAdj * rates.unemployment)
      const injuryPay = round2(injuryAdj * rates.injury)
      const hfPay = round2(hfAdj * rates.hf)

      rows.push({
        employee_id: empId,
        calculation_month: ym,
        employee_category: '',
        reference_wage_base: ref,
        reference_wage_category: refCat,
        pension_base_floor: floors.pension,
        pension_base_cap: caps.pension,
        pension_adjusted_base: pensionAdj,
        medical_base_floor: floors.medical,
        medical_base_cap: caps.medical,
        medical_adjusted_base: medicalAdj,
        unemployment_base_floor: floors.unemployment,
        unemployment_base_cap: caps.unemployment,
        unemployment_adjusted_base: unempAdj,
        injury_base_floor: injuryAdj,
        injury_base_cap: injuryAdj,
        injury_adjusted_base: injuryAdj,
        hf_base_floor: floors.hf,
        hf_base_cap: caps.hf,
        hf_adjusted_base: hfAdj,
        pension_payment: pensionPay,
        medical_payment: medicalPay,
        unemployment_payment: unempPay,
        injury_payment: injuryPay,
        hf_payment: hfPay,
        theoretical_total: round2(pensionPay + medicalPay + unempPay + injuryPay + hfPay),
      })
    }
  }

  console.log('🧹 Deleting existing rows for all employees in range 202401-202406 ...')
  await deleteExisting(empIds)
  console.log(`📝 Inserting ${rows.length} rows ...`)
  await insertRows(rows)

  if (missings.length) {
    const file = path.join(process.cwd(), `missing_refs_2024H1_narrow_${Date.now()}.json`)
    try { fs.writeFileSync(file, JSON.stringify(missings, null, 2), 'utf-8') } catch {}
    console.warn(`Missing reference list written to ${file}`)
  }

  const sec = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`✅ Done. Employees=${empIds.length}, Rows=${rows.length}, Missing=${missings.length}, Time=${sec}s`)
}

if (require.main === module) {
  main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })
}

