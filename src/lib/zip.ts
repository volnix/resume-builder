/**
 * Minimal ZIP reader for LinkedIn's data-export archive.
 *
 * Only the two compression methods LinkedIn actually emits are supported:
 * stored (0) and deflate (8). Deflate is handled by the platform's
 * DecompressionStream, so this file carries no dependencies.
 */

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

export interface ZipEntry {
  name: string
  text(): Promise<string>
}

export async function readZip(file: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(file)
  const bytes = new Uint8Array(file)
  const eocd = findEocd(view)
  if (eocd < 0) throw new Error('Not a ZIP file (end-of-central-directory record not found).')

  const entryCount = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_SIG) break

    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen))

    entries.push({
      name,
      text: () => extract(view, bytes, localOffset, method, compressedSize),
    })

    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function findEocd(view: DataView): number {
  // The EOCD sits at the end, followed by an optional comment of up to 64 KiB.
  const min = Math.max(0, view.byteLength - 0xffff - 22)
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i
  }
  return -1
}

async function extract(
  view: DataView,
  bytes: Uint8Array<ArrayBuffer>,
  localOffset: number,
  method: number,
  compressedSize: number,
): Promise<string> {
  if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
    throw new Error('Corrupt ZIP: bad local file header.')
  }
  const nameLen = view.getUint16(localOffset + 26, true)
  const extraLen = view.getUint16(localOffset + 28, true)
  const start = localOffset + 30 + nameLen + extraLen
  const data = bytes.subarray(start, start + compressedSize)

  if (method === 0) return new TextDecoder().decode(data)
  if (method !== 8) throw new Error(`Unsupported ZIP compression method ${method}.`)

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}
