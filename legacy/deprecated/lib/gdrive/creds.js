module.exports.default = {
  installed: {
    client_id: '781207787684-g86tsrqosdfosjtfj3u4sdknfdjvl3hv.apps.googleusercontent.com',
    project_id: 'fbc-redlark-1531364379255',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://accounts.google.com/o/oauth2/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_secret: process.env.GDRIVE_CLIENT_SECRET,
    redirect_uris: [ 'urn:ietf:wg:oauth:2.0:oob', 'http://localhost' ]
  }
}