aws dynamodb create-table \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --attribute-definitions \
    AttributeName=domain,AttributeType=S \
  --key-schema \
    AttributeName=domain,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Service,Value=SES \
         Key=Purpose,Value=EmailRouting

aws dynamodb put-item \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --item '{
    "domain": {"S": "info@cognifylabs.com.au"},
    "forward_to": {"S": "dilkushank@outlook.com"},
    "mail_sender": {"S": "noreply@cognifylabs.com.au"},
    "enabled": {"BOOL": true},
    "description": {"S": "cognifylabs.com.au A routing"},
    "updated_at": {"S": "2025-03-15T10:00:00Z"}
  }'

aws dynamodb put-item \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --item '{
    "domain": {"S": "cognifylabs.ai"},
    "forward_to": {"S": "dilkushank@outlook.com"},
    "mail_sender": {"S": "noreply@cognifylabs.ai"},
    "enabled": {"BOOL": true},
    "description": {"S": "cognifylabs.ai A routing"},
    "updated_at": {"S": "2025-03-15T10:00:00Z"}
  }'

aws dynamodb put-item \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --item '{
    "domain": {"S": "advicegenie.com.au"},
    "forward_to": {"S": "dilkushank@outlook.com"},
    "mail_sender": {"S": "noreply@advicegenie.com.au"},
    "enabled": {"BOOL": true},
    "description": {"S": "advicegenie.com.au A routing"},
    "updated_at": {"S": "2025-03-15T10:00:00Z"}
  }'

aws dynamodb put-item \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --item '{
    "domain": {"S": "theceylonlens.com"},
    "forward_to": {"S": "dilkushank@outlook.com"},
    "mail_sender": {"S": "noreply@theceylonlens.com"},
    "enabled": {"BOOL": true},
    "description": {"S": "theceylonlens.com A routing"},
    "updated_at": {"S": "2025-03-15T10:00:00Z"}
  }'

aws dynamodb put-item \
  --region us-east-1 \
  --table-name SES-EmailRouting \
  --item '{
    "domain": {"S": "ratescan.com.au"},
    "forward_to": {"S": "dilkushank@outlook.com"},
    "mail_sender": {"S": "noreply@ratescan.com.au"},
    "enabled": {"BOOL": true},
    "description": {"S": "ratescan.com.au A routing"},
    "updated_at": {"S": "2025-03-15T10:00:00Z"}
  }'