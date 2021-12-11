import json
import boto3
import botocore

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
        if event['queryStringParameters']['action'] == "GET_VPC_SUBNETS":
            response_body = get_vpc_subnets(event)
        if event['queryStringParameters']['action'] == "DESCRIBE_ARNS_FOR_EMAIL":
            response_body = describe_arns_for_email(event)
        if event['queryStringParameters']['action'] == "ADD_ARN_TO_EMAIL":
            response_body = add_arn_to_email(event)
        if event['queryStringParameters']['action'] == "DELETE_ARN_FROM_EMAIL":
            response_body = delete_arn_from_email(event)
        if event['queryStringParameters']['action'] == "DELETE_CROSS_ACC_POLICY_FROM_ROLE":
            response_body = delete_cross_acc_policy_from_role(event)
        if event['queryStringParameters']['action'] == "DESCRIBE_WKSPCS_FOR_EMAIL":
            response_body = describe_workspaces_for_email(event)
        if event['queryStringParameters']['action'] == "ADD_WKSPCS_TO_EMAIL":
            response_body = add_workspace_to_email(event)
        if event['queryStringParameters']['action'] == "DELETE_WKSPCS_FROM_EMAIL":
            response_body = delete_workspace_from_email(event)
        if event['queryStringParameters']['action'] == "GET_NEXT_CIDR_FOR_WKSPCS":
            response_body = get_next_cidr_for_workspace(event)
        if event['queryStringParameters']['action'] == "UPDATE_CIDR_FOR_WKSPCS":
            response_body = update_cidr_for_workspace(event)
    print(response_body)
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(response_body)
    }

