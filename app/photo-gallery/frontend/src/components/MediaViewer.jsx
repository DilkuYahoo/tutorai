import { useEffect } from 'react'

function MediaViewer({ media, onClose, onPrev, onNext, hasPrev, hasNext }) {
  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev()
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  // Prevent body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  const isVideo = media.type === 'video'
  const viewUrl = media.view_url

  return (
    <div className="lightbox" onClick={onClose}>
      <button 
        className="lightbox-close" 
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      
      {hasPrev && (
        <button 
          className="lightbox-nav prev" 
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          ‹
        </button>
      )}
      
      {hasNext && (
        <button 
          className="lightbox-nav next" 
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          ›
        </button>
      )}
      
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        {isVideo ? (
          <video 
            src={viewUrl} 
            controls 
            autoPlay 
            style={{ maxHeight: '90vh' }}
          >
            Your browser does not support video playback.
          </video>
        ) : (
          <img 
            src={viewUrl} 
            alt={media.name}
          />
        )}
      </div>
    </div>
  )
}

export default MediaViewer
