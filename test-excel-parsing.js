const XLSX = require('xlsx');
const path = require('path');

// 测试Excel解析功能
async function testExcelParsing() {
  console.log('🔍 测试Excel文件解析...\n');
  
  const testFiles = [
    '数据/8.4.7.2.2.1_2022年工资表汇总-脱敏 数值版.xlsx',
    '数据/8.4.7.2.2.2_2023年工资汇总 脱敏 数值版.xlsx',
    '数据/8.4.7.2.2.3_2024年工资汇总 脱敏 数值版.xlsx'
  ];
  
  for (const filePath of testFiles) {
    try {
      console.log(`📂 检查文件: ${filePath}`);
      
      const workbook = XLSX.readFile(filePath);
      console.log(`   📋 工作表数量: ${workbook.SheetNames.length}`);
      console.log(`   📝 工作表列表: ${workbook.SheetNames.join(', ')}`);
      
      // 检查第一个工作表的结构
      if (workbook.SheetNames.length > 0) {
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        
        console.log(`   📊 "${firstSheet}" 数据范围: ${worksheet['!ref']}`);
        console.log(`   📏 行数: ${range.e.r + 1}, 列数: ${range.e.c + 1}`);
        
        // 显示表头行
        console.log(`   🔍 表头行数据 (前30列):`);
        const headerRowData = [];
        for (let col = 0; col <= Math.min(29, range.e.c); col++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
          const cell = worksheet[cellRef];
          headerRowData.push(cell ? cell.v : '');
        }
        console.log(`      ${headerRowData.join(' | ')}`);
        
        // 查找关键列
        console.log(`   🎯 查找关键列位置:`);
        const keyColumns = ['工号', '入厂时间', '正常工作时间工资', '应发工资合计'];
        for (const targetCol of keyColumns) {
          for (let col = 0; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = worksheet[cellRef];
            if (cell && cell.v && cell.v.toString().includes(targetCol)) {
              console.log(`      "${targetCol}" 在列 ${XLSX.utils.encode_col(col)} (${col})`);
              break;
            }
          }
        }
        console.log('');
      }
      
    } catch (error) {
      console.error(`❌ 文件 ${filePath} 处理失败:`, error.message);
    }
  }
}

testExcelParsing().catch(console.error);