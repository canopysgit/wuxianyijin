/*
  Insert a single employee's 2023 H2 (202307-202312) narrow-calculation rows
  into calculate_result_2023_h2_narrow, using employee_baseline + policy_rules.

  Usage:
    node scripts/insert_employee_2023h2_narrow.js DF-3615
    node scripts/insert_employee_2023h2_narrow.js 3615   // will try DF-3615 automatically
*/

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
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
function months2023H2() { return ['202307','202308','202309','202310','202311','202312'] }

function computeFirstInsuranceYMFromHireDate(hireDate) {
  if (!hireDate) return null
  try {
    const [yStr, mStr, dStr] = String(hireDate).split('-')
    let y = parseInt(yStr, 10)
    let m = parseInt(mStr, 10)
    const d = parseInt(dStr, 10)
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null
    if (d > 15) { m += 1; if (m > 12) { m = 1; y += 1 } }
    return String(y) + String(m).padStart(2, '0')
  } catch { return null }
}

async function getBaseline(id) {
  let eid = id
  let { data, error } = await supabase.from('employee_baseline').select('*').eq('employee_id', eid).single()
  if (error || !data) {
    if (!String(id).startsWith('DF-')) {
      eid = `DF-${id}`
      const res = await supabase.from('employee_baseline').select('*').eq('employee_id', eid).single()
      data = res.data; error = res.error
      if (error || !data) throw new Error(`employee_baseline not found for ${id} / ${eid}`)
    } else {
      throw new Error(`employee_baseline not found for ${id}`)
    }
  }
  return data
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

async function main() {
  const arg = process.argv[2]
  if (!arg) { console.error('Usage: node scripts/insert_employee_2023h2_narrow.js <EMPLOYEE_ID>'); process.exit(1) }

  console.log(`⚙️  (Re)insert 2023H2 narrow for ${arg}`)
  const base = await getBaseline(arg)
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

  const hireYear = new Date(base.hire_date).getUTCFullYear()
  const firstYM = base.first_insurance_month || computeFirstInsuranceYMFromHireDate(base.hire_date)
  const startYM = (firstYM && firstYM > '202307') ? firstYM : '202307'
  const months = months2023H2().filter(ym => ym >= startYM)

  const pref = hireYear < 2023 ? 'avg2022' : 'first'
  const avg22 = (base.avg_wage_narrow_2022 == null ? null : Number(base.avg_wage_narrow_2022))
  const first = (base.first_month_base_narrow == null ? null : Number(base.first_month_base_narrow))
  let refBase = pref === 'avg2022' ? avg22 : first
  if ((refBase == null || isNaN(refBase)) && pref === 'avg2022' && first != null) refBase = first
  if ((refBase == null || isNaN(refBase)) && pref === 'first' && avg22 != null) refBase = avg22
  if (refBase == null || isNaN(refBase)) throw new Error('Both avg_wage_narrow_2022 and first_month_base_narrow are null; cannot compute')

  const ref = round2(refBase)
  const refCat = (hireYear < 2023) ? '2022年平均工资' : '入职首月工资'

  // delete existing
  const { error: delErr } = await supabase
    .from('calculate_result_2023_h2_narrow')
    .delete()
    .eq('employee_id', base.employee_id)
    .gte('calculation_month', '202307')
    .lte('calculation_month', '202312')
  if (delErr) throw new Error('Delete failed: ' + delErr.message)

  const rows = []
  for (const ym of months) {
    const pensionAdj = round2(clamp(ref, floors.pension, caps.pension))
    const medicalAdj = round2(clamp(ref, floors.medical, caps.medical))
    const unempAdj = round2(clamp(ref, floors.unemployment, caps.unemployment))
    const injuryAdj = ref // no clamp per requirement
    const hfAdj = round2(clamp(ref, floors.hf, caps.hf))

    const pensionPay = round2(pensionAdj * rates.pension)
    const medicalPay = round2(medicalAdj * rates.medical)
    const unempPay = round2(unempAdj * rates.unemployment)
    const injuryPay = round2(injuryAdj * rates.injury)
    const hfPay = round2(hfAdj * rates.hf)

    rows.push({
      employee_id: base.employee_id,
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

  const { error: insErr } = await supabase
    .from('calculate_result_2023_h2_narrow')
    .insert(rows, { returning: 'minimal' })
  if (insErr) throw new Error('Insert failed: ' + insErr.message)

  console.log(`✅ Done. Wrote ${rows.length} rows for ${base.employee_id}`)
}

if (require.main === module) {
  main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })
}

