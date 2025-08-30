'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Database, TrendingUp } from 'lucide-react';
import ExcelUpload from './ExcelUpload';

export default function DataUpload() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          五险一金尽职调查系统
        </h1>
        <p className="text-gray-600">
          数据导入与合规性分析工具
        </p>
      </div>

      {/* 系统概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              数据导入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              上传Excel工资表文件，系统将自动解析并导入员工工资数据。
            </p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• 支持2022-2024年工资数据</li>
              <li>• 自动识别工作表和数据格式</li>
              <li>• 重复数据自动更新</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              合规分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              基于政策规则自动计算理论缴费金额，分析合规风险。
            </p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• 支持双重假设计算</li>
              <li>• 动态员工分类算法</li>
              <li>• 合规缺口识别</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Excel文件上传组件 */}
      <ExcelUpload 
        onImportComplete={(results) => {
          console.log('导入完成:', results);
          // TODO: 显示成功提示或跳转到数据查看页面
        }}
      />
    </div>
  );
}