'use client'

import { QueryStatisticsBarProps } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Calendar, BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

export function StatisticsBar({ statistics, loading }: QueryStatisticsBarProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!statistics) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            请执行查询以查看统计信息
          </div>
        </CardContent>
      </Card>
    )
  }

  const { totalRecords, employeeCount, periodRange, wideCount, narrowCount } = statistics

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {/* 总记录数 */}
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">总记录数:</span>
            <span className="font-semibold text-blue-600">
              {totalRecords.toLocaleString()} 条
            </span>
          </div>

          {/* 员工数量 */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">员工数:</span>
            <span className="font-semibold text-green-600">
              {employeeCount} 人
            </span>
          </div>

          {/* 时间跨度 */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-500" />
            <span className="text-muted-foreground">期间:</span>
            <span className="font-semibold text-purple-600">
              {periodRange}
            </span>
          </div>

          {/* 宽口径数量 */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-muted-foreground">宽口径:</span>
            <span className="font-semibold text-orange-600">
              {wideCount.toLocaleString()} 条
            </span>
          </div>

          {/* 窄口径数量 */}
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-cyan-500" />
            <span className="text-muted-foreground">窄口径:</span>
            <span className="font-semibold text-cyan-600">
              {narrowCount.toLocaleString()} 条
            </span>
          </div>
        </div>

        {/* 数据完整性提示 */}
        {wideCount !== narrowCount && (
          <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            ⚠️ 宽窄口径数据量不一致，可能存在部分期间数据缺失
          </div>
        )}
      </CardContent>
    </Card>
  )
}