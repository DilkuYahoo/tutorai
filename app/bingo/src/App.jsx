import { useState } from 'react'
import BingoGame from './BingoGame'
import CardGenerator from './CardGenerator'
import Quiz from './Quiz'

const TABS = ['Caller', 'Cards', 'Quiz']

export default function App() {
  const [tab, setTab] = useState('Caller')
  const [calledSet, setCalledSet] = useState(new Set())

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Tab bar */}
      <div className="flex justify-center pt-6 gap-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${
              tab === t
                ? 'bg-yellow-400 text-gray-950'
                : 'text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Caller' && <BingoGame onCalledChange={setCalledSet} />}
      {tab === 'Cards'  && <CardGenerator calledSet={calledSet} />}
      {tab === 'Quiz'   && <Quiz />}
    </div>
  )
}
