const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')

const { AUTH_METHODS } = require('../lib/auth')
const opensong = require('../lib/opensong')

const SET_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/set.html')

const handler = (request, reply) => {
    const sets = opensong.getAllSetNamesAndIds()

    const setList = cheerio.load('<ul></ul>')('ul')
    const template = cheerio.load(fs.readFileSync(SET_HTML_TEMPLATE_PATH))
    sets.reduce((acc, val) => {
        // Build HTML element
        const set = template('.set').clone()
        set.attr('id', val.id)
        set.find('.set-name').text(val.name)
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