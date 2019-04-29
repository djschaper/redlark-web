const querystring = require('querystring');

const { AUTH_METHODS } = require('../lib/auth')
const { redirect } = require('../lib/server')
const { setAll, keys } = require('../lib/settings')

const handler = (request, reply) => {
    console.log('Received: ' + JSON.stringify(request.body, null, 2))

    console.log(JSON.stringify(keys))
    const settingsJSON = keys.reduce((acc, val) => {
        console.log(val)
        acc[val] = querystring.unescape(request.body[val])
        return acc
    }, {})

    setAll(settingsJSON)
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