const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const db = require('../sequelize/models')
const { AUTH_METHODS, AUTH_TYPES } = require('../lib/auth')

const RETURNED_FIELDS = ['id', 'name', 'updatedAt']
const SET_HTML_TEMPLATE_PATH = path.resolve(__dirname, '../pages/templates/set.html')

const handler = (request, reply) => {
    const userId = request.auth[AUTH_TYPES.MEMBER].userId
    return db.Set.findAll({
        where: { createdBy: userId },
        attributes: RETURNED_FIELDS
    })
        .then((sets) => {
            const setList = cheerio.load('<ul></ul>')('ul')
            const template = cheerio.load(fs.readFileSync(SET_HTML_TEMPLATE_PATH))
            sets.reduce((acc, val) => {
                const set = template('.set').clone()
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
        })
}

const route = {
    method: 'GET',
    path: '/sets',
    auth: [AUTH_METHODS.MEMBER],
    handler
}

module.exports = {
    route
}