/**
 * Headshot handling. The photo is stored as an image data URL so the exported
 * file and the localStorage save stay self-contained, which means two things
 * matter: uploads get downscaled before they eat the storage quota, and any URL
 * that came back from a file or a JSON import is validated before it reaches an
 * `src` attribute.
 */

/** Longest edge of the stored image. Plenty for a 1.25in print at 300dpi. */
export const PHOTO_MAX_PX = 600

/** Refuse absurd uploads before decoding them. */
export const PHOTO_MAX_BYTES = 12 * 1024 * 1024

const SAFE_PHOTO_RE = /^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/]+={0,2}$/i

/**
 * Only base64 image data URLs are allowed. Anything else — `javascript:`,
 * `data:text/html`, an http URL that would phone home when the resume is opened —
 * is rejected rather than sanitized, since there's no safe reading of it.
 */
export const isSafePhoto = (value: unknown): value is string =>
  typeof value === 'string' && SAFE_PHOTO_RE.test(value.replace(/\s+/g, ''))

/** Drop a photo that isn't a safe data URL, so bad input degrades to no photo. */
export const cleanPhoto = (value: unknown): string =>
  isSafePhoto(value) ? value.replace(/\s+/g, '') : ''

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })

/**
 * Decode an uploaded image, crop it to a square around the center, and re-encode
 * it as a JPEG small enough to live in localStorage. Browser-only (canvas).
 */
export async function fileToPhoto(file: File): Promise<string> {
  if (!/^image\//i.test(file.type)) throw new Error('Choose an image file — JPEG, PNG, or WebP.')
  if (file.size > PHOTO_MAX_BYTES) throw new Error('That image is over 12 MB. Please pick a smaller one.')

  const source = await readAsDataUrl(file)
  const img = new Image()
  img.src = source
  try {
    await img.decode()
  } catch {
    throw new Error("That image couldn't be decoded. Try re-saving it as a JPEG or PNG.")
  }

  // Center square crop, so a portrait or landscape upload doesn't come out stretched.
  const edge = Math.min(img.naturalWidth, img.naturalHeight)
  const size = Math.min(edge, PHOTO_MAX_PX)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  // JPEG has no transparency, so fill first or PNG cutouts turn black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(
    img,
    (img.naturalWidth - edge) / 2,
    (img.naturalHeight - edge) / 2,
    edge,
    edge,
    0,
    0,
    size,
    size,
  )

  const encoded = canvas.toDataURL('image/jpeg', 0.85)
  if (!isSafePhoto(encoded)) throw new Error('This browser cannot process images.')
  return encoded
}

/** Rough decoded size of a data URL, for showing the storage cost in the editor. */
export function photoSizeLabel(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bytes = Math.floor((base64.length * 3) / 4)
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
