const path = require('path')
const fs = require('fs')

const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')
const settings = require('../lib/settings')
const pdf = require('../lib/pdf')
const server = require('../lib/server')

const DOWNLOAD_ROUTE_BASE = '/download/'

const handler = (request, reply) => {
    console.log(JSON.stringify(request.body))
    const setName = request.body.name
    const songs = request.body.songs
    const print = request.body.print

    if (!setName) {
        return server.respond.missingParameter('name')
    }
    if (!songs) {
        return server.respond.missingParameter('songs')
    }
    if (print == null) {
        return server.respond.missingParameter('print')
    }

    const songsAndOptions = songs.map(song =>
        ({
            file: opensong.getPathFromId(song.id),
            options: { targetKey: song.key }
        })
    )
    
    const setHTML = opensong.generateSetHTML(songsAndOptions)
    
    if (print) {
        reply.setHeader('content-type', 'text/html')
        reply.writeHead(200)
        reply.write(setHTML)
        return reply.end()
    } else {
        const tmpFilename = setName + '.pdf'
        const tmpFilepath = path.join(settings.getPath('temp'), tmpFilename)

        return pdf.savePDF(tmpFilepath, setHTML)
            .then(() => {
                // Respond with link for client to download file from
                reply.setHeader('content-type', 'application/json')
                reply.writeHead(200)
                reply.write(JSON.stringify({
                    download: DOWNLOAD_ROUTE_BASE + tmpFilename,
                    name: tmpFilename
                }))
                return reply.end()
            })
            .catch((err) => {
                console.log('Error writing song file:')
                console.log(err)

                reply.writeHead(500)
                reply.write('There was an error writing the requested file')
                return reply.end()
            })
    }
}

const route = {
    method: 'POST',
    path: '/set/file',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}