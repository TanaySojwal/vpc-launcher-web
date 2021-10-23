import json
import boto3

def lambda_handler(event, context):
    print(event)
    
    if (event['httpMethod'] == 'POST'):
        response_body = processRequest(event)
    else:
        response_body = {}
        
    print(response_body)
    
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(response_body)
    }
    
def processRequest(event):
    response_body = {}
    try:
        # payload = json.loads(event['body'])
        # uncomment below when testing from lambda console
        subnetPayload = event['body']
        payload = {
            "queryStringParameters": {
                "action": "CREATE_SUBNET"
            },
            "body": subnetPayload,
            "isBase64Encoded": False
        }
        
        # invoke vpc launcher function for action = CREATE_SUBNET
        client = boto3.client('lambda')
        response = client.invoke(
            FunctionName='vpc-launcher-function',
            InvocationType='Event',
            Payload=json.dumps(payload)
        )
        response_body = {
            "message": "success"
        }
    except Exception as e:
        print(e)
        response_body = {
            "message": str(e)
        }
        
    return response_body
