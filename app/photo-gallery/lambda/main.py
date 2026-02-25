"""
Photo Gallery Lambda Handler
Handles listing albums, media files, and generating presigned URLs
"""

import json
import os
import boto3
from botocore.exceptions import ClientError
from urllib.parse import unquote

# Initialize S3 client
s3_client = boto3.client('s3')

# Load config from environment variables (set by deployment)
BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'YOUR_BUCKET_NAME_HERE')
# Region is automatically detected by boto3 from Lambda environment

# Supported file extensions
PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.cr2', '.png', '.gif', '.bmp']
VIDEO_EXTENSIONS = ['.mov', '.mp4', '.avi', '.mkv']
THUMBNAIL_FOLDER = '_thumbnails'


def get_cors_headers():
    """Return CORS headers for API Gateway"""
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    }


def list_folders(s3_client, bucket_name, prefix=''):
    """List all folders (common prefixes) in the S3 bucket"""
    try:
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Delimiter='/',
            Prefix=prefix
        )
        
        folders = []
        if 'CommonPrefixes' in response:
            for obj in response['CommonPrefixes']:
                folder_path = obj['Prefix']
                # Remove trailing slash and any prefix
                folder_name = folder_path.rstrip('/')
                if '/' in folder_name:
                    folder_name = folder_name.split('/')[-1]
                folders.append({
                    'name': folder_name,
                    'path': folder_path
                })
        
        return folders
    except ClientError as e:
        print(f"Error listing folders: {e}")
        return []


def list_media_files(s3_client, bucket_name, folder_path):
    """List all media files in a specific folder"""
    try:
        # Ensure folder path ends with /
        if not folder_path.endswith('/'):
            folder_path += '/'
        
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=folder_path
        )
        
        media_files = []
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                # Skip the folder itself and thumbnail folder
                if key == folder_path or THUMBNAIL_FOLDER in key:
                    continue
                
                # Get file extension
                if '.' in key:
                    ext = '.' + key.rsplit('.', 1)[-1].lower()
                    
                    # Check if it's a supported media type
                    if ext in PHOTO_EXTENSIONS or ext in VIDEO_EXTENSIONS:
                        file_name = key.split('/')[-1]
                        is_video = ext in VIDEO_EXTENSIONS
                        
                        media_files.append({
                            'name': file_name,
                            'key': key,
                            'size': obj.get('Size', 0),
                            'last_modified': obj.get('LastModified', '').isoformat() if obj.get('LastModified') else '',
                            'type': 'video' if is_video else 'photo',
                            'extension': ext
                        })
        
        # Sort by name
        media_files.sort(key=lambda x: x['name'])
        
        return media_files
    except ClientError as e:
        print(f"Error listing media files: {e}")
        return []


def get_presigned_url(s3_client, bucket_name, key, expiration=3600):
    """Generate a presigned URL for viewing a file"""
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': key
            },
            ExpiresIn=expiration
        )
        return url
    except ClientError as e:
        print(f"Error generating presigned URL: {e}")
        return None


def get_thumbnail_key(album_path, file_name):
    """Get the thumbnail key for a file"""
    base_name = file_name.rsplit('.', 1)[0]
    # For CR2 files, create JPG thumbnail
    if file_name.lower().endswith('.cr2'):
        thumbnail_name = f"{base_name}.jpg"
    else:
        thumbnail_name = file_name
    
    album_folder = album_path.rstrip('/')
    thumbnail_key = f"{album_folder}/{THUMBNAIL_FOLDER}/{thumbnail_name}"
    return thumbnail_key


def check_thumbnail_exists(s3_client, bucket_name, thumbnail_key):
    """Check if thumbnail exists in S3"""
    try:
        s3_client.head_object(Bucket=bucket_name, Key=thumbnail_key)
        return True
    except ClientError:
        return False


def lambda_handler(event, context):
    """Main Lambda handler"""
    print(f"Event: {json.dumps(event)}")
    
    # Get HTTP method and path
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    query_params = event.get('queryStringParameters', {}) or {}
    
    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': ''
        }
    
    # Route handling
    try:
        # GET /albums - List all albums
        if path == '/albums' or path == '/albums/':
            folders = list_folders(s3_client, BUCKET_NAME)
            
            # For each folder, try to get a cover image (first photo)
            albums = []
            for folder in folders:
                media = list_media_files(s3_client, BUCKET_NAME, folder['path'])
                cover_key = None
                if media:
                    # Use first photo as cover
                    for m in media:
                        if m['type'] == 'photo':
                            cover_key = m['key']
                            break
                
                albums.append({
                    'name': folder['name'],
                    'path': folder['path'],
                    'media_count': len(media),
                    'cover_key': cover_key
                })
            
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({'albums': albums})
            }
        
        # GET /albums/{album_name} - List media in album
        elif path.startswith('/albums/'):
            album_name = path.split('/albums/')[1].split('/')[0]
            album_name = unquote(album_name)
            
            # List files in the album folder
            media = list_media_files(s3_client, BUCKET_NAME, album_name)
            
            # Add presigned URLs and thumbnail info
            for m in media:
                m['view_url'] = get_presigned_url(s3_client, BUCKET_NAME, m['key'])
                
                # Check for thumbnail
                thumbnail_key = get_thumbnail_key(album_name, m['name'])
                if check_thumbnail_exists(s3_client, BUCKET_NAME, thumbnail_key):
                    m['thumbnail_url'] = get_presigned_url(s3_client, BUCKET_NAME, thumbnail_key)
                else:
                    # Use the view URL as thumbnail for non-CR2 files
                    if not m['name'].lower().endswith('.cr2'):
                        m['thumbnail_url'] = m['view_url']
                    else:
                        m['thumbnail_url'] = None
            
            return {
                'statusCode': 200,
                'headers': get_cors_headers(),
                'body': json.dumps({
                    'album': album_name,
                    'media': media
                })
            }
        
        # GET /media/{album_name}/{file_name}/url - Get presigned URL for file
        elif '/media/' in path and '/url' in path:
            parts = path.split('/media/')[1].split('/')
            if len(parts) >= 2:
                album_name = unquote(parts[0])
                file_name = unquote('/'.join(parts[1:]).replace('/url', ''))
                key = f"{album_name}/{file_name}"
                
                url = get_presigned_url(s3_client, BUCKET_NAME, key)
                
                return {
                    'statusCode': 200,
                    'headers': get_cors_headers(),
                    'body': json.dumps({'url': url})
                }
        
        # 404 for unknown paths
        return {
            'statusCode': 404,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': 'Not found'})
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({'error': str(e)})
        }


# For local testing
if __name__ == '__main__':
    # Test event
    test_event = {
        'httpMethod': 'GET',
        'path': '/albums',
        'queryStringParameters': {}
    }
    
    # Uncomment to test locally
    # print(json.dumps(lambda_handler(test_event, None), indent=2))
    print("Lambda handler ready. Deploy to AWS Lambda and API Gateway to use.")
