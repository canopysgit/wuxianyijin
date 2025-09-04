'use client'

import DataUpload from '@/components/DataUpload'

export default function UploadPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">数据上传</h1>
      <div>
        <DataUpload />
      </div>
    </div>
  )
}

