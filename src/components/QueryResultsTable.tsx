'use client'

import { useState, useMemo } from 'react'
import { QueryResultsTableProps, PairedCalculationRow, MultiSortConfig } from '@/lib/types'
import { 
  sortPairedRows, 
  formatCurrency, 
  formatMonth, 
  hasDataType, 
  getDataByType,
  paginatePairedRows
} from '@/lib/queryUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Download,
  Users,
  Calendar
} from 'lucide-react'

interface QueryResultsTableState {
  sortConfig: MultiSortConfig
  currentPage: number
  pageSize: number
  expandedRows: Set<string>
}

export function QueryResultsTable({
  pairedRows,
  loading,
  onExport,
  onRowExpand
}: QueryResultsTableProps) {
  const [state, setState] = useState<QueryResultsTableState>({
    sortConfig: {
      primary: { field: 'calculation_month', direction: 'asc' },
      secondary: { field: 'employee_id', direction: 'asc' }
    },
    currentPage: 1,
    pageSize: 50,
    expandedRows: new Set()
  })

  // 排序和分页处理
  const processedData = useMemo(() => {
    const sorted = sortPairedRows(pairedRows, state.sortConfig)
    return paginatePairedRows(sorted, state.currentPage, state.pageSize)
  }, [pairedRows, state.sortConfig, state.currentPage, state.pageSize])

  // 处理排序点击
  const handleSort = (field: 'employee_id' | 'calculation_month') => {
    setState(prev => {
      const newSortConfig = { ...prev.sortConfig }
      
      if (newSortConfig.primary.field === field) {
        // 切换主排序方向
        newSortConfig.primary.direction = 
          newSortConfig.primary.direction === 'asc' ? 'desc' : 'asc'
      } else {
        // 设置新的主排序字段
        newSortConfig.secondary = newSortConfig.primary
        newSortConfig.primary = { field, direction: 'asc' }
      }
      
      return {
        ...prev,
        sortConfig: newSortConfig,
        currentPage: 1 // 重置到第一页
      }
    })
  }

  // 获取排序图标
  const getSortIcon = (field: 'employee_id' | 'calculation_month') => {
    if (state.sortConfig.primary.field === field) {
      return state.sortConfig.primary.direction === 'asc' 
        ? <ArrowUp className="h-4 w-4" />
        : <ArrowDown className="h-4 w-4" />
    }
    return <ArrowUpDown className="h-4 w-4 opacity-50" />
  }

  // 处理行展开/收起
  const toggleRowExpanded = (rowKey: string) => {
    setState(prev => {
      const newExpandedRows = new Set(prev.expandedRows)
      if (newExpandedRows.has(rowKey)) {
        newExpandedRows.delete(rowKey)
      } else {
        newExpandedRows.add(rowKey)
      }
      return {
        ...prev,
        expandedRows: newExpandedRows
      }
    })
  }

  // 处理分页
  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }))
  }

  // 处理明细展开
  const handleDetailExpand = (row: PairedCalculationRow, type: 'wide' | 'narrow') => {
    onRowExpand(row, type)
  }

  // 生成行的唯一键
  const getRowKey = (row: PairedCalculationRow): string => {
    return `${row.employee_id}|${row.monthKey}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pairedRows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>查询结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">暂无数据</h3>
            <p className="mt-2 text-muted-foreground">
              请调整查询条件后重新查询
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            查询结果
            <Badge variant="secondary">
              {processedData.totalItems} 条记录
            </Badge>
          </CardTitle>
          <Button onClick={onExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('employee_id')}
                >
                  <div className="flex items-center gap-1">
                    员工ID
                    {getSortIcon('employee_id')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('calculation_month')}
                >
                  <div className="flex items-center gap-1">
                    计算月份
                    {getSortIcon('calculation_month')}
                  </div>
                </TableHead>
                <TableHead>口径</TableHead>
                <TableHead className="text-right">养老保险</TableHead>
                <TableHead className="text-right">医疗保险</TableHead>
                <TableHead className="text-right">失业保险</TableHead>
                <TableHead className="text-right">工伤保险</TableHead>
                <TableHead className="text-right">住房公积金</TableHead>
                <TableHead className="text-right">理论总计</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.data.map(row => {
                const rowKey = getRowKey(row)
                const isExpanded = state.expandedRows.has(rowKey)
                
                return (
                  <>
                    {/* 宽口径行 */}
                    <TableRow key={`${rowKey}-wide`}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpanded(rowKey)}
                        >
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.employee_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatMonth(row.calculation_month)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-600">
                          宽口径
                        </Badge>
                      </TableCell>
                      {hasDataType(row, 'wide') ? (
                        <>
                          <TableCell className="text-right">{formatCurrency(row.wide!.pension_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.wide!.medical_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.wide!.unemployment_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.wide!.injury_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.wide!.hf_payment)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(row.wide!.theoretical_total)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDetailExpand(row, 'wide')}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center text-muted-foreground" colSpan={6}>
                            无数据
                          </TableCell>
                          <TableCell></TableCell>
                        </>
                      )}
                    </TableRow>

                    {/* 窄口径行 */}
                    <TableRow key={`${rowKey}-narrow`} className="bg-slate-50/50">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-cyan-600">
                          窄口径
                        </Badge>
                      </TableCell>
                      {hasDataType(row, 'narrow') ? (
                        <>
                          <TableCell className="text-right">{formatCurrency(row.narrow!.pension_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.narrow!.medical_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.narrow!.unemployment_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.narrow!.injury_payment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.narrow!.hf_payment)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(row.narrow!.theoretical_total)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDetailExpand(row, 'narrow')}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center text-muted-foreground" colSpan={6}>
                            无数据
                          </TableCell>
                          <TableCell></TableCell>
                        </>
                      )}
                    </TableRow>
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* 分页导航 */}
        {processedData.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4">
            <div className="text-sm text-muted-foreground">
              第 {processedData.currentPage} 页，共 {processedData.totalPages} 页
              （显示 {(processedData.currentPage - 1) * state.pageSize + 1}-
              {Math.min(processedData.currentPage * state.pageSize, processedData.totalItems)} 条，
              共 {processedData.totalItems} 条）
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={processedData.currentPage === 1}
              >
                首页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(processedData.currentPage - 1)}
                disabled={processedData.currentPage === 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(processedData.currentPage + 1)}
                disabled={processedData.currentPage === processedData.totalPages}
              >
                下一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(processedData.totalPages)}
                disabled={processedData.currentPage === processedData.totalPages}
              >
                末页
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}