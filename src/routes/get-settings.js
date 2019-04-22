const fs = require('fs')
const path = require('path')

const { applyMainPageTemplate } = require('../lib/html')
const { AUTH_METHODS } = require('../lib/auth')

const settingsHTML = fs.readFileSync(path.resolve(__dirname, '../pages/settings.html'))

const handler = (request, reply) => {
    const html = applyMainPageTemplate(settingsHTML)

    reply.writeHead(200)
    reply.write(html)
    reply.end()
}

const route = {
    method: 'GET',
    path: '/settings',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}