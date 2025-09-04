'use client'

import { useState } from 'react'
import { QueryPanelProps, QueryRequest } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Download, RotateCcw, Loader2 } from 'lucide-react'

// 可选的时间期间
const AVAILABLE_PERIODS = [
  { value: '2023H1', label: '2023年上半年 (1-6月)' },
  { value: '2023H2', label: '2023年下半年 (7-12月)' },
  { value: '2024H1', label: '2024年上半年 (1-6月)' },
  { value: '2024H2', label: '2024年下半年 (7-9月)' },
]

export function QueryPanel({ onQuery, loading }: QueryPanelProps) {
  const [employeeId, setEmployeeId] = useState<string>('')
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['2023H1'])
  
  // 处理期间选择变化
  const handlePeriodChange = (period: string, checked: boolean) => {
    setSelectedPeriods(prev => {
      if (checked) {
        return [...prev, period]
      } else {
        return prev.filter(p => p !== period)
      }
    })
  }
  
  // 处理查询提交
  const handleQuery = () => {
    if (selectedPeriods.length === 0) {
      alert('请至少选择一个时间期间')
      return
    }
    
    const request: QueryRequest = {
      employeeId: employeeId.trim() || undefined,
      periods: selectedPeriods
    }
    
    onQuery(request)
  }
  
  // 清空条件
  const handleReset = () => {
    setEmployeeId('')
    setSelectedPeriods(['2023H1'])
  }
  
  // 全选/全不选期间
  const handleToggleAllPeriods = () => {
    if (selectedPeriods.length === AVAILABLE_PERIODS.length) {
      setSelectedPeriods([])
    } else {
      setSelectedPeriods(AVAILABLE_PERIODS.map(p => p.value))
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          查询条件
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 员工ID输入 */}
          <div className="space-y-2">
            <Label htmlFor="employeeId">员工工号</Label>
            <Input
              id="employeeId"
              type="text"
              placeholder="输入员工工号 (空则查询所有)"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              留空查询所有员工
            </p>
          </div>
          
          {/* 时间期间选择 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>时间期间</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAllPeriods}
                disabled={loading}
              >
                {selectedPeriods.length === AVAILABLE_PERIODS.length ? '全不选' : '全选'}
              </Button>
            </div>
            <div className="space-y-2">
              {AVAILABLE_PERIODS.map(period => (
                <div key={period.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={period.value}
                    checked={selectedPeriods.includes(period.value)}
                    onCheckedChange={(checked) => 
                      handlePeriodChange(period.value, checked as boolean)
                    }
                    disabled={loading}
                  />
                  <Label 
                    htmlFor={period.value}
                    className="text-sm font-normal"
                  >
                    {period.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              已选择 {selectedPeriods.length} 个期间
            </p>
          </div>
          
          {/* 操作按钮 */}
          <div className="space-y-2">
            <Label>操作</Label>
            <div className="space-y-2">
              <Button
                onClick={handleQuery}
                disabled={loading || selectedPeriods.length === 0}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    查询中...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    开始查询
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="w-full"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                清空条件
              </Button>
            </div>
          </div>
        </div>
        
        {/* 查询提示 */}
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>查询说明：</strong>
            系统会同时查询宽口径和窄口径数据，并按员工ID+月份配对显示。
            单次查询最多返回6000条记录，建议按需选择时间期间。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}