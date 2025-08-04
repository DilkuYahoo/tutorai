import boto3
import json
import uuid

# Replace with your actual agent details
agent_id = "RQIX7LLFHM"
agent_alias_id = "LMX7CIXBMM"  # Often "DRAFT" or "PRODUCTION"
region = "ap-southeast-2"  # Change based on where your agent is deployed
session_Id = str(uuid.uuid4())  # e.g., 'e2c2a0b0-7c5f-4a4f-9176-0c1f09f2efbe'

# Sample input to the agent
user_input = """"
About You Current Financial Position as 
Extract the client’s financial summary from the Statement of Advice (SOA), including: total income, total assets, net worth, and annual surplus. Also extract income and expense breakdowns, asset and liability tables (with names and values), and any estate planning details (e.g. wills, POA, trusts). Only return data found directly in the document—do not guess or fabricate values. Keep all amounts formatted as shown, including currency symbols.

Current Insurance Summary Existing Insurance Coverage as

Extract the client’s financial summary from the Statement of Advice (SOA), including: total income, total assets, net worth, and annual surplus. Also extract income and expense breakdowns, asset and liability tables (with names and values), and any estate planning details (e.g. wills, POA, trusts). Only return data found directly in the document—do not guess or fabricate values. Keep all amounts formatted as shown, including currency symbols."
"""
def invoke_bedrock_agent():
    bedrock_agent = boto3.client('bedrock-agent-runtime', region_name=region)

    try:
        response = bedrock_agent.invoke_agent(
        agentId=agent_id,
        agentAliasId=agent_alias_id,
        sessionId=session_Id,
        inputText=user_input
)

        # Print streamed response chunks
        print("Response from Bedrock Agent:")
        for event in response['completion']:
            if 'chunk' in event:
                print(event['chunk']['bytes'].decode(), end='')

    except Exception as e:
        print("Error invoking agent:", e)

if __name__ == "__main__":
    invoke_bedrock_agent()
