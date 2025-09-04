const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const xlsx = require('xlsx');

// Excel解析函数（简化版）
function parseTestExcel(filePath) {
  console.log('\n📊 开始解析Excel文件...');
  
  const workbook = xlsx.readFile(filePath);
  console.log(`工作表: ${workbook.SheetNames.join(', ')}`);
  
  const records = [];
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- 解析工作表: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`原始记录数: ${jsonData.length}`);
    
    // 假设是2024年1月的数据（因为这是测试文件）
    const salaryMonth = '2024-01-01';
    
    for (const row of jsonData) {
      try {
        // 解析记录，适配测试文件的字段
        const employeeId = row['工号'] || row['员工工号'];
        const hireDateRaw = row['入厂时间'] || row['入职日期'];
        const basicSalary = row['正常工作时间工资'] || 0;
        const grossSalary = row['应发工资合计'] || 0;
        
        if (!employeeId || !hireDateRaw) {
          continue;
        }
        
        // 解析入职日期
        let hireDate;
        if (typeof hireDateRaw === 'string') {
          // 处理"2017/04/01"格式
          const parts = hireDateRaw.split('/');
          if (parts.length === 3) {
            hireDate = new Date(parts[0], parts[1] - 1, parts[2]).toISOString().split('T')[0];
          } else {
            hireDate = new Date(hireDateRaw).toISOString().split('T')[0];
          }
        } else {
          hireDate = new Date(hireDateRaw).toISOString().split('T')[0];
        }
        
        records.push({
          employee_id: employeeId.toString(),
          hire_date: hireDate,
          salary_month: salaryMonth,
          basic_salary: Number(basicSalary) || 0,
          gross_salary: Number(grossSalary) || 0
        });
        
        console.log(`✅ ${employeeId}: ￥${basicSalary} / ￥${grossSalary}`);
        
      } catch (error) {
        console.error(`❌ 解析行失败:`, error.message);
      }
    }
  }
  
  console.log(`\n📈 Excel解析完成，共获得 ${records.length} 条有效记录`);
  return records;
}

async function testAPIImport() {
  console.log('=== 五险一金系统 API 导入功能测试 ===\n');
  
  const apiUrl = 'http://localhost:3006/api/import-salary';
  const filePath = path.join(__dirname, '数据', 'test file.xlsx');
  
  console.log(`API端点: ${apiUrl}`);
  console.log(`测试文件: ${filePath}`);
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`测试文件不存在: ${filePath}`);
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`文件大小: ${fileStats.size} 字节`);
    
    // 解析Excel文件
    const records = parseTestExcel(filePath);
    
    if (records.length === 0) {
      throw new Error('没有解析到有效记录');
    }
    
    console.log('\n🚀 开始API测试...');
    console.log(`准备发送 ${records.length} 条记录到API`);
    
    const startTime = Date.now();
    
    // 发送POST请求 - 使用JSON格式
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records })
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`请求耗时: ${duration}ms`);
    console.log(`响应状态: ${response.status} ${response.statusText}`);
    console.log(`响应头:`, Object.fromEntries(response.headers.entries()));
    
    // 解析响应
    const responseText = await response.text();
    console.log(`\n原始响应内容:`, responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError.message);
      return {
        success: false,
        error: 'Invalid JSON response',
        rawResponse: responseText,
        statusCode: response.status
      };
    }
    
    console.log('\n📋 解析后的响应数据:');
    console.log(JSON.stringify(responseData, null, 2));
    
    // 验证响应状态
    if (!response.ok) {
      console.error(`❌ API请求失败: ${response.status}`);
      return {
        success: false,
        error: responseData.error || 'API request failed',
        statusCode: response.status,
        responseData
      };
    }
    
    // 验证响应格式
    if (!responseData.success) {
      console.error('❌ API响应指示失败:', responseData.error);
      return {
        success: false,
        error: responseData.error,
        responseData
      };
    }
    
    // 成功情况下的详细信息
    console.log('\n✅ API测试成功!');
    console.log(`导入记录数: ${responseData.importedCount || '未知'}`);
    console.log(`更新记录数: ${responseData.updatedCount || '未知'}`);
    console.log(`失败记录数: ${responseData.failedCount || 0}`);
    
    if (responseData.errors && responseData.errors.length > 0) {
      console.log('\n⚠️ 导入过程中的错误:');
      responseData.errors.forEach((error, index) => {
        console.log(`错误 ${index + 1}: ${error}`);
      });
    }
    
    return {
      success: true,
      duration,
      statusCode: response.status,
      responseData
    };
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function verifyDatabaseRecords() {
  console.log('\n=== 数据库记录验证 ===');
  
  try {
    // 使用Supabase客户端查询记录
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = 'https://abtvvtnzethqnxqjsvyn.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODkwODYsImV4cCI6MjA2ODA2NTA4Nn0.8HBJYIfll7SWOMIR02Kx30pnhxRWfE31uN_Cz03faK8';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 查询salary_records表
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ 数据库查询失败:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ 查询成功，找到 ${data.length} 条最新记录`);
    
    if (data.length > 0) {
      console.log('\n最新的3条记录:');
      data.slice(0, 3).forEach((record, index) => {
        console.log(`记录 ${index + 1}:`, {
          employee_id: record.employee_id,
          hire_date: record.hire_date,
          salary_month: record.salary_month,
          basic_salary: record.basic_salary,
          gross_salary: record.gross_salary,
          created_at: record.created_at
        });
      });
    }
    
    return { success: true, recordCount: data.length, records: data };
    
  } catch (error) {
    console.error('❌ 数据库验证失败:', error.message);
    return { success: false, error: error.message };
  }
}

// 执行API测试
async function runAPITests() {
  const apiResult = await testAPIImport();
  const dbResult = await verifyDatabaseRecords();
  
  console.log('\n=== API测试总结 ===');
  console.log(`API测试: ${apiResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`数据库验证: ${dbResult.success ? '✅ 成功' : '❌ 失败'}`);
  
  if (apiResult.success && dbResult.success) {
    console.log('\n🎉 所有API测试通过!');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查详细信息');
  }
  
  return {
    api: apiResult,
    database: dbResult
  };
}

runAPITests()
  .catch(error => {
    console.error('脚本执行错误:', error);
    process.exit(1);
  });