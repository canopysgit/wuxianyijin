const { test, expect } = require('@playwright/test');
const path = require('path');

test('调试Excel上传功能', async ({ page }) => {
  // 监听控制台消息
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    console.log(`浏览器控制台 [${msg.type()}]: ${msg.text()}`);
  });

  // 监听页面错误
  page.on('pageerror', error => {
    console.log(`页面错误: ${error.message}`);
  });

  // 监听网络请求
  page.on('request', request => {
    if (request.url().includes('api/') || request.url().includes('.js')) {
      console.log(`请求: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('api/') || (response.status() >= 400 && response.url().includes('.js'))) {
      console.log(`响应: ${response.status()} ${response.url()}`);
    }
  });

  console.log('开始调试Excel上传功能');
  
  await page.goto('http://localhost:3003');
  console.log('页面已加载');
  
  // 等待React应用完全加载
  await page.waitForTimeout(3000);
  
  // 检查是否有初始的控制台错误
  console.log(`初始加载后，控制台消息数量: ${consoleMessages.length}`);
  
  // 查找文件输入并上传
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  
  const testFile = path.join(__dirname, '../数据', '2024年测试工资表.xlsx');
  console.log(`准备上传文件: ${testFile}`);
  
  // 上传文件
  await fileInput.setInputFiles(testFile);
  console.log('文件已设置到input元素');
  
  // 等待JavaScript处理
  await page.waitForTimeout(5000);
  
  console.log(`上传后，控制台消息数量: ${consoleMessages.length}`);
  
  // 检查DOM变化
  const bodyContent = await page.locator('body').innerHTML();
  console.log('页面是否包含"文件列表":', bodyContent.includes('文件列表'));
  console.log('页面是否包含"待处理":', bodyContent.includes('待处理'));
  console.log('页面是否包含文件名:', bodyContent.includes('2024年测试工资表'));
  
  // 查找上传后可能出现的元素
  const fileListElement = page.locator('[class*="space-y-4"] h3');
  const fileListCount = await fileListElement.count();
  console.log(`找到 ${fileListCount} 个可能的文件列表标题`);
  
  if (fileListCount > 0) {
    const fileListText = await fileListElement.first().textContent();
    console.log(`文件列表标题: ${fileListText}`);
  }
  
  // 检查uploadFiles状态（通过React DevTools或其他方式）
  const reactState = await page.evaluate(() => {
    // 尝试访问React组件状态
    const reactRoot = document.querySelector('[data-reactroot], #root, #__next')?.['_reactInternalInstance'];
    return reactRoot ? 'React组件已找到' : '未找到React组件';
  });
  console.log(`React状态检查: ${reactState}`);
  
  // 最终截图
  await page.screenshot({ path: 'debug-final-state.png' });
  
  console.log('调试测试完成');
  console.log('所有控制台消息:');
  consoleMessages.forEach((msg, index) => {
    console.log(`  ${index + 1}: ${msg}`);
  });
});