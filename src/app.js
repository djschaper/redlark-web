const port = process.env.PORT || 3000
const http = require('http')
const url = require('url')
const fs = require('fs')
const glob = require('glob')

const { authorizeRoute } = require('./lib/auth')

const SERVING_FOLDERS = [
    'styles',
    'assets'
]

console.info = (message) => console.log('[INFO] ' + message)

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
        console.info(`Request: ${request.method} ${request.url}`)
        console.info(`Headers: ${JSON.stringify(request.headers, null, 2)}`)

        // Try find route
        const matchedRoutes = registeredRoutes.filter(route =>
            route.path === request.path &&
            route.method === request.method
        )

        // Pre-registered route does not exist
        if (matchedRoutes.length !== 1) {

            // See if the path is a servable file
            const folder = request.path.split('/')[1]
            if (SERVING_FOLDERS.includes(folder)) {
                const relativeFilePath = '.' + request.path
                const file = fs.readFileSync(relativeFilePath)
                reply.write(file)
                return reply.end()
            }

            // 404 - Not Found
            console.log('Route not found.')
            reply.writeHead(404)
            reply.write('<body>Route not found. Thanks for coming out.</body>')
            return reply.end()
        }

        const route = matchedRoutes[0]

        // Check authentication
        return authorizeRoute(request, route.auth)
            .then((authorized) => {

                // Respond with forbidden if auth failed
                if (!authorized) {
                    console.log('User forbidden.')
                    reply.writeHead(403)
                    reply.write('<body>You shall not pass</body>')
                    return reply.end()
                }

                // Pre-process request data
                if (request.headers['content-type'] === 'application/json') {
                    request.body = parseJSON(request.body)
                } else if (request.headers['content-type'] === 'application/x-www-form-urlencoded') {
                    request.body = parseFormURLEncoded(request.body)
                }

                // Route request to handler
                return route.handler(request, reply)
            })
    })
})

const startServer = () => {
    // Listen on port 3000, IP defaults to 127.0.0.1
    server.listen(port)

    // Put a friendly message on the terminal
    console.log('Server running at http://127.0.0.1:' + port + '/')

    registerAllRoutes()
}

startServer()
