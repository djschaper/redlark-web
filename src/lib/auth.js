const uuid = require('uuid')

const db = require('../sequelize/models')
const server = require('./server')

const SESSION_UUID_COOKIE_KEY = 'sessionUUID'
const FAILED_LOGIN_COOKIE_KEY = 'failedLogin'

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

const tryGetSessionUUIDFromRequest = (request) => server.getCookie(request, SESSION_UUID_COOKIE_KEY)

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

const generateSession = (userId, reply) =>
    db.UserSession.create({
        userId,
        uuid: uuid.v4()
    }).then((session) => {
        server.setCookie(reply, SESSION_UUID_COOKIE_KEY, session.uuid)
    })

const deleteSession = (request, reply) => {
    const sessionUUID = tryGetSessionUUIDFromRequest(request)
    return db.UserSession.destroy({ where: { uuid: sessionUUID } })
        .then(() => server.setCookie(reply, SESSION_UUID_COOKIE_KEY, null))
}

const setFailedLoginFlag = (reply, value) => server.setCookie(reply, FAILED_LOGIN_COOKIE_KEY, value)
const getFailedLoginFlag = (request) => server.getCookie(request, FAILED_LOGIN_COOKIE_KEY)

module.exports = {
    AUTH_METHODS,
    AUTH_TYPES,
    generateSession,
    deleteSession,
    authorizeRoute,
    setFailedLoginFlag,
    getFailedLoginFlag
}