import { useState } from 'react'
import { useCandidates } from '@/hooks/useCandidates'

export default function CandidateTagList({ candidateId, tags, editable = false }) {
  const { addTag, removeTag } = useCandidates()
  const [input, setInput] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    const tag = input.trim()
    if (tag) { addTag(candidateId, tag); setInput('') }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
        >
          {tag}
          {editable && (
            <button
              onClick={() => removeTag(candidateId, tag)}
              className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editable && (
        <form onSubmit={handleAdd} className="inline-flex">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="+ Add tag"
            className="bg-transparent border-none outline-none text-xs text-slate-500 placeholder:text-slate-600 w-20"
          />
        </form>
      )}
    </div>
  )
}
