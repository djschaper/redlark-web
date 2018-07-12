const fs = require('fs')
const path = require('path')

const loginHTML = fs.readFileSync(path.resolve(__dirname, '../pages/login.html'))

const handler = (request, reply) => {
    reply.writeHead(200)
    reply.write(loginHTML)
    reply.end()
}

const route = {
    method: 'GET',
    path: '/',
    handler
}

module.exports = {
    route
}