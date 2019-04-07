const gdrive = require('../lib/gdrive')
const { AUTH_METHODS } = require('../lib/auth')

const handler = (request, reply) => {
    const songFolderId = request.query.folder
    if (songFolderId) {
        const key = request.query.key
        return gdrive.listFilesInFolder(songFolderId, 'pdf')
            .then(files => {
                const songFiles = files.map(file => {
                    const viewLink = file.webViewLink
                    const link = viewLink.substring(0, viewLink.indexOf('view?')) + 'preview'

                    return {
                        link,
                        name: file.name
                    }
                })

                reply.writeHead(200)
                reply.write(JSON.stringify(songFiles))
                return reply.end()
            })
    }

    reply.writeHead(400)
    reply.write('Required query parameter "folder" missing.')
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