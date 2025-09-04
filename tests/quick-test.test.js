const { test, expect } = require('@playwright/test');
const path = require('path');

test('快速上传测试', async ({ page }) => {
  // 监听控制台消息
  page.on('console', msg => {
    console.log(`浏览器 [${msg.type()}]: ${msg.text()}`);
  });

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`页面错误: ${error.message}`);
  });

  console.log('开始快速上传测试');
  
  await page.goto('http://localhost:3003');
  await page.waitForTimeout(2000);
  
  // 上传文件
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, '../数据', '2024年测试工资表.xlsx'));
  
  console.log('文件已上传');
  
  // 等待处理
  await page.waitForTimeout(5000);
  
  // 检查文件列表
  const hasFileList = await page.locator('text=文件列表').count() > 0;
  console.log('是否显示文件列表:', hasFileList);
  
  if (!hasFileList) {
    // 检查是否有任何变化
    const bodyContent = await page.locator('body').innerHTML();
    console.log('页面是否包含待处理:', bodyContent.includes('待处理'));
    console.log('页面是否包含解析按钮:', bodyContent.includes('解析'));
    console.log('页面是否包含文件名:', bodyContent.includes('2024年测试工资表'));
  } else {
    console.log('找到文件列表!');
  }
  
  await page.screenshot({ path: 'quick-test.png' });
});