const path = require('path')
const fs = require('fs')

const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')
const settings = require('../lib/settings')
const pdf = require('../lib/pdf')
const server = require('../lib/server')

const EXTENSIONS = {
    pdf: ".pdf",
    html: ".html"
}
const DOWNLOAD_ROUTE_BASE = '/download/'

const handler = (request, reply) => {
    const songId = request.body.id
    const format = request.body.format
    const key = request.body.key
    
    const respondBad = (message) => {
        reply.writeHead(400)
        reply.write(message)
        return reply.end()
    }

    if (!songId) {
        return server.respond.missingParameter(reply, 'id')
    }
    if (!format) {
        return server.respond.missingParameter(reply, 'format')
    }
    if (!(format in EXTENSIONS)) {
        return server.respond.badRequest(reply, `Format not valid: ${format}`)
    }

    const opensongFilepath = opensong.getPathFromId(songId)
    const song = opensong.generateHTML(opensongFilepath, { targetKey: key })
    
    let tmpFilename = path.basename(opensongFilepath) + EXTENSIONS[format]
    if (format === 'pdf') {
        tmpFilename = path.basename(opensongFilepath) + ' - ' + song.key + EXTENSIONS[format]
    }
    const tmpFilepath = path.join(settings.getPath('temp'), tmpFilename)

    const respond = (err) => {
        if (err) {
            console.log('Error writing song file:')
            console.log(err)

            reply.writeHead(500)
            reply.write('There was an error writing the requested file')
            return reply.end()
        }

        // Respond with link for client to download file from
        reply.setHeader('content-type', 'application/json')
        reply.writeHead(200)
        reply.write(JSON.stringify({ download: DOWNLOAD_ROUTE_BASE + tmpFilename }))
        return reply.end()
    }

    // Write files and then use callback to finish response
    if (format === 'pdf') {
        return pdf.savePDF(tmpFilepath, song.html)
            .then(() => respond())
    } else {
        fs.writeFileSync(tmpFilepath, song.html)
        return respond()
    }
}

const route = {
    method: 'POST',
    path: '/song/file',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}