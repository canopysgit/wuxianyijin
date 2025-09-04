const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testFrontendUpload() {
  console.log('=== 五险一金系统 前端Excel上传自动化测试 ===\n');
  
  const baseUrl = 'http://localhost:3006';
  const testFilePath = path.join(__dirname, '数据', 'test file.xlsx');
  
  console.log(`前端地址: ${baseUrl}`);
  console.log(`测试文件: ${testFilePath}`);
  
  // 检查文件是否存在
  if (!fs.existsSync(testFilePath)) {
    throw new Error(`测试文件不存在: ${testFilePath}`);
  }
  
  let browser;
  let page;
  
  try {
    // 启动浏览器
    console.log('\n🌐 启动Chromium浏览器...');
    browser = await chromium.launch({ 
      headless: false, // 非无头模式，方便观察测试过程
      slowMo: 1000     // 每个操作间隔1秒
    });
    
    const context = await browser.newContext();
    page = await context.newPage();
    
    // 设置较长的超时时间
    page.setDefaultTimeout(30000);
    
    // 访问首页
    console.log('\n📱 访问应用首页...');
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
    
    // 截屏记录初始状态
    await page.screenshot({ path: 'test-screenshots/01-homepage.png', fullPage: true });
    console.log('✅ 首页加载完成');
    
    // 查找数据上传组件或按钮
    console.log('\n🔍 查找上传组件...');
    
    // 检查页面标题和内容
    const pageTitle = await page.title();
    console.log(`页面标题: ${pageTitle}`);
    
    const pageContent = await page.textContent('body');
    console.log(`页面是否包含"上传"关键词: ${pageContent.includes('上传') || pageContent.includes('导入') || pageContent.includes('Upload')}`);
    
    // 尝试多种可能的上传元素选择器
    const uploadSelectors = [
      'input[type="file"]',
      '[data-testid="file-upload"]',
      '.upload-zone',
      '.dropzone',
      'button:has-text("上传")',
      'button:has-text("导入")',
      'button:has-text("选择文件")',
      '[role="button"]:has-text("上传")',
      '.file-input'
    ];
    
    let fileInputFound = false;
    let fileInput = null;
    
    for (const selector of uploadSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          console.log(`✅ 找到上传元素: ${selector}`);
          fileInput = element;
          fileInputFound = true;
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
        console.log(`   尝试选择器 "${selector}": 未找到`);
      }
    }
    
    if (!fileInputFound) {
      // 如果没有找到明确的上传控件，检查页面结构
      console.log('\n⚠️ 未找到明确的上传控件，分析页面结构...');
      
      const bodyHTML = await page.locator('body').innerHTML();
      
      // 检查是否有拖拽区域
      const hasDragArea = bodyHTML.includes('drag') || bodyHTML.includes('drop') || bodyHTML.includes('拖拽');
      console.log(`页面是否包含拖拽区域: ${hasDragArea}`);
      
      // 检查所有按钮
      const buttons = await page.locator('button').all();
      console.log(`页面按钮数量: ${buttons.length}`);
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const buttonText = await button.textContent();
        console.log(`   按钮${i + 1}: "${buttonText}"`);
        
        if (buttonText && (buttonText.includes('上传') || buttonText.includes('导入') || buttonText.includes('选择'))) {
          fileInput = button;
          fileInputFound = true;
          console.log(`✅ 找到上传按钮: "${buttonText}"`);
          break;
        }
      }
    }
    
    if (!fileInputFound) {
      // 最后尝试：查找所有可交互元素
      console.log('\n🔎 分析页面所有可交互元素...');
      
      await page.screenshot({ path: 'test-screenshots/02-no-upload-found.png', fullPage: true });
      
      // 输出页面的主要结构
      const mainContent = await page.locator('main, .main, #main, .content').first().innerHTML().catch(() => bodyHTML.substring(0, 1000));
      console.log('页面主要内容:', mainContent.substring(0, 500) + '...');
      
      throw new Error('未找到文件上传控件，请检查页面实现');
    }
    
    // 尝试上传文件
    console.log('\n📤 开始文件上传...');
    
    // 检查是否是文件input元素
    const inputType = await fileInput.getAttribute('type');
    if (inputType === 'file') {
      console.log('✅ 找到文件输入控件');
      await fileInput.setInputFiles(testFilePath);
      console.log('✅ 文件已选择');
    } else {
      console.log('ℹ️  非文件输入控件，尝试点击...');
      await fileInput.click();
      
      // 等待文件选择对话框或其他上传界面
      await page.waitForTimeout(2000);
      
      // 尝试查找出现的文件输入框
      const dynamicFileInput = await page.locator('input[type="file"]').first();
      if (await dynamicFileInput.isVisible()) {
        await dynamicFileInput.setInputFiles(testFilePath);
        console.log('✅ 通过动态文件输入框上传文件');
      } else {
        throw new Error('点击上传按钮后未找到文件选择控件');
      }
    }
    
    // 等待文件处理
    console.log('\n⏳ 等待文件处理...');
    await page.waitForTimeout(3000);
    
    // 截屏记录上传后状态
    await page.screenshot({ path: 'test-screenshots/03-after-upload.png', fullPage: true });
    
    // 查找上传结果提示
    const resultIndicators = [
      'text=上传成功',
      'text=导入成功',
      'text=处理完成',
      'text=成功',
      '.success',
      '.upload-success',
      '[data-testid="upload-result"]',
      '.result-message'
    ];
    
    let uploadSuccess = false;
    let resultMessage = '';
    
    for (const selector of resultIndicators) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          resultMessage = await element.textContent();
          console.log(`✅ 找到结果提示: "${resultMessage}"`);
          uploadSuccess = true;
          break;
        }
      } catch (error) {
        // 继续检查下一个
      }
    }
    
    // 查找错误提示
    if (!uploadSuccess) {
      const errorIndicators = [
        'text=错误',
        'text=失败',
        'text=Error',
        '.error',
        '.upload-error',
        '.error-message'
      ];
      
      for (const selector of errorIndicators) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            const errorMessage = await element.textContent();
            console.log(`❌ 找到错误提示: "${errorMessage}"`);
            resultMessage = errorMessage;
            break;
          }
        } catch (error) {
          // 继续检查下一个
        }
      }
    }
    
    // 检查页面是否显示了数据表格或其他成功指示器
    if (!uploadSuccess) {
      console.log('\n🔍 检查页面数据表格...');
      
      const tableElements = await page.locator('table, .table, .data-table').all();
      if (tableElements.length > 0) {
        console.log(`✅ 找到 ${tableElements.length} 个表格元素`);
        
        for (let i = 0; i < tableElements.length; i++) {
          const table = tableElements[i];
          const tableText = await table.textContent();
          
          // 检查表格是否包含测试数据
          if (tableText.includes('DF-2389') || tableText.includes('DF-2127') || tableText.includes('DF-0793')) {
            console.log(`✅ 表格${i + 1}包含测试数据，上传可能成功`);
            uploadSuccess = true;
            resultMessage = '在数据表格中发现测试数据';
            break;
          }
        }
      }
    }
    
    // 最终截屏
    await page.screenshot({ path: 'test-screenshots/04-final-result.png', fullPage: true });
    
    // 等待更长时间以观察异步处理结果
    console.log('\n⏳ 等待可能的异步处理结果...');
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'test-screenshots/05-after-wait.png', fullPage: true });
    
    return {
      success: uploadSuccess,
      message: resultMessage || '上传过程完成，但未检测到明确的成功/失败提示',
      screenshots: [
        'test-screenshots/01-homepage.png',
        'test-screenshots/03-after-upload.png',
        'test-screenshots/04-final-result.png',
        'test-screenshots/05-after-wait.png'
      ]
    };
    
  } catch (error) {
    console.error('❌ 前端测试失败:', error.message);
    
    if (page) {
      await page.screenshot({ path: 'test-screenshots/error-screenshot.png', fullPage: true });
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🌐 浏览器已关闭');
    }
  }
}

// 创建截图目录
async function ensureScreenshotDir() {
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    console.log(`创建截图目录: ${screenshotDir}`);
  }
}

// 执行测试
async function runFrontendTests() {
  await ensureScreenshotDir();
  
  const result = await testFrontendUpload();
  
  console.log('\n=== 前端测试总结 ===');
  console.log(`测试状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`结果消息: ${result.message || result.error || '无'}`);
  
  if (result.screenshots) {
    console.log('\n📸 测试截图:');
    result.screenshots.forEach((screenshot, index) => {
      console.log(`   ${index + 1}. ${screenshot}`);
    });
  }
  
  return result;
}

runFrontendTests()
  .catch(error => {
    console.error('前端测试脚本执行错误:', error);
    process.exit(1);
  });