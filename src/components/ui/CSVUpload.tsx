'use client'

import { useState, useRef } from 'react'
import Button from './Button'

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>
  loading?: boolean
}

interface UploadedFile {
  name: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  message?: string
}

export default function FileUpload({ onUpload, loading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isValidFile = (file: File) => {
    const name = file.name.toLowerCase()
    return name.endsWith('.csv') || name.endsWith('.pdf') ||
           name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const uploadFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter(isValidFile)

    if (validFiles.length === 0) return

    // Dosyaları listeye ekle
    const newFiles: UploadedFile[] = validFiles.map(f => ({
      name: f.name,
      status: 'pending' as const
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setIsUploading(true)

    // Her dosyayı sırayla yükle
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]

      // Durumu güncelle - uploading
      setUploadedFiles(prev => prev.map(f =>
        f.name === file.name ? { ...f, status: 'uploading' as const } : f
      ))

      try {
        await onUpload(file)
        // Başarılı
        setUploadedFiles(prev => prev.map(f =>
          f.name === file.name ? { ...f, status: 'success' as const, message: 'Yüklendi' } : f
        ))
      } catch (error) {
        // Hata
        setUploadedFiles(prev => prev.map(f =>
          f.name === file.name ? {
            ...f,
            status: 'error' as const,
            message: error instanceof Error ? error.message : 'Hata oluştu'
          } : f
        ))
      }
    }

    setIsUploading(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files)
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files)
      // Input'u temizle (aynı dosyaları tekrar seçebilmek için)
      e.target.value = ''
    }
  }

  const clearFiles = () => {
    setUploadedFiles([])
  }

  const successCount = uploadedFiles.filter(f => f.status === 'success').length
  const errorCount = uploadedFiles.filter(f => f.status === 'error').length

  return (
    <div className="space-y-4">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading || loading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,.jpg,.jpeg,.png"
          multiple
          onChange={handleChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading ? 'Yükleniyor...' : 'Dosyaları sürükleyin'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Birden fazla dosya seçebilirsiniz
            </p>
          </div>

          <div className="flex gap-2">
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">CSV</span>
            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">PDF</span>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">JPG/PNG</span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || loading}
          >
            Dosya Seç
          </Button>
        </div>
      </div>

      {/* Yüklenen dosyalar listesi */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Yüklenen Dosyalar ({successCount}/{uploadedFiles.length})
              {errorCount > 0 && <span className="text-red-600 ml-2">({errorCount} hata)</span>}
            </span>
            <button
              onClick={clearFiles}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Temizle
            </button>
          </div>
          <ul className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
            {uploadedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-gray-600 truncate max-w-[200px]">{file.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  file.status === 'pending' ? 'bg-gray-100 text-gray-600' :
                  file.status === 'uploading' ? 'bg-yellow-100 text-yellow-700' :
                  file.status === 'success' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {file.status === 'pending' ? 'Bekliyor' :
                   file.status === 'uploading' ? 'Yükleniyor...' :
                   file.status === 'success' ? 'Başarılı' :
                   file.message || 'Hata'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
