"""
Bedrock client library for AWS Bedrock interactions.
"""

import json
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal types from DynamoDB"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def invoke_bedrock(system_prompt: str, user_prompt: str, model_id: str = None, model_kwargs: dict = None) -> str:
    """
    Invoke AWS Bedrock to generate a response.
    
    Args:
        system_prompt: The system prompt to set the context/role
        user_prompt: The user input/prompt to generate response for
        model_id: The Bedrock model ID to use (defaults to environment variable BEDROCK_MODEL_ID)
        model_kwargs: Additional model parameters like temperature, max_tokens, etc.
    
    Returns:
        The generated text response from Bedrock
    """
    import os
    
    model_id = model_id or os.environ.get("BEDROCK_MODEL_ID", "au.anthropic.claude-sonnet-4-5-20250929-v1:0")
    default_kwargs = {
        "max_tokens": 2048,
        "temperature": 0.7,
    }
    model_kwargs = model_kwargs or default_kwargs
    
    # Initialize Bedrock Runtime client
    bedrock_runtime = boto3.client('bedrock-runtime')
    
    # Build the full prompt
    full_prompt = f"{system_prompt}\n\nUser: {user_prompt}\n\nAssistant:"
    
    print(f"LOG: Invoking Bedrock model: {model_id}")
    print(f"LOG: Prompt length: {len(full_prompt)} characters")
    
    try:
        # Prepare the request body for Claude model format
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [
                {
                    "role": "user",
                    "content": full_prompt
                }
            ],
            **model_kwargs
        }
        
        print(f"LOG: Sending request to Bedrock...")
        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )
        
        # Parse the response
        response_body = json.loads(response['body'].read())
        
        # Extract the generated text
        if "content" in response_body:
            generated_text = response_body["content"][0]["text"]
        elif "completion" in response_body:
            generated_text = response_body["completion"]
        else:
            generated_text = str(response_body)
        
        print(f"LOG: Bedrock response received")
        print(f"LOG: Response length: {len(generated_text)} characters")
        
        return generated_text
        
    except ClientError as e:
        error_msg = f"ERROR: Bedrock client error - {e.response['Error']['Code']}: {e.response['Error']['Message']}"
        print(error_msg)
        raise Exception(error_msg)
    except json.JSONDecodeError as e:
        error_msg = f"ERROR: Failed to parse Bedrock response: {str(e)}"
        print(error_msg)
        raise Exception(error_msg)
    except Exception as e:
        error_msg = f"ERROR: Unexpected error invoking Bedrock: {str(e)}"
        print(error_msg)
        raise Exception(error_msg)
