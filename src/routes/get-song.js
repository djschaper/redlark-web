const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const handler = (request, reply) => {
    const songId = request.query.id
    const fullId = request.query.fullid
    let targetKey = request.query.key
    
    
    if (!songId) {
        reply.writeHead(400)
        reply.write('Required query parameter "id" missing.')
        reply.end()
    }

    const options = { embeddedId: songId }
    if (!!fullId) {
        options.embeddedFullId = fullId
    }
    if (!!targetKey) {
        options.targetKey = decodeURIComponent(targetKey)
    }

    const song = opensong.generateHTML(opensong.idToPath[songId], options)

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