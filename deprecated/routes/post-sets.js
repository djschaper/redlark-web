const db = require('../sequelize/models')
const { AUTH_METHODS, AUTH_TYPES } = require('../lib/auth')

const handler = (request, reply) => {
    const name = request.body.name
    const songs = request.body.songs
    const userId = request.auth[AUTH_TYPES.MEMBER].userId

    reply.writeHead(200)
    return reply.end()
}

const route = {
    method: 'POST',
    path: '/sets',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}