import type { SVGProps } from 'react'

type Shape = { d?: string[]; circles?: [number, number, number][]; rects?: [number, number, number, number, number][] }

/** Inline, tree-shakable stroke icon set (24×24, currentColor). */
const ICONS = {
  send: { d: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7z'] },
  stop: { rects: [[6, 6, 12, 12, 2]] },
  sparkles: { d: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 3v4', 'M21 5h-4', 'M5 17v3', 'M6.5 18.5h-3'] },
  check: { d: ['M20 6 9 17l-5-5'] },
  x: { d: ['M18 6 6 18', 'M6 6l12 12'] },
  edit: { d: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'] },
  chevronDown: { d: ['m6 9 6 6 6-6'] },
  chevronRight: { d: ['m9 18 6-6-6-6'] },
  chevronLeft: { d: ['m15 18-6-6 6-6'] },
  chevronUp: { d: ['m18 15-6-6-6 6'] },
  palette: {
    d: ['M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z'],
    circles: [[7.5, 10.5, 1], [10.5, 6.5, 1], [15.5, 6.5, 1]],
  },
  history: { d: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'] },
  download: { d: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'] },
  copy: { d: ['M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'], rects: [[9, 9, 13, 13, 2]] },
  diff: { d: ['M12 3v14', 'M5 10h14', 'M5 21h14'] },
  eye: { d: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'], circles: [[12, 12, 3]] },
  file: { d: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'] },
  fileText: { d: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'] },
  folder: { d: ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z'] },
  code: { d: ['m16 18 6-6-6-6', 'm8 6-6 6 6 6'] },
  shield: { d: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
  shieldCheck: { d: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'] },
  gauge: { d: ['m12 14 4-4', 'M3.34 19a10 10 0 1 1 17.32 0'] },
  figma: {
    d: [
      'M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z',
      'M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z',
      'M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z',
      'M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z',
      'M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z',
    ],
  },
  link: { d: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'] },
  sun: { d: ['M12 2v2', 'M12 20v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M2 12h2', 'M20 12h2', 'm6.3 17.7-1.4 1.4', 'm19.1 4.9-1.4 1.4'], circles: [[12, 12, 4]] },
  moon: { d: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'] },
  monitor: { d: ['M8 21h8', 'M12 17v4'], rects: [[2, 3, 20, 14, 2]] },
  tablet: { d: ['M12 18h.01'], rects: [[4, 2, 16, 20, 2]] },
  phone: { d: ['M12 18h.01'], rects: [[7, 2, 10, 20, 2]] },
  message: { d: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'] },
  list: { d: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'] },
  layout: { d: ['M3 9h18', 'M9 21V9'], rects: [[3, 3, 18, 18, 2]] },
  plus: { d: ['M12 5v14', 'M5 12h14'] },
  alert: { d: ['m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z', 'M12 9v4', 'M12 17h.01'] },
  info: { d: ['M12 16v-4', 'M12 8h.01'], circles: [[12, 12, 10]] },
  undo: { d: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'] },
  scissors: { d: ['M20 4 8.1 15.9', 'M14.5 14.5 20 20', 'M8.1 8.1 12 12'], circles: [[6, 6, 3], [6, 18, 3]] },
  accessibility: { d: ['M5 8l7 1.5L19 8', 'M12 9.5V14', 'M12 14l-3 6', 'M12 14l3 6'], circles: [[12, 4.5, 1.6]] },
  refresh: { d: ['M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M3 21v-5h5'] },
  key: { d: ['m21 2-9.6 9.6', 'm15.5 7.5 3 3L22 7l-3-3'], circles: [[7.5, 15.5, 5.5]] },
  bolt: { d: ['M13 2 3 14h9l-1 8 10-12h-9z'] },
  wrench: { d: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z'] },
  search: { d: ['m21 21-4.3-4.3'], circles: [[11, 11, 8]] },
  brain: {
    d: [
      'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z',
      'M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z',
    ],
  },
  bulb: { d: ['M9 18h6', 'M10 22h4', 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z'] },
  wand: { d: ['M15 4V2', 'M15 16v-2', 'M8 9h2', 'M20 9h2', 'M17.8 11.8 19 13', 'M15 9h.01', 'M17.8 6.2 19 5', 'm3 21 9-9', 'M12.2 6.2 11 5'] },
  menu: { d: ['M4 6h16', 'M4 12h16', 'M4 18h16'] },
  user: { d: ['M4 21a8 8 0 0 1 16 0'], circles: [[12, 8, 4]] },
  activity: { d: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  lock: { d: ['M7 11V7a5 5 0 0 1 10 0v4'], rects: [[3, 11, 18, 11, 2]] },
  clock: { d: ['M12 6v6l4 2'], circles: [[12, 12, 10]] },
  sliders: { d: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'] },
  arrowUp: { d: ['M12 19V5', 'm5 12 7-7 7 7'] },
  arrowDown: { d: ['M12 5v14', 'm19 12-7 7-7-7'] },
  arrowRight: { d: ['M5 12h14', 'm12 5 7 7-7 7'] },
  database: { d: ['M3 5v14a9 3 0 0 0 18 0V5', 'M3 12a9 3 0 0 0 18 0', 'M21 5a9 3 0 1 1-18 0 9 3 0 1 1 18 0z'] },
  skip: { d: ['M6 4l10 8-10 8z', 'M19 5v14'] },
  pause: { rects: [[6, 4, 4, 16, 1], [14, 4, 4, 16, 1]] },
  filter: { d: ['M22 3H2l8 9.5V19l4 2v-8.5z'] },
  cloud: { d: ['M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z'] },
  upload: { d: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'] },
  rocket: { d: ['M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z', 'm12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z', 'M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0', 'M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5'] },
  trash: { d: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'] },
  server: { d: ['M6 6h.01', 'M6 18h.01'], rects: [[2, 2, 20, 8, 2], [2, 14, 20, 8, 2]] },
  external: { d: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'] },
  plug: { d: ['M12 22v-5', 'M9 8V2', 'M15 8V2', 'M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z'] },
  table: { d: ['M3 9h18', 'M3 15h18', 'M9 3v18'], rects: [[3, 3, 18, 18, 2]] },
  grid: { rects: [[3, 3, 7, 7, 1], [14, 3, 7, 7, 1], [14, 14, 7, 7, 1], [3, 14, 7, 7, 1]] },
  package: { d: ['M16.5 9.4 7.5 4.2', 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'] },
  flow: { d: ['M6 9v3a3 3 0 0 0 3 3h6', 'M18 15v-3'], rects: [[3, 3, 6, 6, 1], [15, 15, 6, 6, 1]] },
  play: { d: ['M6 4l14 8-14 8z'] },
  home: { d: ['m3 10 9-7 9 7', 'M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9'] },
  layers: { d: ['m12 2 10 5-10 5L2 7z', 'm2 12 10 5 10-5', 'm2 17 10 5 10-5'] },
  gitBranch: { d: ['M6 3v12', 'M18 9a9 9 0 0 1-9 9'], circles: [[18, 6, 3], [6, 18, 3]] },
  book: { d: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'] },
  at: { d: ['M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8'], circles: [[12, 12, 4]] },
  panelLeft: { d: ['M9 3v18'], rects: [[3, 3, 18, 18, 2]] },
  api: { d: ['M4 6h16', 'M4 12h16', 'M4 18h10', 'M18 16l2 2-2 2'] },
  trendingUp: { d: ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'] },
  more: { circles: [[5, 12, 1], [12, 12, 1], [19, 12, 1]] },
} satisfies Record<string, Shape>

export type IconName = keyof typeof ICONS

export const isIconName = (v: unknown): v is IconName => typeof v === 'string' && v in ICONS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  strokeWidth?: number
  label?: string
}

export function Icon({ name, size = 18, strokeWidth = 2, label, ...rest }: IconProps) {
  const shape: Shape = ICONS[name] ?? ICONS.info
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {shape.d?.map((d) => <path key={d} d={d} />)}
      {shape.circles?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
      {shape.rects?.map(([x, y, w, h, rx]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={rx} />)}
    </svg>
  )
}
