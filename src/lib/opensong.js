const cheerio = require('cheerio')
const moment = require('moment')

const fs = require('fs')
const path = require('path')

const settings = require('./settings')

const SETS_SUB_FOLDER = "Sets"
const SONGS_SUB_FOLDER = "Songs"
const TEMPLATE = path.resolve(__dirname, '../pages/templates/opensong.html')
const BASE_CHORDS = [
    'A',
    'Bb',
    'B',
    'C',
    'C#',
    'D',
    'Eb',
    'E',
    'F',
    'F#',
    'G',
    'G#',
]
const MAJOR_KEYS = BASE_CHORDS
const MINOR_KEYS = BASE_CHORDS.map(key => key + 'm')
const SECTION_ABBREV_TO_TITLES = {
    'I': 'Intro',
    'V': 'Verse',
    'P': 'Pre-Chorus',
    'C': 'Chorus',
    'B': 'Bridge',
    'E': 'Ending',
    'T': 'Tag',
}

let allSets = null
let songsInSets = {}

const idToPath = {}
const pathToId = {}
const nameToId = {}
const idToName = {}

function addIdPathPair(id, file_path) {
    idToPath[id] = file_path
    pathToId[file_path] = id

    const name = path.basename(file_path)
    nameToId[name] = id
    idToName[id] = name
}

function getIdFromPath(file_path) {
    return pathToId[file_path]
}

function getPathFromId(id) {
    return idToPath[id]
}

function getIdFromName(name) {
    return nameToId[name]
}

function getNameFromId(id) {
    return idToName[id]
}

function getAllSetNamesAndIds() {
    const openSongFolder = path.join(settings.get(settings.dict.OPENSONG_FOLDER), SETS_SUB_FOLDER)
    let files = []
    if (fs.existsSync(openSongFolder)) {
        files = fs.readdirSync(openSongFolder)
    }
    
    const setFiles = files.filter(file => file.indexOf('.') < 0)
    setFiles.sort().reverse()
    
    const sets = []
    setFiles.reduce((acc, val) => {
        const id = 'id_set_' + val.replace(/\W/g, '-').toLowerCase()

        // Save id-filepath relationship for later access
        addIdPathPair(id, path.join(openSongFolder, val))

        acc.push({
            id,
            name: val
        })
        return acc
    },
        sets
    )

    // cache for later
    allSets = sets

    return sets
}

function getAllSongNamesAndIds() {
    const openSongFolder = path.join(settings.get(settings.dict.OPENSONG_FOLDER), SONGS_SUB_FOLDER)
    let files = []
    if (fs.existsSync(openSongFolder)) {
        files = fs.readdirSync(openSongFolder)
    } else {
        console.log(`OpenSong Songs folder "${openSongFolder}" does not exist`)
    }

    files = files.filter(file => file.indexOf('.') < 0)

    let songs = []
    files.reduce((acc, val) => {
        const id = 'id_' + val.replace(/\W/g, '-').toLowerCase()

        // Save id-filepath relationship for later access
        addIdPathPair(id, path.join(openSongFolder, val))

        acc.push({
            id,
            name: val
        })
        return acc
    },
        songs
    )

    // Ensure songs are sorted alphabetically
    songs.sort((a, b) => {
        return a.name.localeCompare(b.name)
    })

    return songs
}

function getSongsFromSetXML(xml) {
    const $ = cheerio.load(xml, { xmlMode: true })
    return Array.from($('slide_group')).map((song) =>
        ({
            name: song.attribs['name'],
            key: song.attribs['key']
        })
    )
}

function getSetSongs(filepath) {
    const setXML = fs.readFileSync(filepath)
    const setSongs = getSongsFromSetXML(setXML)

    const songs = []
    setSongs.reduce((acc, val) => {
        const song = {
            id: getIdFromName(val.name),
            key: val.key
        }
        if (song.id) {
            acc.push(song)
        } else {
            console.log(`Could not find id for song: ${val.name}`)
        }
        return acc
    },
        songs
    )

    return songs
}

