const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')
const opensong = require('../lib/opensong')

const handler = (request, reply) => {
    const setId = request.query.id

    const songIds = []

    const finishReply = () => {
        reply.setHeader('content-type', 'application/json')
        reply.writeHead(200)
        reply.write(JSON.stringify(songIds))
        return reply.end()
    }

    const setFilepath = opensong.getPathFromId(setId)
    if (!setFilepath) {
        console.log(`Set filepath not found for set id: ${setId}`)
        return finishReply()
    }

    const setXML = fs.readFileSync(setFilepath)
    const $ = cheerio.load(setXML)
    const songNames = Array.from($('slide_group')).map((song) => song.attribs['name'])
    songNames.reduce((acc, val) => {
        const id = opensong.getIdFromName(val)
        if (id) {
            acc.push(id)
        } else {
            console.log(`Could not find id for song: ${val}`)
        }
        return acc
    },
        songIds
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