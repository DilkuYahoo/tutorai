import boto3
import json

# AWS Clients
s3 = boto3.client("s3")

# Replace with your actual values
BUCKET_NAME = "cognifylabs.com.au"  # Ensure this matches your www-prefixed domain
CLOUDFRONT_OAC_ARN = "arn:aws:cloudfront::724772096157:distribution/E2R300A901V4FK"  # Use the correct OAC ARN
LOCAL_HTML_FILE = "index.html"  # Ensure this file exists locally
UPLOAD_PATH = "index.html"  # Path where it will be stored in S3

def get_existing_policy(bucket_name):
    """Retrieve the current S3 bucket policy."""
    try:
        response = s3.get_bucket_policy(Bucket=bucket_name)
        return json.loads(response["Policy"])
    except s3.exceptions.from_code("NoSuchBucketPolicy"):
        return {"Version": "2012-10-17", "Statement": []}

def update_s3_policy(bucket_name, cloudfront_oac_arn):
    """Update the S3 policy to allow only CloudFront access with rollback on failure."""
    
    # Get existing policy and keep a backup
    original_policy = get_existing_policy(bucket_name)
    
    # Define new CloudFront access statement
    cloudfront_statement = {
        "Sid": "AllowCloudFrontAccess",
        "Effect": "Allow",
        "Principal": {
            "Service": "cloudfront.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": f"arn:aws:s3:::{bucket_name}/*",
        "Condition": {
            "StringEquals": {
                "AWS:SourceArn": cloudfront_oac_arn
            }
        }
    }

    # Remove any existing CloudFront policy (to avoid duplicates)
    new_policy = {
        "Version": "2012-10-17",
        "Statement": [stmt for stmt in original_policy["Statement"] if stmt.get("Sid") != "AllowCloudFrontAccess"]
    }
    
    # Add the new CloudFront statement
    new_policy["Statement"].append(cloudfront_statement)

    # Convert policy to JSON string
    policy_json = json.dumps(new_policy)

    try:
        # Apply the policy update
        s3.put_bucket_policy(Bucket=bucket_name, Policy=policy_json)
        print(f"✅ Updated policy applied to S3 bucket: {bucket_name}")

    except Exception as e:
        print(f"❌ Error applying policy: {e}")
        
        # Attempt to rollback to the original policy
        try:
            s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(original_policy))
            print(f"🔄 Rollback successful. Original policy restored.")
        except Exception as rollback_error:
            print(f"⚠️ Rollback failed! Manual intervention required. Error: {rollback_error}")

def disable_public_access(bucket_name):
    """Ensure S3 bucket is private and only accessible via CloudFront."""
    try:
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        )
        print(f"✅ Public access blocked for bucket: {bucket_name}")
    except Exception as e:
        print(f"❌ Error setting public access block: {e}")

def upload_static_file(bucket_name, local_file, s3_path):
    """Upload a static HTML file to the S3 bucket."""
    try:
        s3.upload_file(local_file, bucket_name, s3_path, ExtraArgs={'ContentType': 'text/html'})
        print(f"✅ Uploaded {local_file} to s3://{bucket_name}/{s3_path}")
    except Exception as e:
        print(f"❌ Error uploading file: {e}")

# Execute the setup process
disable_public_access(BUCKET_NAME)
update_s3_policy(BUCKET_NAME, CLOUDFRONT_OAC_ARN)
upload_static_file(BUCKET_NAME, LOCAL_HTML_FILE, UPLOAD_PATH)
