import os
import hashlib
import logging
import boto3
from botocore.exceptions import ClientError

# ==========================
# CONFIG
# ==========================
BUCKET_NAME = "ruhouse-backup"
LOCAL_BASE_PATH = "/Users/Dilku/Pictures"  # contains videos/ and pictures/
FOLDERS_TO_SYNC = ["sdcard","gdrive"]

# ==========================
# LOGGING SETUP (VERBOSE)
# ==========================
logging.basicConfig(
    level=logging.INFO,  # Change to DEBUG for even more detail
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger()

# ==========================
# AWS CLIENT
# ==========================
s3 = boto3.client("s3")


# ==========================
# HELPER: MD5 HASH (for comparison)
# ==========================
def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


# ==========================
# CHECK IF FILE EXISTS + MATCHES
# ==========================
def file_needs_upload(local_path, s3_key):
    try:
        response = s3.head_object(Bucket=BUCKET_NAME, Key=s3_key)
        s3_etag = response["ETag"].strip('"')
        local_md5 = calculate_md5(local_path)

        if local_md5 == s3_etag:
            logger.info(f"SKIP (unchanged): {s3_key}")
            return False
        else:
            logger.info(f"UPDATE (changed): {s3_key}")
            return True

    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            logger.info(f"NEW FILE: {s3_key}")
            return True
        else:
            logger.error(f"Error checking file {s3_key}: {e}")
            return False


# ==========================
# SYNC FUNCTION
# ==========================
def sync_folder(folder_name):
    local_folder = os.path.join(LOCAL_BASE_PATH, folder_name)

    if not os.path.exists(local_folder):
        logger.warning(f"Folder does not exist: {local_folder}")
        return

    logger.info(f"Starting sync for folder: {folder_name}")

    for root, dirs, files in os.walk(local_folder):
        for file in files:
            local_path = os.path.join(root, file)

            # Build S3 key
            relative_path = os.path.relpath(local_path, LOCAL_BASE_PATH)
            s3_key = relative_path.replace("\\", "/")

            if file_needs_upload(local_path, s3_key):
                try:
                    logger.info(f"Uploading: {s3_key}")
                    s3.upload_file(local_path, BUCKET_NAME, s3_key)
                except Exception as e:
                    logger.error(f"Upload failed for {s3_key}: {e}")

    logger.info(f"Finished sync for folder: {folder_name}")


# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    logger.info("===== S3 SYNC STARTED =====")

    for folder in FOLDERS_TO_SYNC:
        sync_folder(folder)

    logger.info("===== S3 SYNC COMPLETED =====")