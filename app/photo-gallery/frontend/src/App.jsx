import { useState, useEffect } from 'react'
import Header from './components/Header'
import AlbumGrid from './components/AlbumGrid'
import MediaGrid from './components/MediaGrid'
import MediaViewer from './components/MediaViewer'
import { fetchAlbums, fetchAlbumMedia } from './services/api'

function App() {
  const [albums, setAlbums] = useState([])
  const [currentAlbum, setCurrentAlbum] = useState(null)
  const [media, setMedia] = useState([])
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load albums on mount
  useEffect(() => {
    loadAlbums()
  }, [])

  // Load media when album changes
  useEffect(() => {
    if (currentAlbum) {
      loadAlbumMedia(currentAlbum)
    }
  }, [currentAlbum])

  async function loadAlbums() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAlbums()
      setAlbums(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadAlbumMedia(albumName) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAlbumMedia(albumName)
      setMedia(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleAlbumClick(albumName) {
    setCurrentAlbum(albumName)
  }

  function handleBackToAlbums() {
    setCurrentAlbum(null)
    setMedia([])
  }

  function handleMediaClick(mediaItem, index) {
    setSelectedMedia(mediaItem)
    setSelectedIndex(index)
  }

  function handleCloseViewer() {
    setSelectedMedia(null)
  }

  function handlePrevMedia() {
    const newIndex = (selectedIndex - 1 + media.length) % media.length
    setSelectedIndex(newIndex)
    setSelectedMedia(media[newIndex])
  }

  function handleNextMedia() {
    const newIndex = (selectedIndex + 1) % media.length
    setSelectedIndex(newIndex)
    setSelectedMedia(media[newIndex])
  }

  return (
    <div className="app">
      <Header 
        title={currentAlbum || 'Photo Gallery'}
        showBack={!!currentAlbum}
        onBack={handleBackToAlbums}
      />
      
      <main className="main-content">
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
          </div>
        )}
        
        {error && (
          <div className="error">
            <h2>Error</h2>
            <p>{error}</p>
          </div>
        )}
        
        {!loading && !error && !currentAlbum && (
          <AlbumGrid 
            albums={albums} 
            onAlbumClick={handleAlbumClick} 
          />
        )}
        
        {!loading && !error && currentAlbum && (
          <MediaGrid 
            media={media} 
            onMediaClick={handleMediaClick}
          />
        )}
        
        {selectedMedia && (
          <MediaViewer
            media={selectedMedia}
            onClose={handleCloseViewer}
            onPrev={handlePrevMedia}
            onNext={handleNextMedia}
            hasPrev={media.length > 1}
            hasNext={media.length > 1}
          />
        )}
      </main>
    </div>
  )
}

export default App
