const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

const templateHTML = fs.readFileSync(path.resolve(__dirname, '../pages/templates/page.html'))

const applyMainPageTemplate = (pageHTML) => {
    const $ = cheerio.load(templateHTML)
    const $page = cheerio.load(pageHTML)

    $('head').append($page('head').html())
    $('#content').append($page('body').html())

    return $.html()
}

module.exports = {
    applyMainPageTemplate
}