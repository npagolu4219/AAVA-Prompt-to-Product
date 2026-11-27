import type { GenFile } from '@/types/run'

/** Bundles generated files into a ZIP and triggers a download. JSZip loads on demand. */
export async function downloadZip(files: GenFile[], extra: GenFile[], name: string) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const f of [...files, ...extra]) zip.file(f.path, f.content)
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${name}.zip`)
}

export function downloadText(content: string, filename: string, mime = 'text/markdown') {
  downloadBlob(new Blob([content], { type: mime }), filename)
}

/** Save a blob via a temporary object URL (works in every evergreen browser, no file-saver needed). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename, rel: 'noopener' })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
