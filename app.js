const vpcLauncherAPIUrl = 'https://fs9gjfj2ei.execute-api.us-east-1.amazonaws.com/cert'

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
    const workspace = document.getElementById('workspace').value
    const publicSubnetCheck = document.getElementById('public-subnet').checked
    const publicPrivateSubnetCheck = document.getElementById('public-private-subnet').checked
    const internetAccess = document.getElementById('private-subnet-internet').checked
    var vpcName = document.getElementById('vpc-name').value
    const region = document.getElementById('vpc-region').value
    const az = document.getElementById('vpc-az').value
    const enableIPv6 = document.getElementById('enable-ipv6').checked
    var email = document.getElementById("email").value

    const isPublicOnly = publicSubnetCheck == true ? true : false

    if (email == "") {
        document.getElementById("submit").style.display = "block"
        alert("Email is invalid!")
        return
    }
    if (crossAccountRoleArn == "") {
        document.getElementById("submit").style.display = "block"
        alert("Cross account role ARN is invalid!")
        return
    }
    if (workspace == "") {
        document.getElementById("submit").style.display = "block"
        alert("Workspace is invalid!")
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

    printNextLog("attempting to add cross account role ARN to lambda policy if not done already")
    printNextLog("sleeping for 20 seconds while policy changes are propagated...")
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=ADD_CROSS_ACC_POLICY_TO_ROLE&crossAccountRoleArn=${crossAccountRoleArn}`, true)
    xhr.send()
    xhr.onload = () => {
        
        document.getElementById("loader").style.display = "block"
        sleep(20000)
        document.getElementById("loader").style.display = "none"

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
                    printNextLog(`retrieving next CIDR for workspace = ${workspace}`)
                    xhr.open('GET', `${vpcLauncherAPIUrl}?action=GET_NEXT_CIDR_FOR_WKSPCS&workspace=${workspace}&email=${email}`, true)
                    xhr.send()
                    xhr.onload = () => {
                        printNextLog(`backend response > ${xhr.response}`)
                        if (xhr.status == 200) {
                            var nextCidr = JSON.parse(xhr.response)['nextCidr']
                            
                            var uuid = getUUID(5)
                            vpcName = vpcName.concat("-").concat(uuid)
        
                            printNextLog(`attempting to create VPC with name = ${vpcName} in region = ${region} with CIDR prefix = ${nextCidr}`)
        
                            const vpcPayload = {
                                crossAccountRoleArn,
                                // isPublicOnly,
                                // internetAccess,
                                vpcName,
                                region,
                                // az,
                                enableIPv6,
                                email,
                                nextCidr,
                                azList
                            }
                            xhr.open('POST', `${vpcLauncherAPIUrl}?action=CREATE_VPC`, true)
                            xhr.send(JSON.stringify({vpcPayload}))
                            document.getElementById("loader").style.display = "block"
                            printNextLog("sleeping for 1 min while resources are ready...")
                            xhr.onload = () => {
                                document.getElementById("loader").style.display = "none"
                                printNextLog(`backend response > ${xhr.response}`)
                                if (xhr.status == 200 && JSON.parse(xhr.response)['message'] == 'success') {
                                    
                                    var vpcId = JSON.parse(xhr.response)['vpcId']
                                    var eipList = JSON.parse(xhr.response)['eipList']
                                    var publicRouteTableId = JSON.parse(xhr.response)['publicRouteTableId']
                                    var i = 0
                                    azList.forEach(az => {
                                        printNextLog(`attempting to create subnet in az = ${az}`)
                                        var publicSubnetName = `public-subnet-${az}-${uuid}`
                                        var privateSubnetName = `private-subnet-${az}-${uuid}`
                                        var publicSubnetCidr = `${nextCidr}.0.${i}.0/24`
                                        i += 1
                                        var privateSubnetCidr = `${nextCidr}.0.${i}.0/24`
                                        i += 1
                                        var eip = eipList.pop()
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
                                            privateSubnetCidr,
                                            eip
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
                                    // showDeletePolicyButton()
                                    
                                    document.getElementById("loader").style.display = "none"
                                    
                                    printNextLog(`fetching subnets for vpcId = ${vpcId}`)
                                    xhr.open('GET', `${vpcLauncherAPIUrl}?action=GET_VPC_SUBNETS&crossAccountRoleArn=${crossAccountRoleArn}&region=${region}&vpcId=${vpcId}`, true)
                                    xhr.send()
                                    xhr.onload = () => {
                                        printNextLog(`backend response > ${xhr.response}`)
                                        if (xhr.status == 200) {
                                            if (JSON.parse(xhr.response)['subnets'].length > 0) {
                                                printNextLog(`Updating VPC CIDR for workspace = ${workspace}`)
                                                xhr.open('GET', `${vpcLauncherAPIUrl}?action=UPDATE_CIDR_FOR_WKSPCS&arn=${crossAccountRoleArn}&region=${region}&vpcName=${vpcName}&workspace=${workspace}&currentCidr=${nextCidr}&email=${email}`, true)
                                                xhr.send()
                                                xhr.onload = () => {
                                                    printNextLog(`backend response > ${xhr.response}`)
                                                }
                                            }
                                            
                                            deletePolicyFromRole()
                                            // printNextLog("process completed.")
                                        } else {
                                            printNextLog("An error occurred while fetching subnets!")
                                        }
                                        
                                    }
                                
                                } else {
                                    printNextLog("An error occurred while creating VPC!")
                                }
                            }
                        } else {
                            printNextLog("An error occurred while fetching next CIDR for workspace!")
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

function showDeletePolicyButton() {
    document.getElementById("delete-policy-button").style.display = "block"
}

function deletePolicyFromRole() {
    // Detach and delete policy from role here...
    printNextLog(`detaching and delete Cross Account Role Policy from Lambda role`)

    var xhr = new XMLHttpRequest()

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DELETE_CROSS_ACC_POLICY_FROM_ROLE`, true)
    xhr.send()
    xhr.onload = () => {
        printNextLog(`backend response > ${xhr.response}`)
        if (xhr.status == 200) {
            printNextLog("policy detached and deleted successfully")
            printNextLog("process completed!")
        } else {
            printNextLog('An error occurred while deleting policy.')
        }
    }
}

