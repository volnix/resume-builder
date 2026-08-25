import { useRef, useState } from 'react'
import { downloadJson, JSON_SCHEMA_VERSION, type RestoreResult } from '../lib/resumeJson'
import type { Resume } from '../types'

interface Props {
  resume: Resume
  /** Reads and validates the file, then replaces the resume if the user agrees. */
  onRestoreFile: (file: File) => Promise<RestoreResult | null>
}

/**
 * Backup and restore in the app's own JSON format: every field, no styling, no
 * HTML — usable as a plain data dump elsewhere and as the way to rebuild a resume
 * from scratch later.
 */
export default function DataPanel({ resume, onRestoreFile }: Props) {
  const [notes, setNotes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    setNotes([])
    try {
      const result = await onRestoreFile(file)
      setNotes(result ? result.notes : ['Restore cancelled — nothing was changed.'])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>7 · Backup &amp; restore (JSON)</h2>
      <p className="hint">
        The JSON file holds everything you have typed — contact details, summary, every company and
        position, competencies, education, the chosen theme, and the headshot — with no styling or markup
        around it. Keep it as a backup, edit it by hand, or feed it to something else. Restoring it
        rebuilds the editor exactly, which is the way to move a resume between browsers.
      </p>

      <div className="card-actions">
        <button className="btn" onClick={() => downloadJson(resume)}>
          ↓ Download JSON
        </button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Reading…' : '↑ Restore from JSON'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <p className="hint">
        Format v{JSON_SCHEMA_VERSION}. Restoring <strong>replaces</strong> everything currently in the
        editor, so you are asked to confirm first. Older files and hand-written ones load too — missing
        fields fall back to defaults.
      </p>

      {error && <p className="alert error">{error}</p>}
      {notes.length > 0 && (
        <ul className="alert ok">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
