const passwordHash = require('password-hash')
const fs = require('fs')
const path = require('path')
const uuid = require('uuid')

const db = require('../sequelize/models')
const { AUTH_METHODS, generateSession, setFailedLoginFlag } = require('../lib/auth')
const { redirect } = require('../lib/server')

const respondFailure = (reply) => {
    console.log('Unsuccessful login')
    reply.writeHead(400)
    reply.write('<body>Failed to login</body>')
    reply.end()
}

const handler = (request, reply) => {
    const email = request.body.email
    const password = request.body.password
    if (!email || !password) {
        return respondFailure(reply)
    }

    let verifiedUser
    return db.User.findOne({ where: { email } })
        .then((user) => {
            if (!user) return false
            verifiedUser = user

            return passwordHash.verify(password, user.passwordHash)
        })
        .then((verified) => {
            if (verified) {
                setFailedLoginFlag(reply, false)
                return generateSession(verifiedUser.id, reply)
                    .then(() => redirect(request, reply, ''))
            } else {
                setFailedLoginFlag(reply, true)
                return redirect(request, reply, '')
            }
        })
}

const route = {
    method: 'POST',
    path: '/login',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}