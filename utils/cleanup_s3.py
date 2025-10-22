import boto3

def delete_s3_prefix_safely(bucket_name, prefix):
    s3 = boto3.client('s3')

    paginator = s3.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(Bucket=bucket_name, Prefix=prefix)

    objects_to_delete = []
    total_deleted = 0
    skipped_folder_marker = False

    print(f"Starting delete under s3://{bucket_name}/{prefix}\n")

    for page in page_iterator:
        if 'Contents' in page:
            for obj in page['Contents']:
                key = obj['Key']

                # Skip the prefix itself (e.g., "incoming-emails/")
                if key == prefix:
                    print(f"Skipping folder placeholder object: {key}")
                    skipped_folder_marker = True
                    continue

                print(f"Deleting: {key}")
                objects_to_delete.append({'Key': key})

                # Batch delete every 1000 objects
                if len(objects_to_delete) == 1000:
                    s3.delete_objects(Bucket=bucket_name, Delete={'Objects': objects_to_delete})
                    total_deleted += len(objects_to_delete)
                    print(f"Deleted 1000 objects...")
                    objects_to_delete = []

    # Delete remaining objects
    if objects_to_delete:
        s3.delete_objects(Bucket=bucket_name, Delete={'Objects': objects_to_delete})
        total_deleted += len(objects_to_delete)
        print(f"Deleted {len(objects_to_delete)} remaining objects.")

    print(f"\n✅ Delete complete. {total_deleted} object(s) deleted.")
    if skipped_folder_marker:
        print("🟢 Folder placeholder object was preserved.")

# Example usage
bucket_name = 'advicegenie-emails'
prefix = 'emails/'  # Make sure it ends with '/'

delete_s3_prefix_safely(bucket_name, prefix)
