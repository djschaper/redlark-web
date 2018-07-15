const { AUTH_METHODS } = require('../lib/auth')

const handler = (request, reply) => {
    reply.writeHead(200)
    reply.write('<body>Hello!</body>')
    reply.end()
}

const route = {
    method: 'GET',
    path: '/hello',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}