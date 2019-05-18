const cheerio = require('cheerio')

const fs = require('fs')
const path = require('path')

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

const idToPath = {}

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

function generateHTML(openSongFile, outputHTMLFile = null, targetKey = null) {
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
    //console.log('Transpose Change: +' + transposeChange)

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
    $('.footer').text(openSongXML('copyright').text())

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
            if (sectionTitle[0] == 'V') {
                sectionTitle[0] = 'Verse'
            } else if (sectionTitle[0] == 'C') {
                sectionTitle[0] = 'Chorus'
            } else if (sectionTitle[0] == 'B') {
                sectionTitle[0] = 'Bridge'
            }

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

    if (outputHTMLFile == null) {
        // Return formatted HTML
        return $.html()
    } else {
        // Write to output file
        fs.writeFileSync(outputHTMLFile, $.html())
    }
    
}

module.exports = {
    generateHTML,
    idToPath
}