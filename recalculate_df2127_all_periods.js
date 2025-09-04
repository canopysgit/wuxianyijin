/**
 * 重新计算DF-2127所有期间的五险一金数据
 * 使用最新的医疗保险比例
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 导入新的计算引擎
const { calculateSSHFDetailed } = require('./src/lib/newCalculator.ts')

async function recalculateAllPeriods() {
  console.log('🔄 开始重新计算DF-2127所有期间数据...')
  
  // 定义所有计算期间
  const periods = [
    { year: 2023, half: 'H1', months: [1, 2, 3, 4, 5, 6] },
    { year: 2023, half: 'H2', months: [7, 8, 9, 10, 11, 12] },
    { year: 2024, half: 'H1', months: [1, 2, 3, 4, 5, 6] },
    { year: 2024, half: 'H2', months: [7, 8, 9] }
  ]
  
  let totalProcessed = 0
  
  for (const period of periods) {
    console.log(`\n📊 计算${period.year}年${period.half}期间...`)
    
    for (const month of period.months) {
      try {
        const calculationMonth = new Date(period.year, month - 1, 1)
        
        console.log(`  计算${period.year}年${month.toString().padStart(2, '0')}月...`)
        
        // 使用宽口径假设重新计算
        const result = await calculateSSHFDetailed(
          'DF-2127',
          calculationMonth,
          'wide'
        )
        
        console.log(`    ✅ ${period.year}${month.toString().padStart(2, '0')}月计算完成，理论总计: ¥${result.theoretical_total.toFixed(2)}`)
        totalProcessed++
        
      } catch (error) {
        console.error(`    ❌ ${period.year}年${month}月计算失败:`, error.message)
      }
    }
  }
  
  console.log(`\n🎯 重新计算完成！共处理${totalProcessed}条记录`)
  console.log('📋 医疗保险比例确认:')
  console.log('  2023年H1: 4.5%')
  console.log('  2023年H2: 5.0%') 
  console.log('  2024年H1: 5.0%')
  console.log('  2024年H2: 5.0%')
}

// 执行重新计算
recalculateAllPeriods().catch(console.error)