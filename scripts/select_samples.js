// Read-only script to select typical employees for sample.md
// - Uses Supabase anon or service role key from .env.local
// - Performs ONLY SELECT queries (no INSERT/UPDATE/DELETE)

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Prefer anon key for read-only; fall back to service key if anon missing
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Periods and representative calculation dates
const periods = [
  { name: '2023H1', year: 2023, period: 'H1', calcDate: new Date('2023-03-01') },
  { name: '2023H2', year: 2023, period: 'H2', calcDate: new Date('2023-08-01') },
  { name: '2024H1', year: 2024, period: 'H1', calcDate: new Date('2024-03-01') },
  { name: '2024H2', year: 2024, period: 'H2', calcDate: new Date('2024-08-01') }, // up to Sep; mid-Aug used for classification
]

function socialSecurityYear(calculationMonth) {
  const m = calculationMonth.getMonth() + 1
  const y = calculationMonth.getFullYear()
  return m >= 7 ? y : y - 1
}

function determineEmployeeCategoryNew(hireDate, calculationMonth) {
  const hireYear = new Date(hireDate).getFullYear()
  const ssYear = socialSecurityYear(calculationMonth)
  if (hireYear < ssYear) return 'A'
  if (hireYear === ssYear) return 'B'
  if (hireYear === ssYear + 1) return 'C'
  return 'UNKNOWN'
}

function yearOf(dateStr) {
  const d = parseYmAscii(dateStr)
  return d.getFullYear()
}

function isBetween(val, floor, cap) {
  return val >= floor && val <= cap
}

function parseChineseMonth(s) {
  if (!s) return new Date('Invalid')
  if (typeof s === 'string') {
    const m = s.match(/(\d{4})\D?([0-1]?\d)\D?月?/)
    // Prefer explicit 年月 like 2023年1月 or 2023-01
    const ym = s.match(/(\d{4})\s*年\s*([0-1]?\d)\s*月/)
    if (ym) {
      const y = parseInt(ym[1], 10)
      const mo = parseInt(ym[2], 10)
      return new Date(Date.UTC(y, mo - 1, 1))
    }
    const ymdash = s.match(/(\d{4})-(\d{1,2})/)
    if (ymdash) {
      const y = parseInt(ymdash[1], 10)
      const mo = parseInt(ymdash[2], 10)
      return new Date(Date.UTC(y, mo - 1, 1))
    }
    if (m) {
      const y = parseInt(m[1], 10)
      const mo = parseInt(m[2], 10)
      return new Date(Date.UTC(y, mo - 1, 1))
    }
  }
  const d = new Date(s)
  return d
}

async function fetchPolicyRules() {
  const rules = {}
  for (const p of periods) {
    const { data, error } = await supabase
      .from('policy_rules')
      .select('*')
      .eq('year', p.year)
      .eq('period', p.period)
      .single()
    if (error || !data) throw new Error(`Policy rules missing for ${p.name}: ${error?.message || 'not found'}`)
    rules[p.name] = data
  }
  return rules
}

async function fetchSalaryRecordsWindowed() {
  const start = '2022-01-01'
  const end = '2024-09-30'
  const pageSize = 1000
  let from = 0
  let to = from + pageSize - 1
  const rows = []
  for (;;) {
    const { data, error } = await supabase
      .from('salary_records')
      .select('employee_id,hire_date,salary_month,gross_salary')
      .gte('salary_month', start)
      .lte('salary_month', end)
      .order('employee_id', { ascending: true })
      .order('salary_month', { ascending: true })
      .range(from, to)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    // If returned less than pageSize, still try next page; stop when empty
    from = to + 1
    to = from + pageSize - 1
  }
  return rows
}

function buildEmployeeStats(rows) {
  const byEmp = new Map()
  for (const r of rows) {
    if (!byEmp.has(r.employee_id)) {
      byEmp.set(r.employee_id, {
        employee_id: r.employee_id,
        hire_date: r.hire_date,
        first_month: r.salary_month,
        first_gross: Number(r.gross_salary) || 0,
        avg2022_sum: 0,
        avg2022_cnt: 0,
        avg2023_sum: 0,
        avg2023_cnt: 0,
      })
    }
    const e = byEmp.get(r.employee_id)
    // earliest first
    if (parseYmAscii(r.salary_month) < parseYmAscii(e.first_month)) {
      e.first_month = r.salary_month
      e.first_gross = Number(r.gross_salary) || 0
    }
    const y = yearOf(r.salary_month)
    if (y === 2022) {
      e.avg2022_sum += Number(r.gross_salary) || 0
      e.avg2022_cnt += 1
    } else if (y === 2023) {
      e.avg2023_sum += Number(r.gross_salary) || 0
      e.avg2023_cnt += 1
    }
  }

  // finalize averages
  for (const e of byEmp.values()) {
    e.avg2022 = e.avg2022_cnt > 0 ? e.avg2022_sum / e.avg2022_cnt : undefined
    e.avg2023 = e.avg2023_cnt > 0 ? e.avg2023_sum / e.avg2023_cnt : undefined
    e.hire_year = new Date(e.hire_date).getFullYear()
  }
  return Array.from(byEmp.values())
}

