import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Excel上传功能测试', () => {
  test.setTimeout(60000);
  
  const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');

  test('完整的Excel上传和导入流程', async ({ page }) => {
    console.log('开始Excel上传功能测试...');
    
    // 1. 访问页面
    await page.goto('http://localhost:3006', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    console.log('✓ 页面加载成功');
    
    // 截图记录初始状态
    await page.screenshot({
      path: 'test-results/step1-initial-page.png',
      fullPage: true
    });
    
    // 2. 查找文件输入并上传文件
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    
    console.log(`✓ 找到文件输入元素，准备上传: ${testFilePath}`);
    
    // 上传测试文件
    await fileInput.setInputFiles(testFilePath);
    
    // 等待文件处理
    await page.waitForTimeout(2000);
    
    // 截图记录文件选择后的状态
    await page.screenshot({
      path: 'test-results/step2-file-selected.png',
      fullPage: true
    });
    
    console.log('✓ 文件已选择');
    
    // 3. 查找并点击导入按钮（如果存在）
    const importButtons = page.locator(
      'button:has-text("导入"), button:has-text("上传"), button:has-text("开始"), ' +
      'button:has-text("提交"), [data-testid*="import"], [data-testid*="upload"]'
    );
    
    const buttonCount = await importButtons.count();
    console.log(`找到 ${buttonCount} 个可能的导入按钮`);
    
    if (buttonCount > 0) {
      const importButton = importButtons.first();
      
      // 检查按钮是否可点击
      const isEnabled = await importButton.isEnabled();
      console.log(`导入按钮状态: ${isEnabled ? '可点击' : '不可点击'}`);
      
      if (isEnabled) {
        await importButton.click();
        console.log('✓ 点击了导入按钮');
        
        // 等待处理
        await page.waitForTimeout(5000);
        
        // 截图记录点击后的状态
        await page.screenshot({
          path: 'test-results/step3-after-import-click.png',
          fullPage: true
        });
      }
    } else {
      console.log('未找到明显的导入按钮，可能是自动处理');
    }
    
    // 4. 等待并检查结果
    await page.waitForTimeout(3000);
    
    // 查找成功/失败消息
    const successMessages = page.locator('.success, [role="status"]:has-text("成功"), text=成功');
    const errorMessages = page.locator('.error, [role="alert"]:has-text("失败"), text=失败');
    const generalMessages = page.locator('.message, .alert, .notification');
    
    const successCount = await successMessages.count();
    const errorCount = await errorMessages.count();
    const generalCount = await generalMessages.count();
    
    console.log(`找到 ${successCount} 个成功消息, ${errorCount} 个错误消息, ${generalCount} 个一般消息`);
    
    // 记录成功消息
    for (let i = 0; i < successCount; i++) {
      const message = successMessages.nth(i);
      if (await message.isVisible()) {
        const text = await message.textContent();
        console.log(`成功消息 ${i + 1}: ${text}`);
      }
    }
    
    // 记录错误消息
    for (let i = 0; i < errorCount; i++) {
      const message = errorMessages.nth(i);
      if (await message.isVisible()) {
        const text = await message.textContent();
        console.log(`错误消息 ${i + 1}: ${text}`);
      }
    }
    
    // 记录一般消息
    for (let i = 0; i < Math.min(generalCount, 3); i++) {
      const message = generalMessages.nth(i);
      if (await message.isVisible()) {
        const text = await message.textContent();
        console.log(`一般消息 ${i + 1}: ${text}`);
      }
    }
    
    // 5. 检查是否有数据显示
    const tables = page.locator('table, .table, [role="table"]');
    const tableCount = await tables.count();
    console.log(`找到 ${tableCount} 个数据表格`);
    
    if (tableCount > 0) {
      const firstTable = tables.first();
      if (await firstTable.isVisible()) {
        const tableText = await firstTable.textContent();
        console.log(`表格内容预览: ${tableText?.substring(0, 200)}...`);
      }
    }
    
    // 最终状态截图
    await page.screenshot({
      path: 'test-results/step4-final-result.png',
      fullPage: true
    });
    
    console.log('✓ Excel上传功能测试完成');
  });

  test('测试API响应', async ({ page }) => {
    // 监听API请求
    let apiCalled = false;
    let apiResponse = null;
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiCalled = true;
        apiResponse = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        };
        console.log(`API调用: ${response.url()} - 状态: ${response.status()}`);
      }
    });
    
    // 访问页面并上传文件
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 等待可能的API调用
    await page.waitForTimeout(8000);
    
    // 查找导入按钮并点击
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(10000);
    }
    
    // 报告API调用情况
    if (apiCalled) {
      console.log('✓ 检测到API调用:', apiResponse);
    } else {
      console.log('! 未检测到API调用，可能是前端处理');
    }
  });

  test('测试控制台错误', async ({ page }) => {
    const consoleErrors: string[] = [];
    const jsErrors: string[] = [];
    
    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // 监听JavaScript错误
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    // 执行上传流程
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(3000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(8000);
    }
    
    // 报告错误
    if (consoleErrors.length > 0) {
      console.log('! 控制台错误:', consoleErrors);
    } else {
      console.log('✓ 没有控制台错误');
    }
    
    if (jsErrors.length > 0) {
      console.log('! JavaScript错误:', jsErrors);
    } else {
      console.log('✓ 没有JavaScript错误');
    }
  });
});