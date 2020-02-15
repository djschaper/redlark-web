const Sortable = require('sortablejs')

const MAJOR_MUSICAL_CHORDS = [
    'Ab',
    'A',
    'A#',
    'Bb',
    'B',
    'C',
    'C#',
    'Db',
    'D',
    'D#',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'G#',
]
const MINOR_MUSICAL_CHORDS = MAJOR_MUSICAL_CHORDS.map(key => key + 'm')
const MUSICAL_CHORDS = [...MAJOR_MUSICAL_CHORDS, ...MINOR_MUSICAL_CHORDS]
const SHEET_MUSIC_DELIMITER = 'sheet'
const SET_ID_PREFIX = '_SET-ID-'

/// Common objects //////////////////////////////////////////////////////
const previewWindow = document.getElementById('preview-window')
const setSongList = document.getElementById('set-song-list')
const songList = document.getElementById('song-list')
const songSearchbox = document.getElementById('song-searchbox')
const setNameInput = document.getElementById('set-name')
const saveSetButton = document.getElementById('save-set-button')
const openSetButton = document.getElementById('open-set-button')
const newSetButton = document.getElementById('new-set-button')
const printSetButton = document.getElementById('print-set-button')
const savePDFSetButton = document.getElementById('pdf-set-button')
const copySetTableButton = document.getElementById('copy-set-table-button')
const setTableClipboard = document.getElementById('set-table-clipboard')
const setList = document.getElementById('set-list')
const exportSetToolbar = document.getElementById('export-set-tools')
const darkMode = document.getElementById('dark-mode')

let allSongs = []
let keySelect

/// Functions ///////////////////////////////////////////////////////////
const getSongList = () => {
    ajax({
        method: 'GET',
        route: '/songs',
        type: RESPONSE_TYPES.XML,
        handler: (songListXML) => {
            songList.innerHTML = songListXML.body.innerHTML

            allSongs = Array.from(songList.children).map(song => ({
                title: song.innerText.toLowerCase(),
                html: song.outerHTML,
                element: song
            }))
        }
    })
}

const parseChord = (str) => {
    if (MUSICAL_CHORDS.includes(str)) return str;
    return null;
}

const getSets = () => {
    ajax({
        method: 'GET',
        route: '/sets',
        type: RESPONSE_TYPES.XML,
        handler: (sets) => {
            setList.innerHTML = sets.body.innerHTML
        }
    })
}

const getSong = (event) => {
    const song = event.currentTarget.parentElement
    const songIdSplit = song.id.split(SET_ID_PREFIX)
    const songId = song.id.split(SET_ID_PREFIX)[0]
    const key = song.querySelector('.key')
    const isInSet = song.parentElement === setSongList

    let queryString = `id=${songId}`
    if (songIdSplit.length > 1) {
        queryString += `&fullid=${song.id}`
    }
    const isKeySet = parseChord(key.innerText) != null
    if (isKeySet) {
        queryString += `&key=${encodeURIComponent(key.innerText)}`
    }

    ajax({
        method: 'GET',
        route: `/song?${queryString}`,
        type: RESPONSE_TYPES.TEXT,
        handler: (html) => {
            previewWindow.setAttribute('srcdoc', html)
            if (!isKeySet) {
                // Song doesn't have a user-associated key yet - use song's default
                const openSongHTML = new DOMParser().parseFromString(html, 'text/html')
                key.innerText = openSongHTML.querySelector('key').innerText.split('-')[1].trim()
            }

            if (isInSet) {
                if (!isKeySet) {
                    // User has yet to set a key, so update save button
                    updateSaveButton(true)
                }
            }

            const onLoad = () => {
                previewWindow.removeEventListener('load', onLoad)
                previewWindow.removeAttribute('srcdoc')
                const embeddedFullId = previewWindow.contentDocument.querySelector('meta[name=embedded-full-id]').content
                if (darkMode.hasAttribute('enabled')) {
                    previewWindow.contentDocument.querySelector('#display-mode').click()
                }
                if ('recentSet' in song.dataset) {
                    previewWindow.contentDocument.getElementById('info-text').innerText = `Last set: "${song.dataset.recentSet}"`
                }
                keySelect = previewWindow.contentDocument.querySelector('#key-select')
                keySelect.addEventListener('change', (event) => {
                    if (embeddedFullId.includes(SET_ID_PREFIX)) {
                        // Song is in set, so update save button
                        updateSaveButton(true)
                    }
                })
            }

            previewWindow.addEventListener('load', onLoad)
        }
    })
}

// Handle drag and drop
let dragged = null

const allowDrop = (event) => {
    event.preventDefault()
}