// ASCII-only parser for year-month strings like "2023年1月" / "2023-01" / "2023/1" / "2023 1"
function parseYmAscii(s) {
  if (!s) return new Date('Invalid')
  if (typeof s === 'string') {
    let m = s.match(/^(\d{4})\D+(\d{1,2})\D*$/)
    if (!m) m = s.match(/^(\d{4})-(\d{1,2})$/)
    if (!m) m = s.match(/^(\d{4})\/(\d{1,2})$/)
    if (!m) m = s.match(/^(\d{4})\s+(\d{1,2})$/)
    if (m) {
      const y = parseInt(m[1], 10)
      const mo = parseInt(m[2], 10)
      return new Date(Date.UTC(y, mo - 1, 1))
    }
  }
  const d = new Date(s)
  return d
}

function selectReferenceWageWide(emp, periodName) {
  // New engine: wide = gross
  if (periodName === '2023H1' || periodName === '2023H2') {
    // A: use 2022 avg; B/C: first
    return {
      A: emp.avg2022,
      B: emp.first_gross,
      C: emp.first_gross,
      source: {
        A: '2022年平均工资',
        B: '入职首月工资',
        C: '入职首月工资',
      },
    }
  }
  if (periodName === '2024H1') {
    // A: 2022 avg; B/C: first
    return {
      A: emp.avg2022,
      B: emp.first_gross,
      C: emp.first_gross,
      source: { A: '2022年平均工资', B: '入职首月工资', C: '入职首月工资' },
    }
  }
  if (periodName === '2024H2') {
    // A: 2023 avg; B/C: first
    return {
      A: emp.avg2023,
      B: emp.first_gross,
      C: emp.first_gross,
      source: { A: '2023年平均工资', B: '入职首月工资', C: '入职首月工资' },
    }
  }
  return { A: undefined, B: undefined, C: undefined, source: {} }
}

function classifyLevel(ref, rule) {
  if (ref == null || isNaN(ref)) return 'unknown'
  const low = Number(rule.ss_base_floor)
  const high = Number(rule.ss_base_cap)
  if (ref < low) return 'below_floor'
  if (ref > high) return 'above_cap'
  return 'within_range'
}

