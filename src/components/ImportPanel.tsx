import { useRef, useState } from 'react'
import { importFromPastedText, importFromPositionsCsv, importFromZip, type ImportResult } from '../lib/linkedin'

interface Props {
  onImport: (result: ImportResult) => void
  /** A dropped .json file is a backup restore, not a LinkedIn import. */
  onRestoreFile: (file: File) => Promise<{ notes: string[] } | null>
}

export default function ImportPanel({ onImport, onRestoreFile }: Props) {
  const [notes, setNotes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pasted, setPasted] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (work: () => Promise<ImportResult> | ImportResult) => {
    setBusy(true)
    setError('')
    setNotes([])
    try {
      const result = await work()
      onImport(result)
      setNotes(result.notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (file: File) => {
    // A backup dropped here should just work, rather than being rejected as
    // "not a LinkedIn export".
    if (/\.json$/i.test(file.name)) {
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
      return
    }
    return run(async () => {
      const buffer = await file.arrayBuffer()
      if (/\.zip$/i.test(file.name)) return importFromZip(buffer)
      if (/\.csv$/i.test(file.name)) return importFromPositionsCsv(await file.text())
      throw new Error('Please choose the LinkedIn export .zip, a Positions.csv from it, or a resume .json backup.')
    })
  }

  return (
    <section className="panel">
      <h2>1 · Import from LinkedIn</h2>
      <p className="hint">
        LinkedIn does not allow other apps to read a profile from its URL, so this tool uses your own
        data export. On LinkedIn: <strong>Settings &amp; Privacy → Data Privacy → Get a copy of your
        data</strong>, pick <em>the works</em> or just <em>Positions</em>, then drop the .zip below. Files
        are parsed in your browser and never uploaded.
      </p>

      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
        }}
      >
        <strong>{busy ? 'Parsing…' : 'Drop your LinkedIn export .zip here'}</strong>
        <span>or click to browse — .zip, Positions.csv, or a resume .json backup</span>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.csv,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <details className="fallback">
        <summary>No export handy? Paste your Experience section instead</summary>
        <p className="hint">
          Open your LinkedIn profile, select the Experience section, and paste it here. Parsing is
          best-effort — verify every field afterwards.
        </p>
        <textarea
          rows={8}
          value={pasted}
          placeholder={'Senior Engineering Manager\nAcme Corp · Full-time\nJan 2020 - Present\nSeattle, WA'}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button
          className="btn"
          disabled={!pasted.trim() || busy}
          onClick={() => void run(() => importFromPastedText(pasted))}
        >
          Parse pasted text
        </button>
      </details>

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
