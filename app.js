const vpcLauncherAPIUrl = 'https://fs9gjfj2ei.execute-api.us-east-1.amazonaws.com/cert'

function createVPC() {
    const xhr = new XMLHttpRequest()

    const crossAccountRoleArn = document.getElementById('cross-account-role-arn').value
    const publicSubnetCheck = document.getElementById('public-subnet').checked
    const internetAccess = document.getElementById('private-subnet-internet').checked
    const vpcName = document.getElementById('vpc-name').value
    const region = document.getElementById('vpc-region').value
    const az = document.getElementById('vpc-az').value
    const enableIPv6 = document.getElementById('enable-ipv6').checked

    const isPublicOnly = publicSubnetCheck == true ? true : false

    const payload = {
        crossAccountRoleArn,
        isPublicOnly,
        internetAccess,
        vpcName,
        region,
        az,
        enableIPv6
    }
    
    xhr.open('POST', `${vpcLauncherAPIUrl}?action=CREATE_VPC`, false)
    xhr.send(JSON.stringify({payload}))
    xhr.onload = () => {
        if (xhr.status == 200) {
            alert(`VPC launched successfully!`)
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }
}

function describeAllRegions() {
    const xhr = new XMLHttpRequest()
    const regionSelect = document.getElementById('vpc-region')

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_REGIONS`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['regionList'].length > 0) {
                var length = regionSelect.options.length;
                for (i = length - 1; i > 0; i--) {
                    regionSelect.options[i] = null;
                }
                var itr = 1
                result['regionList'].forEach(element => {
                    regionSelect.options[itr++] = new Option(element, element)
                })
            }        
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }
}

function describeAZs() {
    const xhr = new XMLHttpRequest()
    const regionSelect = document.getElementById('vpc-region')
    const azSelect = document.getElementById('vpc-az')
    var selectedRegion = regionSelect.options[regionSelect.selectedIndex].value
    
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_AZS&region=${selectedRegion}`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['azList'].length > 0) {
                var length = azSelect.options.length;
                for (i = length - 1; i > 0; i--) {
                    azSelect.options[i] = null;
                }
                var itr = 1
                result['azList'].forEach(element => {
                    azSelect.options[itr++] = new Option(element, element)
                })
            }        
        } else {
            alert(`An error occurred while fetching AZs!`)
        }
    }
}

function onPublicPrivateSubnetCheck() {
    const publicPrivateSubnetCheck = document.getElementById("public-private-subnet").checked
    const publicSubnetCheck = document.getElementById("public-subnet")
    if (publicPrivateSubnetCheck == true) {
        document.getElementById("private-subnet-internet-container").style.display = "block"
        publicSubnetCheck.checked = false
    } else if (publicPrivateSubnetCheck == false) {
        document.getElementById("private-subnet-internet-container").style.display = "none"
    }
}

function onPublicSubnetCheck() {
    const publicPrivateSubnetCheck = document.getElementById("public-private-subnet")
    const publicSubnetCheck = document.getElementById("public-subnet").checked
    if (publicSubnetCheck == true) {
        publicPrivateSubnetCheck.checked = false
        document.getElementById("private-subnet-internet-container").style.display = "none"
    }
}