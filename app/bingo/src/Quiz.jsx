import { useState } from 'react'
import data from '../questions.json'

const ALL_QUESTIONS = data.sections.flatMap(s =>
  s.questions.map(q => ({ ...q, section: s.title }))
)
const TOTAL = ALL_QUESTIONS.length

export default function Quiz() {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState(null)

  const q = ALL_QUESTIONS[index]

  function goTo(i) {
    setIndex(i)
    setRevealed(false)
    setSelected(null)
  }

  function choose(i) {
    setSelected(i)
    setRevealed(true)
  }

  const isCorrect = selected === q.answer_index
  const isLast = index === TOTAL - 1

  return (
    <div className="flex flex-col items-center py-10 px-4 max-w-2xl mx-auto w-full">

      {/* Progress */}
      <div className="w-full flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-widest">
          {q.section}
        </span>
        <span className="text-xs text-gray-500">
          {index + 1} / {TOTAL}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full mb-8">
        <div
          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / TOTAL) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6 shadow-xl">
        {q.trick && (
          <span className="inline-block bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-4 border border-red-500/30">
            ⚠ Trick Question
          </span>
        )}
        <p className="text-white text-xl font-semibold leading-relaxed">
          {q.question}
        </p>
      </div>

      {/* Options */}
      <div className="w-full flex flex-col gap-3 mb-8">
        {q.options.map((opt, i) => {
          let style = 'border-gray-700 text-gray-200 hover:border-yellow-400 hover:bg-yellow-400/5 cursor-pointer'
          if (revealed) {
            if (i === q.answer_index) {
              style = 'border-green-500 bg-green-500/15 text-green-300 cursor-default'
            } else if (i === selected && !isCorrect) {
              style = 'border-red-500 bg-red-500/15 text-red-300 cursor-default'
            } else {
              style = 'border-gray-800 text-gray-600 cursor-default'
            }
          } else if (selected === i) {
            style = 'border-yellow-400 bg-yellow-400/10 text-yellow-300 cursor-pointer'
          }

          return (
            <button
              key={i}
              onClick={() => !revealed && choose(i)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 text-base font-medium transition-all duration-150 ${style}`}
            >
              <span className="text-xs font-bold mr-3 opacity-60">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {revealed && i === q.answer_index && (
                <span className="float-right text-green-400 font-bold">✓</span>
              )}
              {revealed && i === selected && !isCorrect && (
                <span className="float-right text-red-400 font-bold">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Answer reveal (if not clicked an option) */}
      {!revealed && (
        <button
          onClick={() => setRevealed(true)}
          className="text-sm text-gray-500 underline underline-offset-4 hover:text-gray-300 mb-6 transition-colors"
        >
          Show answer
        </button>
      )}

      {/* Answer callout */}
      {revealed && (
        <div className="w-full bg-green-500/10 border border-green-500/40 rounded-xl px-5 py-4 mb-8">
          <p className="text-xs text-green-400 font-bold uppercase tracking-widest mb-1">Answer</p>
          <p className="text-green-300 text-lg font-semibold">{q.answer}</p>
          {selected !== null && (
            <p className={`text-sm mt-1 font-medium ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {isCorrect ? '🎉 Correct!' : '✗ Wrong — better luck next one'}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 w-full">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex-1 py-3 rounded-xl font-bold border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={isLast}
          className="flex-1 py-3 rounded-xl font-bold bg-yellow-400 text-gray-950 hover:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isLast ? 'Last Question' : 'Next →'}
        </button>
      </div>

      {/* Jump to question */}
      <div className="flex flex-wrap gap-1.5 justify-center mt-8 max-w-sm">
        {ALL_QUESTIONS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
              i === index
                ? 'bg-yellow-400 text-gray-950'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
