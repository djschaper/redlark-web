const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

const { AUTH_METHODS, AUTH_TYPES, getFailedLoginFlag } = require('../lib/auth')
const gdrive = require('../lib/gdrive')

const loginHTML = fs.readFileSync(path.resolve(__dirname, '../pages/login.html'))
const mainHTML = fs.readFileSync(path.resolve(__dirname, '../pages/home.html'))

const handler = (request, reply) => {
    let html = mainHTML

    if (!request.auth[AUTH_TYPES.MEMBER].authorized) {
        reply.writeHead(200)
        html = loginHTML
        if (getFailedLoginFlag(request)) {
            const $ = cheerio.load(html)
            $('#badLoginText').removeAttr('hidden')
            html = $.html()
        }
        reply.write(html)
        return reply.end()
    }

    return gdrive.findFolder('Worship Songs')
        .then((folder) => {
            if (!folder) return Promise.resolve([])
            return gdrive.listFoldersInFolder(folder.id)
        })
        .then((folders) => {
            const $ = cheerio.load(html)
            folders = folders.filter(folder => !folder.name.startsWith('_'))
            folders.sort((a, b) => {
                const aName = a.name.toLowerCase()
                const bName = b.name.toLowerCase()
                if (aName < bName) return -1
                else if (aName > bName) return 1
                else return 0
            })
            folders.forEach(folder => $('#song-list').append(`<li class="song" id="${folder.id}" draggable="true" ondragstart="drag(event)"><button onClick="getSongFiles('${folder.id}')"><span>${folder.name}</span><i class="fas fa-minus-circle remove"></i></button></li>`))
            html = $.html()

            reply.writeHead(200)
            reply.write(html)
            return reply.end()
        })
}

const route = {
    method: 'GET',
    path: '/',
    auth: [AUTH_METHODS.NONE, AUTH_METHODS.MEMBER],
    handler
}

module.exports = {
    route
}