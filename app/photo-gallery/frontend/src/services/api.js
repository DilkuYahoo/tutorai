// API Service for Photo Gallery

// Update this to your API Gateway endpoint after deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://YOUR-API-ID.execute-api.ap-southeast-2.amazonaws.com/prod';

/**
 * Fetch all albums from the API
 */
export async function fetchAlbums() {
  const response = await fetch(`${API_BASE_URL}/albums`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch albums: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.albums;
}

/**
 * Fetch media files in an album
 * @param {string} albumName - The album/folder name
 */
export async function fetchAlbumMedia(albumName) {
  const encodedName = encodeURIComponent(albumName);
  const response = await fetch(`${API_BASE_URL}/albums/${encodedName}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch album media: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.media;
}

/**
 * Get presigned URL for a specific media file
 * @param {string} albumName - The album/folder name
 * @param {string} fileName - The file name
 */
export async function getMediaUrl(albumName, fileName) {
  const encodedAlbum = encodeURIComponent(albumName);
  const encodedFile = encodeURIComponent(fileName);
  const response = await fetch(`${API_BASE_URL}/media/${encodedAlbum}/${encodedFile}/url`);
  
  if (!response.ok) {
    throw new Error(`Failed to get media URL: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.url;
}
