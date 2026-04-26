export const COLUMNS = ['B', 'I', 'N', 'G', 'O']

export const COLUMN_RANGES = {
  B: [1,  15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
}

export const COLUMN_COLOURS = {
  B: { bg: 'bg-blue-500',   print: '#3b82f6' },
  I: { bg: 'bg-red-500',    print: '#ef4444' },
  N: { bg: 'bg-green-500',  print: '#22c55e' },
  G: { bg: 'bg-yellow-500', print: '#eab308' },
  O: { bg: 'bg-purple-500', print: '#a855f7' },
}

export function columnLetter(n) {
  if (n <= 15) return 'B'
  if (n <= 30) return 'I'
  if (n <= 45) return 'N'
  if (n <= 60) return 'G'
  return 'O'
}

function pickRandom(min, max, count) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

export function generateCard() {
  // Standard bingo card: 5 numbers per column, FREE space at N[2] (row 3, col 3)
  const columns = COLUMNS.map(col => {
    const [min, max] = COLUMN_RANGES[col]
    return pickRandom(min, max, 5)
  })
  // FREE space
  columns[2][2] = null
  return columns
}

export function shufflePool(n = 75) {
  const arr = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
