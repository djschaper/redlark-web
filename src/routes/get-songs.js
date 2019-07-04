const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const SONG_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/song.html')
const RECENT_SET_THRESHOLD = 12

const handler = (request, reply) => {
    const openSongSongs = opensong.getAllSongNamesAndIds()

    const songList = cheerio.load('<ul></ul>')('ul')
    const template = cheerio.load(fs.readFileSync(SONG_HTML_TEMPLATE_PATH))
    openSongSongs.reduce((acc, val) => {
        recentSet = opensong.getMostRecentSetSongWasIn(val.name)

        // Build HTML element
        const song = template('.song').clone()
        song.attr('id', val.id)
        song.find('.song-title').text(val.name)
        if (recentSet) {
            song.attr('data-recent-set', recentSet.name)
            const recentPercentage = Math.max(0, (RECENT_SET_THRESHOLD - recentSet.index)/RECENT_SET_THRESHOLD)
            song.find('.recent').css('opacity', recentPercentage.toString())
        }
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