def update_cidr_for_workspace(event):
    try:
        email = event['queryStringParameters']['email']
        workspace = event['queryStringParameters']['workspace']
        arn = event['queryStringParameters']['arn']
        currentCidr = event['queryStringParameters']['currentCidr']
        vpcName = event['queryStringParameters']['vpcName']
        region = event['queryStringParameters']['region']
        
        # fetch record with workspace and email
        # create string like 'currentCidr|vpcName|region|arn'
        # if cidr value is empty / none
        #     create and update cidr string set with above string
        # else
        #     update cidr string set with above string
        # create array of size 256
        # loop index (1, 255) array and fill 1s for cidrs available in set created above
        # loop array again and find next available index with 0, this will be value of nextCidr
        # finally update record with new string set and nextCidr value
        client = boto3.client('dynamodb')
        response = client.get_item(
                TableName='workspaces_vpc-launcher',
                Key={
                    'workspace': {
                        'S': workspace
                    },
                    'email': {
                        'S': email
                    }
                }
            )
        print(response)
        cidrEntry = "{}|{}|{}|{}".format(currentCidr, vpcName, region, arn)
        if 'Item' in response:
            cidrSet = []
            helper = []
            
            if 'cidr' in response['Item']:
                cidrSet = response['Item']['cidr']['SS']
            
            cidrSet.append(cidrEntry)
            
            nextCidr = -1
            
            for cidr in cidrSet:
                helper.append(int(cidr.split("|")[0]))
                
            for i in range(1, 256):
                if i not in helper:
                    nextCidr = i
                    break
            
            if nextCidr > 0:
                response = client.put_item(
                    TableName='workspaces_vpc-launcher',
                    Item={
                        'workspace': {
                            'S': workspace
                        },
                        'nextcidr': {
                            'S': str(nextCidr)
                        },
                        'email': {
                            'S': email
                        },
                        'cidr': {
                            'SS': cidrSet
                        }
                    }
                )
                return {
                    "message": "success"
                }
            else:
                return {
                    "message": "encountered an error while calculating next CIDR"
                }
        else:
            return {
                "message": "workspace does not exist"
            }
        
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def get_next_cidr_for_workspace(event):
    try:
        email = event['queryStringParameters']['email']
        workspace = event['queryStringParameters']['workspace']
        
        client = boto3.client('dynamodb')
        
        response = client.get_item(
                TableName='workspaces_vpc-launcher',
                Key={
                    'workspace': {
                        'S': workspace
                    },
                    'email': {
                        'S': email
                    }
                }
            )
        print(response)
        if 'Item' in response:
            return {
                "nextCidr": response['Item']['nextcidr']['S']
            }
        else:
            return {
                "message": "workspace does not exist"
            }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def delete_cross_acc_policy_from_role(event):
    # get detach policy from role
    # delete policy
    client = boto3.client('iam')
        
    policyArn = 'arn:aws:iam::239547938232:policy/MyCrossAccountRolePolicy'

    try:
        response = client.detach_role_policy(
            RoleName='vpc-launcher-role',
            PolicyArn=policyArn
        )
        print(response)
        response = client.delete_policy(
            PolicyArn=policyArn
        )
        print(response)
        return {
            "message": "success"
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def add_cross_acc_policy_to_role(event):
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
        return {
            "message": "success"
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def delete_workspace_from_email(event):
    try:
        email = event['queryStringParameters']['email']
        workspace = event['queryStringParameters']['workspace']
        
        client = boto3.client('dynamodb')
        
        response = client.delete_item(
            TableName='workspaces_vpc-launcher',
            Key={
                'workspace': {
                    'S': workspace
                },
                'email': {
                    'S': email
                }
            },
            ConditionExpression='email=:email',
            ExpressionAttributeValues={
                ':email': {'S':email}
            }
        )
        
        return {
            "message": "success"
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def delete_arn_from_email(event):
    try:
        email = event['queryStringParameters']['email']
        arn = event['queryStringParameters']['arn']
        
        arns = []
        
        client = boto3.client('dynamodb')
        
        response = client.get_item(
            TableName='cross-account-roles_vpc-launcher',
            Key={
                'users':{
                    'S': email
                }
            }
        )
        
        print(response)
        
        if 'Item' in response and 'cross-account-arns' in response['Item']:
            arns = response['Item']['cross-account-arns']['SS']
        
        arns.remove(arn)
        
        response = client.update_item(
            TableName='cross-account-roles_vpc-launcher',
            Key={
                'users': {
                    'S': email
                }
            },
            AttributeUpdates={
                'cross-account-arns': {
                    'Value': {
                        'SS': arns
                    }
                }
            }
        )
        
        print(response)
        
        return {
            "message": "success"
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def add_workspace_to_email(event):
    try:
        message = "success"
        email = event['queryStringParameters']['email']
        workspace = event['queryStringParameters']['workspace']
        
        client = boto3.client('dynamodb')
        
        response = client.get_item(
                TableName='workspaces_vpc-launcher',
                Key={
                    'workspace': {
                        'S': workspace
                    },
                    'email': {
                        'S': email
                    }
                }
            )
            
        if 'Item' in response:
            message = "workspace already exists"
        else:
            response = client.put_item(
                    TableName='workspaces_vpc-launcher',
                    Item={
                        'workspace': {
                            'S': workspace
                        },
                        'nextcidr': {
                            'S': "1"
                        },
                        'email': {
                            'S': email
                        }
                    }
                )
        
        print(response)
        
        return {
            "message": message
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def add_arn_to_email(event):
    try:
        email = event['queryStringParameters']['email']
        arn = event['queryStringParameters']['arn']
        
        arns = []
        
        client = boto3.client('dynamodb')
        
        response = client.get_item(
            TableName='cross-account-roles_vpc-launcher',
            Key={
                'users':{
                    'S': email
                }
            }
        )
        
        print(response)
        
        if 'Item' in response and 'cross-account-arns' in response['Item']:
            arns = response['Item']['cross-account-arns']['SS']
        
        if arn not in arns:
            arns.append(arn)
        
        response = client.update_item(
            TableName='cross-account-roles_vpc-launcher',
            Key={
                'users': {
                    'S': email
                }
            },
            AttributeUpdates={
                'cross-account-arns': {
                    'Value': {
                        'SS': arns
                    }
                }
            }
        )
        
        print(response)
        
        return {
            "message": "success"
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def describe_workspaces_for_email(event):
    try:
        email = event['queryStringParameters']['email']

        workspaces = []
        
        client = boto3.client('dynamodb')
        
        response = client.query(
            TableName='workspaces_vpc-launcher',
            IndexName='email-workspace-index',
            KeyConditionExpression='email=:email',
            ExpressionAttributeValues={
                ':email': {'S': email}
            }
        )
        
        print(response)
        
        if 'Items' in response:
            for workspace in response['Items']:
                workspaces.append(workspace['workspace']['S'])

        return {
            "workspaces": workspaces
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def describe_arns_for_email(event):
    try:
        email = event['queryStringParameters']['email']
        arns = []
        
        client = boto3.client('dynamodb')
        
        response = client.get_item(
            TableName='cross-account-roles_vpc-launcher',
            Key={
                'users':{
                    'S': email
                }
            }
        )
        print(response)
        if 'Item' in response and 'cross-account-arns' in response['Item']:
            arns = response['Item']['cross-account-arns']['SS']
        else:
            client.put_item(
                TableName='cross-account-roles_vpc-launcher',
                Item={
                    'users':{
                        'S': email
                    }
                }
            )
        return {
            "arns": arns
        }
    except Exception as e:
        message = str(e)
        print(e)
        return {
            "message": message
        }

def get_vpc_subnets(event):
    try:
        # extract fields from request
        vpc_id = event['queryStringParameters']['vpcId']
        region = event['queryStringParameters']['region']
        cross_account_role_arn = event['queryStringParameters']['crossAccountRoleArn']

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

        vpc = ec2.Vpc(vpc_id)
        subnets = []
        for subnet in vpc.subnets.all():
            print(subnet)
            subnets.append(subnet.id)

        # # get detach policy from role
        # # delete policy
        # iam_client = boto3.client('iam')
            
        # policyArn = 'arn:aws:iam::239547938232:policy/MyCrossAccountRolePolicy'
    
        # iam_response = iam_client.detach_role_policy(
        #     RoleName='vpc-launcher-role',
        #     PolicyArn=policyArn
        # )
        # print(iam_response)
        
        # iam_response = iam_client.delete_policy(
        #     PolicyArn=policyArn
        # )
        # print(iam_response)
        
        return {
            "subnets": subnets
        }
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
        email = payload['email']
        nextCidr = payload['nextCidr']
        
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
            CidrBlock=nextCidr + '.0.0.0/16',
            AmazonProvidedIpv6CidrBlock=enable_IPv6,
            TagSpecifications=[{
                'ResourceType':'vpc',
                'Tags':[
                    {'Key': 'Name', 'Value': vpc_name},
                    {'Key': 'user', 'Value': email}
                ]
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
