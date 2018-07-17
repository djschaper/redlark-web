const redirect = (request, reply, redirectPath) => {
    reply.writeHead(303, {
        Location: "http" + (request.socket.encrypted ? "s" : "") + "://" + request.headers.host + redirectPath
    })
    return reply.end()
}

const getCookie = (request, key) => {
    const cookieJar = request.headers['cookie']
    if (!cookieJar) return null

    if (!cookieJar.includes(key)) return null

    sessionCookie = cookieJar.split(';').find(cookie => cookie.includes(key))
    const value = sessionCookie.split('=')[1].trim()

    if (value === 'true') {
        return true
    } else if (value === 'false') {
        return false
    } else {
        return value
    }
}

const setCookie = (reply, key, value) => {
    let stringValue = value
    if (typeof stringValue !== 'string') stringValue = JSON.stringify(stringValue)

    let pendingCookies = reply.getHeader('set-cookie')
    if (!pendingCookies) pendingCookies = []
    pendingCookies.push(`${key}=${stringValue}`)

    reply.setHeader('set-cookie', pendingCookies)
}

module.exports = {
    redirect,
    getCookie,
    setCookie
}