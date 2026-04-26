import { useState, useRef } from 'react'
import BingoCard from './BingoCard'
import { generateCard } from './utils'

export default function CardGenerator({ calledSet }) {
  const [count, setCount] = useState(4)
  const [cards, setCards] = useState([])
  const printRef = useRef()

  function generate() {
    setCards(Array.from({ length: count }, generateCard))
  }

  function buildCardHtml(card, cardNumber) {
    const COLS = ['B','I','N','G','O']
    const COLOURS = { B:'#3b82f6', I:'#ef4444', N:'#22c55e', G:'#eab308', O:'#a855f7' }
    const headerCells = COLS.map(col =>
      `<div style="background:${COLOURS[col]};color:#fff;text-align:center;padding:10px 0;font-size:20px;font-weight:900;">${col}</div>`
    ).join('')
    const rows = Array.from({ length: 5 }, (_, row) =>
      card.map((col, ci) => {
        const val = col[row]
        const isFree = val === null
        const bg = isFree ? '#fbbf24' : '#fff'
        const fs = isFree ? '11px' : '18px'
        return `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;
                  font-size:${fs};font-weight:700;border:1px solid #e5e7eb;color:#1f2937;background:${bg};">
                  ${isFree ? 'FREE' : val}
                </div>`
      }).join('')
    ).join('')
    return `
      <div style="border:2px solid #d1d5db;border-radius:10px;overflow:hidden;width:100%;">
        <div style="display:grid;grid-template-columns:repeat(5,1fr);">${headerCells}</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);">${rows}</div>
        <div style="text-align:center;font-size:11px;color:#9ca3af;padding:4px;background:#f9fafb;">Card #${cardNumber}</div>
      </div>`
  }

  function printCards() {
    // Group cards into pages of 4 (2×2 on A4)
    const pages = []
    for (let i = 0; i < cards.length; i += 4) {
      pages.push(cards.slice(i, i + 4))
    }

    const pagesHtml = pages.map((group, pi) => {
      const cardHtmls = group.map((card, ci) =>
        `<div style="width:calc(50% - 8px);">${buildCardHtml(card, pi * 4 + ci + 1)}</div>`
      ).join('')
      const pageBreak = pi < pages.length - 1 ? 'page-break-after:always;' : ''
      return `<div style="display:flex;flex-wrap:wrap;gap:16px;align-content:flex-start;${pageBreak}">${cardHtmls}</div>`
    }).join('')

    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bingo Cards</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; background: #fff; }
            @page { size: A4 portrait; margin: 15mm; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      <h2 className="text-2xl font-bold text-yellow-400 tracking-widest uppercase mb-6">
        Card Generator
      </h2>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-8 flex-wrap justify-center">
        <label className="text-gray-300 text-sm font-medium">Number of cards</label>
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
          className="w-20 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 text-center text-lg font-bold focus:outline-none focus:border-yellow-400"
        />
        <button
          onClick={generate}
          className="px-6 py-2 rounded-xl font-bold bg-yellow-400 text-gray-950 hover:bg-yellow-300 transition-colors"
        >
          Generate
        </button>
        {cards.length > 0 && (
          <button
            onClick={printCards}
            className="px-6 py-2 rounded-xl font-bold border border-gray-500 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Print / Save PDF
          </button>
        )}
      </div>

      {/* Cards grid — screen view */}
      {cards.length > 0 && (
        <>
          <p className="text-gray-500 text-xs mb-4">
            {cards.length} card{cards.length !== 1 ? 's' : ''} generated
            {calledSet?.size > 0 ? ` · ${calledSet.size} numbers called — matched cells highlighted` : ''}
          </p>
          <div ref={printRef}>
            <div className="grid-print flex flex-wrap gap-5 justify-center max-w-5xl">
              {cards.map((card, i) => (
                <BingoCard
                  key={i}
                  card={card}
                  cardNumber={i + 1}
                  calledSet={calledSet}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {cards.length === 0 && (
        <p className="text-gray-600 text-sm mt-8">
          Enter a number of cards and press Generate.
        </p>
      )}
    </div>
  )
}
