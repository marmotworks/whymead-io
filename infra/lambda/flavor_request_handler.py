import json
import os
import uuid
from datetime import datetime
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['FLAVOR_REQUESTS_TABLE'])


def handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))

        flavor = body.get('flavor', '').strip()
        name = body.get('name', '').strip()
        email = body.get('email', '').strip()
        notes = body.get('notes', '').strip()

        if not flavor or not name or not email:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({'error': 'Flavor, name, and email are required'})
            }

        item = {
            'id': str(uuid.uuid4()),
            'flavor': flavor,
            'name': name,
            'email': email,
            'notes': notes,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }

        table.put_item(Item=item)

        return {
            'statusCode': 201,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'message': 'Flavor request submitted successfully'})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'error': str(e)})
        }
