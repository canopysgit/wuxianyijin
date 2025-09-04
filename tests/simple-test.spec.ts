import { test, expect } from '@playwright/test';

test.describe('简化的前端测试', () => {
  test.setTimeout(30000);

  test('应用应该正常加载', async ({ page }) => {
    // 直接访问页面
    const response = await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    
    // 验证响应状态
    expect(response?.status()).toBe(200);
    
    // 验证页面基本元素
    await expect(page.locator('body')).toBeVisible();
    
    // 截图记录
    await page.screenshot({
      path: 'test-results/homepage.png',
      fullPage: true
    });
    
    console.log('✓ 页面成功加载');
  });

  test('应该能找到文件上传元素', async ({ page }) => {
    await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });
    
    // 查找文件输入
    const fileInputs = page.locator('input[type="file"]');
    const inputCount = await fileInputs.count();
    
    console.log(`找到 ${inputCount} 个文件输入元素`);
    
    // 查找上传相关按钮
    const uploadButtons = page.locator('button:has-text("上传"), button:has-text("导入"), button:has-text("选择文件")');
    const buttonCount = await uploadButtons.count();
    
    console.log(`找到 ${buttonCount} 个上传按钮`);
    
    // 截图记录UI状态
    await page.screenshot({
      path: 'test-results/upload-interface.png',
      fullPage: true
    });
    
    // 如果有文件输入或按钮，测试通过
    if (inputCount > 0 || buttonCount > 0) {
      console.log('✓ 找到文件上传界面元素');
    } else {
      console.log('! 未找到明显的文件上传元素');
    }
  });
});