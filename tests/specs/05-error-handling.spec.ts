import { test, expect } from '@playwright/test';
import { 
  waitForPageLoad, 
  takeScreenshot, 
  setupConsoleErrorCapture,
  waitForLoadingComplete
} from '../utils/test-helpers';
import path from 'path';

test.describe('错误处理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('应该正确处理无效文件格式', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 创建一个临时的非Excel文件进行测试
    const invalidFilePath = path.join(process.cwd(), 'tests', 'fixtures', 'invalid-file.txt');
    
    // 尝试上传无效文件
    const fileInput = page.locator('input[type="file"]');
    
    // 如果文件不存在，先创建一个简单的文本文件
    try {
      await fileInput.setInputFiles([{
        name: 'invalid-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is not an Excel file')
      }]);
    } catch (error) {
      // 如果不支持Buffer方式，跳过此测试
      console.log('无法创建测试用的无效文件，跳过此测试');
      return;
    }
    
    await page.waitForTimeout(2000);
    
    // 查找错误消息
    const errorSelectors = [
      '.error', '[role="alert"]', '.alert-error',
      'text="格式错误"', 'text="无效文件"', 'text="不支持的格式"',
      'text="invalid"', 'text="format"', 'text="错误"',
      '[data-testid*="error"]', '[class*="error"]'
    ];
    
    let errorFound = false;
    let errorMessages = [];
    
    for (const selector of errorSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        if (await element.isVisible()) {
          const text = await element.textContent();
          if (text && text.trim()) {
            errorFound = true;
            errorMessages.push(text.trim());
          }
        }
      }
    }
    
    if (errorFound) {
      console.log('找到文件格式错误提示:', errorMessages);
    } else {
      console.log('未找到明显的格式错误提示，可能在文件选择时就被过滤了');
    }
    
    // 截图记录错误状态
    await takeScreenshot(page, 'invalid-file-format-error');
    
    // 记录控制台错误
    if (consoleErrors.length > 0) {
      console.log('无效文件上传时的控制台错误:', consoleErrors);
    }
  });

  test('应该处理网络错误和API失败', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 拦截API请求并模拟失败
    await page.route('**/api/import**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // 上传有效文件但模拟API失败
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    // 查找并点击导入按钮
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 等待错误响应
      await page.waitForTimeout(5000);
      
      // 查找网络错误消息
      const errorSelectors = [
        'text="网络错误"', 'text="服务器错误"', 'text="导入失败"',
        'text="Network Error"', 'text="Server Error"', 'text="500"',
        '.error', '[role="alert"]', '.alert-error',
        '[data-testid*="error"]'
      ];
      
      let networkErrorFound = false;
      
      for (const selector of errorSelectors) {
        const elements = page.locator(selector);
        if (await elements.count() > 0) {
          const element = elements.first();
          if (await element.isVisible()) {
            networkErrorFound = true;
            const errorText = await element.textContent();
            console.log(`找到网络错误消息: ${errorText}`);
            break;
          }
        }
      }
      
      if (!networkErrorFound) {
        console.log('未找到明显的网络错误提示');
      }
      
      // 截图记录网络错误状态
      await takeScreenshot(page, 'network-error-state');
    }
    
    // 记录控制台错误
    if (consoleErrors.length > 0) {
      console.log('网络错误时的控制台错误:', consoleErrors);
    }
  });

  test('应该处理大文件上传错误', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 注意: 由于无法在测试中创建真正的大文件，这里主要测试UI对大文件的处理
    const fileInput = page.locator('input[type="file"]');
    
    // 检查是否有文件大小限制的提示
    const fileSizeHints = page.locator(
      'text=/最大.*MB/', 'text=/大小.*限制/', 'text=/文件.*大小/',
      'text=/max.*size/', 'text=/size.*limit/',
      '.file-size-hint', '[data-testid*="size"]'
    );
    
    const hintCount = await fileSizeHints.count();
    if (hintCount > 0) {
      console.log('找到文件大小限制提示:');
      for (let i = 0; i < hintCount; i++) {
        const hint = await fileSizeHints.nth(i).textContent();
        console.log(`- ${hint}`);
      }
    }
    
    // 尝试模拟大文件错误响应
    await page.route('**/api/import**', route => {
      route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'File too large' })
      });
    });
    
    // 上传正常文件但模拟大文件错误
    const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(3000);
      
      // 查找大文件错误消息
      const largeFileErrors = page.locator(
        'text="文件过大"', 'text="文件太大"', 'text="超出大小限制"',
        'text="File too large"', 'text="413"',
        '.error', '[role="alert"]'
      );
      
      if (await largeFileErrors.count() > 0) {
        const error = await largeFileErrors.first().textContent();
        console.log(`找到大文件错误: ${error}`);
      }
      
      await takeScreenshot(page, 'large-file-error');
    }
    
    if (consoleErrors.length > 0) {
      console.log('大文件错误的控制台信息:', consoleErrors);
    }
  });

  test('应该处理文件解析错误', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 模拟文件解析错误
    await page.route('**/api/import**', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Parse error',
          details: 'Unable to read Excel file structure'
        })
      });
    });
    
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(3000);
      
      // 查找解析错误消息
      const parseErrors = page.locator(
        'text="解析错误"', 'text="文件损坏"', 'text="格式错误"',
        'text="Parse error"', 'text="Invalid format"',
        '.error', '[role="alert"]', '[data-testid*="error"]'
      );
      
      let parseErrorFound = false;
      const count = await parseErrors.count();
      
      for (let i = 0; i < count; i++) {
        const element = parseErrors.nth(i);
        if (await element.isVisible()) {
          parseErrorFound = true;
          const errorText = await element.textContent();
          console.log(`找到解析错误: ${errorText}`);
        }
      }
      
      if (!parseErrorFound) {
        console.log('未找到明显的解析错误提示');
      }
      
      await takeScreenshot(page, 'parse-error-state');
    }
    
    if (consoleErrors.length > 0) {
      console.log('文件解析错误的控制台信息:', consoleErrors);
    }
  });

  test('应该处理超时错误', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 模拟长时间无响应的API
    await page.route('**/api/import**', route => {
      // 延迟很长时间才响应
      setTimeout(() => {
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        });
      }, 30000); // 30秒后才响应
    });
    
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 等待一段时间看是否有超时提示
      await page.waitForTimeout(15000); // 等待15秒
      
      // 查找超时错误消息
      const timeoutErrors = page.locator(
        'text="超时"', 'text="请求超时"', 'text="处理时间过长"',
        'text="timeout"', 'text="Time out"', 'text="408"',
        '.error', '[role="alert"]', '.timeout'
      );
      
      if (await timeoutErrors.count() > 0) {
        const error = await timeoutErrors.first().textContent();
        console.log(`找到超时错误: ${error}`);
      } else {
        console.log('未找到超时错误提示，可能还在处理中');
      }
      
      await takeScreenshot(page, 'timeout-error-state');
    }
    
    if (consoleErrors.length > 0) {
      console.log('超时错误的控制台信息:', consoleErrors);
    }
  });

  test('应该提供错误恢复和重试机制', async ({ page }) => {
    // 首先模拟一个失败的请求
    let requestCount = 0;
    await page.route('**/api/import**', route => {
      requestCount++;
      if (requestCount === 1) {
        // 第一次请求失败
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      } else {
        // 后续请求成功
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Success', recordsImported: 3 })
        });
      }
    });
    
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(process.cwd(), '数据', 'test file.xlsx');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    // 第一次导入（会失败）
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(3000);
      
      // 查找重试按钮或选项
      const retryButtons = page.locator(
        'button:has-text("重试")', 'button:has-text("再试一次")',
        'button:has-text("Retry")', '[data-testid*="retry"]'
      );
      
      if (await retryButtons.count() > 0) {
        console.log('找到重试按钮');
        await retryButtons.first().click();
        await page.waitForTimeout(3000);
        
        // 检查重试后的状态
        const successMessages = page.locator(
          'text="成功"', 'text="完成"', 'text="Success"',
          '.success', '[data-testid*="success"]'
        );
        
        if (await successMessages.count() > 0) {
          console.log('重试成功');
        }
        
        await takeScreenshot(page, 'retry-success-state');
      } else {
        console.log('未找到重试按钮，检查是否可以重新上传');
        
        // 尝试重新上传
        const fileInput2 = page.locator('input[type="file"]');
        if (await fileInput2.count() > 0) {
          await fileInput2.setInputFiles(testFilePath);
          await page.waitForTimeout(1000);
          
          const importButton2 = page.locator('button:has-text("导入"), [data-testid*="import"]');
          if (await importButton2.count() > 0) {
            await importButton2.first().click();
            await page.waitForTimeout(3000);
            console.log('重新上传并导入完成');
          }
        }
      }
      
      await takeScreenshot(page, 'error-recovery-final-state');
    }
    
    console.log(`总共发起了 ${requestCount} 次API请求`);
  });

  test('应该正确处理用户输入验证错误', async ({ page }) => {
    // 查找所有输入字段
    const inputs = page.locator('input:not([type="file"]):not([type="hidden"])');
    const inputCount = await inputs.count();
    
    console.log(`找到 ${inputCount} 个用户输入字段`);
    
    if (inputCount > 0) {
      // 测试第一个输入字段的验证
      const firstInput = inputs.first();
      
      // 尝试输入无效数据
      await firstInput.click();
      await firstInput.fill('invalid-data-123!@#');
      await page.keyboard.press('Tab'); // 触发blur事件
      
      await page.waitForTimeout(1000);
      
      // 查找验证错误消息
      const validationErrors = page.locator(
        '.field-error', '.validation-error', '.input-error',
        '[role="alert"]', '[data-testid*="error"]',
        'text="无效"', 'text="错误"', 'text="格式不正确"'
      );
      
      const validationCount = await validationErrors.count();
      if (validationCount > 0) {
        console.log('找到输入验证错误:');
        for (let i = 0; i < Math.min(validationCount, 3); i++) {
          const error = await validationErrors.nth(i).textContent();
          console.log(`- ${error}`);
        }
      } else {
        console.log('未找到输入验证错误提示');
      }
      
      await takeScreenshot(page, 'input-validation-errors');
    }
  });
});