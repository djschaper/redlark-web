const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const handler = (request, reply) => {
    const setId = request.query.id

    let songs = []

    const finishReply = () => {
        reply.setHeader('content-type', 'application/json')
        reply.writeHead(200)
        reply.write(JSON.stringify(songs))
        return reply.end()
    }

    const setFilepath = opensong.getPathFromId(setId)
    if (!setFilepath) {
        console.log(`Set filepath not found for set id: ${setId}`)
        return finishReply()
    }

    songs = opensong.getSetSongs(setFilepath)

    return finishReply()
}

const route = {
    method: 'GET',
    path: '/set',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}