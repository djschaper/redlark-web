const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const gdrive = require('../lib/gdrive')
const { AUTH_METHODS } = require('../lib/auth')

const SONG_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/song.html')

const handler = (request, reply) =>
    gdrive.findFolder('Worship Songs')
        .then((folder) => {
            if (!folder) return Promise.resolve([])
            return gdrive.listFoldersInFolder(folder.id)
        })
        .then((folders) => {
            folders = folders.filter(folder => !folder.name.startsWith('_'))
            folders.sort((a, b) => {
                const aName = a.name.toLowerCase()
                const bName = b.name.toLowerCase()
                if (aName < bName) return -1
                else if (aName > bName) return 1
                else return 0
            })

            const songList = cheerio.load('<ul></ul>')('ul')
            const template = cheerio.load(fs.readFileSync(SONG_HTML_TEMPLATE_PATH))
            folders.reduce((acc, val) => {
                const song = template('.song').clone()
                song.attr('id', val.id)
                song.find('.song-title').text(val.name)
                acc.append(song)
                return acc
            },
                songList
            )

            reply.setHeader('content-type', 'text/html')
            reply.writeHead(200)
            reply.write(songList.html())
            return reply.end()
        })

const route = {
    method: 'GET',
    path: '/songs',
    auth: [AUTH_METHODS.MEMBER],
    handler
}

module.exports = {
    route
}