function reloadPage() {
    location.reload()
}

function printNextLog(content) {
    var logsContainer = document.getElementById("logs-container")
    var date = new Date()
    logsContainer.innerHTML += `<b>${date.toLocaleTimeString()}</b> :: ${content}<br>`
}

function onPageLoad() {
    describeAllRegions()
}

function onArnChange() {
    const arnSelect = document.getElementById('cross-account-role-arn')
    var addNewArnContainer = document.getElementById('add-new-arn-container')
    var selectedArn = arnSelect.options[arnSelect.selectedIndex].value

    if (selectedArn == '') {
        // do nothing
        addNewArnContainer.style.display = 'none'
        document.getElementById('delete-arn-button-container').style.display = 'none'
    } else if (selectedArn == 'add-new-arn') {
        // form for adding new ARN appears
        addNewArnContainer.style.display = 'block'
        document.getElementById('delete-arn-button-container').style.display = 'none'
    } else {
        // delete button appears as selected ARN is retrieved from backend
        document.getElementById('delete-arn-button-container').style.display = 'block'
        addNewArnContainer.style.display = 'none'
    }

}

function onWorkspaceChange() {
    const workspaceSelect = document.getElementById('workspace')
    var addNewWorkspaceContainer = document.getElementById('add-new-workspace-container')
    var selectedWorkspace = workspaceSelect.options[workspaceSelect.selectedIndex].value

    if (selectedWorkspace == '') {
        addNewWorkspaceContainer.style.display = 'none'
        document.getElementById('delete-workspace-button-container').style.display = 'none'
    } else if (selectedWorkspace == 'add-new-workspace') {
        addNewWorkspaceContainer.style.display = 'block'
        document.getElementById('delete-workspace-button-container').style.display = 'none'
    } else {
        document.getElementById('delete-workspace-button-container').style.display = 'block'
        addNewWorkspaceContainer.style.display = 'none'
    }
}

