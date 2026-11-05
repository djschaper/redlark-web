const querystring = require('querystring');

const { AUTH_METHODS } = require('../lib/auth')
const { redirect } = require('../lib/server')
const settings = require('../lib/settings')

const handler = (request, reply) => {
    const settingsJSON = settings.keys.reduce((acc, val) => {
        console.log(val)
        acc[val] = querystring.unescape(request.body[val])
        return acc
    }, {})

    settings.setAll(settingsJSON)
    console.log(JSON.stringify(settingsJSON))

    // Return to settings page
    redirect(request, reply, '/settings')
}

const route = {
    method: 'POST',
    path: '/settings',
    auth: [AUTH_METHODS.NONE],
    handler
}

module.exports = {
    route
}