const port = process.env.PORT || 3000
const http = require('http')
const url = require('url')
const fs = require('fs')
const glob = require('glob')

const sequelize = require('./sequelize')

const registeredRoutes = []
const registerAllRoutes = () => {
    const registerRoute = (route) => registeredRoutes.push(route)
    const routeFiles = glob.sync('./routes/**/*.js')
    routeFiles.forEach(file => registerRoute(require(file).route))
}

const parseJSON = (str) => {
    try {
        return JSON.parse(request.body)
    } catch (err) {
        return {}
    }
}

const parseFormURLEncoded = (str) => {
    const elements = str.split('&');
    return elements.reduce((acc, val) => {
        const [key, value] = val.split('=')
        acc[key] = decodeURIComponent(value)
        return acc
    }, {})
}

const server = http.createServer((request, reply) => {
    const details = url.parse(request.url, true)
    request.path = details.pathname
    request.query = details.query
    
    request.body = ''
    request.on('data', (chunk) => {
        request.body += chunk
    })

    request.on('end', () => {
        // Log request details
        console.log(`Request: ${request.method} ${request.url}`)
        console.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`)

        // Try find route
        const matchedRoutes = registeredRoutes.filter(route =>
            route.path === request.path &&
            route.method === request.method
        )

        // Route does not exist
        if (matchedRoutes.length !== 1) {
            console.log('Route not found.')
            reply.writeHead(404)
            reply.write('<body>Route not found. Thanks for coming out.</body>')
            return reply.end()
        }

        // Pre-process request data
        if (request.headers['content-type'] === 'application/json') {
            request.body = parseJSON(request.body)
        } else if (request.headers['content-type'] === 'application/x-www-form-urlencoded') {
            request.body = parseFormURLEncoded(request.body)
        }

        // Route request to handler
        matchedRoutes[0].handler(request, reply)
    })
})

const startServer = () => {
    sequelize.init()

    // Listen on port 3000, IP defaults to 127.0.0.1
    server.listen(port)

    // Put a friendly message on the terminal
    console.log('Server running at http://127.0.0.1:' + port + '/')

    registerAllRoutes()
}

startServer()
