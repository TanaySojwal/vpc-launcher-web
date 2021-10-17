
def create_vpc_old(event):
    message = "success"
    try:
        # extracting values out of payload
        
        payload = json.loads(event['body'])['payload']
        # payload = event['body']['payload']
        cross_account_role_arn = payload['crossAccountRoleArn']
        enable_IPv6 = True if payload['enableIPv6'] else False
        vpc_name = payload['vpcName']
        is_public_only = payload['isPublicOnly']
        internet_access = payload['internetAccess']
        public_subnet_name = 'public-subnet-' + payload['az']
        private_subnet_name = 'private-subnet-' + payload['az']
        az = payload['az']
        
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
        
        # creating a public subnet
        public_subnet = ec2.create_subnet(
            CidrBlock='10.0.0.0/24', 
            VpcId=vpc.id,
            TagSpecifications=[{
                'ResourceType':'subnet',
                'Tags':[{'Key': 'Name', 'Value':public_subnet_name}]
            }],
            AvailabilityZone=az
        )
        
        # associate the route table with the subnet
        public_route_table.associate_with_subnet(SubnetId=public_subnet.id)
        
        if (not is_public_only):
            # create private subnet
            private_subnet = ec2.create_subnet(
                CidrBlock='10.0.1.0/24', 
                VpcId=vpc.id,
                TagSpecifications=[{
                    'ResourceType':'subnet',
                    'Tags':[{'Key': 'Name', 'Value':private_subnet_name}]
                }],
                AvailabilityZone=az
            )
            
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
    except Exception as e:
        message = e["errorMessage"]
    

    return {
        "message": message
    }