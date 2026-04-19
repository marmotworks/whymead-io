import json
import os
from datetime import datetime
import boto3

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')


def handler(event, context):
    table = dynamodb.Table(os.environ['FLAVOR_REQUESTS_TABLE'])
    NOTIFICATION_EMAIL = os.environ['NOTIFICATION_EMAIL']
    try:
        response = table.scan()
        items = response.get('Items', [])
        count = len(items)

        today = datetime.utcnow().strftime('%A, %B %d, %Y')
        subject = f'WHY Mead Flavor Requests - {today} ({count} new)'

        body = f"""Daily Flavor Request Summary
{'=' * 40}
Date: {today}
Total Requests on File: {count}
{'=' * 40}
"""

        if items:
            body += '\nRecent Requests:\n'
            body += '-' * 40
            for item in sorted(items, key=lambda x: x.get('createdAt', ''), reverse=True)[:20]:
                body += f"\n\nFlavor: {item.get('flavor', 'N/A')}"
                body += f"\nName: {item.get('name', 'N/A')}"
                body += f"\nEmail: {item.get('email', 'N/A')}"
                if item.get('notes'):
                    body += f"\nNotes: {item.get('notes', '')}"
                body += f"\nSubmitted: {item.get('createdAt', 'N/A')}"
                body += '\n' + '-' * 40
        else:
            body += '\nNo flavor requests received.'

        sns.publish(
            TopicArn=os.environ['NOTIFICATION_TOPIC_ARN'],
            Subject=subject,
            Message=body
        )

        return {
            'statusCode': 200,
            'body': json.dumps(f'Notification sent: {count} requests on file')
        }

    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
