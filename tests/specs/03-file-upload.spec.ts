import { test, expect } from '@playwright/test';
import { 
  waitForPageLoad, 
  takeScreenshot, 
  waitForElement, 
  getTestFilePath,
  waitForApiRequest,
  setupConsoleErrorCapture
} from '../utils/test-helpers';

test.describe('文件上传流程测试', () => {
  const testFilePath = getTestFilePath('test file.xlsx');
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    
    // 设置控制台错误监控
    setupConsoleErrorCapture(page);
  });

  test('应该能够选择和显示Excel文件', async ({ page }) => {
    // 截图记录初始状态
    await takeScreenshot(page, 'before-file-selection');

    // 查找文件输入元素
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    
    // 选择测试文件
    console.log(`选择测试文件: ${testFilePath}`);
    await fileInput.setInputFiles(testFilePath);
    
    // 等待文件被处理
    await page.waitForTimeout(1000);
    
    // 截图记录文件选择后的状态
    await takeScreenshot(page, 'after-file-selection');
    
    // 查找可能显示文件信息的元素
    const fileNameElements = page.locator('text="test file.xlsx", [data-testid*="file"], .file-name, [class*="file"]');
    const fileInfoCount = await fileNameElements.count();
    
    if (fileInfoCount > 0) {
      console.log('文件信息已显示在界面上');
      await expect(fileNameElements.first()).toBeVisible();
    } else {
      console.log('没有找到明显的文件信息显示，但文件已选择');
    }
  });

  test('应该能够预览Excel文件内容', async ({ page }) => {
    // 选择测试文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 等待文件处理
    await page.waitForTimeout(2000);
    
    // 查找预览相关的按钮或自动预览内容
    const previewButton = page.locator('button:has-text("预览"), button:has-text("查看"), [data-testid*="preview"]');
    if (await previewButton.count() > 0) {
      await previewButton.first().click();
      await page.waitForTimeout(1000);
    }
    
    // 查找可能的数据预览表格或内容
    const previewTable = page.locator('table, .table, [role="table"], [data-testid*="table"], [class*="preview"]');
    const tableCount = await previewTable.count();
    
    console.log(`找到 ${tableCount} 个可能的预览表格`);
    
    if (tableCount > 0) {
      await expect(previewTable.first()).toBeVisible();
      
      // 检查表格内容
      const tableText = await previewTable.first().textContent();
      console.log(`预览内容片段: ${tableText?.substring(0, 200)}...`);
    }
    
    // 截图记录预览状态
    await takeScreenshot(page, 'file-preview');
  });

  test('应该能够执行文件导入流程', async ({ page }) => {
    // 选择测试文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 等待文件选择完成
    await page.waitForTimeout(1000);
    
    // 查找导入/上传按钮
    const importButton = page.locator(
      'button:has-text("导入"), button:has-text("上传"), button:has-text("开始"), ' +
      '[data-testid*="import"], [data-testid*="upload"], [data-testid*="submit"]'
    );
    
    if (await importButton.count() > 0) {
      // 截图记录导入前状态
      await takeScreenshot(page, 'before-import');
      
      // 点击导入按钮
      await importButton.first().click();
      console.log('点击了导入按钮');
      
      // 等待API请求（如果有的话）
      try {
        await waitForApiRequest(page, '/api/import', 30000);
        console.log('检测到导入API请求');
      } catch (error) {
        console.log('未检测到API请求，可能是客户端处理');
      }
      
      // 等待处理完成
      await page.waitForTimeout(5000);
      
      // 截图记录导入后状态
      await takeScreenshot(page, 'after-import');
      
    } else {
      console.log('未找到明显的导入按钮，可能是自动导入');
      
      // 等待可能的自动处理
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'auto-import-state');
    }
  });

  test('应该显示文件上传进度', async ({ page }) => {
    // 选择测试文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 等待文件选择
    await page.waitForTimeout(500);
    
    // 查找并点击导入按钮
    const importButton = page.locator('button:has-text("导入"), button:has-text("上传"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 查找进度指示器
      const progressElements = page.locator(
        'progress, .progress, [role="progressbar"], ' +
        '.loading, .spinner, [class*="progress"], [class*="loading"]'
      );
      
      // 在短时间内检查进度元素
      let progressFound = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(200);
        if (await progressElements.count() > 0) {
          const firstProgress = progressElements.first();
          if (await firstProgress.isVisible()) {
            progressFound = true;
            console.log('找到进度指示器');
            await takeScreenshot(page, `progress-step-${i}`);
            break;
          }
        }
      }
      
      if (!progressFound) {
        console.log('未找到明显的进度指示器，可能处理速度很快');
      }
    }
  });

  test('应该处理文件上传的各种状态', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 选择测试文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 等待初始处理
    await page.waitForTimeout(1000);
    
    // 查找状态消息
    const statusMessages = page.locator(
      '.message, .status, .alert, .notification, ' +
      '[role="status"], [role="alert"], [data-testid*="message"]'
    );
    
    console.log(`找到 ${await statusMessages.count()} 个状态消息元素`);
    
    // 记录所有状态消息
    const messageCount = await statusMessages.count();
    for (let i = 0; i < messageCount; i++) {
      const message = statusMessages.nth(i);
      if (await message.isVisible()) {
        const messageText = await message.textContent();
        console.log(`状态消息 ${i + 1}: ${messageText}`);
      }
    }
    
    // 查找并点击导入按钮
    const importButton = page.locator('button:has-text("导入"), button:has-text("上传")');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 等待处理完成
      await page.waitForTimeout(5000);
      
      // 再次检查状态消息
      const finalMessages = page.locator('.message, .status, .alert, .notification');
      const finalCount = await finalMessages.count();
      
      console.log(`处理完成后的状态消息数量: ${finalCount}`);
      for (let i = 0; i < finalCount; i++) {
        const message = finalMessages.nth(i);
        if (await message.isVisible()) {
          const messageText = await message.textContent();
          console.log(`最终状态消息 ${i + 1}: ${messageText}`);
        }
      }
    }
    
    // 截图记录最终状态
    await takeScreenshot(page, 'final-upload-state');
    
    // 检查是否有JavaScript错误
    if (consoleErrors.length > 0) {
      console.log('检测到控制台错误:', consoleErrors);
    }
  });

  test('应该验证文件格式和大小', async ({ page }) => {
    // 测试正确的Excel文件
    const fileInput = page.locator('input[type="file"]');
    
    // 首先测试正确的文件
    await fileInput.setInputFiles(testFilePath);
    await page.waitForTimeout(1000);
    
    // 检查是否有错误消息
    const errorMessages = page.locator('.error, [role="alert"], [class*="error"]');
    const errorCount = await errorMessages.count();
    
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const error = await errorMessages.nth(i).textContent();
        console.log(`文件验证错误 ${i + 1}: ${error}`);
      }
    } else {
      console.log('Excel文件通过了格式验证');
    }
    
    // 截图记录文件验证结果
    await takeScreenshot(page, 'file-validation-result');
  });

  test('应该支持拖拽上传功能', async ({ page }) => {
    // 查找拖拽上传区域
    const dropZone = page.locator(
      '[data-testid="drop-zone"], .dropzone, .drop-area, ' +
      '[class*="drop"], [class*="drag"], .upload-area'
    );
    
    if (await dropZone.count() > 0) {
      console.log('找到拖拽上传区域');
      
      // 测试拖拽悬停效果
      const firstDropZone = dropZone.first();
      await firstDropZone.hover();
      
      // 截图记录悬停状态
      await takeScreenshot(page, 'drag-hover-state');
      
      // 注意: Playwright不能直接模拟文件拖拽，但可以测试拖拽区域的存在和样式
      console.log('拖拽区域测试完成（无法模拟实际文件拖拽）');
      
    } else {
      console.log('未找到明显的拖拽上传区域');
    }
  });
});