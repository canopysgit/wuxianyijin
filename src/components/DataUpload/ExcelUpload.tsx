'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, FileText, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { parseExcelFile, validateExcelFile, ExcelParseResult } from '../../lib/excel';
import { importExcelData, importSalaryRecords, ImportResult } from '../../lib/database';

interface UploadFile {
  file: File;
  id: string;
  parseResult?: ExcelParseResult;
  importResults?: ImportResult[];
  status: 'pending' | 'parsing' | 'parsed' | 'importing' | 'imported' | 'error';
  error?: string;
  importProgress?: {
    totalRecords: number;
    processedRecords: number;
    currentSheet: string;
    percentage: number;
  };
}

interface ExcelUploadProps {
  onImportComplete?: (results: ImportResult[]) => void;
}

export default function ExcelUpload({ onImportComplete }: ExcelUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  // 处理文件拖拽上传
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles
      .filter(file => {
        const validation = validateExcelFile(file);
        return validation.valid;
      })
      .map(file => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending' as const
      }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: true
  });

  // 移除文件
  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 解析单个Excel文件
  const parseFile = async (fileId: string) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'parsing' as const } : f
    ));

    try {
      const file = uploadFiles.find(f => f.id === fileId)?.file;
      if (!file) throw new Error('文件不存在');

      const parseResult = await parseExcelFile(file);
      
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'parsed' as const, parseResult }
          : f
      ));
    } catch (error) {
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : '解析失败' 
            }
          : f
      ));
    }
  };

  // 导入单个文件数据
  const importFile = async (fileId: string) => {
    const uploadFile = uploadFiles.find(f => f.id === fileId);
    if (!uploadFile?.parseResult) throw new Error('文件未解析');

    // 计算总记录数
    const totalRecords = uploadFile.parseResult.sheets.reduce(
      (sum, sheet) => sum + sheet.records.length, 0
    );

    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { 
        ...f, 
        status: 'importing' as const,
        importProgress: {
          totalRecords,
          processedRecords: 0,
          currentSheet: uploadFile.parseResult.sheets[0]?.sheetName || '',
          percentage: 0
        }
      } : f
    ));

    try {
      const importResults: ImportResult[] = [];
      let processedRecords = 0;

      // 逐个工作表导入，提供进度反馈
      for (let i = 0; i < uploadFile.parseResult.sheets.length; i++) {
        const sheet = uploadFile.parseResult.sheets[i];
        
        // 更新当前进度
        setUploadFiles(prev => prev.map(f => 
          f.id === fileId ? {
            ...f,
            importProgress: {
              totalRecords,
              processedRecords,
              currentSheet: sheet.sheetName,
              percentage: Math.round((processedRecords / totalRecords) * 100)
            }
          } : f
        ));

        if (sheet.records.length > 0) {
          const result = await importSalaryRecords(sheet.records, sheet.sheetName);
          importResults.push(result);
          processedRecords += result.importedRecords;
          
          // 更新进度
          setUploadFiles(prev => prev.map(f => 
            f.id === fileId ? {
              ...f,
              importProgress: {
                totalRecords,
                processedRecords,
                currentSheet: sheet.sheetName,
                percentage: Math.round((processedRecords / totalRecords) * 100)
              }
            } : f
          ));
        }
      }
      
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: 'imported' as const, importResults, importProgress: undefined }
          : f
      ));

      onImportComplete?.(importResults);
    } catch (error) {
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : '导入失败',
              importProgress: undefined
            }
          : f
      ));
    }
  };

  // 批量处理所有文件
  const processAllFiles = async () => {
    setIsProcessing(true);
    
    try {
      // 首先解析所有待解析的文件
      const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
      for (const file of pendingFiles) {
        await parseFile(file.id);
      }

      // 等待状态更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 然后导入所有已解析的文件
      const parsedFiles = uploadFiles.filter(f => f.status === 'parsed');
      for (const file of parsedFiles) {
        await importFile(file.id);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 清空所有文件
  const clearAllFiles = () => {
    setUploadFiles([]);
    setSelectedPreview(null);
  };

  // 获取状态图标
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="w-4 h-4 text-gray-500" />;
      case 'parsing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'parsed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'importing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'imported':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  // 获取状态文本
  const getStatusText = (file: UploadFile) => {
    switch (file.status) {
      case 'pending':
        return '待处理';
      case 'parsing':
        return '解析中...';
      case 'parsed':
        return `已解析 (${file.parseResult?.sheets.length || 0} 个工作表)`;
      case 'importing':
        if (file.importProgress) {
          return `导入中... ${file.importProgress.processedRecords}/${file.importProgress.totalRecords} (${file.importProgress.percentage}%)`;
        }
        return '导入中...';
      case 'imported':
        const totalRecords = file.importResults?.reduce((sum, r) => sum + r.importedRecords, 0) || 0;
        const totalExpected = file.importResults?.reduce((sum, r) => sum + r.totalRecords, 0) || 0;
        return `已导入 ${totalRecords}/${totalExpected} 条记录`;
      case 'error':
        return file.error || '处理失败';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Excel工资数据导入
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 文件拖拽区域 */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600">拖放文件到此处...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-600">拖拽Excel文件到此处，或点击选择文件</p>
                <p className="text-sm text-gray-400">
                  支持 .xlsx 和 .xls 格式，文件名应包含年份（如&quot;2023年工资表.xlsx&quot;）
                </p>
              </div>
            )}
          </div>

          {/* 文件列表 */}
          {uploadFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">文件列表 ({uploadFiles.length})</h3>
                <div className="space-x-2">
                  <Button 
                    onClick={processAllFiles}
                    disabled={isProcessing || uploadFiles.every(f => f.status === 'imported')}
                    size="sm"
                  >
                    {isProcessing ? '处理中...' : '处理所有文件'}
                  </Button>
                  <Button 
                    onClick={clearAllFiles}
                    variant="outline"
                    size="sm"
                  >
                    清空列表
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {uploadFiles.map((uploadFile) => (
                  <Card key={uploadFile.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(uploadFile.status)}
                        <div>
                          <div className="font-medium">{uploadFile.file.name}</div>
                          <div className="text-sm text-gray-500">
                            {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB • {getStatusText(uploadFile)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {uploadFile.parseResult && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPreview(uploadFile.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            预览
                          </Button>
                        )}
                        
                        {uploadFile.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => parseFile(uploadFile.id)}
                          >
                            解析
                          </Button>
                        )}
                        
                        {uploadFile.status === 'parsed' && (
                          <Button
                            size="sm"
                            onClick={() => importFile(uploadFile.id)}
                          >
                            导入
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFile(uploadFile.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 导入进度显示 */}
                    {uploadFile.status === 'importing' && uploadFile.importProgress && (
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>正在导入: {uploadFile.importProgress.currentSheet}</span>
                          <span>{uploadFile.importProgress.processedRecords}/{uploadFile.importProgress.totalRecords}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadFile.importProgress.percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          {uploadFile.importProgress.percentage}% 完成
                        </div>
                      </div>
                    )}

                    {/* 错误信息显示 */}
                    {uploadFile.status === 'error' && uploadFile.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {uploadFile.error}
                      </div>
                    )}

                    {/* 解析统计信息 */}
                    {uploadFile.status === 'parsed' && uploadFile.parseResult && (
                      <div className="mt-2 space-y-1">
                        {uploadFile.parseResult.sheets.map((sheet, index) => (
                          <div key={index} className="text-sm bg-blue-50 p-2 rounded border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{sheet.sheetName}</span>
                              <span className="text-blue-600">{sheet.records.length} 条记录</span>
                            </div>
                            {sheet.stats && (
                              <div className="mt-1 text-xs text-gray-600 grid grid-cols-2 gap-2">
                                <span>总行数: {sheet.stats.totalRows}</span>
                                <span>有效: {sheet.stats.validRecords}</span>
                                <span>空行: {sheet.stats.emptyRows}</span>
                                <span>错误: {sheet.stats.errorRows}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 导入结果详情 */}
                    {uploadFile.status === 'imported' && uploadFile.importResults && (
                      <div className="mt-2 space-y-1">
                        {uploadFile.importResults.map((result, index) => (
                          <div key={index} className={`text-sm p-2 rounded border ${
                            result.success ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium">工作表 {index + 1}</span>
                              <span className={`text-sm ${result.success ? 'text-green-600' : 'text-orange-600'}`}>
                                {result.importedRecords}/{result.totalRecords} 
                                {result.success ? ' ✅' : ` (${result.failedRecords} 失败)`}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex justify-between">
                              <span>耗时: {result.duration}ms</span>
                              <span>成功率: {((result.importedRecords / result.totalRecords) * 100).toFixed(1)}%</span>
                            </div>
                            {result.failedRecords > 0 && result.errors.length > 0 && (
                              <div className="mt-1 text-xs text-red-600">
                                错误示例: {result.errors[0].error}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* 总计统计 */}
                        <div className="text-sm bg-blue-50 p-2 rounded border border-blue-200 font-medium">
                          总计: {uploadFile.importResults.reduce((sum, r) => sum + r.importedRecords, 0)}/
                          {uploadFile.importResults.reduce((sum, r) => sum + r.totalRecords, 0)} 条记录
                          {uploadFile.importResults.some(r => !r.success) && (
                            <span className="text-orange-600 ml-2">
                              (有失败记录)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据预览弹窗 */}
      {selectedPreview && (
        <DataPreviewModal
          uploadFile={uploadFiles.find(f => f.id === selectedPreview)!}
          onClose={() => setSelectedPreview(null)}
        />
      )}
    </div>
  );
}

// 数据预览弹窗组件
interface DataPreviewModalProps {
  uploadFile: UploadFile;
  onClose: () => void;
}

function DataPreviewModal({ uploadFile, onClose }: DataPreviewModalProps) {
  const [selectedSheet, setSelectedSheet] = useState(0);

  if (!uploadFile.parseResult) return null;

  const currentSheet = uploadFile.parseResult.sheets[selectedSheet];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{uploadFile.file.name}</h2>
            <p className="text-gray-600">数据预览</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4">
          {/* 解析统计信息 */}
          {currentSheet.stats && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">解析统计</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{currentSheet.stats.totalRows}</div>
                  <div className="text-gray-600">总行数</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{currentSheet.stats.validRecords}</div>
                  <div className="text-gray-600">有效记录</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-500">{currentSheet.stats.emptyRows}</div>
                  <div className="text-gray-600">空行</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{currentSheet.stats.errorRows}</div>
                  <div className="text-gray-600">错误行</div>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                数据完整性: {((currentSheet.stats.validRecords / currentSheet.stats.totalRows) * 100).toFixed(1)}%
              </div>
              {currentSheet.stats.errorRows > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  ⚠️ 发现 {currentSheet.stats.errorRows} 行错误数据，将不会被导入
                </div>
              )}
            </div>
          )}

          {/* 工作表选择 */}
          {uploadFile.parseResult.sheets.length > 1 && (
            <div className="mb-4">
              <div className="flex gap-2 flex-wrap">
                {uploadFile.parseResult.sheets.map((sheet, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={selectedSheet === index ? "default" : "outline"}
                    onClick={() => setSelectedSheet(index)}
                  >
                    {sheet.sheetName} ({sheet.records.length})
                    {sheet.stats?.errorRows > 0 && (
                      <span className="ml-1 text-red-500">⚠</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 数据表格预览 */}
          <div className="overflow-auto max-h-96 border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left border-r">工号</th>
                  <th className="p-2 text-left border-r">入职日期</th>
                  <th className="p-2 text-right border-r">基本工资</th>
                  <th className="p-2 text-right">应发工资</th>
                </tr>
              </thead>
              <tbody>
                {currentSheet.records.slice(0, 50).map((record, index) => (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="p-2 border-r font-mono">{record.employeeId}</td>
                    <td className="p-2 border-r">{record.hireDate.toISOString().split('T')[0]}</td>
                    <td className="p-2 text-right border-r">{record.basicSalary.toLocaleString()}</td>
                    <td className="p-2 text-right">{record.grossSalary.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentSheet.records.length > 50 && (
              <div className="p-2 text-center text-gray-500 border-t">
                显示前50条记录，共{currentSheet.records.length}条
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}