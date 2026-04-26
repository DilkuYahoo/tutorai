import { COLUMNS, COLUMN_COLOURS } from './utils'

export default function BingoCard({ card, cardNumber, calledSet }) {
  return (
    <div className="bingo-card bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200 w-64">
      {/* Header row */}
      <div className="grid grid-cols-5">
        {COLUMNS.map(col => (
          <div
            key={col}
            className={`${COLUMN_COLOURS[col].bg} text-white text-center py-2 text-xl font-black`}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Number grid — 5 rows */}
      <div className="grid grid-cols-5">
        {Array.from({ length: 5 }, (_, row) =>
          card.map((col, colIdx) => {
            const val = col[row]
            const isFree = val === null
            const isCalled = !isFree && calledSet?.has(val)

            return (
              <div
                key={`${colIdx}-${row}`}
                className={`
                  aspect-square flex items-center justify-center text-lg font-bold border border-gray-100
                  ${isFree ? 'bg-yellow-400 text-gray-900 text-xs' : ''}
                  ${isCalled ? 'bg-green-100 text-green-800' : 'text-gray-800'}
                `}
              >
                {isFree ? 'FREE' : val}
              </div>
            )
          })
        )}
      </div>

      {/* Card number footer */}
      <div className="text-center text-xs text-gray-400 py-1 bg-gray-50">
        Card #{cardNumber}
      </div>
    </div>
  )
}
