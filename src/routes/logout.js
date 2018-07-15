const db = require('../sequelize/models')
const { AUTH_METHODS, deleteSession } = require('../lib/auth')
const { redirect } = require('../lib/server')

const handler = (request, reply) => deleteSession(request, reply)
    .then(() => redirect(request, reply, '/'))

const route = {
    method: 'POST',
    path: '/logout',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}