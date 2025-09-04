import Link from 'next/link'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import LoginForm from '@/components/LoginForm'
import LogoutButton from '@/components/LogoutButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Upload, BarChart3, FileText } from 'lucide-react'

export default async function HomePage() {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const secret = process.env.AUTH_SECRET
  let username: string | null = null
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
      username = (payload as any)?.username || null
    } catch {}
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">五险一金尽职调查系统</h1>
          <p className="text-muted-foreground">企业五险一金合规分析与尽调</p>
        </div>
        <div>
          {username ? (
            <div className="flex items-center gap-3 text-sm">
              <span>已登录：{username}</span>
              <LogoutButton />
            </div>
          ) : null}
        </div>
      </div>

      {!username && (
        <div className="flex justify-center">
          <LoginForm defaultNext="/" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" /> 数据上传
            </CardTitle>
            <CardDescription>导入 Excel 工资数据，支持批量与校验</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">多文件上传，自动解析与实时验证</p>
            <Button className="w-full" asChild>
              <Link href="/upload">进入上传页面</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-green-500" /> 结果查询
            </CardTitle>
            <CardDescription>支持员工筛选、期间选择、宽/窄口径对比</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">对比与明细展开，支持导出 Excel</p>
            <Button className="w-full" asChild>
              <Link href="/query">进入查询页面</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" /> 合规分析
            </CardTitle>
            <CardDescription>识别潜在缴费风险（规划中）</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="secondary" disabled>
              即将上线
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> 系统说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>支持期间：2023/2024 上下半年，按半年进行计算与对比。</p>
          <p>调基规则：每年 7 月 1 日调基；上下半年采用不同政策标准。</p>
          <p>计算假设：宽口径（应发工资）与窄口径（基本工资）。</p>
        </CardContent>
      </Card>
    </div>
  )
}

