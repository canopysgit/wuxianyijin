/*
  Insert a single employee's 2023 H1 (202301-202306) wide-calculation rows
  into calculate_result_2023_h1_wide, using employee_baseline + policy_rules.

  Usage:
    node scripts/insert_employee_2023h1_wide.js DF-2127
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

// Fallback to hard-coded values present in repo (dev only)
const DEFAULT_URL = 'https://abtvvtnzethqnxqjsvyn.supabase.co'
const DEFAULT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ4OTA4NiwiZXhwIjoyMDY4MDY1MDg2fQ.ZpmsQkZcaGYf8xalik0G1HXPTVopADj4k6eV_jaX3r8'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

function round2(n) {
  if (n == null || isNaN(n)) return 0
  return Number.parseFloat(Number(n).toFixed(2))
}

function clamp(val, floor, cap) {
  let v = Number(val)
  const f = floor == null ? null : Number(floor)
  const c = cap == null ? null : Number(cap)
  if (f == null && c == null) return v
  if (f != null && v < f) v = f
  if (c != null && v > c) v = c
  return v
}

function months2023H1() {
  return [
    { ym: '202301', date: new Date(Date.UTC(2023, 0, 1)) },
    { ym: '202302', date: new Date(Date.UTC(2023, 1, 1)) },
    { ym: '202303', date: new Date(Date.UTC(2023, 2, 1)) },
    { ym: '202304', date: new Date(Date.UTC(2023, 3, 1)) },
    { ym: '202305', date: new Date(Date.UTC(2023, 4, 1)) },
    { ym: '202306', date: new Date(Date.UTC(2023, 5, 1)) },
  ]
}

async function main() {
  const employeeId = process.argv[2]
  if (!employeeId) {
    console.error('Usage: node scripts/insert_employee_2023h1_wide.js <EMPLOYEE_ID>')
    process.exit(1)
  }

  console.log(`⚙️  Preparing to (re)insert 2023H1 wide results for ${employeeId}`)

  // Fetch baseline
  const { data: base, error: baseErr } = await supabase
    .from('employee_baseline')
    .select('*')
    .eq('employee_id', employeeId)
    .single()
  if (baseErr || !base) {
    throw new Error(`employee_baseline not found for ${employeeId}: ${baseErr && baseErr.message}`)
  }

  // Fetch policy rules 2023 H1
  const { data: policy, error: polErr } = await supabase
    .from('policy_rules')
    .select('*')
    .eq('year', 2023)
    .eq('period', 'H1')
    .single()
  if (polErr || !policy) {
    throw new Error(`policy_rules 2023/H1 not found: ${polErr && polErr.message}`)
  }

  // Floors/caps; support both old(ss_base_*) and new per-insurance fields
  const floors = {
    pension: policy.pension_base_floor ?? policy.ss_base_floor,
    medical: policy.medical_base_floor ?? policy.ss_base_floor,
    unemployment: policy.unemployment_base_floor ?? policy.ss_base_floor,
    injury: policy.injury_base_floor ?? null,
    hf: policy.hf_base_floor,
  }
  const caps = {
    pension: policy.pension_base_cap ?? policy.ss_base_cap,
    medical: policy.medical_base_cap ?? policy.ss_base_cap,
    unemployment: policy.unemployment_base_cap ?? policy.ss_base_cap,
    injury: policy.injury_base_cap ?? null,
    hf: policy.hf_base_cap,
  }
  const rates = {
    pension: Number(policy.pension_rate_enterprise),
    medical: Number(policy.medical_rate_enterprise),
    unemployment: Number(policy.unemployment_rate_enterprise),
    injury: Number(policy.injury_rate_enterprise),
    hf: Number(policy.hf_rate_enterprise),
  }

  // Reference wage base for 2023H1: A=avg_2022, else=first_month_base_wide
  // Social security year for Jan-Jun 2023 = 2022
  const hireYear = new Date(base.hire_date).getUTCFullYear()
  const refBase = hireYear < 2022 ? Number(base.avg_wage_wide_2022) : Number(base.first_month_base_wide)
  const refCategory = hireYear < 2022 ? '2022年平均工资' : '入职首月工资'

  const rows = []
  for (const m of months2023H1()) {
    const pensionAdj = round2(clamp(refBase, floors.pension, caps.pension))
    const medicalAdj = round2(clamp(refBase, floors.medical, caps.medical))
    const unempAdj = round2(clamp(refBase, floors.unemployment, caps.unemployment))
    const injuryAdj = round2(clamp(refBase, floors.injury, caps.injury))
    const hfAdj = round2(clamp(refBase, floors.hf, caps.hf))

    const pensionPay = round2(pensionAdj * rates.pension)
    const medicalPay = round2(medicalAdj * rates.medical)
    const unempPay = round2(unempAdj * rates.unemployment)
    const injuryPay = round2(injuryAdj * rates.injury)
    const hfPay = round2(hfAdj * rates.hf)

    rows.push({
      employee_id: employeeId,
      calculation_month: m.ym, // TEXT YYYYMM
      employee_category: '',
      reference_wage_base: round2(refBase),
      reference_wage_category: refCategory,
      pension_base_floor: floors.pension,
      pension_base_cap: caps.pension,
      pension_adjusted_base: pensionAdj,
      medical_base_floor: floors.medical,
      medical_base_cap: caps.medical,
      medical_adjusted_base: medicalAdj,
      unemployment_base_floor: floors.unemployment,
      unemployment_base_cap: caps.unemployment,
      unemployment_adjusted_base: unempAdj,
      injury_base_floor: floors.injury,
      injury_base_cap: caps.injury,
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

  console.log(`🧹 Deleting existing rows for ${employeeId} (202301-202306) ...`)
  const { error: delErr } = await supabase
    .from('calculate_result_2023_h1_wide')
    .delete()
    .eq('employee_id', employeeId)
    .gte('calculation_month', '202301')
    .lte('calculation_month', '202306')
  if (delErr) throw new Error('Delete failed: ' + delErr.message)

  console.log(`📝 Inserting ${rows.length} rows ...`)
  const { error: insErr } = await supabase
    .from('calculate_result_2023_h1_wide')
    .insert(rows, { returning: 'minimal' })
  if (insErr) throw new Error('Insert failed: ' + insErr.message)

  console.log('✅ Done. Wrote rows for', employeeId)
}

if (require.main === module) {
  main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })
}

