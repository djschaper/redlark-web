const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')
const opensong = require('../lib/opensong')

const handler = (request, reply) => {
    const setId = request.query.id

    const songs = []

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

    const setXML = fs.readFileSync(setFilepath)
    const $ = cheerio.load(setXML, { xmlMode: true })
    const setSongs = Array.from($('slide_group')).map((song) =>
        ({
            name: song.attribs['name'],
            key: song.attribs['key']
        })
    )
    setSongs.reduce((acc, val) => {
        const song = {
            id: opensong.getIdFromName(val.name),
            key: val.key
        }
        if (song.id) {
            acc.push(song)
        } else {
            console.log(`Could not find id for song: ${val.name}`)
        }
        return acc
    },
        songs
    )

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