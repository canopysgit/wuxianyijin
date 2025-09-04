import { test, expect } from '@playwright/test';
import { 
  waitForPageLoad, 
  takeScreenshot, 
  getTestFilePath,
  waitForApiRequest,
  setupConsoleErrorCapture,
  waitForLoadingComplete
} from '../utils/test-helpers';

test.describe('状态反馈和进度测试', () => {
  const testFilePath = getTestFilePath('test file.xlsx');
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('应该显示文件解析进度', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 选择测试文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // 截图记录文件选择后的初始状态
    await takeScreenshot(page, 'file-parsing-start');
    
    // 监控可能的解析状态消息
    const statusSelectors = [
      'text="解析中"', 'text="parsing"',
      'text="处理中"', 'text="processing"',
      '.parsing', '.processing',
      '[data-testid*="parse"]', '[data-testid*="process"]'
    ];
    
    let parsingStatusFound = false;
    
    // 在多个时间点检查解析状态
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      
      for (const selector of statusSelectors) {
        const elements = page.locator(selector);
        if (await elements.count() > 0) {
          const element = elements.first();
          if (await element.isVisible()) {
            parsingStatusFound = true;
            console.log(`找到解析状态: ${await element.textContent()}`);
            await takeScreenshot(page, `parsing-status-${i}`);
            break;
          }
        }
      }
      
      if (parsingStatusFound) break;
    }
    
    if (!parsingStatusFound) {
      console.log('未检测到明显的解析进度指示，可能解析速度很快');
    }
    
    // 等待解析完成
    await waitForLoadingComplete(page);
    
    // 检查控制台错误
    if (consoleErrors.length > 0) {
      console.log('解析过程中的控制台错误:', consoleErrors);
    }
    
    // 截图记录解析完成后的状态
    await takeScreenshot(page, 'file-parsing-complete');
  });

  test('应该显示数据导入进度和状态', async ({ page }) => {
    // 选择文件并开始导入流程
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    // 查找并点击导入按钮
    const importButton = page.locator(
      'button:has-text("导入"), button:has-text("上传"), button:has-text("开始导入"), ' +
      '[data-testid*="import"], [data-testid*="upload"]'
    );
    
    if (await importButton.count() > 0) {
      console.log('找到导入按钮，开始导入流程');
      
      // 截图记录导入开始前
      await takeScreenshot(page, 'import-before-start');
      
      // 点击导入按钮
      await importButton.first().click();
      
      // 监控导入状态指示器
      const progressSelectors = [
        'progress', '.progress-bar', '[role="progressbar"]',
        '.loading', '.spinner', '[class*="loading"]',
        'text="导入中"', 'text="uploading"', 'text="importing"'
      ];
      
      let progressFound = false;
      let progressScreenshots = 0;
      
      // 在导入过程中多次检查进度
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(200);
        
        for (const selector of progressSelectors) {
          const elements = page.locator(selector);
          if (await elements.count() > 0) {
            const element = elements.first();
            if (await element.isVisible()) {
              if (!progressFound) {
                progressFound = true;
                console.log(`找到进度指示器: ${selector}`);
              }
              
              // 每隔几次截图记录进度
              if (progressScreenshots < 3 && i % 3 === 0) {
                await takeScreenshot(page, `import-progress-${progressScreenshots}`);
                progressScreenshots++;
              }
              
              // 如果是进度条，尝试读取进度值
              if (selector.includes('progress')) {
                const progressValue = await element.getAttribute('value');
                const progressMax = await element.getAttribute('max');
                if (progressValue && progressMax) {
                  const percentage = (parseInt(progressValue) / parseInt(progressMax)) * 100;
                  console.log(`导入进度: ${percentage.toFixed(1)}%`);
                }
              }
              break;
            }
          }
        }
      }
      
      if (!progressFound) {
        console.log('未找到明显的进度指示器，可能导入速度很快');
      }
      
      // 等待导入完成
      await waitForLoadingComplete(page);
      
      // 截图记录导入完成后的状态
      await takeScreenshot(page, 'import-completed');
    }
  });

  test('应该显示导入结果和成功/失败消息', async ({ page }) => {
    // 执行完整的导入流程
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    // 查找导入按钮并点击
    const importButton = page.locator('button:has-text("导入"), button:has-text("上传"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 等待足够的时间让导入完成
      await page.waitForTimeout(10000);
      
      // 查找结果消息
      const resultSelectors = [
        '.success', '.error', '.message', '.alert', '.notification',
        '[role="alert"]', '[role="status"]',
        'text="成功"', 'text="失败"', 'text="完成"', 'text="错误"',
        'text="导入成功"', 'text="导入完成"', 'text="导入失败"',
        '[data-testid*="result"]', '[data-testid*="message"]'
      ];
      
      let resultMessages = [];
      
      for (const selector of resultSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text && text.trim()) {
              resultMessages.push({
                selector: selector,
                text: text.trim()
              });
            }
          }
        }
      }
      
      console.log(`找到 ${resultMessages.length} 个结果消息:`);
      resultMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.text} (${msg.selector})`);
      });
      
      // 截图记录结果状态
      await takeScreenshot(page, 'import-results');
      
      // 检查是否有成功相关的消息
      const successMessages = resultMessages.filter(msg => 
        msg.text.includes('成功') || msg.text.includes('完成') || msg.text.includes('成功导入')
      );
      
      if (successMessages.length > 0) {
        console.log('检测到成功消息:', successMessages.map(m => m.text));
      }
    }
  });

  test('应该显示数据统计和导入摘要', async ({ page }) => {
    // 执行导入流程
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    // 查找导入按钮并执行导入
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      await page.waitForTimeout(8000);
      
      // 查找数据统计信息
      const statsSelectors = [
        'text=/\\d+.*条/', 'text=/\\d+.*记录/', 'text=/\\d+.*行/',
        'text=/成功.*\\d+/', 'text=/失败.*\\d+/',
        '.stats', '.statistics', '.summary', '.count',
        '[data-testid*="stats"]', '[data-testid*="count"]', '[data-testid*="summary"]'
      ];
      
      let statsFound = [];
      
      for (const selector of statsSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text && text.trim()) {
              statsFound.push(text.trim());
            }
          }
        }
      }
      
      console.log(`找到 ${statsFound.length} 个统计信息:`);
      statsFound.forEach((stat, index) => {
        console.log(`${index + 1}. ${stat}`);
      });
      
      // 截图记录统计信息
      await takeScreenshot(page, 'import-statistics');
      
      // 查找可能的数据预览或结果表格
      const tableElements = page.locator('table, .table, [role="table"], [data-testid*="table"]');
      const tableCount = await tableElements.count();
      
      if (tableCount > 0) {
        console.log(`找到 ${tableCount} 个数据表格`);
        
        // 检查第一个表格的内容
        const firstTable = tableElements.first();
        if (await firstTable.isVisible()) {
          const tableText = await firstTable.textContent();
          console.log(`表格内容预览: ${tableText?.substring(0, 200)}...`);
        }
      }
    }
  });

  test('应该处理长时间操作的状态更新', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    
    // 开始文件导入
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 持续监控状态变化
      const statusHistory = [];
      const monitoringDuration = 12000; // 12秒
      const checkInterval = 1000; // 每秒检查一次
      const checksCount = monitoringDuration / checkInterval;
      
      for (let i = 0; i < checksCount; i++) {
        await page.waitForTimeout(checkInterval);
        
        // 检查各种状态元素
        const statusElements = page.locator(
          '.status, .message, .progress, .loading, ' +
          '[role="status"], [role="alert"], [class*="status"]'
        );
        
        const currentStatus = [];
        const count = await statusElements.count();
        
        for (let j = 0; j < Math.min(count, 5); j++) {
          const element = statusElements.nth(j);
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text && text.trim()) {
              currentStatus.push(text.trim());
            }
          }
        }
        
        if (currentStatus.length > 0) {
          statusHistory.push({
            time: i + 1,
            status: currentStatus
          });
        }
      }
      
      // 输出状态变化历史
      console.log('状态变化历史:');
      statusHistory.forEach(entry => {
        console.log(`第${entry.time}秒: ${entry.status.join(', ')}`);
      });
      
      // 检查是否有控制台错误
      if (consoleErrors.length > 0) {
        console.log('长时间操作过程中的错误:', consoleErrors);
      }
      
      // 最终状态截图
      await takeScreenshot(page, 'long-operation-final-state');
    }
  });

  test('应该正确处理状态转换和UI更新', async ({ page }) => {
    // 监控DOM变化
    await page.addInitScript(() => {
      window.domChanges = [];
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            window.domChanges.push({
              type: mutation.type,
              target: mutation.target.tagName || 'unknown',
              timestamp: Date.now()
            });
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-testid', 'aria-label']
      });
    });
    
    // 执行导入流程
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    await page.waitForTimeout(1000);
    
    const importButton = page.locator('button:has-text("导入"), [data-testid*="import"]');
    if (await importButton.count() > 0) {
      await importButton.first().click();
      
      // 等待操作完成
      await page.waitForTimeout(8000);
      
      // 获取DOM变化记录
      const domChanges = await page.evaluate(() => window.domChanges || []);
      
      console.log(`检测到 ${domChanges.length} 次DOM变化`);
      
      // 分析DOM变化类型
      const changeTypes = domChanges.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('DOM变化统计:', changeTypes);
      
      // 截图记录最终UI状态
      await takeScreenshot(page, 'ui-state-transitions-final');
    }
  });
});