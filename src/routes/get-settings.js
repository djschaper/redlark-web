const fs = require('fs')
const path = require('path')

const cheerio = require('cheerio')

const { applyMainPageTemplate } = require('../lib/html')
const { AUTH_METHODS } = require('../lib/auth')
const settings = require('../lib/settings')

const settingsHTML = fs.readFileSync(path.resolve(__dirname, '../pages/settings.html'))

const handler = (request, reply) => {
    const html = applyMainPageTemplate(settingsHTML)

    const $ = cheerio.load(html)

    console.log(settings.keys)
    settings.keys.forEach(key => $(`#${key}`).attr('value', settings.get(key)))

    reply.writeHead(200)
    reply.write($.html())
    reply.end()
}

const route = {
    method: 'GET',
    path: '/settings',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}