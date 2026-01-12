#!/usr/bin/env python3
"""
AWS API Gateway Teardown Script for BA Portal
"""

import boto3
import json
import argparse
from botocore.exceptions import ClientError

class APIGatewayTeardown:
    def __init__(self, config_file='api-config.json', region='ap-southeast-2'):
        self.config = self.load_config(config_file)
        self.region = region
        self.api_client = boto3.client('apigateway', region_name=region)

    def load_config(self, config_file):
        """Load API configuration from JSON file"""
        with open(config_file, 'r') as f:
            return json.load(f)

    def find_api_id(self):
        """Find API ID by name"""
        api_name = self.config['api_name']
        existing_apis = self.api_client.get_rest_apis()
        for api in existing_apis['items']:
            if api['name'] == api_name:
                return api['id']
        return None

    def delete_stages(self, api_id):
        """Delete all stages"""
        try:
            stages = self.api_client.get_stages(restApiId=api_id)
            # API returns 'item' not 'items'
            stage_list = stages.get('item', [])
            for stage in stage_list:
                stage_name = stage['stageName']
                print(f"Deleting stage: {stage_name}")
                try:
                    self.api_client.delete_stage(restApiId=api_id, stageName=stage_name)
                except ClientError as e:
                    if e.response['Error']['Code'] != 'NotFoundException':
                        print(f"  Error deleting stage {stage_name}: {e}")
        except ClientError as e:
            print(f"Error getting stages: {e}")

    def delete_resources(self, api_id):
        """Delete all resources except root, handling hierarchy properly"""
        resources = self.api_client.get_resources(restApiId=api_id)

        # Sort resources by path depth (deepest first) to handle parent-child relationships
        # This ensures child resources are deleted before their parents
        non_root_resources = [r for r in resources['items'] if r['path'] != '/']
        sorted_resources = sorted(non_root_resources, key=lambda x: x['path'].count('/'), reverse=True)

        for resource in sorted_resources:
            resource_id = resource['id']
            # Skip deleting the specific resource ID that should be preserved
            if resource_id == 'sq2s9workd':
                print(f"Skipping resource: {resource['path']} (ID: {resource_id})")
                continue

            print(f"Deleting resource: {resource['path']}")

            # Get and delete methods for the resource
            if 'resourceMethods' in resource:
                for http_method in resource['resourceMethods'].keys():
                    print(f"  Deleting method: {http_method}")

                    # Delete integration if exists
                    try:
                        self.api_client.delete_integration(restApiId=api_id, resourceId=resource_id, httpMethod=http_method)
                        print(f"    Deleted integration for {http_method}")
                    except ClientError as e:
                        if e.response['Error']['Code'] != 'NotFoundException':
                            print(f"    Error deleting integration for {http_method}: {e}")

                    # Delete method
                    try:
                        self.api_client.delete_method(restApiId=api_id, resourceId=resource_id, httpMethod=http_method)
                        print(f"    Deleted method {http_method}")
                    except ClientError as e:
                        if e.response['Error']['Code'] != 'NotFoundException':
                            print(f"    Error deleting method {http_method}: {e}")

            # Now delete the resource
            try:
                self.api_client.delete_resource(restApiId=api_id, resourceId=resource_id)
                print(f"  Deleted resource")
            except ClientError as e:
                if e.response['Error']['Code'] != 'NotFoundException':
                    print(f"  Error deleting resource: {e}")

    def delete_api(self, api_id):
        """Delete the REST API"""
        print(f"Deleting API: {self.config['api_name']}")
        self.api_client.delete_rest_api(restApiId=api_id)

    def teardown(self):
        """Main teardown function"""
        api_id = self.find_api_id()
        if not api_id:
            print(f"API {self.config['api_name']} not found")
            return

        self.delete_stages(api_id)
        self.delete_resources(api_id)
        self.delete_api(api_id)
        print("Teardown completed")

def main():
    parser = argparse.ArgumentParser(description='Teardown API Gateway for BA Portal')
    parser.add_argument('--config', default='api-config.json', help='Configuration file')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')

    args = parser.parse_args()

    teardown = APIGatewayTeardown(args.config, args.region)
    teardown.teardown()

if __name__ == '__main__':
    main()