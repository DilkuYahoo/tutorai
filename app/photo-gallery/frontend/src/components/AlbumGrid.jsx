import { useState } from 'react'

function AlbumGrid({ albums, onAlbumClick }) {
  const [imageErrors, setImageErrors] = useState({})

  function handleImageError(albumName) {
    setImageErrors(prev => ({ ...prev, [albumName]: true }))
  }

  if (!albums || albums.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Albums Found</h2>
        <p>Your S3 bucket doesn't contain any folders with photos/videos.</p>
      </div>
    )
  }

  return (
    <div className="albums-grid">
      {albums.map(album => (
        <div 
          key={album.name} 
          className="album-card"
          onClick={() => onAlbumClick(album.name)}
        >
          {album.cover_key && !imageErrors[album.name] ? (
            <img 
              className="album-cover"
              src={album.cover_key}
              alt={album.name}
              onError={() => handleImageError(album.name)}
            />
          ) : (
            <div className="album-cover placeholder">
              📁
            </div>
          )}
          <div className="album-info">
            <h3>{album.name}</h3>
            <p>{album.media_count} items</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default AlbumGrid
