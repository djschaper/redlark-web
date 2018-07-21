const gdrive = require('../lib/gdrive')
const { AUTH_METHODS } = require('../lib/auth')

const handler = (request, reply) => {
    const songFolderId = request.query.folder
    if (songFolderId) {
        const key = request.query.key
        return gdrive.listFilesInFolder(songFolderId, 'pdf')
            .then(files => {
                console.log(JSON.stringify(files))
                const file = files[0]
                const viewLink = files[0].webViewLink
                const previewLink = viewLink.substring(0, viewLink.indexOf('view?')) + 'preview'
                reply.writeHead(200)
                reply.write(previewLink)
                return reply.end()
            })
    }

    reply.writeHead(200)
    reply.write('meh')
    reply.end()
}

const route = {
    method: 'GET',
    path: '/song',
    auth: [AUTH_METHODS.MEMBER],
    handler
}

module.exports = {
    route
}