import { useEffect, useMemo, useState } from 'react'
import DataPanel from './components/DataPanel'
import Editor from './components/Editor'
import ImportPanel from './components/ImportPanel'
import StylePanel from './components/StylePanel'
import { downloadHtml, renderResumeHtml } from './lib/exportHtml'
import type { ImportResult } from './lib/linkedin'
import { isResumeEmpty } from './lib/normalize'
import { downloadJson, parseResumeJson, type RestoreResult } from './lib/resumeJson'
import { clearResume, loadResume, saveResume } from './lib/storage'
import { emptyResume, type Resume } from './types'

export default function App() {
  const [resume, setResume] = useState<Resume>(loadResume)
  const [saved, setSaved] = useState(false)

  // Debounced autosave to local storage — the only persistence layer.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveResume(resume)
      setSaved(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [resume])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 1600)
    return () => clearTimeout(timer)
  }, [saved])

  const previewHtml = useMemo(() => renderResumeHtml(resume), [resume])

  const applyImport = (result: ImportResult) =>
    setResume((current) => ({
      ...current,
      ...result.resume,
      // Never let an import blank out contact details already typed in.
      contact: { ...current.contact, ...pruneEmpty(result.resume.contact ?? {}) },
    }))

  /**
   * A JSON restore replaces the whole resume rather than merging, which is the
   * point of it — so confirm first unless there's nothing to lose. Returns null
   * when the user backs out, so the panel can say so.
   */
  const restoreFromFile = async (file: File): Promise<RestoreResult | null> => {
    const result = parseResumeJson(await file.text())
    if (
      !isResumeEmpty(resume) &&
      !confirm('Replace everything in the editor with the contents of this file? This cannot be undone.')
    ) {
      return null
    }
    setResume(result.resume)
    return result
  }

  const handleReset = () => {
    if (!confirm('Clear the saved resume and start over? This cannot be undone.')) return
    clearResume()
    setResume(emptyResume())
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Resume Builder</h1>
          <p className="tagline">Engineering resume format · everything stays in your browser</p>
        </div>
        <div className="topbar-actions">
          <span className={`saved-chip ${saved ? 'on' : ''}`}>Saved locally</span>
          <button className="btn subtle" onClick={handleReset}>
            Start over
          </button>
          <button className="btn" onClick={() => downloadJson(resume)}>
            ↓ JSON data
          </button>
          <button className="btn primary" onClick={() => downloadHtml(resume)}>
            ↓ Download HTML resume
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="column-edit">
          <ImportPanel onImport={applyImport} onRestoreFile={restoreFromFile} />
          <StylePanel resume={resume} onChange={setResume} />
          <Editor resume={resume} onChange={setResume} />
          <DataPanel resume={resume} onRestoreFile={restoreFromFile} />
        </div>

        <div className="column-preview">
          <div className="preview-head">
            <h2>Live preview</h2>
            <span className="hint">Print or "Save as PDF" from the downloaded file for a paper copy.</span>
          </div>
          <iframe className="preview-frame" title="Resume preview" srcDoc={previewHtml} />
        </div>
      </main>
    </div>
  )
}

/** Drop empty-string keys so a partial import can't erase existing values. */
function pruneEmpty<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null)) as Partial<T>
}
