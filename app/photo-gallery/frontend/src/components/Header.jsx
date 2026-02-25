function Header({ title, showBack, onBack }) {
  return (
    <header className="header">
      {showBack && (
        <button className="back-btn" onClick={onBack}>
          ← Back to Albums
        </button>
      )}
      <h1>{title}</h1>
      <div style={{ width: '100px' }}></div>
    </header>
  )
}

export default Header
