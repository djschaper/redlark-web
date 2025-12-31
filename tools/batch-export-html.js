const opensong = require("../src/lib/opensong")
const fs = require("fs")
const path = require('path')

const openSongFolder = process.argv[2]
const outputDir = process.argv[3]

let files = []
if (fs.existsSync(openSongFolder)) {
    files = fs.readdirSync(openSongFolder)
} else {
    console.log(`OpenSong Songs folder "${openSongFolder}" does not exist`)
}

files = files.filter(file => file.indexOf('.') < 0 && fs.statSync(path.join(openSongFolder, file)).isFile())

files.forEach((songFilename) => {
    const songPath = path.join(openSongFolder, songFilename)
    const outputHTMLFile = path.join(outputDir, path.basename(songFilename) + ".html")
    console.log(`Outputting to: ${outputHTMLFile}`)
    opensong.generateHTML(songPath, {outputHTMLFile})
})

console.log(`Outputted ${files.length} files`);
