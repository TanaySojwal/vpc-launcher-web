import json
import boto3

def lambda_handler(event, context):
    print(event)
    response_body = {}
    
    # Return only dict obj for response body from switcher functions
    if 'action' in event['queryStringParameters'].keys():
        if event['queryStringParameters']['action'] == "DESCRIBE_REGIONS":
            response_body = describe_regions(event)
        if event['queryStringParameters']['action'] == "DESCRIBE_AZS":
            response_body = describe_azs(event)
        if event['queryStringParameters']['action'] == "CREATE_VPC":
            response_body = create_vpc(event)

    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(response_body)
    }

def describe_regions(event):
    client = boto3.client('ec2')
    regionList = []
    regions = client.describe_regions()['Regions']
    for region in regions:
        regionList.append(region['RegionName'])
    return {
        "regionList": regionList
    }
    
def describe_azs(event):
    region = event['queryStringParameters']['region']
    client = boto3.client('ec2', region_name=region)
    azList = []
    azs = client.describe_availability_zones(Filters=[
        {
            'Name': 'region-name',
            'Values': [
                region
            ]
        },
    ])['AvailabilityZones']
    for az in azs:
        azList.append(az['ZoneName'])
    return {
        "azList": azList
    }
    
def create_vpc(event):
    message = "success"
    try:
        # extracting values out of payload
        
        payload = json.loads(event['body'])['payload']
        # uncomment below when testing from lambda console
        # payload = event['body']['payload']
        cross_account_role_arn = payload['crossAccountRoleArn']
        enable_IPv6 = True if payload['enableIPv6'] else False
        vpc_name = payload['vpcName']
        
        # assume cross account role
        sts_client = boto3.client('sts')
        response = sts_client.assume_role(
            RoleArn=cross_account_role_arn,
            RoleSessionName='assume_role_session'
        )
            
        # create ec2 resource
        ec2 = boto3.resource(
            'ec2',
            aws_access_key_id=response['Credentials']['AccessKeyId'],
            aws_secret_access_key=response['Credentials']['SecretAccessKey'],
            aws_session_token=response['Credentials']['SessionToken'],
            region_name=payload['region']
        )
        
        # create ec2 client
        ec2_client = boto3.client(
            'ec2',
            aws_access_key_id=response['Credentials']['AccessKeyId'],
            aws_secret_access_key=response['Credentials']['SecretAccessKey'],
            aws_session_token=response['Credentials']['SessionToken'],
            region_name=payload['region']
        )
        

        # create vpc
        vpc = ec2.create_vpc(
            CidrBlock='10.0.0.0/16',
            AmazonProvidedIpv6CidrBlock=enable_IPv6,
            TagSpecifications=[{
                'ResourceType':'vpc',
                'Tags':[{'Key': 'Name', 'Value':vpc_name}]
            }]
        )
        vpc.wait_until_available()
        ec2_client.modify_vpc_attribute(VpcId=vpc.id,EnableDnsHostnames={'Value':True})
        # create and attach internet gateway to VPC
        ig = ec2.create_internet_gateway()
        vpc.attach_internet_gateway(InternetGatewayId=ig.id)
        # create a route table and a public route
        public_route_table = vpc.create_route_table()
        ig_route = public_route_table.create_route(
            DestinationCidrBlock='0.0.0.0/0',
            GatewayId=ig.id
        )

    return {
        "message": message
    }