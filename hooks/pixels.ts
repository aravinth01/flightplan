// Pixel art in code. A sprite is rows of characters, one per art pixel, each
// character a palette key ('.' is clear). toPaths turns it into one <path> per
// color: horizontal runs, merged down into the run above when x and width
// match, at integer coordinates. The output is small and byte-stable, so a
// scene built from it stays identical across redraws.

export type Grid = readonly string[]
export type Palette = Readonly<Record<string, string>>

type Run = [x: number, y: number, w: number, h: number]

const RUNS = new Map<Grid, Map<string, Run[]>>()

function runsOf(grid: Grid): Map<string, Run[]> {
  const cached = RUNS.get(grid)
  if (cached !== undefined) return cached
  const by = new Map<string, Run[]>()
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row.charAt(x)
      if (c === '.' || c === ' ') {
        x++
        continue
      }
      let end = x
      while (end < row.length && row.charAt(end) === c) end++
      const list = by.get(c) ?? []
      const up = list.find(run => run[0] === x && run[2] === end - x && run[1] + run[3] === y)
      if (up !== undefined) up[3]++
      else list.push([x, y, end - x, 1])
      by.set(c, list)
      x = end
    }
  })
  RUNS.set(grid, by)

  return by
}

// One <path> per palette color, in the order colors first appear in the grid.
// Characters missing from the palette are left out.
export function toPaths(grid: Grid, palette: Palette): string {
  const parts: string[] = []
  for (const [c, runs] of runsOf(grid)) {
    const fill = palette[c]
    if (fill === undefined) continue
    parts.push(`<path fill="${fill}" d="${runs.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join('')}"/>`)
  }

  return parts.join('')
}

// A sprite placed at integer coordinates.
export function sprite(grid: Grid, palette: Palette, x: number, y: number, extra = ''): string {
  return `<g transform="translate(${Math.round(x)} ${Math.round(y)})">${toPaths(grid, palette)}${extra}</g>`
}

export function widthOf(grid: Grid): number {
  return grid.reduce((most, row) => Math.max(most, row.length), 0)
}

// The grid mirrored left to right (a plane flying back for a redo).
export function flip(grid: Grid): Grid {
  const w = widthOf(grid)

  return grid.map(row => row.padEnd(w, '.').split('').reverse().join(''))
}

// XML-escapes text that goes into markup (a <title>, an attribute), and
// drops what XML 1.0 cannot hold at all: control characters other than tab,
// newline and return, and half a surrogate pair (a slice through an emoji).
export function esc(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/[&<>"']/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'))
}
