const uuid = require('uuid')

const db = require('../sequelize/models')

const SESSION_UUID_COOKIE_KEY = 'sessionUUID'

const saveAuthResult = (request, type, authorized = false, userId = null) => {
    const authResult = {
        type,
        authorized,
        userId
    }
    if (!request.auth) request.auth = {}
    request.auth[type] = authResult
    return authResult
}

const authorizeNone = (request) => Promise.resolve(saveAuthResult(request, AUTH_TYPES.NONE, true))

const tryGetSessionUUIDFromRequest = (request) => {
    const cookieJar = request.headers['cookie']
    if (!cookieJar) return null

    if (!cookieJar.includes(SESSION_UUID_COOKIE_KEY)) return null

    sessionCookie = cookieJar.split(';').find(cookie => cookie.includes(SESSION_UUID_COOKIE_KEY))
    return sessionCookie.split('=')[1].trim()
}

const authorizeMember = (request) => {
    const sessionUUID = tryGetSessionUUIDFromRequest(request)
    if (!sessionUUID) return saveAuthResult(request, AUTH_TYPES.MEMBER)

    return db.UserSession.findOne({ where: { uuid: sessionUUID } })
        .then((userSession) => {
            if (!userSession) return saveAuthResult(request, AUTH_TYPES.MEMBER)

            console.log('successful auth!')
            return saveAuthResult(request, AUTH_TYPES.MEMBER, true, userSession.userId)
        })
}

const authorizeAdditionalRole = (request, authType) => authorizeMember(request)
    .then((authResult) => {
        authResult.type = authType
        if (!authResult.authorized) return authResult

        // TODO: Look up user's role to see if it matches required role
        return authResult
    })

const authorizeLeader = (request) => authorizeAdditionalRole(request, AUTH_TYPES.LEADER)

const authorizeAdmin = (request) => authorizeAdditionalRole(request, AUTH_TYPES.ADMIN)

const authorizeRoute = (request, auths) => Promise.all(auths.map(auth => auth(request)))
    .then((authResults) => authResults.some(result => result.authorized))

const AUTH_METHODS = {
    NONE: authorizeNone,
    MEMBER: authorizeMember,
    LEADER: authorizeLeader,
    ADMIN: authorizeAdmin
}

const AUTH_TYPES = {
    NONE: 'none',
    MEMBER: 'member',
    LEADER: 'leader',
    ADMIN: 'admin'
}

const generateSession = (userId, reply) => db.UserSession.create({
    userId,
    uuid: uuid.v4()
}).then((session) => {
    reply.setHeader('set-cookie', [`${SESSION_UUID_COOKIE_KEY}=${session.uuid}`])
    })

const deleteSession = (request, reply) => {
    const sessionUUID = tryGetSessionUUIDFromRequest(request)
    return db.UserSession.destroy({ where: { uuid: sessionUUID } })
        .then(() => reply.setHeader('set-cookie', [`${SESSION_UUID_COOKIE_KEY}=null`]))
}

module.exports = {
    AUTH_METHODS,
    AUTH_TYPES,
    generateSession,
    deleteSession,
    authorizeRoute
}