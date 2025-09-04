import { Page, expect } from '@playwright/test';
import path from 'path';

/**
 * 测试辅助工具函数
 * 提供通用的测试操作和断言方法
 */

/**
 * 等待页面加载完成并验证基本元素
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });
}

/**
 * 获取测试文件的绝对路径
 */
export function getTestFilePath(fileName: string): string {
  return path.join(process.cwd(), '数据', fileName);
}

/**
 * 截图并保存到指定路径
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true
  });
}

/**
 * 等待元素可见并返回元素
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  return page.locator(selector);
}

/**
 * 等待文本出现在页面中
 */
export async function waitForText(page: Page, text: string, timeout = 10000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * 模拟文件拖拽到指定元素
 */
export async function dragFileToElement(page: Page, filePath: string, targetSelector: string) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

/**
 * 验证元素文本内容
 */
export async function verifyElementText(page: Page, selector: string, expectedText: string) {
  const element = await waitForElement(page, selector);
  await expect(element).toContainText(expectedText);
}

/**
 * 验证元素是否可见
 */
export async function verifyElementVisible(page: Page, selector: string) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
}

/**
 * 验证元素是否不可见
 */
export async function verifyElementHidden(page: Page, selector: string) {
  const element = page.locator(selector);
  await expect(element).toBeHidden();
}

/**
 * 等待并验证加载状态
 */
export async function waitForLoadingComplete(page: Page) {
  // 等待可能的loading指示器消失
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout: 30000 }).catch(() => {
    // 如果没有loading指示器就忽略
  });
  
  // 等待网络请求完成
  await page.waitForLoadState('networkidle');
}

/**
 * 检查控制台错误
 */
export function setupConsoleErrorCapture(page: Page): string[] {
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });
  
  return consoleErrors;
}

/**
 * 验证没有控制台错误
 */
export function verifyNoConsoleErrors(consoleErrors: string[]) {
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(', ')}`);
  }
}

/**
 * 等待API请求完成
 */
export async function waitForApiRequest(page: Page, urlPattern: string, timeout = 30000) {
  return page.waitForResponse(
    response => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
}