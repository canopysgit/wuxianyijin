import { defineConfig, devices } from '@playwright/test';

/**
 * 五险一金系统前端测试配置
 * 测试Excel上传界面的完整用户交互流程
 */
export default defineConfig({
  testDir: './tests',
  /* 测试超时时间 */
  timeout: 30 * 1000,
  expect: {
    /* 断言超时时间 */
    timeout: 5000
  },
  /* 并行执行失败时的处理 */
  fullyParallel: true,
  /* 失败重试次数 */
  retries: process.env.CI ? 2 : 0,
  /* 并发执行的worker数量 */
  workers: process.env.CI ? 1 : undefined,
  /* 报告格式 */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  /* 全局测试配置 */
  use: {
    /* 基础URL */
    baseURL: 'http://localhost:3006',
    /* 浏览器跟踪 */
    trace: 'on-first-retry',
    /* 截图设置 */
    screenshot: 'only-on-failure',
    /* 视频录制 */
    video: 'retain-on-failure',
    /* 等待网络空闲 */
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 移动端测试 */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* 测试前启动开发服务器（如果需要） */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3006',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});