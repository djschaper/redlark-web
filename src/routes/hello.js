const handler = (request, reply) => {
    reply.writeHead(200)
    reply.write('<body>Hello!</body>')
    reply.end()
}

const route = {
    method: 'GET',
    path: '/hello',
    handler
}

module.exports = {
    route
}