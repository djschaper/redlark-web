const puppeteer = require('puppeteer')

const path = require('path')
const fs = require('fs')

const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const EXTENSIONS = {
    pdf: ".pdf",
    html: ".html"
}
const TMP_FOLDER = path.resolve(__dirname, '../download')
const DOWNLOAD_ROUTE_BASE = '/download/'

const handler = (request, reply) => {
    const songId = request.body.id
    const format = request.body.format
    const key = request.body.key
    
    if (!songId) {
        reply.writeHead(400)
        reply.write('Required query parameter "id" missing.')
        reply.end()
    }
    if (!format) {
        reply.writeHead(400)
        reply.write('Required query parameter "format" missing.')
        reply.end()
    }
    if (!(format in EXTENSIONS)) {
        reply.writeHead(400)
        reply.write(`Format not valid: ${format}`)
        reply.end()
    }

    const song = opensong.generateHTML(opensong.idToPath[songId], { targetKey: key })
    
    let tmpFilename = path.basename(opensong.idToPath[songId]) + EXTENSIONS[format]
    if (format === 'pdf') {
        tmpFilename = path.basename(opensong.idToPath[songId]) + ' - ' + song.key + EXTENSIONS[format]
    }
    const tmpFilepath = path.join(TMP_FOLDER, tmpFilename)

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
        let browser
        let page
        return puppeteer.launch()
            .then((res) => {
                browser = res
                return browser.newPage()
            })
            .then((res) => {
                page = res
                return page.setContent(song.html)
            })
            .then(() => page.pdf({
                path: tmpFilepath,
                format: 'Letter',
                margin: {
                    top: '0.5in',
                    bottom: '0.3in',
                    left: '0.5in',
                    right: '0.5in'
                }
            }))
            .then(() => browser.close())
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