const drag = (event) => {
    dragged = event.target
    const title = dragged.querySelector('.song-title')
    if (title) {
        title.style.display = 'block'
        event.dataTransfer.setDragImage(dragged, dragged.offsetWidth / 2, dragged.offsetHeight / 2)
        resetTextForElement(title)
    }
}

const dragEnd = (event) => {
    const title = dragged.querySelector('.song-title')
    if (title) {
        title.style.display = 'unset';
    }
    dragged = null;
}

let setSongIndex = 0;
const addToSet = (event) => {
    if (!dragged) return

    // Don't add if dragging from set back to set
    if (dragged.parentElement === setSongList) return

    // Prevent arbitrary elements being dragged into set
    if (!dragged.classList.contains('song')) return

    event.preventDefault()
    return addSongToSet(dragged)
}

const tryAddSongByIdToSet = (songId, key) => {
    const song = allSongs.find(song => song.element.id === songId)

    if (!song) {
        console.log(`Could not find song with id: ${songId}`)
        return
    }

    return addSongToSet(song.element, key)
}

const addSongToSet = (song, key) => {
    const copy = song.cloneNode(true)
    const id = song.getAttribute("id") + SET_ID_PREFIX + setSongIndex
    copy.setAttribute("id", id)
    setSongIndex++

    const songTitle = copy.querySelector('.song-title')
    songTitle.style.display = 'unset'
    resetTextForElement(songTitle)

    if (key) {
        copy.querySelector('.key').innerText = key
    }

    setSongList.appendChild(copy)
    updateSaveButton(true)
}

const removeFromSet = (event) => {
    event.target.parentElement.remove()
    updateSaveButton(true)
}

const scrollText = (event) => {
    const titleWidth = event.target.offsetWidth
    const containerWidth = event.target.parentElement.clientWidth
    const rightPaddingPx = 5

    if (titleWidth > containerWidth) {
        const diff = titleWidth - containerWidth
        event.target.style.transitionDelay = '0.5s'
        event.target.style.transitionDuration = `${0.02 * diff}s`
        event.target.style.left = `${-1 * (diff + rightPaddingPx)}px`
    }
}

const resetText = (event) => {
    const titleWidth = event.target.offsetWidth
    const containerWidth = event.target.parentElement.clientWidth

    if (titleWidth > containerWidth) {
        resetTextForElement(event.target)
    }
}

const resetTextForElement = (elem) => {
    elem.style.transitionDelay = '0s'
    elem.style.transitionDuration = '0s'
    elem.style.left = '0'
}

/// Main ////////////////////////////////////////////////////////////////

// Initialize song list
getSongList()

// Set up event listeners
setSongList.addEventListener('drop', addToSet)
setSongList.addEventListener('dragover', allowDrop)

const searchSongs = (event) => {
    const search = event.target.value.toLowerCase()
    songList.innerText = ''
    songList.innerHTML = allSongs.filter(song => song.title.indexOf(search) >= 0).map(song => song.html).join('')
}
// Use timeout to wait for the value to be written to the event target
songSearchbox.addEventListener('keydown', (event) => setTimeout(() => searchSongs(event), 50))

const updateSaveButton = (unsavedChanges) => {
    updateExportSetToolbar()

    // Prevent saving if key is not selected for a song
    if (Array.from(setSongList.children).some(song => !parseChord(song.querySelector('.key').innerText))) {
        saveSetButton.setAttribute('disabled', 'disabled')
        return
    }

    if (!setNameInput.value || setSongList.childElementCount === 0 || !unsavedChanges) {
        saveSetButton.setAttribute('disabled', 'disabled')
    } else {
        saveSetButton.removeAttribute('disabled')
    }
}
setNameInput.addEventListener('keydown', (event) => setTimeout(() => updateSaveButton(true), 50))

const exportSetTools = Array.from(exportSetToolbar.children)
const updateExportSetToolbar = () => {
    if (
        setSongList.childElementCount === 0 ||
        Array.from(setSongList.children).some(song => !parseChord(song.querySelector('.key').innerText))
    ) {
        console.log('Disabling set export tools')
        exportSetTools.forEach((tool) => tool.setAttribute('disabled', 'disabled'))
        return
    }

    console.log('Enabling set export tools')
    exportSetTools.forEach((tool) => tool.removeAttribute('disabled'))
}

const trySaveSet = () => {
    const setName = document.getElementById('set-name').value
}

const getSongsInSet = () => Array.from(setSongList.children)

saveSetButton.addEventListener('click', (event) => {
    const setName = document.getElementById('set-name').value
    const songs = getSongsInSet().map(song =>
        ({
            id: song.id.split(SET_ID_PREFIX)[0],
            key: song.querySelector('.key').innerText
        })
    )

    ajax({
        method: 'POST',
        route: '/set',
        body: {
            setName,
            songs
        },
        headers: {
            'content-type': 'application/json'
        },
        handler: () => updateSaveButton(false)
    })
})

