import { useEffect, useState, type FormEvent } from 'react'
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

export function AccountDocuments() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('application')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

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

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) {
      setError('Title and file required.')
      return
    }
    setError(null)
    setOk(null)
    setUploading(true)
    try {
      const dataBase64 = await fileToBase64(file)
      await api.uploadAccountDocument({
        title: title.trim(),
        category,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64,
      })
      setTitle('')
      setFile(null)
      setFileKey((k) => k + 1)
      setOk('Uploaded.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
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
      <div className="mypage-toolbar">
        <div className="mypage-meta">
          <em>{docs.length} files</em>
          {uploaded ? <em className="is-yours">Your uploads {uploaded}</em> : null}
          {fromStaff ? <em className="is-open">From Equarios {fromStaff}</em> : null}
        </div>
        <span className="muted tiny">Tax, resale, ID for wholesale review</span>
      </div>

      <form className="account-doc-upload" onSubmit={(e) => void onUpload(e)}>
        <label>
          <span className="filter-trigger-title">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resale certificate"
          />
        </label>
        <label>
          <span className="filter-trigger-title">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="account-doc-file">
          <span className="filter-trigger-title">File</span>
          <input
            key={fileKey}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? <span className="muted tiny account-doc-file-name">{file.name}</span> : null}
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
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
