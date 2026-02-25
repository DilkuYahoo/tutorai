# Photo Gallery Web App

A serverless web application to display photos and videos from an S3 bucket.

## Features

- 📁 Album-based organization (folders in S3)
- 🖼️ Photo viewer with lightbox
- 🎬 Video playback for MOV files
- ⚡ Serverless architecture (AWS Lambda + API Gateway)
- 🔒 Presigned URLs for secure access

## Prerequisites

- AWS account with appropriate permissions
- Python 3.12+
- Node.js 18+
- AWS CLI configured

## Project Structure

```
photo-gallery/
├── config.yaml           # Configuration (S3 bucket, region, etc.)
├── lambda/               # AWS Lambda backend
│   ├── main.py          # Lambda handler
│   ├── requirements.txt # Python dependencies
│   └── deploy_lambda.py # Lambda deployment script
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API service
│   │   ├── App.jsx      # Main app
│   │   └── index.css    # Styles
│   └── package.json     # Dependencies
└── IaC/                 # Infrastructure as Code
    ├── api-config.json  # API Gateway config
    └── deploy_api.py    # API Gateway deployment
```

## Setup

### 1. Configure S3 Bucket

Edit `config.yaml` and update the S3 bucket name:

```yaml
s3:
  bucket_name: "your-bucket-name"
  region: "ap-southeast-2"
```

### 2. Organize Your S3 Bucket

Create folders (albums) in your S3 bucket:

```
your-bucket/
├── Vacation2024/
│   ├── photo1.jpg
│   ├── photo2.cr2
│   └── video.mov
├── Birthday/
│   └── ...
└── _thumbnails/         # Optional: pre-generated thumbnails
    └── ...
```

### 3. Deploy Backend

```bash
cd app/photo-gallery/lambda
pip install boto3 pyyaml
python deploy_lambda.py
```

### 4. Deploy API Gateway

```bash
cd app/photo-gallery/IaC
python deploy_api.py
```

### 5. Configure Frontend

Copy the example environment file and update with your API URL:

```bash
cd app/photo-gallery/frontend
cp .env.example .env
# Edit .env with your API Gateway URL
```

### 6. Deploy Frontend

```bash
cd app/photo-gallery/frontend
npm install
npm run build
# Upload the dist/ folder to S3 or CloudFront
```

## Supported File Types

- **Photos**: JPG, JPEG, CR2, PNG, GIF, BMP
- **Videos**: MOV, MP4, AVI, MKV

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/albums` | List all albums |
| GET | `/albums/{name}` | List media in album |
| GET | `/media/{album}/{file}/url` | Get presigned URL |

## Development

### Running Frontend Locally

```bash
cd app/photo-gallery/frontend
npm install
npm run dev
```

### Testing Lambda Locally

```bash
cd app/photo-gallery/lambda
python -c "
import json
from main import lambda_handler
event = {'httpMethod': 'GET', 'path': '/albums', 'queryStringParameters': {}}
print(json.dumps(lambda_handler(event, None), indent=2))
"
```

## S3 Bucket Policy

Ensure your S3 bucket allows Lambda to read files:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT:role/photo-gallery-lambda-role"
      },
      "Action": ["s3:ListBucket", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET",
        "arn:aws:s3:::YOUR-BUCKET/*"
      ]
    }
  ]
}
```

## Notes

- CR2 files: The app will display them, but for full support consider adding a Lambda layer with raw processing
- Thumbnails: Create a `_thumbnails` folder in each album with pre-generated JPG thumbnails
- Video: MOV files play directly in the browser

## License

MIT