function parseSetDate(setName) {
    // Capture groups of numbers, presumably something like: YYYY-MM-dd
    const dateParts = setName.match(/\d+/gm)
    // Need at least 3 results for year, month, day
    if (dateParts.length < 3) {
        return null
    }

    const setDate = moment(setName, 'YYYY-MM-DD', true)
    if (!setDate.isValid()) {
        return null
    }
    return setDate
}

function getMostRecentSetSongWasIn(songName) {
    // Used cached set list if possible
    if (!allSets) {
        getAllSetNamesAndIds()
    }

    mostRecentSetIndex = allSets.findIndex(set => {
        const setDate = parseSetDate(set.name)
        
        // Don't include any sets that don't match required date format
        if (!setDate) {
            return false;
        }

        // Don't include sets with future dates
        if (moment() < setDate) {
            return false;
        }

        let songs
        if (set.id in songsInSets) {
            // Use cached set-song groups if possible
            songs = songsInSets[set.id]
        } else {
            songs = getSongsFromSetXML(fs.readFileSync(getPathFromId(set.id)))
            songsInSets[set.id] = songs
        }
        
        return songs.map(song => song.name).includes(songName)
    })

    if (mostRecentSetIndex < 0) {
        return null
    }

    allSets[mostRecentSetIndex].index = mostRecentSetIndex
    return allSets[mostRecentSetIndex]
}

function getTranspositionChange(key, targetKey) {
    fromBase = getBaseChord(key)[1]
    toBase = getBaseChord(targetKey)[1]

    if (!BASE_CHORDS.includes(fromBase)) {
        console.log('Current key is not a valid base chord: ' + fromBase)
        return 0
    }
    if (!BASE_CHORDS.includes(toBase)) {
        console.log('Target key is not a valid base chord: ' + toBase)
        return 0
    }

    const from = BASE_CHORDS.indexOf(fromBase)
    const to = BASE_CHORDS.indexOf(toBase)

    return to - from
}

