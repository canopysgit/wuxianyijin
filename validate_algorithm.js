/**
 * 验证修正后的动态员工分类算法
 * 不依赖数据库，直接测试算法逻辑
 */

/**
 * 员工分类算法 (修正版)
 */
function determineEmployeeCategory(hireDate, calculationMonth) {
  const hireYear = new Date(hireDate).getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  const calculationYear = calculationMonth.getFullYear()
  
  // 确定计算月份所属的社保年度
  let socialSecurityYear
  if (calculationMonthNum >= 7) {
    // 7-12月属于当年社保年度
    socialSecurityYear = calculationYear
  } else {
    // 1-6月属于上一年社保年度  
    socialSecurityYear = calculationYear - 1
  }
  
  // 基于入职年份与社保年度关系分类
  if (hireYear < socialSecurityYear) {
    return 'A' // 老员工：社保年度开始前入职
  } else if (hireYear === socialSecurityYear) {
    return 'B' // 当前社保年度新员工
  } else if (hireYear === socialSecurityYear + 1) {
    return 'C' // 下一社保年度新员工
  } else {
    throw new Error(`员工入职年份异常: 入职${hireYear}年，计算${calculationYear}年${calculationMonthNum}月`)
  }
}

/**
 * 测试各种员工在4个期间的分类
 */
function testEmployeeClassification() {
  console.log('🧪 开始验证动态员工分类算法...\n')
  
  // 测试员工样本
  const testEmployees = [
    { id: 'EMP-2020', hireDate: '2020-03-15', desc: '2020年入职员工' },
    { id: 'EMP-2021', hireDate: '2021-08-10', desc: '2021年入职员工' },
    { id: 'EMP-2022', hireDate: '2022-02-20', desc: '2022年入职员工' },
    { id: 'EMP-2022B', hireDate: '2022-09-05', desc: '2022年下半年入职员工' },
    { id: 'EMP-2023', hireDate: '2023-01-15', desc: '2023年入职员工' },
    { id: 'EMP-2023B', hireDate: '2023-10-01', desc: '2023年下半年入职员工' },
    { id: 'EMP-2024', hireDate: '2024-03-10', desc: '2024年入职员工' },
  ]
  
  // 4个计算期间
  const calculationPeriods = [
    { name: '2023年1-6月', months: [new Date(2023, 0, 1), new Date(2023, 2, 1), new Date(2023, 5, 1)] },
    { name: '2023年7-12月', months: [new Date(2023, 6, 1), new Date(2023, 8, 1), new Date(2023, 11, 1)] },
    { name: '2024年1-6月', months: [new Date(2024, 0, 1), new Date(2024, 2, 1), new Date(2024, 5, 1)] },
    { name: '2024年7-9月', months: [new Date(2024, 6, 1), new Date(2024, 7, 1), new Date(2024, 8, 1)] },
  ]
  
  // 测试每个期间的分类结果
  calculationPeriods.forEach(period => {
    console.log(`📅 === ${period.name} ===`)
    
    const testMonth = period.months[0] // 使用期间第一个月进行测试
    
    testEmployees.forEach(employee => {
      try {
        const category = determineEmployeeCategory(employee.hireDate, testMonth)
        console.log(`  ${employee.id} (${employee.desc}): ${category}类`)
      } catch (error) {
        console.log(`  ${employee.id} (${employee.desc}): ❌ ${error.message}`)
      }
    })
    
    console.log()
  })
}

/**
 * 测试参考工资选择逻辑
 */
function testReferenceWageSelection() {
  console.log('💰 开始验证参考工资选择逻辑...\n')
  
  const periods = [
    { name: '2023年1-6月', date: new Date(2023, 0, 1) },
    { name: '2023年7-12月', date: new Date(2023, 6, 1) },
    { name: '2024年1-6月', date: new Date(2024, 0, 1) },
    { name: '2024年7-9月', date: new Date(2024, 6, 1) },
  ]
  
  periods.forEach(period => {
    console.log(`📅 === ${period.name} ===`)
    
    // 测试A类员工
    const aEmployeeHire = new Date(2021, 5, 15) // 2021年6月入职 = A类
    const aCat = determineEmployeeCategory(aEmployeeHire, period.date)
    console.log(`  A类员工 (2021年入职): ${aCat}类`)
    console.log(`    → 应使用参考工资: ${getExpectedReferenceWage('A', period.date)}`)
    
    // 测试B类员工  
    const bEmployeeHire = getBCategoryHireDate(period.date)
    if (bEmployeeHire) {
      const bCat = determineEmployeeCategory(bEmployeeHire, period.date)
      console.log(`  B类员工 (${bEmployeeHire.getFullYear()}年入职): ${bCat}类`)
      console.log(`    → 应使用参考工资: 入职首月工资`)
    }
    
    // 测试C类员工
    const cEmployeeHire = getCCategoryHireDate(period.date)
    if (cEmployeeHire) {
      const cCat = determineEmployeeCategory(cEmployeeHire, period.date)
      console.log(`  C类员工 (${cEmployeeHire.getFullYear()}年入职): ${cCat}类`)
      console.log(`    → 应使用参考工资: 入职首月工资`)
    }
    
    console.log()
  })
}

// 辅助函数：获取B类员工入职日期
function getBCategoryHireDate(calculationMonth) {
  const calculationYear = calculationMonth.getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  
  let socialSecurityYear
  if (calculationMonthNum >= 7) {
    socialSecurityYear = calculationYear
  } else {
    socialSecurityYear = calculationYear - 1
  }
  
  return new Date(socialSecurityYear, 3, 15) // B类 = 当前社保年度入职
}

// 辅助函数：获取C类员工入职日期
function getCCategoryHireDate(calculationMonth) {
  const calculationYear = calculationMonth.getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  
  let socialSecurityYear
  if (calculationMonthNum >= 7) {
    socialSecurityYear = calculationYear
  } else {
    socialSecurityYear = calculationYear - 1
  }
  
  const cYear = socialSecurityYear + 1
  if (cYear > 2024) return null // 超出范围
  
  return new Date(cYear, 2, 10) // C类 = 下一社保年度入职
}

// 辅助函数：获取A类员工期望参考工资类型
function getExpectedReferenceWage(category, calculationMonth) {
  if (category !== 'A') return '入职首月工资'
  
  const calculationYear = calculationMonth.getFullYear()
  const calculationMonthNum = calculationMonth.getMonth() + 1
  
  if (calculationYear === 2023 && calculationMonthNum <= 6) {
    return '2022年月平均工资 (特殊替代)'
  } else if (calculationYear === 2023 && calculationMonthNum >= 7) {
    return '2022年月平均工资'
  } else if (calculationYear === 2024 && calculationMonthNum <= 6) {
    return '2022年月平均工资'
  } else if (calculationYear === 2024 && calculationMonthNum >= 7) {
    return '2023年月平均工资'
  } else {
    return '未知'
  }
}

// 执行验证
console.log('🚀 动态员工分类算法验证\n')
testEmployeeClassification()
testReferenceWageSelection()