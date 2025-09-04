# 测试记录：导出 Excel 功能失败修复

- 日期：2025-09-04
- 场景：查询页点击“导出”，请求接口 `/api/calculations/export`

## 错误现象
- 前端提示：“导出失败”。
- 接口返回非 200。抓包与本地 `Invoke-WebRequest` 显示 500。
- 后端错误详情（已通过 API 返回体打印）：
  - `Cannot convert argument to a ByteString because the character at index 22 has a value of 20116 which is greater than 255.`

## 根因分析
- 路由 `src/app/api/calculations/export/route.ts` 在返回响应时设置了中文文件名：
  - `Content-Disposition: attachment; filename="五险一金查询结果_....xlsx"`
- Next.js 使用 WHATWG Headers，要求头部值为 ByteString（仅允许 0–255 范围内的字节）。直接放入中文会触发上述 ByteString 转换错误并导致 500。

## 修复方案
- 使用 RFC 5987 方案同时提供 ASCII 回退与 UTF-8 文件名：
  - `filename="result_<timestamp>.xlsx"` 作为 ASCII 回退；
  - `filename*=UTF-8''<encodeURIComponent(中文文件名)>` 提供真实中文名。
- 同时明确指定 Node.js 运行时，确保 `Buffer` 在路由中可用：
  - 在导出路由顶部添加：
    - `export const runtime = 'nodejs'`
    - `export const dynamic = 'force-dynamic'`

## 代码变更
- 文件：`src/app/api/calculations/export/route.ts`
  - 新增：`export const runtime = 'nodejs'`、`export const dynamic = 'force-dynamic'`。
  - 响应头修改：
    - 旧：`Content-Disposition: attachment; filename="<中文文件名>.xlsx"`
    - 新：`Content-Disposition: attachment; filename="result_<ts>.xlsx"; filename*=UTF-8''<URL 编码的中文文件名>`

## 验证
- 通过 `Invoke-WebRequest`/浏览器实际请求：
  - 返回 `200`；
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`；
  - `Content-Disposition` 同时包含 ASCII 与 `filename*`；
  - 文件可成功下载并打开。
- 前端解析时若只读取 `filename` 将得到 ASCII 回退名；如需显示中文名，可优先解析 `filename*`。

## 后续建议
- 前端解析文件名时，优先使用 `filename*`（若存在），否则回退到 `filename`。
- 其他导出/下载接口若也返回中文名，应按相同方式设置响应头。
