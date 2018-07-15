const redirect = (request, reply, redirectPath) => {
    reply.writeHead(301, {
        Location: "http" + (request.socket.encrypted ? "s" : "") + "://" +
            request.headers.host + redirectPath
    })
    return reply.end()
}


module.exports = {
    redirect
}