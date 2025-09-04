/**
 * 测试计算引擎的员工分类算法
 */

function determineEmployeeCategory(hireDate, calculationYear) {
  const hireYear = hireDate.getFullYear()
  
  if (hireYear < calculationYear - 1) {
    return 'A' // 老员工
  } else if (hireYear === calculationYear - 1) {
    return 'B' // N-1年新员工
  } else if (hireYear === calculationYear) {
    return 'C' // 当年新员工
  } else {
    throw new Error(`员工入职年份 ${hireYear} 不能大于计算年份 ${calculationYear}`)
  }
}

function testEmployeeClassification() {
  console.log('🧪 测试员工分类算法...\n')
  
  const testCases = [
    // 2023年计算规则测试
    { hireDate: '2021-12-31', calculationYear: 2023, expected: 'A', desc: '2021年入职，2023年计算 → A类' },
    { hireDate: '2022-01-01', calculationYear: 2023, expected: 'B', desc: '2022年初入职，2023年计算 → B类' },
    { hireDate: '2022-06-15', calculationYear: 2023, expected: 'B', desc: '2022年中入职，2023年计算 → B类' },
    { hireDate: '2022-12-31', calculationYear: 2023, expected: 'B', desc: '2022年末入职，2023年计算 → B类' },
    { hireDate: '2023-01-01', calculationYear: 2023, expected: 'C', desc: '2023年初入职，2023年计算 → C类' },
    { hireDate: '2023-03-01', calculationYear: 2023, expected: 'C', desc: '2023年中入职，2023年计算 → C类' },
    
    // 2024年计算规则测试
    { hireDate: '2022-12-31', calculationYear: 2024, expected: 'A', desc: '2022年入职，2024年计算 → A类' },
    { hireDate: '2023-01-01', calculationYear: 2024, expected: 'B', desc: '2023年初入职，2024年计算 → B类' },
    { hireDate: '2023-06-15', calculationYear: 2024, expected: 'B', desc: '2023年中入职，2024年计算 → B类' },
    { hireDate: '2023-12-31', calculationYear: 2024, expected: 'B', desc: '2023年末入职，2024年计算 → B类' },
    { hireDate: '2024-01-01', calculationYear: 2024, expected: 'C', desc: '2024年初入职，2024年计算 → C类' },
    { hireDate: '2024-09-30', calculationYear: 2024, expected: 'C', desc: '2024年末入职，2024年计算 → C类' },
    
    // 边界条件测试
    { hireDate: '2020-01-01', calculationYear: 2023, expected: 'A', desc: '老员工边界测试' },
    { hireDate: '2005-09-08', calculationYear: 2023, expected: 'A', desc: '资深老员工测试' }
  ]
  
  let passedTests = 0
  let totalTests = testCases.length
  
  testCases.forEach((testCase, index) => {
    try {
      const hireDate = new Date(testCase.hireDate)
      const result = determineEmployeeCategory(hireDate, testCase.calculationYear)
      
      const passed = result === testCase.expected
      const status = passed ? '✅' : '❌'
      
      console.log(`${status} 测试 ${index + 1}: ${testCase.desc}`)
      console.log(`   入职日期: ${testCase.hireDate}, 计算年份: ${testCase.calculationYear}`)
      console.log(`   预期: ${testCase.expected}, 实际: ${result}`)
      
      if (passed) {
        passedTests++
      } else {
        console.log(`   ❌ 分类错误！`)
      }
      
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: 执行异常 - ${error.message}`)
    }
    
    console.log('')
  })
  
  console.log('📊 测试总结:')
  console.log(`   通过: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`)
  
  if (passedTests === totalTests) {
    console.log('🎉 所有员工分类测试通过！')
  } else {
    console.warn(`⚠️ ${totalTests - passedTests} 个测试失败，需要检查算法`)
  }
}

// 测试政策期间判断
function testPolicyPeriod() {
  console.log('\n🗓️ 测试政策期间判断...\n')
  
  function determinePolicyPeriod(date) {
    const month = date.getMonth() + 1
    return month >= 1 && month <= 6 ? 'H1' : 'H2'
  }
  
  const periodTests = [
    { date: '2023-01-01', expected: 'H1' },
    { date: '2023-03-15', expected: 'H1' },
    { date: '2023-06-30', expected: 'H1' },
    { date: '2023-07-01', expected: 'H2' },
    { date: '2023-09-15', expected: 'H2' },
    { date: '2023-12-31', expected: 'H2' }
  ]
  
  periodTests.forEach(test => {
    const date = new Date(test.date)
    const result = determinePolicyPeriod(date)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`${status} ${test.date} → ${result} (预期: ${test.expected})`)
  })
}

// 运行所有测试
testEmployeeClassification()
testPolicyPeriod()