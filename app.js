const vpcLauncherAPIUrl = 'https://fs9gjfj2ei.execute-api.us-east-1.amazonaws.com/cert'
const vpcLauncherHelper = 'https://0x7zt4osma.execute-api.us-east-1.amazonaws.com/cert'

function getUUID(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

function createVPC() {

    // hide submit button on submit to prevent resubmission
    document.getElementById("submit").style.display = "none"

    var xhr = new XMLHttpRequest()

    const crossAccountRoleArn = document.getElementById('cross-account-role-arn').value
    const publicSubnetCheck = document.getElementById('public-subnet').checked
    const publicPrivateSubnetCheck = document.getElementById('public-private-subnet').checked
    const internetAccess = document.getElementById('private-subnet-internet').checked
    var vpcName = document.getElementById('vpc-name').value
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

    printNextLog("attempting to add cross account role ARN to lambda policy if not done already.")

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=ADD_CROSS_ACC_POLICY_TO_ROLE&crossAccountRoleArn=${crossAccountRoleArn}`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            printNextLog(`backend response > ${xhr.response}`)
            
            xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_AZS&region=${region}`, true)
            xhr.send()
            xhr.onload = () => {
                if (xhr.status == 200) {
                    
                    var result = JSON.parse(xhr.response)
                    var azList = []
                    if (result['azList'].length >= az) {
                        for (i = 0; i < az; i++) {
                            azList.push(result['azList'][i])
                        }
                    } else {
                        alert("Invalid AZ value!")
                    }
                    var uuid = getUUID(5)
                    vpcName = vpcName.concat("-").concat(uuid)

                    printNextLog(`attempting to create VPC with name = ${vpcName} in region = ${region}`)

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
                    document.getElementById("loader").style.display = "block"
                    printNextLog("Sleeping for 1 min while resources are ready...")
                    xhr.onload = () => {
                        document.getElementById("loader").style.display = "none"
                        printNextLog(`backend response > ${xhr.response}`)
                        if (xhr.status == 200) {
                            
                            var vpcId = JSON.parse(xhr.response)['vpcId']
                            var publicRouteTableId = JSON.parse(xhr.response)['publicRouteTableId']
                            // return
                            var i = 0
                            azList.forEach(az => {
                                printNextLog(`attempting to create subnet in az = ${az}`)
                                var publicSubnetName = `public-subnet-${az}-${uuid}`
                                var privateSubnetName = `private-subnet-${az}-${uuid}`
                                var publicSubnetCidr = `10.0.${i}.0/24`
                                i += 1
                                var privateSubnetCidr = `10.0.${i}.0/24`
                                i += 1
                                var subnetPayload = {
                                    crossAccountRoleArn,
                                    isPublicOnly,
                                    internetAccess,
                                    vpcId,
                                    publicRouteTableId,
                                    region,
                                    az,
                                    publicSubnetName,
                                    privateSubnetName,
                                    publicSubnetCidr,
                                    privateSubnetCidr
                                }
                                try {
                                    xhr.open('POST', `${vpcLauncherAPIUrl}/create-subnet`, true)
                                    xhr.send(JSON.stringify({subnetPayload}))
                                    xhr.onload = () => {
                                        printNextLog(`backend response > ${xhr.response}`)
                                        if (xhr.status == 200) {
                                            return
                                        } else {
                                            printNextLog("An error occurred while creating subnet!")
                                            return
                                        }
                                    }
                                } catch (error) {
                                    console.log(error.message);
                                }
                            });

                            document.getElementById("loader").style.display = "block"
                            
                            sleep(60000)

                            showReloadButton()
                            document.getElementById("loader").style.display = "none"
                            
                            printNextLog(`Fetching subnets for vpcId = ${vpcId}`)
                            xhr.open('GET', `${vpcLauncherAPIUrl}?action=GET_VPC_SUBNETS&crossAccountRoleArn=${crossAccountRoleArn}&region=${region}&vpcId=${vpcId}`, true)
                            xhr.send()
                            xhr.onload = () => {
                                printNextLog(`backend response > ${xhr.response}`)
                                printNextLog("Process completed.")

                            }
                        
                        } else {
                            printNextLog("An error occurred while creating VPC!")
                        }
                    }

                } else {
                    printNextLog("An error occurred while fetching AZs!")
                }
            }
        } else {
            printNextLog("An error occurred while adding cross account role policy to lambda execution role!")
        }
    }
}

function sleep(ms) {
    const date = Date.now()
    let currentDate = null
    do {
        currentDate = Date.now()
    } while (currentDate - date < ms)
}

function showReloadButton() {
    document.getElementById("reload-button").style.display = "block"
}

function reloadPage() {
    location.reload()
}

function printNextLog(content) {
    var logsContainer = document.getElementById("logs-container")
    var date = new Date()
    logsContainer.innerHTML += `<b>${date.toLocaleTimeString()}</b> :: ${content}<br>`
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