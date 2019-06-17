const puppeteer = require('puppeteer')

// To workaround Puppeteer needing to be unpacked and resolving its path properly when distributed
const createBrowser = (options = {}) => {
    return puppeteer.launch({
        ...options,
        executablePath: puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked')
    });
}

const savePDF = (filepath, html) => {
    let browser
    let page
    return createBrowser()
        .then((res) => {
            browser = res
            return browser.newPage()
        })
        .then((res) => {
            page = res
            return page.setContent(html)
        })
        .then(() => page.pdf({
            path: filepath,
            format: 'Letter',
            margin: {
                top: '0.5in',
                bottom: '0.3in',
                left: '0.5in',
                right: '0.5in'
            }
        }))
        .then(() => browser.close())
}

module.exports = {
    savePDF
}