function deleteArnFromEmail() {
    const arnSelect = document.getElementById('cross-account-role-arn')
    var selectedArn = arnSelect.options[arnSelect.selectedIndex].value
    var email = document.getElementById("email").value
    if (email == "") {
        alert("Email is invalid!")
        return
    }
    if (selectedArn == "" || selectedArn == "add-new-arn") {
        alert("Cross account role ARN to delete is invalid!")
        return
    }

    // delete ARN from email
    var xhr = new XMLHttpRequest()
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DELETE_ARN_FROM_EMAIL&email=${email}&arn=${selectedArn}`, false)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['message'] == "success") {
                alert(`ARN deleted successfully`)
            }
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }

    // reload the page
    reloadPage()
}

function deleteWorkspaceFromEmail() {
    const workspaceSelect = document.getElementById('workspace')
    var selectedWorkspace = workspaceSelect.options[workspaceSelect.selectedIndex].value
    var email = document.getElementById("email").value

    if (email == "") {
        alert("Email is invalid!")
        return
    }
    if (selectedWorkspace == "" || selectedWorkspace == "add-new-workspace") {
        alert("Workspace to delete is invalid!")
        return
    }

    // delete workspace from email
    var xhr = new XMLHttpRequest()
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DELETE_WKSPCS_FROM_EMAIL&email=${email}&workspace=${selectedWorkspace}`, false)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['message'] == "success") {
                alert(`Workspace deleted successfully`)
            }
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }

    // reload the page
    reloadPage()
}

function addArnToEmail() {
    // hiding add arn form once submitted
    document.getElementById("add-new-arn-container").style.display = "none"
    var newArn = document.getElementById('new-arn').value
    var email = document.getElementById("email").value
    
    if (email == "") {
        alert("Email is invalid!")
        return
    }
    if (newArn == "") {
        document.getElementById("add-new-arn-container").style.display = "block"
        alert("New cross account role ARN is invalid!")
        return
    }

    // add ARN to email
    var xhr = new XMLHttpRequest()
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=ADD_ARN_TO_EMAIL&email=${email}&arn=${newArn}`, false)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['message'] == "success") {
                alert(`ARN added successfully`)
            }
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }

    // reload the page
    reloadPage()
}

function addWorkspaceToEmail() {
    // hiding add workspace form once submitted
    document.getElementById("add-new-workspace-container").style.display = "none"
    var newWorkspace = document.getElementById('new-workspace').value
    var email = document.getElementById("email").value
    
    if (email == "") {
        alert("Email is invalid!")
        return
    }

    if (newWorkspace == "") {
        document.getElementById("add-new-workspace-container").style.display = "block"
        alert("Workspace is invalid!")
        return
    }

    // add workspace to email
    var xhr = new XMLHttpRequest()
    xhr.open('GET', `${vpcLauncherAPIUrl}?action=ADD_WKSPCS_TO_EMAIL&email=${email}&workspace=${newWorkspace}`, false)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['message'] == "success") {
                alert(`Workspace added successfully`)
            }
        } else {
            alert(`An error occurred while fetching regions!`)
        }
    }

    // reload the page
    reloadPage()
}

function onEmailChange() {
    describeARNs()
    describeWorkspaces()
}

function describeWorkspaces() {
    var email = document.getElementById('email').value

    if (email == '') {
        alert("Email entered is invalid!")
        return
    }

    var xhr = new XMLHttpRequest()
    var workspaceSelect = document.getElementById('workspace')

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_WKSPCS_FOR_EMAIL&email=${email}`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['workspaces'].length > 0) {
                var length = workspaceSelect.options.length;
                for (i = length - 1; i > 0; i--) {
                    workspaceSelect.options[i] = null;
                }
                var itr = 1
                workspaceSelect.options[itr++] = new Option("Add new workspace", "add-new-workspace")
                result['workspaces'].forEach(element => {
                    workspaceSelect.options[itr++] = new Option(element, element)    
                })
            }
        } else {
            alert(`An error occurred while fetching workspaces!`)
        }
    }
}

function describeARNs() {

    var email = document.getElementById('email').value

    if (email == '') {
        alert("Email entered is invalid!")
        return
    }

    var xhr = new XMLHttpRequest()
    var arnSelect = document.getElementById('cross-account-role-arn')

    xhr.open('GET', `${vpcLauncherAPIUrl}?action=DESCRIBE_ARNS_FOR_EMAIL&email=${email}`, true)
    xhr.send()
    xhr.onload = () => {
        if (xhr.status == 200) {
            var result = JSON.parse(xhr.response)
            if (result['arns'].length > 0) {
                var length = arnSelect.options.length;
                for (i = length - 1; i > 0; i--) {
                    arnSelect.options[i] = null;
                }
                var itr = 1
                arnSelect.options[itr++] = new Option("Add new ARN", "add-new-arn")
                result['arns'].forEach(element => {
                    arnSelect.options[itr++] = new Option(element, element)    
                })
            }
        } else {
            alert(`An error occurred while fetching arns!`)
        }
    }
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