const path = require('path')
const fs = require('fs')

const SETTINGS_FILENAME = 'user_settings.json'
const SETTINGS = {
    OPENSONG_FOLDER: "opensong-folder"
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
    settings[val] = key
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings))
}

const setAll = (json) => {
    settings = json
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings))
}

const getPath = (pathKey) => {
    return appPaths[pathKey]
}

module.exports = {
    init,
    get,
    set,
    setAll,
    dict: SETTINGS,
    keys: Object.values(SETTINGS),
    getPath
}