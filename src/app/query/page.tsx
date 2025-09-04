'use client'

import { useState } from 'react'
import { 
  QueryRequest, 
  QueryResponse, 
  PairedCalculationRow, 
  CalculationResultNew 
} from '@/lib/types'
import { pairCalculationResults } from '@/lib/queryUtils'
import { QueryPanel } from '@/components/QueryPanel'
import { StatisticsBar } from '@/components/StatisticsBar'
import { QueryResultsTable } from '@/components/QueryResultsTable'
import { CalculationDetail } from '@/components/CalculationDetail'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'

interface QueryPageState {
  loading: boolean
  queryResponse: QueryResponse | null
  pairedRows: PairedCalculationRow[]
  selectedDetail: {
    result: CalculationResultNew
    type: 'wide' | 'narrow'
  } | null
}

export default function QueryPage() {
  const [state, setState] = useState<QueryPageState>({
    loading: false,
    queryResponse: null,
    pairedRows: [],
    selectedDetail: null
  })
  
  const { toast } = useToast()

  // 执行查询
  const handleQuery = async (request: QueryRequest) => {
    setState(prev => ({ ...prev, loading: true }))

    try {
      console.log('发起查询请求:', request)
      
      const response = await fetch('/api/calculations/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '查询失败')
      }

      const queryResponse: QueryResponse = await response.json()
      console.log('查询响应:', queryResponse)

      // 将字符串日期恢复为 Date，避免前端调用 Date 方法时报错
      const revive = (r: any): CalculationResultNew => ({
        ...r,
        calculation_month: r?.calculation_month instanceof Date
          ? r.calculation_month
          : new Date(r.calculation_month),
        created_at: r?.created_at instanceof Date
          ? r.created_at
          : new Date(r.created_at),
      })

      const normalized: QueryResponse = {
        ...queryResponse,
        wideResults: (queryResponse.wideResults as any[]).map(revive),
        narrowResults: (queryResponse.narrowResults as any[]).map(revive),
      }

      // 配对宽窄口径数据
      const pairedRows = pairCalculationResults(
        normalized.wideResults,
        normalized.narrowResults
      )

      setState(prev => ({
        ...prev,
        loading: false,
        queryResponse: normalized,
        pairedRows
      }))

      // 显示成功提示
      toast({
        title: "查询成功",
        description: `找到 ${queryResponse.statistics.totalRecords} 条记录，涉及 ${queryResponse.statistics.employeeCount} 名员工`,
      })

    } catch (error) {
      console.error('查询失败:', error)
      
      setState(prev => ({ ...prev, loading: false }))
      
      toast({
        title: "查询失败",
        description: error instanceof Error ? error.message : '网络错误，请稍后重试',
        variant: "destructive",
      })
    }
  }

  // 处理Excel导出
  const handleExport = async () => {
    if (!state.queryResponse) {
      toast({
        title: "导出失败",
        description: "没有可导出的数据",
        variant: "destructive",
      })
      return
    }

    try {
      // 获取当前查询条件（需要从queryResponse重新构造）
      const periods = Array.from(new Set([
        ...state.queryResponse.wideResults.map(r => {
          const month = r.calculation_month.getMonth() + 1
          const year = r.calculation_month.getFullYear()
          return month <= 6 ? `${year}H1` : `${year}H2`
        }),
        ...state.queryResponse.narrowResults.map(r => {
          const month = r.calculation_month.getMonth() + 1
          const year = r.calculation_month.getFullYear()
          return month <= 6 ? `${year}H1` : `${year}H2`
        })
      ]))

      // 获取员工ID（如果有筛选的话）
      const uniqueEmployees = Array.from(new Set([
        ...state.queryResponse.wideResults.map(r => r.employee_id),
        ...state.queryResponse.narrowResults.map(r => r.employee_id)
      ]))
      
      const employeeId = uniqueEmployees.length === 1 ? uniqueEmployees[0] : undefined

      console.log('准备导出:', { employeeId, periods })

      const exportRequest = {
        employeeId,
        periods
      }

      toast({
        title: "开始导出",
        description: "正在生成Excel文件，请稍候...",
      })

      const response = await fetch('/api/calculations/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportRequest)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '导出失败')
      }

      // 获取文件blob
      const blob = await response.blob()
      
      // 从响应头获取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      let fileName = '五险一金查询结果.xlsx'
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
        if (fileNameMatch) {
          fileName = decodeURIComponent(fileNameMatch[1])
        }
      }

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      
      // 清理
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

      toast({
        title: "导出成功",
        description: `已下载文件: ${fileName}`,
      })

    } catch (error) {
      console.error('导出失败:', error)
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : '导出过程中发生错误',
        variant: "destructive",
      })
    }
  }

  // 处理行展开
  const handleRowExpand = (row: PairedCalculationRow, type: 'wide' | 'narrow') => {
    const result = type === 'wide' ? row.wide : row.narrow
    
    if (!result) {
      toast({
        title: "无法展开",
        description: `该行没有${type === 'wide' ? '宽口径' : '窄口径'}数据`,
        variant: "destructive",
      })
      return
    }

    setState(prev => ({
      ...prev,
      selectedDetail: { result, type }
    }))
  }

  // 关闭详情弹窗
  const handleCloseDetail = () => {
    setState(prev => ({
      ...prev,
      selectedDetail: null
    }))
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">五险一金查询分析</h1>
        <p className="text-muted-foreground">
          查询和分析员工的五险一金理论计算结果，支持宽窄口径对比和明细展开
        </p>
      </div>

      {/* 查询面板 */}
      <QueryPanel 
        onQuery={handleQuery} 
        loading={state.loading} 
      />

      {/* 统计信息栏 */}
      <StatisticsBar 
        statistics={state.queryResponse?.statistics || null}
        loading={state.loading}
      />

      {/* 查询结果表格 */}
      <QueryResultsTable
        pairedRows={state.pairedRows}
        loading={state.loading}
        onExport={handleExport}
        onRowExpand={handleRowExpand}
      />

      {/* 详情弹窗 */}
      <Dialog 
        open={!!state.selectedDetail} 
        onOpenChange={(open) => !open && handleCloseDetail()}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {state.selectedDetail && (
            <CalculationDetail
              result={state.selectedDetail.result}
              type={state.selectedDetail.type}
              onClose={handleCloseDetail}
            />
          )}
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