// Set view transitions
const editSetView = document.getElementById('edit-set-view')
const openSetView = document.getElementById('open-set-view')
const viewTranslationX = editSetView.offsetWidth + 20

openSetButton.addEventListener('click', (event) => {
    editSetView.style.transform = `translateX(-${viewTranslationX}px)`
    openSetView.style.transform = `translateX(-${viewTranslationX}px)`
    getSets()
})


const goBackToSetView = () => {
    editSetView.style.transform = 'translateX(0px)'
    openSetView.style.transform = 'translateX(0px)'
}

document.getElementById('back-to-set-button').addEventListener('click', (event) => goBackToSetView())

const loadSet = (event) => {
    // Load songs from set
    let set = event.target.parentElement
    while (!set.classList.contains('set')) {
        set = set.parentElement
    }
    const setName = set.querySelector('.set-name').innerText

    ajax({
        method: 'GET',
        route: `/set?id=${set.id}`,
        type: RESPONSE_TYPES.JSON,
        handler: (setSongs) => {
            // Clear set
            setSongList.innerText = ''

            // Load songs from requested set
            for (let song of setSongs) {
                tryAddSongByIdToSet(song.id, song.key)
            }
            setNameInput.value = setName

            // The save button should be disabled at this point, since the set was just loaded
            updateSaveButton(false)
        }
    })

    goBackToSetView()
}

const clearSet = () => {
    setSongList.innerText = ''
    setNameInput.value = ''

    updateSaveButton(false)
}
newSetButton.addEventListener('click', clearSet)

const postSetFile = (print, handler) => {
    const songs = getSongsInSet().map(song => ({
        id: song.id.split(SET_ID_PREFIX)[0],
        key: song.querySelector('.key').innerText
    }))
    const name = setNameInput.value === '' ? 'Full Set' : setNameInput.value
    const type = print ? RESPONSE_TYPES.TEXT : RESPONSE_TYPES.JSON

    document.body.style.cursor = 'wait'
    ajax({
        method: 'POST',
        route: '/set/file',
        type,
        headers: {
            'content-type': 'application/json'
        },
        body: {
            name,
            songs,
            print
        },
        handler
    })
}

const copySetSongTable = () => {
    // Reset table
    setTableClipboard.innerHTML = ''

    // Create headers
    const headers = ["Order", "Song", "Key"]
    const headerRow = document.createElement('tr')
    setTableClipboard.append(headerRow)
    headers.forEach(text => {
        const col = document.createElement('th')
        col.innerText = text
        headerRow.appendChild(col)
    })

    // Get YouTube links for songs
    const songIdToLink = {}
    setSongList.childNodes.forEach(song => {
        const songId = song.id.split(SET_ID_PREFIX)[0]

        ajax({
            method: 'GET',
            route: `/song?id=${songId}`,
            type: RESPONSE_TYPES.HTML,
            handler: (doc) => {
                const link = doc.querySelector('#youtube-link').href
                songIdToLink[songId] = link

                // All AJAX calls done
                if (Object.keys(songIdToLink).length == setSongList.childElementCount) {
                    // Add song rows
                    for (i = 0; i < setSongList.childElementCount; i++) {
                        const finalSong = setSongList.children[i]
                        const key = finalSong.querySelector(".key").innerText
                        const title = finalSong.querySelector(".song-title").innerText
                        const finalSongId = finalSong.id.split(SET_ID_PREFIX)[0]

                        // Last song is 'R' for "reflection"
                        const order = i == setSongList.childElementCount - 1 ? 'R' : i + 1

                        addTableRow(setTableClipboard, [order, `<a href="${songIdToLink[finalSongId]}">${title}</a>`, key])
                    }

                    // Copy table to clipboard
                    copyElement(setTableClipboard)
                }
            }
        })
    })
}

const addTableRow = (table, cols) => {
    row = document.createElement('tr')
    table.appendChild(row)

    cols.forEach(col => {
        const td = document.createElement('td')
        td.innerHTML = col
        row.appendChild(td)
    })
}

const copyElement = (element) => {
    const selection = window.getSelection()
    selection.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.addRange(range)
    document.execCommand("copy")
}

savePDFSetButton.addEventListener('click', () => postSetFile(false, (res) => downloadLink(res.download, res.name)))
printSetButton.addEventListener('click', () => postSetFile(true, (html) => printHTML(html)))
copySetTableButton.addEventListener('click', () => copySetSongTable())

updateExportSetToolbar()

Sortable.create(setSongList, {
    draggable: '.song',
    animation: 150,
    onUpdate: (event) => {
        // Sort order changed, so update save button
        updateSaveButton(true)
    }
})
