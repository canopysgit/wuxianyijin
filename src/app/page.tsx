'use client'

import Link from 'next/link'
import DataUpload from '@/components/DataUpload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Upload, BarChart3, FileText } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* 页面标题 */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">五险一金尽职调查系统</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          专业的Web应用程序，用于企业五险一金合规性分析和尽职调查
        </p>
      </div>

      {/* 功能模块导航 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              数据导入
            </CardTitle>
            <CardDescription>
              导入Excel格式的工资数据，支持批量处理和数据验证
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              支持多文件上传，自动解析工资表结构，实时验证数据完整性
            </p>
            <Button className="w-full" asChild>
              <Link href="#upload">
                开始导入数据
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-green-500" />
              数据查询
            </CardTitle>
            <CardDescription>
              查询和分析五险一金计算结果，支持多维度筛选
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              支持员工查询、时间期间选择、宽窄口径对比和详细明细展开
            </p>
            <Button className="w-full" asChild>
              <Link href="/query">
                进入查询系统
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              合规分析
            </CardTitle>
            <CardDescription>
              生成合规分析报告，识别潜在的缴费风险
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              理论vs实际对比分析，风险等级评估，可视化报告生成
            </p>
            <Button className="w-full" variant="secondary" disabled>
              即将上线
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 数据导入区域 */}
      <div id="upload">
        <DataUpload />
      </div>

      {/* 系统说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            系统说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">分析周期</h3>
              <p className="text-sm text-muted-foreground">
                2023年1月1日-2024年9月30日，按半年期间分析
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">调基规则</h3>
              <p className="text-sm text-muted-foreground">
                每年7月1日调基，上下半年适用不同政策标准
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">计算假设</h3>
              <p className="text-sm text-muted-foreground">
                支持宽口径（应发工资）和窄口径（基本工资）双重测算
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">地区定位</h3>
              <p className="text-sm text-muted-foreground">
                以佛山地区政策为基准，可扩展至其他城市
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
