'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          五险一金尽职调查系统
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          专业的Web应用程序，用于企业五险一金合规性分析和尽职调查
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>数据导入</CardTitle>
            <CardDescription>导入Excel工资数据和政策规则</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              支持批量导入工资记录，自动解析Excel文件结构
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>计算引擎</CardTitle>
            <CardDescription>五险一金合规性计算</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              双重假设计算，精准对比理论与实际缴纳额
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>合规分析</CardTitle>
            <CardDescription>生成详细的合规分析报告</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              识别潜在风险，量化合规缺口的财务影响
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
