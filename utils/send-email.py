import boto3

def test_ses_setup(domain_name, recipient_email):
    ses_client = boto3.client("ses", region_name="ap-southeast-2")
    
    try:
        # Check if domain is verified
        identities = ses_client.list_identities(IdentityType='Domain')['Identities']
        if domain_name not in identities:
            print(f"Domain {domain_name} is not verified in SES.")
            return False
        print(f"Domain {domain_name} is verified in SES.")
        
        # Check DKIM setup
        dkim_attributes = ses_client.get_identity_dkim_attributes(Identities=[domain_name])
        if not dkim_attributes['DkimAttributes'][domain_name]['DkimEnabled']:
            print("DKIM is not enabled for this domain.")
            return False
        print("DKIM is properly configured.")
        
        # Send a test email
        sender_email = f"no-reply@{domain_name}"
        subject = "SES Test Email"
        body = "This is a test email from AWS SES setup verification script."
        
        response = ses_client.send_email(
            Source=sender_email,
            Destination={
                'ToAddresses': [recipient_email]
            },
            Message={
                'Subject': {'Data': subject},
                'Body': {'Text': {'Data': body}}
            }
        )
        print(f"Test email sent successfully: {response['MessageId']}")
        
        return True
    
    except Exception as e:
        print(f"Test failed: {e}")
        return False

# Replace with the actual domain name and recipient email
domain_name = "cognifylabs.ai"
recipient_email = "info@advicegenie.com.au"
success = test_ses_setup(domain_name, recipient_email)
if success:
    print("SES setup is correctly configured and test email sent.")
else:
    print("SES setup is incorrect. Please check the configuration.")
