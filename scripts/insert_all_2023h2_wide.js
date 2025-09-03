/*
  Bulk insert 2023 H2 (202307-202312) wide-calculation rows into
  calculate_result_2023_h2_wide for employees who have salary
  records in 2023 H2. Logs employees with missing reference base
  (avg_2022 and first_month both null) into calculation_missing_reference.

  Usage:
    node scripts/insert_all_2023h2_wide.js
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

async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ sql })
  })
  const text = await res.text()
  if (!res.ok) console.warn('exec_sql may not exist or failed:', res.status, text)
  return text
}

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
function months2023H2() { return ['202307','202308','202309','202310','202311','202312'] }

async function ensureMissingTable() {
  const sql = `
    create table if not exists calculation_missing_reference (
      id uuid primary key default gen_random_uuid(),
      period text not null,
      assumption text not null,
      employee_id text not null,
      hire_date date,
      preferred_source text,
      details text,
      created_at timestamptz default now()
    );
    create index if not exists idx_missing_ref_period on calculation_missing_reference(period);
  `
  try { await execSQL(sql) } catch (e) { /* best effort */ }
}

async function getPolicy() {
  const { data, error } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', 2023)
    .eq('period', 'H2')
    .single()
  if (error || !data) throw new Error('policy_rules 2023/H2 not found: ' + (error && error.message))
  return data
}
async function getEmployeeIdsWithH2Salary() {
  const { data, error } = await supabase
    .from('salary_records')
    .select('employee_id')
    .gte('salary_month_std', '202307')
    .lte('salary_month_std', '202312')
  if (error) throw new Error('query salary_records failed: ' + error.message)
  const set = new Set(); for (const r of data || []) set.add(r.employee_id); return Array.from(set)
}
async function getBaselines(employeeIds) {
  const result = new Map(); const chunkSize = 1000
  for (let i = 0; i < employeeIds.length; i += chunkSize) {
    const chunk = employeeIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('employee_baseline')
      .select('employee_id, hire_date, avg_wage_wide_2022, first_month_base_wide')
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
      .from('calculate_result_2023_h2_wide')
      .delete()
      .in('employee_id', chunk)
      .gte('calculation_month', '202307')
      .lte('calculation_month', '202312')
    if (error) throw new Error('delete existing failed: ' + error.message)
  }
}
async function insertRows(rows) {
  const chunkSize = 1000
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('calculate_result_2023_h2_wide')
      .insert(chunk, { returning: 'minimal' })
    if (error) throw new Error('insert failed: ' + error.message)
  }
}
async function insertMissing(missings) {
  if (!missings.length) return
  try {
    const chunkSize = 1000
    for (let i = 0; i < missings.length; i += chunkSize) {
      const chunk = missings.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('calculation_missing_reference')
        .insert(chunk, { returning: 'minimal' })
      if (error) throw error
    }
  } catch (e) {
    // Fallback to local file if table doesn't exist
    const file = path.join(process.cwd(), `missing_refs_2023H2_wide_${Date.now()}.json`)
    try { fs.writeFileSync(file, JSON.stringify(missings, null, 2), 'utf-8') } catch {}
    console.warn('Missing references written to', file)
  }
}

async function main() {
  const start = Date.now()
  console.log('🚀 Bulk insert 2023 H2 wide for employees with H2 salary records')

  await ensureMissingTable()
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

  const empIds = await getEmployeeIdsWithH2Salary(); console.log(`👥 Employees in 2023H2 salary: ${empIds.length}`)
  if (!empIds.length) { console.log('Nothing to do'); return }
  const baselines = await getBaselines(empIds)

  const rows = []; const missings = []
  for (const empId of empIds) {
    const b = baselines.get(empId); if (!b) continue
    const hireYear = new Date(b.hire_date).getUTCFullYear()
    const pref = hireYear < 2023 ? 'avg2022' : 'first'
    const avg22 = (b.avg_wage_wide_2022 == null ? null : Number(b.avg_wage_wide_2022))
    const first = (b.first_month_base_wide == null ? null : Number(b.first_month_base_wide))

    let refBase = (pref === 'avg2022') ? avg22 : first
    if ((refBase == null || isNaN(refBase)) && pref === 'avg2022' && first != null) refBase = first
    if ((refBase == null || isNaN(refBase)) && pref === 'first' && avg22 != null) refBase = avg22
    if (refBase == null || isNaN(refBase)) {
      missings.push({ period: '2023H2', assumption: 'wide', employee_id: empId, hire_date: b.hire_date, preferred_source: pref, details: 'avg_wage_wide_2022 and first_month_base_wide both null' })
      continue
    }
    const ref = round2(refBase)
    const refCat = (hireYear < 2023) ? '2022年平均工资' : '入职首月工资'

    for (const ym of months2023H2()) {
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

  console.log('🧹 Deleting existing rows for all employees in range 202307-202312 ...')
  await deleteExisting(empIds)
  console.log(`📝 Inserting ${rows.length} rows ...`)
  await insertRows(rows)
  if (missings.length) {
    console.log(`📝 Logging ${missings.length} employees with missing reference base ...`)
    await insertMissing(missings)
  }

  const sec = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`✅ Done. Employees=${empIds.length}, Rows=${rows.length}, Missing=${missings.length}, Time=${sec}s`)
}

if (require.main === module) { main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) }) }
