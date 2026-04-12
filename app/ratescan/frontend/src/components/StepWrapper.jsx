export default function StepWrapper({ children, direction }) {
  const animClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <div className={animClass}>
      {children}
    </div>
  )
}
