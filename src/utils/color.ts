const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export const isHex = (v: string) => HEX.test(v.trim())

export function normalizeHex(v: string): string {
  const m = v.trim().match(HEX)
  if (!m) return v
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toUpperCase()}`
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Pick white or near-black text for a given background colour. */
export function readableOn(bg: string): string {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#0F1B26') ? '#FFFFFF' : '#0F1B26'
}
