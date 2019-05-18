const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')
const opensong = require('../lib/opensong')

const SONG_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/song.html')
const SONGS_SUB_FOLDER = "Songs"

const handler = (request, reply) => {
    const openSongFolder = path.join(settings.get(settings.dict.OPENSONG_FOLDER), SONGS_SUB_FOLDER)
    var files = []
    if (fs.existsSync(openSongFolder)) {
        files = fs.readdirSync(openSongFolder)
    } else {
        console.log(`OpenSong Songs folder "${openSongFolder}" does not exist`)
    }
    
    const openSongFiles = files.filter(file => file.indexOf('.') < 0)

    const songList = cheerio.load('<ul></ul>')('ul')
    const template = cheerio.load(fs.readFileSync(SONG_HTML_TEMPLATE_PATH))
    openSongFiles.reduce((acc, val) => {
        const id = val.replace(/\W/g, '-').toLowerCase()

        // Save id-filepath relationship for later access
        opensong.idToPath[id] = path.join(openSongFolder, val)

        // Build HTML element
        const song = template('.song').clone()
        song.attr('id', id)
        song.find('.song-title').text(val)
        acc.append(song)
        return acc
    },
        songList
    )

    reply.setHeader('content-type', 'text/html')
    reply.writeHead(200)
    reply.write(songList.html())
    return reply.end()
}

const route = {
    method: 'GET',
    path: '/songs',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}