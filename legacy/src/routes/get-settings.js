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

    Object.values(settings.raw).forEach(setting => {
        const key = setting.key
        const value = settings.get(setting.key)
        
        if (setting.type == 'text') {
            $(`#${key}`).attr('value', value)
        } else if (setting.type == 'radio') {
            if (value == undefined || value === 'undefined') {
                return
            }
            $(`#${key}-${value}`).attr('checked', '')
        } else if (setting.type == 'checkbox') {
            if (value != 'undefined') {
                $(`#${key}`).attr('checked', '')
            }
        }
    })

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