function getBaseChord(chord) {
    const baseChordRegex = /([A-G,b,#]+)/g
    const matches = baseChordRegex.exec(chord)
    if (matches == null || matches.length < 2) {
        if (!chord.includes('|')) {
            console.log('Could not identify base of "chord": ' + chord)
        }
        return null
    }
    const oldBase = matches[1]

    let baseChord = oldBase
    // Deal with sharp/flat alternatives
    if (baseChord == 'A#') {
        baseChord = 'Bb'
    } else if (baseChord == 'Ab') {
        baseChord = 'G#'
    } else if (baseChord == 'Db') {
        baseChord = 'C#'
    } else if (baseChord == 'D#') {
        baseChord = 'Eb'
    } else if (baseChord == 'Gb') {
        baseChord = 'F#'
    }

    return [oldBase, baseChord]
}

function parseKey(key) {
    return transposeChord(key, 0)
}

function transposeChord(chord, change) {
    // Handle chord treble/bass combos
    if (chord.includes('/')) {
        chords = chord.split('/')
        return chords.map(c => transposeChord(c, change)).join('/')
    }

    // Try extract base of chord
    const result = getBaseChord(chord)
    if (result == null) {
        // Return chord unchanged if could not get base chord
        return chord
    }
    const [oldBase, baseChord] = result

    // Find new base chord
    const oldIndex = BASE_CHORDS.indexOf(baseChord)
    let newIndex = oldIndex + change
    if (newIndex < 0) {
        newIndex += BASE_CHORDS.length
    } else if (newIndex >= BASE_CHORDS.length) {
        newIndex -= BASE_CHORDS.length
    }

    // Replace old base chord with new one
    const newBase = BASE_CHORDS[newIndex]
    // console.log([oldBase, baseChord, newBase].join(' -> '))

    return chord.replace(oldBase, newBase)
}

function buildYoutubeSearchURL(searchStrings) {
    return 'https://www.youtube.com/results?search_query=' + searchStrings.map(str => encodeURI(str)).join('+')
}

function generateHTML(openSongFile, options = {}) {
    let outputHTMLFile = null
    let targetKey = null
    let embeddedId = null
    let embeddedFullId = null

    if ('outputHTMLFile' in options) {
        outputHTMLFile = options.outputHTMLFile
    }
    if ('targetKey' in options) {
        targetKey = options.targetKey
    }
    if ('embeddedId' in options) {
        embeddedId = options.embeddedId
    }
    if ('embeddedFullId' in options) {
        embeddedFullId = options.embeddedFullId
    }

    // Read OpenSong file
    const openSongContents = fs.readFileSync(openSongFile, 'UTF8')
    const openSongXML = cheerio.load(openSongContents, {xmlMode: true})

    // Load HTML template
    const $ = cheerio.load(fs.readFileSync(TEMPLATE))

    // Extract song key
    const key = parseKey(openSongXML('key').text())
    if (targetKey == null) {
        targetKey = key
    }
    const transposeChange = getTranspositionChange(key, targetKey)

    // Set up transposition control
    let transposeOptions
    if (targetKey.includes('m')) {
        transposeOptions = MINOR_KEYS
    } else {
        transposeOptions = MAJOR_KEYS
    }
    transposeOptions.forEach(key => {
        if (key == targetKey) {
            $('#key-select').append('<option selected value="' + key + '">' + key + '</option>')
        } else {
            $('#key-select').append('<option value="' + key + '">' + key + '</option>')
        }
    })

    // Disable unsupported elements if not embedded
    if (embeddedId == null) {
        $('#save-pdf').css('display', 'none')
        $('#export').css('display', 'none')
    } else {
        $("meta[name='embedded-id']").attr('content', embeddedId)
    }

    // Save song's set id if embedded
    if (embeddedFullId != null) {
        $("meta[name='embedded-full-id']").attr('content', embeddedFullId)
    }

    // Populate song details
    $('song').text(openSongXML('title').text())
    $('author').text(openSongXML('author').text())
    $('key').text('Key - ' + targetKey)
    const timeTempoLines = []
    if (openSongXML('tempo').text()) {
        timeTempoLines.push('Tempo - ' + openSongXML('tempo').text())
    }
    if (openSongXML('time_sig').text()) {
        timeTempoLines.push('Time - ' + openSongXML('time_sig').text())
    }
    $('tempo').text(timeTempoLines.join(' | '))
    const copyright = openSongXML('copyright').text()
    $('.footer').text(copyright)

    if (openSongXML('link_youtube').text() != '') {
        $('#youtube-link').attr('href', openSongXML('link_youtube').text())
    } else {
        // If no Youtube link present, search Youtube by song title and author
        $('#youtube-link').attr('href', buildYoutubeSearchURL([$('song').text(), $('author').text()]))
    }

    function addChordLyricSpan(chord, lyric) {
        if (lyric == '') {
            if (chord == '') {
                // Don't add a span if both chord and lyric are empty
                return
            } else {
                // Add an extra 2 spaces of padding for chords with no attached lyrics
                chord += '  '
            }
        }

        if (chord == '') {
            // Add a space above lyrics to force lyrics down to lign up with other lyrics
            chord = ' '
        } else {
            // Default pad chords with 2 spaces
            chord += '  '
        }
        $('#' + currentSection).children().last().append('<span class="chord-lyric"><chord>' + chord + '</chord><lyric>' + lyric + '</lyric></span>')
    }

    // Parse song contents
    const songLines = openSongXML('lyrics').text().split('\n')
    let currentSection = null
    for (let i = 0; i < songLines.length; i++) {
        const line = songLines[i]

        // Empty lines generally mark the end of sections
        if (line.length == 0) {
            continue
        }

        // Section title line
        if (line[0] == '[') {
            // Break section up into section type and number
            let sections = /\[(\D+)(\d+)\]/g.exec(line)
            if (sections == null) {
                sections = /\[(\D+)\]/g.exec(line)
            }
            if (sections == null) {
                sections = /\[(\D+)\s.+\]/g.exec(line)
            }

            if (sections == null) {
                console.log('Error parsing section header line: ' + line)
                break
            }
            const sectionTitle = sections.slice(1)

            // Replace shorthand if present
            sectionTitle[0] = SECTION_ABBREV_TO_TITLES[sectionTitle[0]] || sectionTitle[0]

            // Add new section to HTML
            currentSection = sectionTitle.join('-').replace(/\s/g, '').replace(/\//g, '-').toLowerCase()
            $('.song-content').append('<div class="section" id="' + currentSection + '"><section-title>' + sectionTitle.join(' ') + '</section-title></div>')

            // Indent "Chorus" sections
            if (sectionTitle[0].toLowerCase().includes('chorus') && !sectionTitle[0].toLowerCase().includes('pre')) {
                $('#' + currentSection).addClass('indented')
            }
        } else if (line[0] == '.') {
            // Chord line, which should be followed by a lyric line
            if (i + 1 >= songLines.length) {
                console.log("Error, lyric line index is out of range")
                break
            }

            // Start a new line
            $('#' + currentSection).append('<span class="line"></span>')

            // Remove trail whitespace on chord line
            chordLine = line.trim().slice(1)
            lyricLine = songLines[i + 1].slice(1)

            const chordRegex = /\s*(\S+)\s*/g
            let chordStartIndex = 0
            let chordEndIndex = 0
            let lastChordIndex = 0

            const chords = []
            while ((m = chordRegex.exec(chordLine)) !== null) {
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === chordRegex.lastIndex) {
                    chordRegex.lastIndex++;
                }

                // The result can be accessed through the `m`-variable.
                if (m.length == 2) {
                    let chordStartIndex = m.index
                    if (chordStartIndex == 0) {
                        chordStartIndex = chordLine.indexOf(m[1])
                    }

                    chords.push({
                        chord: m[1],
                        index: chordStartIndex
                    })
                }
            }

            for (let j = 0; j < chords.length; j++) {
                lastChordIndex = chordEndIndex
                chordStartIndex = chords[j].index

                chordEndIndex = chordStartIndex
                if (lyricLine[chordEndIndex] == ' ') {
                    // Chord is anchored to white space
                    while (
                        chordEndIndex < lyricLine.length &&
                        lyricLine[chordEndIndex] == ' ' &&
                        (j + 1 >= chords.length || chordEndIndex < chords[j + 1].index)
                    ) {
                        chordEndIndex++
                    }
                } else {
                    // Chord is anchored to a letter                   
                    while (
                        chordEndIndex < lyricLine.length &&
                        lyricLine[chordEndIndex] != ' ' &&
                        lyricLine[chordEndIndex] != '-' &&
                        (j + 1 >= chords.length || chordEndIndex < chords[j + 1].index)
                    ) {
                        chordEndIndex++
                    }
                }

                // Add chord-less span with lyrics only between chords
                addChordLyricSpan('', lyricLine.slice(lastChordIndex, chordStartIndex))

                // Add span for chord and its anchored lyrics
                const chord = transposeChord(chords[j].chord, transposeChange)
                addChordLyricSpan(chord, lyricLine.slice(chordStartIndex, chordEndIndex))
            }

            // Catch any straggling lyrics that don't have chords above them
            addChordLyricSpan('', lyricLine.slice(chordEndIndex))

        } else if (line[0] == ' ') {
            // Lyric line should already be dealt with in conjunction with chord lines
        }
    }

    // Add transposition Javascript functions to html
    $('#shared-functions').text([
        getTranspositionChange.toString(),
        getBaseChord.toString(),
        parseKey.toString(),
        transposeChord.toString()
    ].join('\n\n'))

    if (outputHTMLFile != null) {
        // Write to output file
        fs.writeFileSync(outputHTMLFile, $.html())   
    }

    return {
        html: $.html(),
        key: targetKey,
        copyright
    }
    
}

function generateSetHTML(songs) {
    const allSongs = songs.map(song => generateHTML(song.file, song.options))

    // Merge them all together semi-intelligently
    const style = cheerio.load(allSongs[0].html)('style').clone()
    const songContents = allSongs.map(song => {
        const $ = cheerio.load(song.html)

        // Remove the absolute bottom-positioned footer, and use table footer
        $('.footer-space').text($('.footer').text())
        $('.footer').remove()

        return $('.song-wrapper').clone()
    })

    const $ = cheerio.load('')
    $('head').append(style)
    for (let content of songContents) {
        $('body').append(content)
    }

    return $.html()
}

module.exports = {
    generateHTML,
    generateSetHTML,
    addIdPathPair,
    getIdFromPath,
    getPathFromId,
    getIdFromName,
    getNameFromId,
    getSetSongs,
    getAllSongNamesAndIds,
    getAllSetNamesAndIds,
    getMostRecentSetSongWasIn
}