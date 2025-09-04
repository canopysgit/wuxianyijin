const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 分析2022年5月缺失数据
async function analyze2022May() {
  console.log('🔍 分析2022年5月缺失数据\n');
  console.log('=' .repeat(70));

  // Excel日期解析函数
  function excelDateToJSDate(excelDate) {
    const excelDateObj = XLSX.SSF.parse_date_code(excelDate);
    return new Date(Date.UTC(excelDateObj.y, excelDateObj.m - 1, excelDateObj.d));
  }

  function parseDateValue(value) {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'number') {
      return excelDateToJSDate(value);
    }
    
    if (typeof value === 'string') {
      const dateStr = value.trim();
      const patterns = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
        /^(\d{4})年(\d{1,2})月(\d{1,2})日$/
      ];
      
      for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          return new Date(Date.UTC(year, month, day));
        }
      }
      
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    throw new Error(`无法解析日期值: ${value}`);
  }

  // 读取Excel文件
  const excelPath = path.join(__dirname, '数据', '8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const targetSheet = '2022年5月';
  
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
  
  // 过滤有意义的数据
  const meaningfulData = jsonData.filter(row => {
    const employeeId = row['工号'];
    return employeeId && employeeId.toString().trim() !== '';
  });
  
  console.log(`   有意义记录: ${meaningfulData.length} 条`);
  
  // 模拟解析过程，记录错误
  const validRecords = [];
  const parseErrors = [];
  
  meaningfulData.forEach((row, index) => {
    const sequenceNumber = row['序号'];
    const employeeId = row['工号'];
    
    try {
      const hireDate = parseDateValue(row['入厂时间']);
      const basicSalary = parseFloat(row['正常工作时间工资']) || 0;
      const grossSalary = parseFloat(row['应发工资合计']) || 0;
      
      // 基础验证（保留必要的验证）
      if (basicSalary < 0 || grossSalary < 0) {
        throw new Error('工资不能为负数');
      }
      
      // 未来日期验证
      const currentDate = new Date();
      if (hireDate > currentDate) {
        throw new Error('入职日期不能是未来时间');
      }
      
      validRecords.push({
        sequenceNumber,
        employeeId,
        hireDate: hireDate.toISOString().split('T')[0],
        basicSalary,
        grossSalary,
        isSpecialCase: basicSalary > grossSalary
      });
      
    } catch (error) {
      parseErrors.push({
        序号: sequenceNumber,
        工号: employeeId,
        原始入厂时间: row['入厂时间'],
        原始基本工资: row['正常工作时间工资'],
        原始应发工资: row['应发工资合计'],
        错误原因: error.message
      });
    }
  });
  
  console.log(`\n📊 解析统计:`);
  console.log(`   成功解析: ${validRecords.length} 条`);
  console.log(`   解析错误: ${parseErrors.length} 条`);
  
  if (parseErrors.length > 0) {
    console.log(`\n❌ 解析错误详情:`);
    parseErrors.forEach((error, idx) => {
      console.log(`   ${idx + 1}. 序号${error.序号} | ${error.工号}`);
      console.log(`      入厂时间: "${error.原始入厂时间}" (类型: ${typeof error.原始入厂时间})`);
      console.log(`      基本工资: ${error.原始基本工资}`);
      console.log(`      应发工资: ${error.原始应发工资}`);
      console.log(`      错误: ${error.错误原因}`);
    });
  }
  
  // 查询数据库实际记录
  console.log(`\n🗄️ 查询数据库实际导入情况...`);
  
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { count: dbCount, error: dbError } = await supabase
    .from('salary_records')
    .select('*', { count: 'exact', head: true })
    .eq('salary_month', '2022年5月');
  
  if (dbError) {
    console.error('❌ 数据库查询失败:', dbError.message);
    return;
  }
  
  console.log(`   数据库记录: ${dbCount} 条`);
  console.log(`   Excel有意义记录: ${meaningfulData.length} 条`);
  console.log(`   解析成功记录: ${validRecords.length} 条`);
  console.log(`   实际缺失: ${meaningfulData.length - (dbCount || 0)} 条`);
  
  // 如果有解析错误，这就是缺失原因
  if (parseErrors.length === (meaningfulData.length - (dbCount || 0))) {
    console.log(`\n🎯 缺失原因分析:`);
    console.log(`   缺失数量: ${parseErrors.length} 条`);
    console.log(`   原因: 数据解析错误`);
    
    // 详细分析每个错误
    parseErrors.forEach((error, idx) => {
      console.log(`\n   缺失记录 ${idx + 1}:`);
      console.log(`   序号: ${error.序号}`);
      console.log(`   工号: ${error.工号}`);
      console.log(`   问题: ${error.错误原因}`);
      
      // 特别分析日期问题
      if (error.错误原因.includes('日期')) {
        console.log(`   入厂时间原始值: "${error.原始入厂时间}" (${typeof error.原始入厂时间})`);
        
        if (typeof error.原始入厂时间 === 'number') {
          try {
            const convertedDate = excelDateToJSDate(error.原始入厂时间);
            console.log(`   Excel序列号转换: ${convertedDate.toISOString().split('T')[0]}`);
          } catch (convError) {
            console.log(`   序列号转换失败: ${convError.message}`);
          }
        }
      }
    });
  } else {
    console.log(`\n❓ 缺失原因不明:`);
    console.log(`   解析错误: ${parseErrors.length} 条`);
    console.log(`   实际缺失: ${meaningfulData.length - (dbCount || 0)} 条`);
    console.log(`   可能需要进一步调查API层或数据库层问题`);
  }
  
  // 获取数据库中已有的序号，找出缺失的序号
  const { data: dbRecords } = await supabase
    .from('salary_records')
    .select('xuhao2, employee_id')
    .eq('salary_month', '2022年5月')
    .order('xuhao2');
  
  if (dbRecords) {
    const dbSequences = dbRecords.map(r => r.xuhao2).filter(x => x);
    const excelSequences = meaningfulData.map(r => r['序号']).filter(x => x);
    
    const missingSequences = excelSequences.filter(seq => !dbSequences.includes(seq));
    
    console.log(`\n🔍 序号对比分析:`);
    console.log(`   Excel序号范围: ${Math.min(...excelSequences)}-${Math.max(...excelSequences)}`);
    console.log(`   数据库序号范围: ${Math.min(...dbSequences)}-${Math.max(...dbSequences)}`);
    console.log(`   缺失序号: ${missingSequences.length > 0 ? missingSequences.join(', ') : '无'}`);
    
    if (missingSequences.length > 0) {
      console.log(`\n🔍 缺失序号详情:`);
      missingSequences.forEach(seq => {
        const excelRecord = meaningfulData.find(r => r['序号'] === seq);
        if (excelRecord) {
          console.log(`   序号${seq}: ${excelRecord['工号']} | 入厂时间: "${excelRecord['入厂时间']}" | ￥${excelRecord['正常工作时间工资']}/￥${excelRecord['应发工资合计']}`);
        }
      });
    }
  }
}

analyze2022May().catch(console.error);