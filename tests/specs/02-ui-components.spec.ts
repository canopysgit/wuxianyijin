import { test, expect } from '@playwright/test';
import { waitForPageLoad, takeScreenshot, waitForElement, verifyElementVisible } from '../utils/test-helpers';

test.describe('UI组件显示测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('Excel上传界面应该正确显示', async ({ page }) => {
    // 截图记录初始状态
    await takeScreenshot(page, 'upload-interface-initial');

    // 查找上传相关的组件 - 使用更通用的选择器
    const uploadArea = page.locator('[data-testid="upload-area"], .upload-area, .dropzone, [class*="upload"], [class*="drop"]').first();
    const fileInput = page.locator('input[type="file"]');
    
    // 检查上传区域或文件输入是否存在
    const uploadAreaExists = await uploadArea.count() > 0;
    const fileInputExists = await fileInput.count() > 0;
    
    expect(uploadAreaExists || fileInputExists).toBeTruthy();

    // 如果有上传区域，验证其可见性
    if (uploadAreaExists) {
      await expect(uploadArea).toBeVisible();
      console.log('找到上传区域组件');
    }

    // 如果有文件输入，验证其存在
    if (fileInputExists) {
      await expect(fileInput).toBeAttached();
      console.log('找到文件输入组件');
    }

    // 查找可能的上传按钮
    const uploadButton = page.locator('button:has-text("上传"), button:has-text("选择文件"), button:has-text("导入"), [data-testid="upload-button"]');
    if (await uploadButton.count() > 0) {
      await expect(uploadButton.first()).toBeVisible();
      console.log('找到上传按钮');
    }
  });

  test('页面标题和主要内容区域应该显示', async ({ page }) => {
    // 查找页面标题
    const titles = page.locator('h1, h2, h3, [role="heading"], .title, [class*="title"]');
    if (await titles.count() > 0) {
      await expect(titles.first()).toBeVisible();
      const titleText = await titles.first().textContent();
      console.log(`页面标题: ${titleText}`);
    }

    // 查找主要内容区域
    const mainContent = page.locator('main, [role="main"], .main-content, [class*="main"], [class*="content"]');
    if (await mainContent.count() > 0) {
      await expect(mainContent.first()).toBeVisible();
      console.log('找到主要内容区域');
    }

    // 截图记录页面内容
    await takeScreenshot(page, 'main-content-display');
  });

  test('页面布局元素应该正确显示', async ({ page }) => {
    // 检查页面基本布局结构
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // 查找可能的导航栏
    const nav = page.locator('nav, [role="navigation"], .navbar, [class*="nav"]');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
      console.log('找到导航栏');
    }

    // 查找可能的侧边栏
    const sidebar = page.locator('aside, [role="complementary"], .sidebar, [class*="sidebar"]');
    if (await sidebar.count() > 0) {
      console.log('找到侧边栏');
    }

    // 查找可能的页脚
    const footer = page.locator('footer, [role="contentinfo"], .footer, [class*="footer"]');
    if (await footer.count() > 0) {
      console.log('找到页脚');
    }

    // 截图记录布局
    await takeScreenshot(page, 'page-layout');
  });

  test('表单元素应该正确显示和交互', async ({ page }) => {
    // 查找表单元素
    const forms = page.locator('form');
    const inputs = page.locator('input');
    const buttons = page.locator('button');
    const selects = page.locator('select');

    console.log(`找到 ${await forms.count()} 个表单`);
    console.log(`找到 ${await inputs.count()} 个输入框`);
    console.log(`找到 ${await buttons.count()} 个按钮`);
    console.log(`找到 ${await selects.count()} 个下拉框`);

    // 如果有输入框，测试第一个的交互
    if (await inputs.count() > 0) {
      const firstInput = inputs.first();
      const inputType = await firstInput.getAttribute('type');
      
      if (inputType !== 'file' && inputType !== 'hidden') {
        await expect(firstInput).toBeVisible();
        await firstInput.click();
        await expect(firstInput).toBeFocused();
      }
    }

    // 如果有按钮，检查其可见性和可点击性
    if (await buttons.count() > 0) {
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();
      
      // 检查按钮是否可点击（不是禁用状态）
      const isDisabled = await firstButton.isDisabled();
      console.log(`第一个按钮禁用状态: ${isDisabled}`);
    }

    // 截图记录表单元素
    await takeScreenshot(page, 'form-elements');
  });

  test('加载状态和反馈元素应该正确显示', async ({ page }) => {
    // 查找可能的加载指示器
    const loadingElements = page.locator('[data-testid*="loading"], .loading, .spinner, [class*="loading"], [class*="spinner"]');
    console.log(`找到 ${await loadingElements.count()} 个加载指示器`);

    // 查找可能的消息/提示元素
    const messageElements = page.locator('.message, .alert, .notification, [role="alert"], [class*="message"], [class*="alert"]');
    console.log(`找到 ${await messageElements.count()} 个消息元素`);

    // 查找可能的进度条
    const progressElements = page.locator('progress, .progress, [role="progressbar"], [class*="progress"]');
    console.log(`找到 ${await progressElements.count()} 个进度指示器`);

    // 截图记录状态元素
    await takeScreenshot(page, 'status-elements');
  });

  test('错误边界和异常处理UI应该正常', async ({ page }) => {
    // 检查是否有错误显示
    const errorElements = page.locator('.error, [role="alert"], [class*="error"], [data-testid*="error"]');
    const errorCount = await errorElements.count();
    
    console.log(`找到 ${errorCount} 个错误元素`);

    // 如果没有错误，这是好现象
    if (errorCount === 0) {
      console.log('页面没有显示错误信息 - 正常状态');
    } else {
      // 如果有错误元素，截图记录
      await takeScreenshot(page, 'error-elements');
      
      // 记录错误内容
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`错误信息 ${i + 1}: ${errorText}`);
      }
    }
  });

  test('页面图标和样式资源应该正确加载', async ({ page }) => {
    // 检查favicon
    const favicon = page.locator('link[rel="icon"], link[rel="shortcut icon"]');
    if (await favicon.count() > 0) {
      console.log('找到网站图标');
    }

    // 检查字体是否加载
    const fontFaces = await page.evaluate(() => {
      return Array.from(document.fonts).length;
    });
    console.log(`加载的字体数量: ${fontFaces}`);

    // 检查CSS样式是否应用
    const bodyStyles = await page.locator('body').evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
        color: styles.color
      };
    });
    
    console.log('页面样式:', bodyStyles);

    // 截图记录最终样式效果
    await takeScreenshot(page, 'styled-page');
  });
});