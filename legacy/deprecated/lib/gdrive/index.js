const fs = require('fs')
const readline = require('readline')
const { google } = require('googleapis')
const path = require('path')

const creds = require('./creds').default

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly']
const TOKEN_PATH = path.resolve(__dirname, './credentials.json')

let oAuth2Client

// Create an OAuth2 client with the given credentials, and then execute the
// given callback function.
const authorize = () => {
    const { client_secret, client_id, redirect_uris } = creds.installed
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]
    )

    let token
    // Check if we have previously stored a token.
    if (!fs.existsSync(TOKEN_PATH)) {
        token = getAccessToken()
    } else {
        token = JSON.parse(fs.readFileSync(TOKEN_PATH))
    }

    // Use access token
    oAuth2Client.setCredentials(token)
}

// Get and store new token after prompting for user authorization, and then
// execute the given callback with the authorized OAuth2 client.
const getAccessToken = () => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })

    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close()
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                console.log(err)
                return
            }

            // Store the token to disk for later program executions
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
            console.log('Token stored to', TOKEN_PATH)

            return token
        })
    })
}

// Authorize a client with credentials, then call the Google Drive API.
authorize()

const drive = google.drive({ version: 'v3', auth: oAuth2Client })

const listFoldersInFolder = (folderId) => {
    const drive = google.drive({ version: 'v3', auth: oAuth2Client })
    return drive.files.list({
        pageSize: 1000,
        fields: 'files(id, name)',
        q: `'${folderId}' in parents and mimeType contains 'folder'`
    })
        .then((res) => res.data.files)
        .catch((err) => console.log('The API returned an error: ' + err))
}

const listFilesInFolder = (folderId, extension='') => {
    const drive = google.drive({ version: 'v3', auth: oAuth2Client })
    return drive.files.list({
        pageSize: 1000,
        fields: 'files(id, name, webViewLink)',
        q: `'${folderId}' in parents and name contains '${extension}'`
    })
        .then((res) => res.data.files)
        .catch((err) => console.log('The API returned an error: ' + err))
}

const findFolder = (folderName) => {
    const drive = google.drive({ version: 'v3', auth: oAuth2Client })
    return drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
        q: `name='${folderName}'`
    })
        .then((res) => {
            if (res.data.files.length === 1) return res.data.files[0]

            return null
        })
        .catch((err) => console.log('The API returned an error: ' + err))
}

module.exports = {
    listFilesInFolder,
    listFoldersInFolder,
    findFolder
}