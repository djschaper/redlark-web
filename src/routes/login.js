const passwordHash = require('password-hash')
const fs = require('fs')
const path = require('path')

const db = require('../sequelize/models')

const mainHTML = fs.readFileSync(path.resolve(__dirname, '../pages/index.html'))

const respondSuccess = (reply) => {
    console.log('Successful login')
    reply.writeHead(200)
    reply.write(mainHTML)
    reply.end()
}

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

    return db.User.findOne({ where: { email } })
        .then((user) => {
            if (!user) return false

            return passwordHash.verify(password, user.passwordHash)
        })
        .then((verified) => {
            if (verified) {
                return respondSuccess(reply)
            } else {
                return respondFailure(reply)
            }
        })
}

const route = {
    method: 'POST',
    path: '/login',
    handler
}

module.exports = {
    route
}