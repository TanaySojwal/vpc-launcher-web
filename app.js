const vpcLauncherAPIUrl = 'https://fs9gjfj2ei.execute-api.us-east-1.amazonaws.com/cert'

function createVPC() {

    // hide submit button
    document.getElementById("submit").style.display = "none"


    var xhr = new XMLHttpRequest()

    const crossAccountRoleArn = document.getElementById('cross-account-role-arn').value
    const publicSubnetCheck = document.getElementById('public-subnet').checked
    const publicPrivateSubnetCheck = document.getElementById('public-private-subnet').checked
    const internetAccess = document.getElementById('private-subnet-internet').checked
    const vpcName = document.getElementById('vpc-name').value
    const region = document.getElementById('vpc-region').value
    const az = document.getElementById('vpc-az').value
    const enableIPv6 = document.getElementById('enable-ipv6').checked

    const isPublicOnly = publicSubnetCheck == true ? true : false

    if (crossAccountRoleArn == "") {
        document.getElementById("submit").style.display = "block"
        alert("Cross account role ARN is invalid!")
        return
    }
    if (publicSubnetCheck == false && publicPrivateSubnetCheck == false) {
        document.getElementById("submit").style.display = "block"
        alert("One of the VPC types should be checked!")
        return
    }
    if (vpcName == "") {
        document.getElementById("submit").style.display = "block"
        alert("VPC name is invalid!")
        return
    }
    if (region == "") {
        document.getElementById("submit").style.display = "block"
        alert("Region selected is invalid!")
        return
    }
    if (az == "") {
        document.getElementById("submit").style.display = "block"
        alert("AZs selected is invalid!")
        return
    }

    // add cross account role ARN to lambda execution role policy
    printNextLog("Adding cross account role ARN to lambda policy if not done already.")

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_AZS&region=${region}`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            console.log(result)
            var azList = result['azList']
            for (i = 0; i < azList.length; i++) {
                if (i >= az) delete azList[i]
            }
            printNextLog(`Attempting to create VPC with region=${region} and az=${azList.toString()}`)

            const vpcPayload = {
                crossAccountRoleArn,
                // isPublicOnly,
                // internetAccess,
                vpcName,
                region,
                // az,
                enableIPv6
            }
            xhr.open('POST', `${vpcLauncherAPIUrl}?action=CREATE_VPC`, true)
            xhr.send(JSON.stringify({vpcPayload}))
            xhr.onload = () => {
                if (xhr.status == 200) {
                    printNextLog("VPC created successfully!")
                } else {
                    printNextLog("An error occurred while creating VPC!")
                }
            }

        } else {
            printNextLog("An error occurred while fetching AZs!")
        }
    }

    return
}

function printNextLog(content) {
    var logsContainer = document.getElementById("logs-container")
    var date = new Date()
    logsContainer.innerHTML += `${date.toLocaleTimeString()} :: ${content}<br>`
}

function describeAllRegions() {
    var xhr = new XMLHttpRequest()
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
    var xhr = new XMLHttpRequest()
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
                for (i = 1; i <= result['azList'].length; i++) {
                    azSelect.options[itr++] = new Option(i, i)
                }
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