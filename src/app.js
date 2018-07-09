const port = process.env.PORT || 3000
const http = require('http')
const fs = require('fs')
const verifyUser = require('./login').verifyUser
const sequelize = require('./sequelize')

const loginHTML = fs.readFileSync('./login.html')
const mainHTML = fs.readFileSync('./index.html')

const log = function(entry) {
    fs.appendFileSync('/tmp/sample-app.log', new Date().toISOString() + ' - ' + entry + '\n')
}

const server = http.createServer(function (req, res) {
    if (req.method === 'POST') {
        let body = ''

        req.on('data', function(chunk) {
            body += chunk
        })

        req.on('end', function () {
            switch (req.url) {
                case '/scheduled':
                    log('Received task ' + req.headers['x-aws-sqsd-taskname'] + ' scheduled at ' + req.headers['x-aws-sqsd-scheduled-at'])
                    break
                case '/login':
                    return verifyUser(body)
                        .then((success) => {
                            if (success) {
                                console.log('Successful login')
                                res.writeHead(200)
                                res.write(mainHTML)
                                res.end()
                            } else {
                                console.log('Unsuccessful login')
                                res.writeHead(400)
                                res.write('<body><p>Failed to login</p></body>')
                                res.end()
                            }
                        })
                    break
                default:
                    log('Received message: ' + body)
                    break
            }

            res.writeHead(200, 'OK', {'Content-Type': 'text/plain'})
            res.end()
        })
    } else {
        res.writeHead(200)
        res.write(loginHTML)
        res.end()
    }
})

const main = () => {
    sequelize.init()

    // Listen on port 3000, IP defaults to 127.0.0.1
    server.listen(port)

    // Put a friendly message on the terminal
    console.log('Server running at http://127.0.0.1:' + port + '/')
}

main()
