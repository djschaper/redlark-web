const port = process.env.PORT || 3000
const https = require('https')
const http = require('http')
const url = require('url')
const fs = require('fs')
const path = require('path')
const qs = require('querystring')

const glob = require('glob')
const AWS = require('aws-sdk')
const { autoUpdater } = require("electron-updater")

const { authorizeRoute } = require('./lib/auth')
const settings = require('./lib/settings')
const version = require('../package.json').version

const SERVING_FOLDERS = [
    'styles',
    'assets',
    'scripts',
    'pages'
]
const PROXY_SERVING_FOLDERS = {
    modules: path.join(__dirname, '../node_modules'),
    download: null
}

console.info = (message) => console.log('[INFO] ' + message)

const S3 = new AWS.S3()

const registeredRoutes = []
const registerAllRoutes = () => {
    const registerRoute = (route) => registeredRoutes.push(route)
    const routeFiles = glob.sync(path.join(__dirname, 'routes/**/*.js'))
    routeFiles.forEach(file => registerRoute(require(file).route))
}

const parseJSON = (str) => {
    try {
        return JSON.parse(str)
    } catch (err) {
        console.log('Error parsing JSON body')
        console.log(err)
        return {}
    }
}

const parseFormURLEncoded = (str) => {
    return qs.parse(str)
}

const serve = (request, reply) => {
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
            if (SERVING_FOLDERS.includes(folder) || folder in PROXY_SERVING_FOLDERS) {
                const decodedPath = decodeURIComponent(request.path)
                let relativeFilePath = path.join(__dirname, decodedPath)
                if (folder in PROXY_SERVING_FOLDERS) {
                    relativeFilePath = path.join(PROXY_SERVING_FOLDERS[folder], ...decodedPath.split('/').slice(2))
                }
                
                const file = fs.readFileSync(relativeFilePath)
                const extension = path.extname(relativeFilePath)
                let contentType = 'text/plain'
                switch (extension) {
                    case '.css':
                        contentType = 'text/css'
                        break
                    case '.js':
                        contentType = 'application/javascript'
                        break
                    case '.ico':
                        contentType = 'image/x-icon'
                        break
                    case '.png', '.gif':
                        contentType = `image/${extension.replace('.', '')}`
                        break
                    case '.html':
                        contentType = 'text/html'
                        break
                    case '.pdf':
                        contentType = 'application/pdf'
                        break
                }
                reply.setHeader('content-type', contentType)
                reply.write(file)
                return reply.end()
            }

            // 404 - Not Found
            console.log('Route not found.')
            reply.writeHead(404)
            reply.write(`<body><p>Route not found. Thanks for coming out.</p>
                        <p>${request.method} ${request.url} (path: ${request.path})</p>
                        <p>Available routes: ${registeredRoutes.map((route) => route.path)}</p>
                        </body>
            `)
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
                if (request.headers['content-type'] && request.headers['content-type'].includes('application/json')) {
                    request.body = parseJSON(request.body)
                } else if (request.headers['content-type'] && request.headers['content-type'].includes('application/x-www-form-urlencoded')) {
                    request.body = parseFormURLEncoded(request.body)
                }

                // Route request to handler
                return route.handler(request, reply)
            })
    })
}

let server
const useHTTPS = process.env.USE_HTTPS === 'true'
const baseURL = `http${useHTTPS ? 's' : ''}://127.0.0.1:${port}`

async function createServer() {
    if (!useHTTPS) {
        server = http.createServer(serve)
        return
    }

    let options
    if (process.env.IS_LOCAL === 'true') {
        options = {
            key: fs.readFileSync('../test-certs/server.key'),
            cert: fs.readFileSync('../test-certs/server.crt')
        }
    } else {
        async function getFileBuffer(fileName) {
            const params = {
                Bucket: process.env.EBS_BUCKET,
                Key: fileName
            }

            const response = await S3.getObject(params, (err) => {
                if (err) {
                    console.log(`Error retrieving private key: ${err}`)
                }
            }).promise()

            return response.Body
        }

        options = {
            key: await getPrivateKey('server.key'),
            cert: await getPrivateKey('server.crt')
        }
    }

    server = https.createServer(options, serve)
}

const startServer = () => {
    // Listen on port 3000, IP defaults to 127.0.0.1
    server.listen(port)

    // Put a friendly message on the terminal
    console.log(`Server running at ${baseURL}`)

    registerAllRoutes()
}

///// Electron Desktop App /////////////////////////////////////////
const { app, BrowserWindow } = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
const width = 1200;
const height = 700;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true
        },
        title: `Redlark ${version}`
    })
    // mainWindow.maximize()

    // and load the index.html of the app.
    mainWindow.loadURL(baseURL)

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    settings.init({
        appData: app.getPath('appData'),
        userData: app.getPath('userData'),
        temp: app.getPath('temp'),
        logs: app.getPath('logs')
    })

    PROXY_SERVING_FOLDERS.download = app.getPath('temp')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow()
})

return createServer()
    .then(() => {
        startServer()

        // Check for app updates
        return  autoUpdater.checkForUpdatesAndNotify()
    })