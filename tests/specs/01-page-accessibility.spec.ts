import { test, expect } from '@playwright/test';
import { waitForPageLoad, takeScreenshot, setupConsoleErrorCapture, verifyNoConsoleErrors } from '../utils/test-helpers';

test.describe('页面可访问性测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置控制台错误监控
    setupConsoleErrorCapture(page);
  });

  test('主页面应该正常加载', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);

    // 访问主页
    await page.goto('/');
    await waitForPageLoad(page);

    // 截图记录页面状态
    await takeScreenshot(page, 'homepage-loaded');

    // 验证页面标题
    await expect(page).toHaveTitle(/五险一金/);

    // 验证页面基本结构
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang');

    // 检查没有控制台错误
    verifyNoConsoleErrors(consoleErrors);
  });

  test('页面应该具有正确的HTML结构', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // 验证基础HTML元素
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('head')).toBeAttached();
    await expect(page.locator('body')).toBeVisible();

    // 验证meta标签
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toBeAttached();

    // 验证样式表加载
    const stylesheets = page.locator('link[rel="stylesheet"]');
    const count = await stylesheets.count();
    expect(count).toBeGreaterThan(0);
  });

  test('页面应该响应式适配不同屏幕尺寸', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // 测试桌面尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await takeScreenshot(page, 'desktop-view');
    await expect(page.locator('body')).toBeVisible();

    // 测试平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await takeScreenshot(page, 'tablet-view');
    await expect(page.locator('body')).toBeVisible();

    // 测试手机尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await takeScreenshot(page, 'mobile-view');
    await expect(page.locator('body')).toBeVisible();
  });

  test('页面加载性能应该在合理范围内', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await waitForPageLoad(page);
    
    const loadTime = Date.now() - startTime;
    
    // 页面加载时间应该在10秒内
    expect(loadTime).toBeLessThan(10000);
    
    console.log(`页面加载时间: ${loadTime}ms`);
  });

  test('页面应该处理网络错误', async ({ page }) => {
    // 模拟网络离线
    await page.context().setOffline(true);
    
    const response = await page.goto('/', { waitUntil: 'networkidle' }).catch(() => null);
    
    if (response) {
      // 如果有缓存或离线页面，验证其存在
      await expect(page.locator('body')).toBeVisible();
    }
    
    // 恢复网络连接
    await page.context().setOffline(false);
  });

  test('页面应该支持键盘导航', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // 检查可聚焦元素
    const focusableElements = page.locator('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
    const count = await focusableElements.count();
    
    if (count > 0) {
      // 测试Tab键导航
      await page.keyboard.press('Tab');
      
      // 验证焦点状态
      const activeElement = page.locator(':focus');
      await expect(activeElement).toBeVisible();
    }
  });
});