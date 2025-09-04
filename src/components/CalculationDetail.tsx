'use client'

import { CalculationDetailProps } from '@/lib/types'
import { formatCurrency } from '@/lib/queryUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { X, User, Calendar, TrendingUp, Calculator } from 'lucide-react'

export function CalculationDetail({ result, type, onClose }: CalculationDetailProps) {
  const typeLabel = type === 'wide' ? '宽口径' : '窄口径'
  const typeColor = type === 'wide' ? 'text-orange-600' : 'text-cyan-600'

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            计算明细展开
            <Badge variant="outline" className={typeColor}>
              {typeLabel}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">员工工号</p>
              <p className="font-semibold">{result.employee_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">计算月份</p>
              <p className="font-semibold">
                {result.calculation_month.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">员工类别</p>
            <Badge variant="secondary">{result.employee_category}类</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">理论总计</p>
            <p className="font-bold text-lg text-green-600">
              {formatCurrency(result.theoretical_total)}
            </p>
          </div>
        </div>

        <Separator />

        {/* 参考工资信息 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            参考工资基数信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">参考工资基数</p>
              <p className="font-semibold text-lg">
                {formatCurrency(result.reference_wage_base)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">参考工资类别</p>
              <Badge variant="outline">{result.reference_wage_category}</Badge>
            </div>
          </div>
        </div>

        {/* 各险种调整明细 */}
        <div className="space-y-4">
          <h3 className="font-semibold">险种基数调整与缴费明细</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 养老保险 */}
            <div className="border p-4 rounded-lg">
              <h4 className="font-medium text-blue-600 mb-3">养老保险</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数下限:</span>
                  <span>{formatCurrency(result.pension_base_floor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数上限:</span>
                  <span>{formatCurrency(result.pension_base_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">调整后基数:</span>
                  <span className="font-semibold">{formatCurrency(result.pension_adjusted_base)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应缴金额:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(result.pension_payment)}</span>
                </div>
              </div>
            </div>

            {/* 医疗保险 */}
            <div className="border p-4 rounded-lg">
              <h4 className="font-medium text-green-600 mb-3">医疗保险</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数下限:</span>
                  <span>{formatCurrency(result.medical_base_floor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数上限:</span>
                  <span>{formatCurrency(result.medical_base_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">调整后基数:</span>
                  <span className="font-semibold">{formatCurrency(result.medical_adjusted_base)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应缴金额:</span>
                  <span className="font-bold text-green-600">{formatCurrency(result.medical_payment)}</span>
                </div>
              </div>
            </div>

            {/* 失业保险 */}
            <div className="border p-4 rounded-lg">
              <h4 className="font-medium text-orange-600 mb-3">失业保险</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数下限:</span>
                  <span>{formatCurrency(result.unemployment_base_floor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数上限:</span>
                  <span>{formatCurrency(result.unemployment_base_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">调整后基数:</span>
                  <span className="font-semibold">{formatCurrency(result.unemployment_adjusted_base)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应缴金额:</span>
                  <span className="font-bold text-orange-600">{formatCurrency(result.unemployment_payment)}</span>
                </div>
              </div>
            </div>

            {/* 工伤保险 */}
            <div className="border p-4 rounded-lg">
              <h4 className="font-medium text-red-600 mb-3">工伤保险</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数下限:</span>
                  <span>{formatCurrency(result.injury_base_floor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基数上限:</span>
                  <span>{formatCurrency(result.injury_base_cap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">调整后基数:</span>
                  <span className="font-semibold">{formatCurrency(result.injury_adjusted_base)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应缴金额:</span>
                  <span className="font-bold text-red-600">{formatCurrency(result.injury_payment)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 住房公积金 */}
          <div className="border p-4 rounded-lg bg-purple-50">
            <h4 className="font-medium text-purple-600 mb-3">住房公积金</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">基数下限</span>
                <span className="font-semibold">{formatCurrency(result.hf_base_floor)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">基数上限</span>
                <span className="font-semibold">{formatCurrency(result.hf_base_cap)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">调整后基数</span>
                <span className="font-semibold">{formatCurrency(result.hf_adjusted_base)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">应缴金额</span>
                <span className="font-bold text-purple-600">{formatCurrency(result.hf_payment)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 汇总信息 */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">缴费汇总</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">五险合计</p>
              <p className="font-bold text-lg">
                {formatCurrency(
                  result.pension_payment + 
                  result.medical_payment + 
                  result.unemployment_payment + 
                  result.injury_payment
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">公积金</p>
              <p className="font-bold text-lg text-purple-600">
                {formatCurrency(result.hf_payment)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">理论总计</p>
              <p className="font-bold text-xl text-green-600">
                {formatCurrency(result.theoretical_total)}
              </p>
            </div>
          </div>
        </div>

        {/* 创建时间 */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          计算时间: {result.created_at.toLocaleString('zh-CN')}
        </div>
      </CardContent>
    </Card>
  )
}