const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')
const opensong = require('../lib/opensong')

const SET_XML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/opensongSet.xml')
const SETS_SUB_FOLDER = "Sets"

const handler = (request, reply) => {
    const setName = request.body.setName
    const songs = request.body.songs

    const badReply = (message) => {
        reply.writeHead(400)
        reply.write(message)
        return reply.end()
    }

    if (!setName) {
        return badReply('Missing "setName" parameter in request body')
    }
    if (!songs) {
        return badReply('Missing "songs" parameter in request body')
    }

    const openSongFolder = path.join(settings.get(settings.dict.OPENSONG_FOLDER), SETS_SUB_FOLDER)
    const setFilepath = path.join(openSongFolder, setName)

    // Add the songs to the set template
    const template = fs.readFileSync(SET_XML_TEMPLATE_PATH)
    const $ = cheerio.load(template, { xmlMode: true })
    const songsParent = $('slide_groups')
    const blankSong = $('slide_group')
    blankSong.attr('path', settings.get(settings.dict.OPENSONG_SUBFOLDER) || '/')
    for (let song of songs) {
        const songElement = blankSong.clone()
        songElement.attr('name', opensong.getNameFromId(song.id))
        if (song.key) {
            songElement.attr('key', song.key)
        }
        songElement.appendTo(songsParent)
    }
    blankSong.remove()

    // Convert XML to string
    const setXML = $.xml()
    
    // Write XML to new set file
    fs.writeFileSync(setFilepath, setXML)
    
    reply.writeHead(200)
    return reply.end()
}

const route = {
    method: 'POST',
    path: '/set',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}