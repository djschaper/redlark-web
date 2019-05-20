const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const handler = (request, reply) => {
    const songId = request.query.id
    
    if (!songId) {
        reply.writeHead(400)
        reply.write('Required query parameter "id" missing.')
        reply.end()
    }

    const song = opensong.generateHTML(opensong.idToPath[songId], { embeddedId: songId })

    reply.setHeader('content-type', 'text/html')
    reply.writeHead(200)
    reply.write(song.html)
    return reply.end()
}

const route = {
    method: 'GET',
    path: '/song',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}