const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 分析2022年1月缺失数据
async function analyzeMissingData() {
  console.log('🔍 分析2022年1月缺失数据\n');
  console.log('=' .repeat(70));

  // 读取原始Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Excel文件不存在:', excelPath);
    return;
  }

  const workbook = XLSX.readFile(excelPath);
  const targetSheet = '2022年1月';
  
  if (!workbook.SheetNames.includes(targetSheet)) {
    console.error('❌ 找不到工作表:', targetSheet);
    console.log('可用工作表:', workbook.SheetNames);
    return;
  }

  const worksheet = workbook.Sheets[targetSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📄 Excel原始数据:`);
  console.log(`   工作表: "${targetSheet}"`);
  console.log(`   总行数: ${jsonData.length}`);
  
  // 过滤有意义的数据（有工号的记录）
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`   有意义记录: ${meaningfulData.length} 条`);
  
  // 分析各种数据情况
  let validRecords = 0;
  let basicGreaterThanGross = 0;
  let negativeWages = 0;
  let missingFields = 0;
  let otherIssues = 0;
  
  const problemRecords = [];
  
  meaningfulData.forEach((row, index) => {
    const sequenceNumber = row['序号'];
    const employeeId = row['工号'];
    const basicSalary = parseFloat(row['正常工作时间工资']) || 0;
    const grossSalary = parseFloat(row['应发工资合计']) || 0;
    const hireDate = row['入厂时间'];
    
    let hasIssue = false;
    const issues = [];
    
    // 检查必填字段
    if (!employeeId || !hireDate) {
      missingFields++;
      hasIssue = true;
      issues.push('缺少必填字段');
    }
    
    // 检查负数工资
    if (basicSalary < 0 || grossSalary < 0) {
      negativeWages++;
      hasIssue = true;
      issues.push('负数工资');
    }
    
    // 检查基本工资>应发工资
    if (basicSalary > grossSalary) {
      basicGreaterThanGross++;
      hasIssue = true;
      issues.push(`基本工资>应发工资 (${basicSalary}>${grossSalary})`);
    }
    
    if (hasIssue) {
      problemRecords.push({
        序号: sequenceNumber,
        工号: employeeId,
        问题: issues.join('; '),
        基本工资: basicSalary,
        应发工资: grossSalary
      });
    } else {
      validRecords++;
    }
  });
  
  console.log(`\n📊 数据分类统计:`);
  console.log(`   完全有效记录: ${validRecords} 条`);
  console.log(`   基本工资>应发工资: ${basicGreaterThanGross} 条`);
  console.log(`   负数工资: ${negativeWages} 条`);
  console.log(`   缺少必填字段: ${missingFields} 条`);
  console.log(`   总问题记录: ${problemRecords.length} 条`);
  
  // 显示前10条问题记录
  if (problemRecords.length > 0) {
    console.log(`\n⚠️ 问题记录详情 (前10条):`);
    problemRecords.slice(0, 10).forEach((record, idx) => {
      console.log(`   ${idx + 1}. 序号${record.序号} | ${record.工号} | ${record.问题}`);
    });
    
    if (problemRecords.length > 10) {
      console.log(`   ... 还有 ${problemRecords.length - 10} 条问题记录`);
    }
  }
  
  // 查询数据库中实际导入的记录数
  console.log(`\n🗄️ 查询数据库实际导入情况...`);
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { count: dbCount, error: dbError } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .eq('salary_month', '2022年1月');
  
  if (dbError) {
    console.error('❌ 数据库查询失败:', dbError.message);
  } else {
    console.log(`   数据库记录: ${dbCount} 条`);
    console.log(`   预期记录: ${meaningfulData.length} 条`);
    console.log(`   缺失记录: ${meaningfulData.length - (dbCount || 0)} 条`);
    
    // 分析缺失原因
    const potentialMissing = basicGreaterThanGross + negativeWages + missingFields;
    console.log(`   潜在被过滤: ${potentialMissing} 条`);
    
    if (potentialMissing === (meaningfulData.length - (dbCount || 0))) {
      console.log(`   🎯 缺失原因: 验证规则过滤导致`);
      console.log(`      - 基本工资>应发工资被过滤: ${basicGreaterThanGross} 条`);
      console.log(`      - 负数工资被过滤: ${negativeWages} 条`);
      console.log(`      - 缺少必填字段被过滤: ${missingFields} 条`);
    }
  }
  
  // 重点分析序号90的记录
  const seq90Record = meaningfulData.find(row => row['序号'] === 90);
  if (seq90Record) {
    console.log(`\n🔍 序号90记录详情:`);
    console.log(`   工号: ${seq90Record['工号']}`);
    console.log(`   基本工资: ${seq90Record['正常工作时间工资']}`);
    console.log(`   应发工资: ${seq90Record['应发工资合计']}`);
    console.log(`   入厂时间: ${seq90Record['入厂时间']}`);
    
    const basicSal = parseFloat(seq90Record['正常工作时间工资']) || 0;
    const grossSal = parseFloat(seq90Record['应发工资合计']) || 0;
    
    if (basicSal > grossSal) {
      console.log(`   ❌ 问题: 基本工资(${basicSal}) > 应发工资(${grossSal})`);
      console.log(`   💡 这就是序号90被过滤的原因！`);
    }
  } else {
    console.log(`\n❌ 找不到序号90的记录`);
  }
}

analyzeMissingData().catch(console.error);