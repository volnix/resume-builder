import { useRef, useState } from 'react'
import { fileToPhoto, photoSizeLabel } from '../lib/photo'
import { getTheme, THEMES } from '../lib/themes'
import type { Resume, ThemeId } from '../types'

interface Props {
  resume: Resume
  onChange: (next: Resume) => void
}

/**
 * Theme picker plus the headshot upload. Themes change only the exported
 * stylesheet, so switching is lossless — the content stays exactly as typed.
 */
export default function StylePanel({ resume, onChange }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const theme = getTheme(resume.theme)
  const photo = resume.contact.photo
  const setTheme = (id: ThemeId) => onChange({ ...resume, theme: id })
  const setPhoto = (dataUrl: string) => onChange({ ...resume, contact: { ...resume.contact, photo: dataUrl } })

  const handleFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      setPhoto(await fileToPhoto(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That image could not be used.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>2 · Style</h2>
      <p className="hint">
        Pick how the exported resume looks. All three are single-column and text-only, so the words stay
        machine-readable — only the typography, spacing, and accents change.
      </p>

      <div className="theme-grid">
        {THEMES.map((t) => (
          <label className={`theme-card ${resume.theme === t.id ? 'on' : ''}`} key={t.id}>
            <input
              type="radio"
              name="theme"
              checked={resume.theme === t.id}
              onChange={() => setTheme(t.id)}
            />
            <span className={`theme-swatch swatch-${t.id}`} aria-hidden="true">
              <span className="swatch-rule" />
              <span className="swatch-line" />
              <span className="swatch-line short" />
            </span>
            <span className="theme-copy">
              <strong>
                {t.name}
                {t.usesPhoto && <em className="badge">photo</em>}
              </strong>
              <span>{t.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      <fieldset className="subgroup">
        <legend>Headshot</legend>
        <p className="hint">
          {theme.usesPhoto
            ? 'Cropped to a square, scaled down, and embedded in the exported file so it works offline.'
            : `The ${theme.name} theme does not print a photo — switch to Portrait to show one. Your upload is kept either way.`}
        </p>

        <div className="photo-row">
          {photo ? (
            <img className="photo-preview" src={photo} alt="Headshot preview" />
          ) : (
            <span className="photo-preview empty" aria-hidden="true">
              No photo
            </span>
          )}
          <div className="photo-actions">
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Processing…' : photo ? 'Replace photo' : 'Upload photo'}
            </button>
            {photo && (
              <button className="btn subtle danger" onClick={() => setPhoto('')}>
                Remove
              </button>
            )}
            {photo && <span className="tip">Embedded size: {photoSizeLabel(photo)}</span>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {error && <p className="alert error">{error}</p>}
      </fieldset>
    </section>
  )
}
