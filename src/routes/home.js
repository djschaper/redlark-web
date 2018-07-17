const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

const { AUTH_METHODS, AUTH_TYPES, getFailedLoginFlag } = require('../lib/auth')

const loginHTML = fs.readFileSync(path.resolve(__dirname, '../pages/login.html'))
const mainHTML = fs.readFileSync(path.resolve(__dirname, '../pages/index.html'))

const handler = (request, reply) => {
    if (!request.auth[AUTH_TYPES.MEMBER].authorized) {
        reply.writeHead(200)
        let html = loginHTML
        if (getFailedLoginFlag(request)) {
            const $ = cheerio.load(html)
            $('#badLoginText').removeAttr('hidden')
            html = $.html()
        }
        reply.write(html)
        return reply.end()
    }

    reply.writeHead(200)
    reply.write(mainHTML)
    return reply.end()
}

const route = {
    method: 'GET',
    path: '/',
    auth: [AUTH_METHODS.NONE, AUTH_METHODS.MEMBER],
    handler
}

module.exports = {
    route
}