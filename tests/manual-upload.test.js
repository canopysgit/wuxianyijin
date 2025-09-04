const { test, expect } = require('@playwright/test');
const path = require('path');

// 简化的手动测试
test('手动Excel上传测试', async ({ page }) => {
  console.log('开始手动Excel上传测试');
  
  // 启用慢速模式以便观察
  await page.goto('http://localhost:3003');
  
  console.log('页面已加载');
  
  // 等待页面完全加载
  await page.waitForTimeout(2000);
  
  // 截取初始状态
  await page.screenshot({ path: 'manual-test-initial.png' });
  
  // 查找文件输入元素
  const fileInput = page.locator('input[type="file"]');
  const fileInputCount = await fileInput.count();
  console.log(`找到 ${fileInputCount} 个文件输入元素`);
  
  if (fileInputCount === 0) {
    console.log('错误：未找到文件输入元素');
    return;
  }
  
  // 上传文件
  const testFile = path.join(__dirname, '../数据', '2024年测试工资表.xlsx');
  console.log(`上传文件: ${testFile}`);
  
  await fileInput.setInputFiles(testFile);
  console.log('文件上传完成');
  
  // 等待处理
  await page.waitForTimeout(3000);
  
  // 截取上传后状态
  await page.screenshot({ path: 'manual-test-after-upload.png' });
  
  // 检查页面内容变化
  const pageContent = await page.content();
  console.log('页面是否包含文件名:', pageContent.includes('2024年测试工资表.xlsx'));
  
  // 查找所有按钮
  const buttons = await page.locator('button').allTextContents();
  console.log('页面按钮:', buttons);
  
  // 查找可能的文件列表元素
  const cards = await page.locator('.card, [class*="card"]').count();
  console.log(`找到 ${cards} 个卡片元素`);
  
  // 查找文件名显示
  const fileNameElements = await page.locator('text=/2024年测试工资表\\.xlsx/').count();
  console.log(`找到 ${fileNameElements} 个包含文件名的元素`);
  
  // 检查可能的错误信息
  const errorElements = await page.locator('[class*="error"], .text-red-500, .text-red-600').count();
  console.log(`找到 ${errorElements} 个错误元素`);
  
  if (errorElements > 0) {
    const errorTexts = await page.locator('[class*="error"], .text-red-500, .text-red-600').allTextContents();
    console.log('错误信息:', errorTexts);
  }
  
  // 等待更长时间观察
  await page.waitForTimeout(5000);
  
  // 最终截图
  await page.screenshot({ path: 'manual-test-final.png' });
  
  console.log('手动测试完成');
});