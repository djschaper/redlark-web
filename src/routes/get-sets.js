const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')
const opensong = require('../lib/opensong')

const SET_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/set.html')
const SETS_SUB_FOLDER = "Sets"

const handler = (request, reply) => {
    const openSongFolder = path.join(settings.get(settings.dict.OPENSONG_FOLDER), SETS_SUB_FOLDER)
    var files = []
    if (fs.existsSync(openSongFolder)) {
        files = fs.readdirSync(openSongFolder)
    } else {
        console.log(`OpenSong Sets folder "${openSongFolder}" does not exist`)
    }
    
    const setFiles = files.filter(file => file.indexOf('.') < 0)
    setFiles.sort().reverse()

    const setList = cheerio.load('<ul></ul>')('ul')
    const template = cheerio.load(fs.readFileSync(SET_HTML_TEMPLATE_PATH))
    setFiles.reduce((acc, val) => {
        const id = 'id_set_' + val.replace(/\W/g, '-').toLowerCase()

        // Save id-filepath relationship for later access
        opensong.idToPath[id] = path.join(openSongFolder, val)

        // Build HTML element
        const set = template('.set').clone()
        set.attr('id', id)
        set.find('.set-name').text(val)
        acc.append(set)
        return acc
    },
        setList
    )

    reply.setHeader('content-type', 'text/html')
    reply.writeHead(200)
    reply.write(setList.html())
    return reply.end()
}

const route = {
    method: 'GET',
    path: '/sets',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}