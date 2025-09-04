const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testFrontendDetailed() {
  console.log('=== 五险一金系统 前端详细自动化测试 ===\n');
  
  const baseUrl = 'http://localhost:3006';
  const testFilePath = path.join(__dirname, '数据', 'test file.xlsx');
  
  console.log(`前端地址: ${baseUrl}`);
  console.log(`测试文件: ${testFilePath}`);
  
  let browser;
  let page;
  
  try {
    // 启动浏览器
    console.log('\n🌐 启动Chromium浏览器...');
    browser = await chromium.launch({ 
      headless: false,  // 可视化模式
      slowMo: 1000,     // 慢速执行
      devtools: true    // 开启开发者工具
    });
    
    const context = await browser.newContext();
    page = await context.newPage();
    
    // 监听控制台消息
    page.on('console', msg => {
      console.log(`[浏览器控制台 ${msg.type()}]: ${msg.text()}`);
    });
    
    // 监听网络请求
    page.on('request', request => {
      console.log(`[网络请求]: ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      console.log(`[网络响应]: ${response.status()} ${response.url()}`);
    });
    
    // 设置较长的超时时间
    page.setDefaultTimeout(60000);
    
    // 访问首页
    console.log('\n📱 访问应用首页...');
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
    
    // 截屏记录初始状态
    await page.screenshot({ path: 'test-screenshots/detailed-01-homepage.png', fullPage: true });
    console.log('✅ 首页加载完成');
    
    // 等待上传组件完全加载
    console.log('\n⏳ 等待上传组件加载...');
    await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    
    // 查找并上传文件
    console.log('\n📤 开始文件上传...');
    const fileInput = await page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    console.log('✅ 文件已选择');
    
    // 等待文件出现在列表中
    console.log('\n⏳ 等待文件出现在上传列表...');
    await page.waitForSelector('.font-medium', { timeout: 10000 });
    
    // 截屏记录文件选择后状态
    await page.screenshot({ path: 'test-screenshots/detailed-02-file-selected.png', fullPage: true });
    
    // 检查文件是否出现在列表中
    const fileName = await page.locator('.font-medium').textContent();
    console.log(`✅ 文件已添加到列表: ${fileName}`);
    
    // 查找并点击"处理所有文件"按钮
    console.log('\n🔄 查找并点击处理按钮...');
    const processButton = await page.getByRole('button', { name: /处理|解析/ });
    
    if (await processButton.count() > 0) {
      console.log('✅ 找到处理按钮');
      await processButton.first().click();
      console.log('✅ 已点击处理按钮');
    } else {
      console.log('⚠️ 未找到处理按钮，尝试点击单个解析按钮');
      const parseButton = await page.getByRole('button', { name: '解析' });
      if (await parseButton.count() > 0) {
        await parseButton.first().click();
        console.log('✅ 已点击解析按钮');
      }
    }
    
    // 等待处理过程
    console.log('\n⏳ 等待文件解析处理...');
    await page.waitForTimeout(5000);
    
    // 截屏记录处理中状态
    await page.screenshot({ path: 'test-screenshots/detailed-03-processing.png', fullPage: true });
    
    // 检查是否有错误提示
    const errorElements = await page.locator('.text-red-700, .bg-red-50').all();
    if (errorElements.length > 0) {
      console.log('\n❌ 发现错误提示:');
      for (const errorEl of errorElements) {
        const errorText = await errorEl.textContent();
        console.log(`   - ${errorText}`);
      }
    }
    
    // 查找导入按钮
    console.log('\n🔍 查找导入按钮...');
    const importButton = await page.getByRole('button', { name: '导入' });
    if (await importButton.count() > 0) {
      console.log('✅ 找到导入按钮');
      await importButton.first().click();
      console.log('✅ 已点击导入按钮');
      
      // 等待导入处理
      console.log('\n⏳ 等待数据导入...');
      await page.waitForTimeout(10000);
    } else {
      console.log('⚠️ 未找到导入按钮');
    }
    
    // 截屏记录最终状态
    await page.screenshot({ path: 'test-screenshots/detailed-04-final.png', fullPage: true });
    
    // 检查成功指示器
    console.log('\n🔍 检查处理结果...');
    
    // 检查成功状态
    const successElements = await page.locator('.text-green-600, .bg-green-50, .text-green-700').all();
    let hasSuccess = false;
    if (successElements.length > 0) {
      console.log('\n✅ 发现成功指示器:');
      for (const successEl of successElements) {
        const successText = await successEl.textContent();
        console.log(`   - ${successText}`);
        hasSuccess = true;
      }
    }
    
    // 检查是否有数据统计信息
    const statsElements = await page.locator('text=/\\d+\\s*条记录/').all();
    if (statsElements.length > 0) {
      console.log('\n📊 发现记录统计:');
      for (const statsEl of statsElements) {
        const statsText = await statsEl.textContent();
        console.log(`   - ${statsText}`);
        hasSuccess = true;
      }
    }
    
    // 检查文件状态文本
    const statusElements = await page.locator('.text-gray-500').all();
    console.log('\n📋 文件状态信息:');
    for (const statusEl of statusElements) {
      const statusText = await statusEl.textContent();
      if (statusText && (statusText.includes('已导入') || statusText.includes('已解析') || statusText.includes('记录'))) {
        console.log(`   - ${statusText}`);
        hasSuccess = true;
      }
    }
    
    // 最终等待，确保所有异步操作完成
    console.log('\n⏳ 最终等待，确保所有操作完成...');
    await page.waitForTimeout(5000);
    
    // 最终截屏
    await page.screenshot({ path: 'test-screenshots/detailed-05-complete.png', fullPage: true });
    
    return {
      success: hasSuccess,
      message: hasSuccess ? '检测到成功指示器' : '未检测到明确的成功指示器',
      details: '详细测试完成'
    };
    
  } catch (error) {
    console.error('❌ 详细前端测试失败:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'test-screenshots/detailed-error.png', fullPage: true });
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      console.log('\n⏳ 保持浏览器开启10秒供检查...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
      console.log('🌐 浏览器已关闭');
    }
  }
}

// 执行详细测试
testFrontendDetailed()
  .then(result => {
    console.log('\n=== 详细前端测试总结 ===');
    console.log(`测试状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`结果消息: ${result.message || result.error || '无'}`);
  })
  .catch(error => {
    console.error('详细测试脚本执行错误:', error);
    process.exit(1);
  });