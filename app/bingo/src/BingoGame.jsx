import { useState, useCallback } from 'react'
import { columnLetter, COLUMN_COLOURS, shufflePool } from './utils'

const TOTAL = 75

export default function BingoGame({ onCalledChange }) {
  const [pool, setPool] = useState(() => shufflePool())
  const [called, setCalled] = useState([])

  const callNumber = useCallback(() => {
    if (pool.length === 0) return
    const [next, ...rest] = pool
    setPool(rest)
    setCalled(prev => {
      const updated = [next, ...prev]
      onCalledChange?.(new Set(updated))
      return updated
    })
  }, [pool, onCalledChange])

  const reset = useCallback(() => {
    setPool(shufflePool())
    setCalled([])
    onCalledChange?.(new Set())
  }, [onCalledChange])

  const current = called[0] ?? null
  const letter = current ? columnLetter(current) : null
  const colour = letter ? COLUMN_COLOURS[letter].bg : 'bg-gray-700'
  const done = pool.length === 0

  return (
    <div className="flex flex-col items-center py-12 px-4">
      <h1 className="text-4xl font-bold tracking-widest mb-2 text-yellow-400 uppercase">
        Bingo Caller
      </h1>
      <p className="text-gray-400 mb-10 text-sm">
        {done ? 'All numbers called!' : `${called.length} / ${TOTAL} called`}
      </p>

      {/* Current number */}
      <div
        className={`w-52 h-52 rounded-full flex flex-col items-center justify-center shadow-2xl mb-8 transition-all duration-300 ${colour}`}
      >
        {current ? (
          <>
            <span className="text-5xl font-black leading-none">{letter}</span>
            <span className="text-7xl font-black leading-none">{current}</span>
          </>
        ) : (
          <span className="text-2xl font-semibold text-white/60">Ready</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-10">
        <button
          onClick={callNumber}
          disabled={done}
          className="px-8 py-3 rounded-xl text-lg font-bold bg-yellow-400 text-gray-950 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {done ? 'All Called' : 'Call Number'}
        </button>
        <button
          onClick={reset}
          className="px-8 py-3 rounded-xl text-lg font-bold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          New Game
        </button>
      </div>

      {/* Called numbers history */}
      {called.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="text-gray-400 text-sm uppercase tracking-widest mb-3">
            Called numbers
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {called.map((n, i) => {
              const col = columnLetter(n)
              return (
                <span
                  key={n}
                  className={`w-12 h-12 rounded-full flex flex-col items-center justify-center text-xs font-bold ${
                    i === 0
                      ? COLUMN_COLOURS[col].bg + ' ring-2 ring-white scale-110'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  <span className="leading-none">{col}</span>
                  <span className="text-base leading-none">{n}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
