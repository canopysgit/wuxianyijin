const xlsx = require('xlsx');
const path = require('path');

async function analyzeTestExcel() {
  console.log('=== 五险一金系统 Excel 文件分析测试 ===\n');
  
  const filePath = path.join(__dirname, '数据', 'test file.xlsx');
  console.log(`分析文件: ${filePath}`);
  
  try {
    // 读取Excel文件
    const workbook = xlsx.readFile(filePath);
    console.log(`\n✅ 文件读取成功`);
    console.log(`工作表数量: ${workbook.SheetNames.length}`);
    console.log(`工作表名称: ${workbook.SheetNames.join(', ')}`);
    
    let totalRecords = 0;
    const sheetAnalysis = [];
    
    // 分析每个工作表
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n--- 分析工作表: ${sheetName} ---`);
      
      const worksheet = workbook.Sheets[sheetName];
      const range = xlsx.utils.decode_range(worksheet['!ref']);
      const rowCount = range.e.r - range.s.r; // 减去表头行
      
      console.log(`数据范围: ${worksheet['!ref']}`);
      console.log(`总行数: ${range.e.r + 1} (包含表头)`);
      console.log(`数据行数: ${rowCount}`);
      
      // 读取数据
      const jsonData = xlsx.utils.sheet_to_json(worksheet);
      console.log(`解析记录数: ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        console.log(`表头字段: ${Object.keys(jsonData[0]).join(', ')}`);
        
        // 显示前3条记录作为样例
        console.log('\n样例数据:');
        jsonData.slice(0, 3).forEach((row, index) => {
          console.log(`记录${index + 1}:`, JSON.stringify(row, null, 2));
        });
        
        // 数据质量检查
        let validRecords = 0;
        let invalidRecords = 0;
        
        jsonData.forEach((row, index) => {
          const hasEmployeeId = row['工号'] || row['员工工号'] || row['employee_id'];
          const hasHireDate = row['入厂时间'] || row['入职日期'] || row['hire_date'];
          const hasBasicSalary = row['正常工作时间工资'] || row['基本工资'] || row['basic_salary'];
          const hasGrossSalary = row['应发工资合计'] || row['总工资'] || row['gross_salary'];
          
          if (hasEmployeeId && hasHireDate && hasBasicSalary && hasGrossSalary) {
            validRecords++;
          } else {
            invalidRecords++;
            if (invalidRecords <= 3) { // 只显示前3条无效记录
              console.log(`⚠️ 无效记录 ${index + 1}:`, row);
            }
          }
        });
        
        console.log(`\n数据质量统计:`);
        console.log(`✅ 有效记录: ${validRecords}`);
        console.log(`❌ 无效记录: ${invalidRecords}`);
        
        totalRecords += validRecords;
      }
      
      sheetAnalysis.push({
        sheetName,
        recordCount: jsonData.length,
        validRecords: jsonData.length,
        headers: jsonData.length > 0 ? Object.keys(jsonData[0]) : []
      });
    }
    
    console.log(`\n=== 总体分析结果 ===`);
    console.log(`总工作表数: ${workbook.SheetNames.length}`);
    console.log(`总有效记录数: ${totalRecords}`);
    console.log(`平均每表记录数: ${(totalRecords / workbook.SheetNames.length).toFixed(1)}`);
    
    return {
      success: true,
      fileName: 'test file.xlsx',
      totalSheets: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      totalRecords,
      sheetAnalysis
    };
    
  } catch (error) {
    console.error('❌ 文件分析失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行分析
analyzeTestExcel()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Excel文件分析完成');
      console.log('准备进行下一步测试...');
    } else {
      console.log('\n❌ Excel文件分析失败');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('脚本执行错误:', error);
    process.exit(1);
  });