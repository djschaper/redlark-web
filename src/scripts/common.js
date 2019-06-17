const RESPONSE_TYPES = {
    XML: 'document',
    HTML: 'document',
    JSON: 'json',
    TEXT: 'text'
}

const ajax = (params) => {
    if (!params.method) params.method = 'GET'
    if (!params.type) params.type = RESPONSE_TYPES.JSON
    if (!params.handler) params.handler = (res) => { }

    const xhttp = new XMLHttpRequest()
    xhttp.responseType = params.type
    xhttp.onreadystatechange = () => {
        document.body.style.cursor = 'auto'
        
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            params.handler(xhttp.response)
        }
    }
    xhttp.open(params.method, params.route, true)
    if (params.headers) {
        for (let key of Object.keys(params.headers)) {
            xhttp.setRequestHeader(key, params.headers[key])
        }
    }
    xhttp.send(JSON.stringify(params.body))
}

const downloadLink = (link, suggestedFilename) => {
    const hiddenDownload = document.createElement('a')
    hiddenDownload.href = link
    hiddenDownload.download = suggestedFilename
    hiddenDownload.click()
    hiddenDownload.remove()
}

const printHTML = (html) => {
    console.log('Printing HTML:')
    console.log(html)

    const printContainer = document.getElementById('hidden-print-container')
    printContainer.setAttribute('srcdoc', html)
    printContainer.addEventListener('load', () => {
        printContainer.removeAttribute('srcdoc')
        printContainer.contentWindow.print()
    })
    
}
