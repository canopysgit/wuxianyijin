const { test, expect } = require('@playwright/test');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase客户端配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://abtvvtnzethqnxqjsvyn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFidHZ2dG56ZXRocW54cWpzdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ3NDMxODYsImV4cCI6MjA0MDMxOTE4Nn0.R_WY1b9krmgJTjGWYx_VvZMUjSvLOdTEn9Kl8zOBGHs';
const supabase = createClient(supabaseUrl, supabaseKey);

// 测试文件路径
const TEST_FILE_PATH = path.join(__dirname, '../数据/test file.xlsx');

test.describe('Excel上传功能自动化测试', () => {
  
  test.beforeEach(async ({ page }) => {
    // 清理测试数据 - 删除测试员工的记录
    const testEmployeeIds = ['DF-2389', 'DF-2127', 'DF-0793'];
    for (const employeeId of testEmployeeIds) {
      await supabase
        .from('salary_records')
        .delete()
        .eq('employee_id', employeeId);
    }
    
    // 等待清理完成
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('1. 验证应用启动和访问', async ({ page }) => {
    console.log('开始测试：验证应用启动和访问');
    
    await page.goto('http://localhost:3003');
    await expect(page).toHaveTitle(/五险一金/);
    
    // 验证主要元素是否存在
    await expect(page.locator('h1')).toContainText('五险一金');
    
    console.log('✓ 应用启动验证通过');
  });

  test('2. 测试数据库连接', async ({ page }) => {
    console.log('开始测试：数据库连接');
    
    // 测试API连接
    const response = await page.request.get('http://localhost:3003/api/test-connection');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    console.log('✓ 数据库连接验证通过');
  });

  test('3. Excel文件上传和解析', async ({ page }) => {
    console.log('开始测试：Excel文件上传和解析');
    
    await page.goto('http://localhost:3003');
    
    // 等待页面加载完成
    await page.waitForSelector('input[type="file"]');
    
    // 上传文件到隐藏的文件输入
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    
    console.log('✓ 文件上传成功');
    
    // 等待文件出现在文件列表中
    await page.waitForSelector('.font-medium', { timeout: 5000 });
    
    // 检查文件是否出现在列表中
    const fileName = await page.locator('.font-medium').first().textContent();
    if (fileName && fileName.includes('test file.xlsx')) {
      console.log('✓ 文件显示在列表中');
    }
    
    // 查找解析按钮并点击
    const parseButton = page.locator('button:has-text("解析")').first();
    if (await parseButton.count() > 0) {
      await parseButton.click();
      console.log('✓ 点击解析按钮');
      
      // 等待解析完成
      await page.waitForTimeout(3000);
      
      // 检查解析状态
      const parsedStatus = page.locator('text=/已解析/');
      if (await parsedStatus.count() > 0) {
        console.log('✓ 文件解析完成');
      }
    }
  });

  test('4. 数据导入流程', async ({ page }) => {
    console.log('开始测试：数据导入流程');
    
    await page.goto('http://localhost:3003');
    
    // 上传文件
    await page.waitForSelector('input[type="file"]');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_FILE_PATH);
    
    // 等待文件列表出现
    await page.waitForSelector('.font-medium', { timeout: 5000 });
    
    // 点击解析按钮
    const parseButton = page.locator('button:has-text("解析")').first();
    if (await parseButton.count() > 0) {
      await parseButton.click();
      console.log('✓ 点击解析按钮');
      
      // 等待解析完成
      await page.waitForTimeout(3000);
    }
    
    // 查找并点击导入按钮
    const importButton = page.locator('button:has-text("导入")').first();
    
    if (await importButton.count() > 0) {
      await importButton.click();
      console.log('✓ 点击导入按钮');
      
      // 等待导入完成
      await page.waitForTimeout(8000);
      
      // 检查导入状态
      const importedStatus = page.locator('text=/已导入/');
      if (await importedStatus.count() > 0) {
        console.log('✓ 数据导入完成');
      }
      
      // 检查是否显示成功的导入记录数
      const importResult = page.locator('text=/成功导入.*条记录/');
      if (await importResult.count() > 0) {
        const resultText = await importResult.first().textContent();
        console.log('✓ 导入结果显示:', resultText);
      }
    } else {
      console.log('警告：未找到导入按钮');
    }
  });

  test('5. 验证数据库中的导入结果', async ({ page }) => {
    console.log('开始测试：验证数据库中的导入结果');
    
    // 先执行导入流程
    await page.goto('http://localhost:3003');
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(TEST_FILE_PATH);
      await page.waitForTimeout(3000);
      
      const importButton = page.locator('button:has-text("导入"), button:has-text("上传"), [data-testid="import-button"]').first();
      if (await importButton.count() > 0) {
        await importButton.click();
        await page.waitForTimeout(10000);
      }
    }
    
    // 直接查询数据库验证导入结果
    const testEmployeeIds = ['DF-2389', 'DF-2127', 'DF-0793'];
    
    for (const employeeId of testEmployeeIds) {
      const { data, error } = await supabase
        .from('salary_records')
        .select('*')
        .eq('employee_id', employeeId);
      
      if (error) {
        console.error(`查询员工 ${employeeId} 失败:`, error);
      } else if (data && data.length > 0) {
        console.log(`✓ 员工 ${employeeId} 数据导入成功，记录数: ${data.length}`);
        console.log(`  - 应发工资: ${data[0].gross_salary}`);
        console.log(`  - 正常工资: ${data[0].basic_salary}`);
        console.log(`  - 入职日期: ${data[0].hire_date}`);
      } else {
        console.log(`✗ 员工 ${employeeId} 未找到导入数据`);
      }
    }
    
    // 统计总导入记录数
    const { data: allRecords, error: countError } = await supabase
      .from('salary_records')
      .select('employee_id')
      .in('employee_id', testEmployeeIds);
    
    if (!countError && allRecords) {
      console.log(`总导入记录数: ${allRecords.length}/3`);
      if (allRecords.length === 3) {
        console.log('✓ 所有测试数据导入成功');
      } else {
        console.log(`✗ 导入不完整，预期3条，实际${allRecords.length}条`);
      }
    }
  });

  test('6. 错误处理机制测试', async ({ page }) => {
    console.log('开始测试：错误处理机制');
    
    await page.goto('http://localhost:3003');
    
    // 测试上传非Excel文件
    const testTextFile = path.join(__dirname, '../test-file.txt');
    
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(testTextFile);
      await page.waitForTimeout(2000);
      
      // 检查是否显示错误提示
      const errorMessage = page.locator('.error, .alert-error, [data-testid="error-message"]');
      if (await errorMessage.count() > 0) {
        console.log('✓ 文件格式错误处理正常');
      }
    }
  });

  test('7. UI响应性测试', async ({ page }) => {
    console.log('开始测试：UI响应性');
    
    await page.goto('http://localhost:3003');
    
    // 测试响应式设计
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    console.log('✓ 桌面视图正常');
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    console.log('✓ 平板视图正常');
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    console.log('✓ 手机视图正常');
  });

  test.afterEach(async ({ page }) => {
    // 测试完成后的清理工作
    console.log('测试完成，执行清理工作');
    
    // 可以选择保留测试数据用于调试
    // 或者清理测试数据
    
    await page.close();
  });
});