async function main() {
  console.log('Fetching policy rules...')
  const rules = await fetchPolicyRules()

  console.log('Fetching salary records (2022-01-01 .. 2024-09-30)...')
  const rows = await fetchSalaryRecordsWindowed()
  console.log(`Fetched ${rows.length} salary rows`)

  const emps = buildEmployeeStats(rows)
  console.log(`Employees aggregated: ${emps.length}`)
  // Year distribution
  const yearDist = rows.reduce((acc, r) => {
    const y = parseYmAscii(r.salary_month).getFullYear()
    acc[y] = (acc[y] || 0) + 1
    return acc
  }, {})
  console.log('Record year distribution:', yearDist)
  // Sample months
  const sampleMonths = Array.from(new Set(rows.slice(0, 50).map(r => r.salary_month))).slice(0, 5)
  console.log('Sample salary_month values:', sampleMonths)
  console.log('Parsed sample months:', sampleMonths.map(s => parseYmAscii(s).toISOString ? parseYmAscii(s).toISOString() : String(parseYmAscii(s))))

  // Create buckets per period and category/level
  const samples = {}
  const wantLevels = ['within_range', 'below_floor', 'above_cap']

  for (const p of periods) {
    samples[p.name] = { A: {}, B: {}, C: {} }
    for (const lvl of wantLevels) {
      samples[p.name].A[lvl] = null
      samples[p.name].B[lvl] = null
      samples[p.name].C[lvl] = null
    }
  }

  // Iterate employees and fill first matching slots
  const stats = {}
  for (const emp of emps) {
    for (const p of periods) {
      const cat = determineEmployeeCategoryNew(emp.hire_date, p.calcDate)
      if (cat === 'UNKNOWN') continue
      const refPack = selectReferenceWageWide(emp, p.name)
      const ref = refPack[cat]
      if (ref == null) continue
      const lvl = classifyLevel(ref, rules[p.name])
      if (!wantLevels.includes(lvl)) continue
      const key = `${p.name}/${cat}/${lvl}`
      stats[key] = (stats[key] || 0) + 1
      if (!samples[p.name][cat][lvl]) {
        samples[p.name][cat][lvl] = {
          employee_id: emp.employee_id,
          hire_date: emp.hire_date,
          hire_year: emp.hire_year,
          category: cat,
          period: p.name,
          reference_wage: Math.round(ref * 100) / 100,
          reference_source: refPack.source[cat],
        }
      }
    }
  }
  console.log('Bucket counts:')
  Object.keys(stats).sort().forEach(k => console.log(`  ${k}: ${stats[k]}`))

  // Cross-period conversion examples
  const cross = { _2022_to_2023: null, _2023_to_2024: null }
  for (const emp of emps) {
    if (!cross._2022_to_2023 && emp.hire_year === 2022) {
      const catH1 = determineEmployeeCategoryNew(emp.hire_date, new Date('2023-03-01')) // B expected
      const catH2 = determineEmployeeCategoryNew(emp.hire_date, new Date('2023-08-01')) // A expected
      if (catH1 === 'B' && catH2 === 'A') cross._2022_to_2023 = { employee_id: emp.employee_id, hire_date: emp.hire_date }
    }
    if (!cross._2023_to_2024 && emp.hire_year === 2023) {
      const catH1 = determineEmployeeCategoryNew(emp.hire_date, new Date('2024-03-01')) // B expected
      const catH2 = determineEmployeeCategoryNew(emp.hire_date, new Date('2024-08-01')) // A expected
      if (catH1 === 'B' && catH2 === 'A') cross._2023_to_2024 = { employee_id: emp.employee_id, hire_date: emp.hire_date }
    }
    if (cross._2022_to_2023 && cross._2023_to_2024) break
  }

  // Build markdown
  const lines = []
  lines.push('# 典型员工清单 (宽口径, 新引擎, 佛山政策)')
  lines.push('')
  lines.push('- 期间: 2023H1、2023H2、2024H1、2024H2（2024H2至9月）')
  lines.push('- 分类: 按社保年度制 A/B/C')
  lines.push('- 参考工资: 宽口径（gross_salary），A类按年均（2022或2023），B/C为入职首月工资')
  lines.push('- 上下限判断: 同时参考社保与公积金上下限；低于两者较小者为“低于下限”，高于两者较大者为“高于上限”，两者区间内为“区间内”')
  lines.push('')

  for (const p of periods) {
    lines.push(`## ${p.name}`)
    for (const cat of ['A', 'B', 'C']) {
      lines.push(`- 类别 ${cat}:`)
      for (const [label, key] of [
        ['区间内', 'within_range'],
        ['低于下限', 'below_floor'],
        ['高于上限', 'above_cap'],
      ]) {
        const item = samples[p.name][cat][key]
        if (item) {
          lines.push(`  - ${label}: ${item.employee_id} | 入职: ${item.hire_date} | 参考工资: ${item.reference_wage} (${item.reference_source})`)
        } else {
          lines.push(`  - ${label}: 暂未找到合适样本`)
        }
      }
    }
    lines.push('')
  }

  lines.push('## 跨期转换样本')
  if (cross._2022_to_2023) {
    lines.push(`- 2022入职 → 2023年H1为B类、H2为A类: ${cross._2022_to_2023.employee_id} | 入职: ${cross._2022_to_2023.hire_date}`)
  } else {
    lines.push('- 2022入职 → 2023年H1=B、H2=A: 暂未找到')
  }
  if (cross._2023_to_2024) {
    lines.push(`- 2023入职 → 2024年H1为B类、H2为A类: ${cross._2023_to_2024.employee_id} | 入职: ${cross._2023_to_2024.hire_date}`)
  } else {
    lines.push('- 2023入职 → 2024年H1=B、H2=A: 暂未找到')
  }

  const outPath = path.resolve(process.cwd(), 'sample.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`\nWritten: ${outPath}`)
}

main().catch((e) => {
  console.error('Failed to build samples:', e)
  process.exit(1)
})
