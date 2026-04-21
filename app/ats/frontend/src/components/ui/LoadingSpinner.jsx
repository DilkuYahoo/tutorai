export default function LoadingSpinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'
  return (
    <div className="flex items-center justify-center py-16">
      <div className={`${sz} rounded-full border-2 border-indigo-500 border-t-transparent animate-spin`} />
    </div>
  )
}
