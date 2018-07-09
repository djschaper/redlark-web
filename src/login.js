const passwordHash = require('password-hash')

const sequelize = require('./sequelize')

const parseQueryString = (str) => {
    const elements = str.split('&');
    return elements.reduce((acc, val) => {
        const [key, value] = val.split('=')
        acc[key] = decodeURIComponent(value)
        return acc
    }, {})
}

const verifyUser = (body) => {
    const parsed = parseQueryString(body)
    const email = parsed.email
    const password = parsed.password
    if (!email || !password) {
        return Promise.resolve(false)
    }

    const User = sequelize.getModel('user')
    return User.findOne({ where: { email } })
        .then((user) => {
            if (!user) return false

            return passwordHash.verify(password, user.passwordHash)
        })
}

module.exports = {
    verifyUser
}