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
        if event['queryStringParameters']['action'] == "CREATE_SUBNET":
            response_body = create_subnet(event)
        if event['queryStringParameters']['action'] == "CREATE_VPC":
            response_body = create_vpc(event)
        if event['queryStringParameters']['action'] == "ADD_CROSS_ACC_POLICY_TO_ROLE":
            response_body = add_cross_acc_policy_to_role(event)
    print(response_body)
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(response_body)
    }

def add_cross_acc_policy_to_role(event):
    message = "success"
    try:
        iam = boto3.client('iam')
        cross_account_role_arn = event['queryStringParameters']['crossAccountRoleArn']
        my_managed_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "sts:AssumeRole"
                    ],
                    "Resource": [
                        cross_account_role_arn
                    ]
                }
            ]
        }
        response = iam.create_policy(
            PolicyName='MyCrossAccountRolePolicy',
            PolicyDocument=json.dumps(my_managed_policy)
        )
        policyArn = response['Policy']['Arn']
        iam.attach_role_policy(
            RoleName='vpc-launcher-role',
            PolicyArn=policyArn
        )
    except Exception as e:
        message = str(e)
        print(e)
    return {
        "message": message
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

def create_subnet(event):
    response_body = {}
    try:
        # payload = json.loads(event['body'])['subnetPayload']
        # uncomment below when testing from lambda console
        payload = event['body']['subnetPayload']
        cross_account_role_arn = payload['crossAccountRoleArn']
        is_public_only = payload['isPublicOnly']
        internet_access = payload['internetAccess']
        vpc_id = payload['vpcId']
        public_route_table_id = payload['publicRouteTableId']
        region = payload['region']
        az = payload['az']
        public_subnet_name = payload['publicSubnetName']
        private_subnet_name = payload['privateSubnetName']
        public_subnet_cidr = payload['publicSubnetCidr']
        private_subnet_cidr = payload['privateSubnetCidr']

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
            region_name=region
        )
        
        # create ec2 client
        ec2_client = boto3.client(
            'ec2',
            aws_access_key_id=response['Credentials']['AccessKeyId'],
            aws_secret_access_key=response['Credentials']['SecretAccessKey'],
            aws_session_token=response['Credentials']['SessionToken'],
            region_name=region
        )
        # getting public route table with id
        public_route_table = ec2.RouteTable(public_route_table_id)

        # getting vpc with id
        vpc = ec2.Vpc(vpc_id)

        # creating a public subnet
        public_subnet = ec2.create_subnet(
            CidrBlock=public_subnet_cidr, 
            VpcId=vpc.id,
            TagSpecifications=[{
                'ResourceType':'subnet',
                'Tags':[{'Key': 'Name', 'Value':public_subnet_name}]
            }],
            AvailabilityZone=az
        )
        
        # associate the route table with the subnet
        public_route_table.associate_with_subnet(SubnetId=public_subnet.id)
        response_body['publicSubnetId'] = public_subnet.id
        
        if (not is_public_only):
            # create private subnet
            private_subnet = ec2.create_subnet(
                CidrBlock=private_subnet_cidr, 
                VpcId=vpc.id,
                TagSpecifications=[{
                    'ResourceType':'subnet',
                    'Tags':[{'Key': 'Name', 'Value':private_subnet_name}]
                }],
                AvailabilityZone=az
            )
            
            response_body['privateSubnetId'] = private_subnet.id

            if (internet_access):
                # create nat instance for private subnet
                eip = ec2_client.allocate_address(Domain='vpc')
                nat_gateway = ec2_client.create_nat_gateway(SubnetId=public_subnet.id,AllocationId=eip['AllocationId'])
                
                # wait until NAT gateway is available
                waiter = ec2_client.get_waiter('nat_gateway_available')
                waiter.wait(
                    NatGatewayIds=[nat_gateway['NatGateway']['NatGatewayId']]
                )
                
                # create route table for private subnet
                private_route_table = vpc.create_route_table()
                nat_route = private_route_table.create_route(
                    DestinationCidrBlock='0.0.0.0/0',
                    NatGatewayId=nat_gateway['NatGateway']['NatGatewayId']
                )
                
                # associate private route table with private subnet
                private_route_table.associate_with_subnet(SubnetId=private_subnet.id)
        
        response_body['message'] = "success"

    except Exception as e:
        print(e)
        response_body = {
            "message": str(e)
        }

    return response_body

def create_vpc(event):
    response = {}
    try:
        payload = json.loads(event['body'])['vpcPayload']
        print(payload)
        # uncomment below when testing from lambda console
        # payload = event['body']['payload']
        cross_account_role_arn = payload['crossAccountRoleArn']
        enable_IPv6 = True if payload['enableIPv6'] else False
        vpc_name = payload['vpcName']
        region = payload['region']
        
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
            region_name=region
        )
        
        # create ec2 client
        ec2_client = boto3.client(
            'ec2',
            aws_access_key_id=response['Credentials']['AccessKeyId'],
            aws_secret_access_key=response['Credentials']['SecretAccessKey'],
            aws_session_token=response['Credentials']['SessionToken'],
            region_name=region
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
        
        response = {
            "message": "success",
            "vpcId": vpc.id,
            "publicRouteTableId": public_route_table.id
        }

    except Exception as e:
        print(e)
        response = {
            "message": str(e)
        }

    return response
