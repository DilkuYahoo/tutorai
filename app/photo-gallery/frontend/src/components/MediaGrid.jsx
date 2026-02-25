import { useState } from 'react'

function MediaGrid({ media, onMediaClick }) {
  const [imageErrors, setImageErrors] = useState({})

  function handleImageError(mediaKey) {
    setImageErrors(prev => ({ ...prev, [mediaKey]: true }))
  }

  if (!media || media.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Media Found</h2>
        <p>This album doesn't contain any photos or videos.</p>
      </div>
    )
  }

  return (
    <div className="media-grid">
      {media.map((item, index) => (
        <div 
          key={item.key || index} 
          className="media-item"
          onClick={() => onMediaClick(item, index)}
        >
          {item.type === 'video' ? (
            <video 
              src={item.thumbnail_url || item.view_url}
              muted
              preload="metadata"
              onMouseOver={e => e.target.play()}
              onMouseOut={e => {
                e.target.pause()
                e.target.currentTime = 0
              }}
            />
          ) : (
            <>
              {item.thumbnail_url && !imageErrors[item.key] ? (
                <img 
                  src={item.thumbnail_url}
                  alt={item.name}
                  loading="lazy"
                  onError={() => handleImageError(item.key)}
                />
              ) : (
                <div 
                  className="album-cover placeholder"
                  style={{ aspectRatio: '1' }}
                >
                  {item.name.toLowerCase().endsWith('.cr2') ? '📷' : '🖼️'}
                </div>
              )}
            </>
          )}
          <span className="media-type-badge">
            {item.type}
          </span>
        </div>
      ))}
    </div>
  )
}

export default MediaGrid
