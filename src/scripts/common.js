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
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            params.handler(xhttp.response)
        }
    }
    xhttp.open(params.method, params.route, true)
    xhttp.send(params.body)
}