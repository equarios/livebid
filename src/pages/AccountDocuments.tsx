import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { MyPageHead } from '../components/MyPageHead'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

type Doc = {
  id: string
  direction: string
  category: string
  title: string
  fileName: string
  mimeType: string
  note: string
  createdBy: string
  createdAt: string
  size: number
}

const CATEGORIES = [
  { value: 'application', label: 'Application' },
  { value: 'tax', label: 'Tax' },
  { value: 'resale', label: 'Resale' },
  { value: 'id', label: 'ID' },
  { value: 'other', label: 'Other' },
] as const

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx'
const ACCEPT_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'])

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const i = result.indexOf(',')
      resolve(i >= 0 ? result.slice(i + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

function formatSize(n: number) {
  if (!n || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').trim()
  return base || name
}

function isAllowedFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ACCEPT_EXT.has(ext)
}

export function AccountDocuments() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [category, setCategory] = useState('application')
  const [files, setFiles] = useState<File[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const res = await api.listAccountDocuments()
    setDocs(res.documents as Doc[])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await reload()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load documents.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function addFiles(list: FileList | File[] | null) {
    if (!list || !list.length) return
    const next = Array.from(list).filter(isAllowedFile)
    const skipped = Array.from(list).length - next.length
    setFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}:${f.size}`))
      const merged = [...prev]
      for (const f of next) {
        const key = `${f.name}:${f.size}`
        if (!names.has(key)) {
          names.add(key)
          merged.push(f)
        }
      }
      return merged
    })
    setError(
      skipped > 0
        ? `${skipped} file${skipped === 1 ? '' : 's'} skipped — use PDF, PNG, JPG, WebP, DOC, or DOCX.`
        : null,
    )
    setOk(null)
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!files.length) {
      setError('Choose one or more files to upload.')
      return
    }
    setError(null)
    setOk(null)
    setUploading(true)
    let done = 0
    const failed: string[] = []
    try {
      for (const file of files) {
        setProgress(`${done + 1} / ${files.length}`)
        try {
          const dataBase64 = await fileToBase64(file)
          await api.uploadAccountDocument({
            title: titleFromFileName(file.name),
            category,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
          })
          done += 1
        } catch {
          failed.push(file.name)
        }
      }
      setFiles([])
      setFileKey((k) => k + 1)
      if (inputRef.current) inputRef.current.value = ''
      await reload()
      if (failed.length && done) {
        setOk(`Uploaded ${done}. Failed: ${failed.join(', ')}.`)
        setError(null)
      } else if (failed.length) {
        setError(`Upload failed: ${failed.join(', ')}.`)
      } else {
        setOk(done === 1 ? 'Uploaded.' : `Uploaded ${done} files.`)
      }
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  async function download(id: string) {
    setError(null)
    try {
      const res = await api.downloadAccountDocument(id)
      const bin = atob(res.dataBase64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: res.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  const fromStaff = docs.filter((d) => d.direction === 'staff_send').length
  const uploaded = docs.length - fromStaff

  if (loading) return <p className="muted tiny">Loading documents…</p>

  return (
    <div className="account-documents">
      <MyPageHead
        title="Documents"
        count={docs.length}
        note="Tax, resale, and ID for wholesale review."
        trust={[
          { to: '/account/wholesale', label: 'Wholesale apply' },
          { to: '/account/settings', label: 'Settings' },
        ]}
      >
        <ul className="store-page-trust mypage-head-meta">
          {uploaded ? <li>Your uploads {uploaded}</li> : null}
          {fromStaff ? <li>From Equarios {fromStaff}</li> : null}
        </ul>
      </MyPageHead>

      <form className="account-doc-upload help-panel" onSubmit={(e) => void onUpload(e)}>
        <h3 className="mypage-panel-label">Upload</h3>
        <label className="account-doc-category">
          <span className="filter-trigger-title">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div
          className={`account-doc-drop${dragOver ? ' is-over' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setDragOver(false)
          }}
          onDrop={onDrop}
        >
          <p className="account-doc-drop-copy">
            Drop files here, or choose files — PDF, PNG, JPG, WebP, DOC, DOCX.
          </p>
          <button
            type="button"
            className="btn"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </button>
          <input
            key={fileKey}
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPT}
            multiple
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {files.length ? (
          <ul className="account-doc-queue" aria-label="Files to upload">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`}>
                <span className="account-doc-queue-name">{f.name}</span>
                <span className="muted tiny">{formatSize(f.size)}</span>
                <button
                  type="button"
                  className="linkish"
                  disabled={uploading}
                  aria-label={`Remove ${f.name}`}
                  onClick={() => removeFile(i)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="form-actions">
          {files.length ? (
            <button
              type="button"
              className="btn"
              disabled={uploading}
              onClick={() => {
                setFiles([])
                setFileKey((k) => k + 1)
              }}
            >
              Clear
            </button>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={uploading || !files.length}>
            {uploading
              ? `Uploading${progress ? ` ${progress}` : '…'}`
              : files.length > 1
                ? `Upload ${files.length} files`
                : 'Upload'}
          </button>
        </div>
      </form>
      {error ? <p className="error tiny">{error}</p> : null}
      {ok ? <p className="ok tiny">{ok}</p> : null}

      <div className="table-wrap gbs-table-wrap">
        <table className="gbs-table account-doc-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Source</th>
              <th>Category</th>
              <th>File</th>
              <th>Size</th>
              <th>Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {docs.length ? (
              docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.title}</strong>
                    {d.note ? <div className="muted tiny">{d.note}</div> : null}
                  </td>
                  <td>
                    <em
                      className={`account-doc-source${
                        d.direction === 'staff_send' ? ' is-staff' : ' is-you'
                      }`}
                    >
                      {d.direction === 'staff_send' ? 'Equarios' : 'You'}
                    </em>
                  </td>
                  <td className="muted tiny" style={{ textTransform: 'capitalize' }}>
                    {d.category}
                  </td>
                  <td className="muted tiny mono">{d.fileName}</td>
                  <td className="muted tiny">{formatSize(d.size)}</td>
                  <td className="muted tiny">
                    {formatDateTime(new Date(d.createdAt).getTime())}
                  </td>
                  <td className="right">
                    <button type="button" className="btn btn-sm" onClick={() => void download(d.id)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="muted tiny">
                  No documents yet. Upload tax, resale, or ID above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
