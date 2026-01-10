const path = require('path')
const fs = require('fs')

const SETTINGS_FILENAME = 'user_settings.json'
const SETTINGS = {
    OPENSONG_FOLDER: {
        key: "opensong-folder",
        type: "text"
    },
    OPENSONG_SUBFOLDER: {
        key: "opensong-subfolder",
        type: "text",
    },
    DISPLAY_MODE: {
        key: "display-mode",
        type: "radio"
    }
}

let appPaths
let settingsFilePath
let settings

const init = (paths) => {
    appPaths = paths
    settingsFilePath = path.join(appPaths['userData'], SETTINGS_FILENAME)
    console.log(`Settings File: ${settingsFilePath}`)
}

const get = (key) => {
    try {
        settings = JSON.parse(fs.readFileSync(settingsFilePath))
    } catch (error) {
        console.log(`Error reading settings JSON file: ${error}`)
        return
    }

    return settings[key]
}

const set = (key, val) => {
    settings[key] = val
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
}

const setAll = (json) => {
    settings = json
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
}

const getPath = (pathKey) => {
    return appPaths[pathKey]
}

const getSettingDict = () => Object.keys(SETTINGS).reduce((acc, val) => {
    acc[val] = SETTINGS[val].key
    return acc
}, {})

const getKeys = () => Object.keys(SETTINGS).reduce((acc, val) => {
    acc.push(SETTINGS[val].key)
    return acc
}, [])

module.exports = {
    init,
    get,
    set,
    setAll,
    dict: getSettingDict(),
    keys: getKeys(),
    raw: SETTINGS,
    getPath
}