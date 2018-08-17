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
const SET_ID_PREFIX = 'SET-ID:'

// Common objects
const pdfWindow = document.getElementById('pdf-window')
const fileSelector = document.getElementById('file-selector')
const setSongList = document.getElementById('set-song-list')
const songList = document.getElementById('song-list')
const songSearchbox = document.getElementById('song-searchbox')
const setNameInput = document.getElementById('set-name')
const saveSetButton = document.getElementById('save-set-button')
const openSetButton = document.getElementById('open-set-button')

let allSongs = []

// Functions
const getSongList = () => {
    const xhttp = new XMLHttpRequest()
    xhttp.responseType = 'document';
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            const songListXML = this.responseXML
            songList.innerHTML = songListXML.body.innerHTML

            allSongs = Array.from(songList.children).map(song => ({
                title: song.innerText.toLowerCase(),
                html: song.outerHTML
            }))
        }
    }
    xhttp.open("GET", `/songs`, true)
    xhttp.send()
}

const parseChord = (str) => {
    if (MUSICAL_CHORDS.includes(str)) return str;
    return null;
}

const selectSongKey = (preferPreset = false) => {
    let option = fileSelector.options[fileSelector.selectedIndex]

    // Save key for song in set
    const songId = fileSelector.getAttribute('data-song-id')
    if (songId.includes(SET_ID_PREFIX)) {
        const song = document.getElementById(songId)

        const key = parseChord(song.getElementsByClassName('key')[0].innerText)
        if (preferPreset && key) {
            // User has already picked a key for this song in the set, so use that
            optionIndex = Array.from(fileSelector.options).findIndex(opt => opt.getAttribute('data-key') === key)
            fileSelector.selectedIndex = optionIndex
            option = fileSelector.options[optionIndex]
        } else {
            // First time we are selecting a key, so pick default and update song
            song.getElementsByClassName('key')[0].innerText = option.getAttribute('data-key')
            updateSaveButton(true)
        }
    }

    // Update preview window
    pdfWindow.setAttribute('src', option.value)
}

const getSongFiles = (event) => {
    const xhttp = new XMLHttpRequest()
    const song = event.currentTarget.parentElement
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            const files = JSON.parse(this.responseText)

            // Clear file list
            fileSelector.innerText = ''
            fileSelector.setAttribute('data-song-id', song.id)

            // Add new files to list
            const options = files.map(file => {
                const option = document.createElement('option')
                option.setAttribute('value', file.link)
                const filenameSplit = file.name.replace('.pdf', '').split('-')
                let key = filenameSplit[filenameSplit.length - 1].trim()
                const isSheetMusic = key.toLowerCase().includes(SHEET_MUSIC_DELIMITER)
                if (isSheetMusic) key = key.split(' ')[0].trim()

                let optionText = file.name
                if (MUSICAL_CHORDS.includes(key)) {
                    optionText = key
                    option.setAttribute('data-key', key)
                    if (isSheetMusic) {
                        optionText = optionText + ' (Sheet)'
                    }
                } else {
                    option.setAttribute('data-key', '?')
                }

                option.innerText = optionText
                return option
            })

            // Sort keys alphabetically, with unrecognized name formats at bottom
            options.sort((a, b) => {
                const aTitle = a.innerText
                const bTitle = b.innerText
                if (aTitle.includes('.')) return 1
                if (bTitle.includes('.')) return -1

                if (aTitle < bTitle) return -1
                else if (aTitle > bTitle) return 1
                else return 0
            })
            options.forEach(option => fileSelector.appendChild(option))

            // Set PDf preview to first option
            selectSongKey(true)
        }
    }
    const folderId = song.id.split(SET_ID_PREFIX)[0]
    xhttp.open("GET", `/song?folder=${folderId}`, true)
    xhttp.send()
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

    updateSaveButton(true)

    // Don't add if dragging from set back to set
    if (dragged.parentElement === setSongList) return

    // Prevent arbitrary elements being dragged into set
    if (dragged.className !== 'song') return

    event.preventDefault()
    const copy = dragged.cloneNode(true)
    const id = dragged.getAttribute("id") + SET_ID_PREFIX + setSongIndex
    copy.setAttribute("id", id)
    setSongIndex++

    const songTitle = copy.querySelector('.song-title')
    songTitle.style.display = 'unset'
    resetTextForElement(songTitle)

    setSongList.appendChild(copy)
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

// Initialize song list
getSongList()

// Set up event listeners
setSongList.addEventListener('drop', addToSet)
setSongList.addEventListener('dragover', allowDrop)

Sortable.create(setSongList, {
    draggable: '.song',
    animation: 150
})

fileSelector.addEventListener('change', (event) => selectSongKey())

const searchSongs = (event) => {
    const search = event.target.value.toLowerCase()
    songList.innerText = ''
    songList.innerHTML = allSongs.filter(song => song.title.indexOf(search) >= 0).map(song => song.html).join('')
}
// Use timeout to wait for the value to be written to the event target
songSearchbox.addEventListener('keydown', (event) => setTimeout(() => searchSongs(event), 50))

const updateSaveButton = (unsavedChanges) => {
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

saveSetButton.addEventListener('click', (event) => {
    updateSaveButton(false)
})

// Set view transitions
const editSetView = document.getElementById('edit-set-view')
const openSetView = document.getElementById('open-set-view')
const viewTranslationX = editSetView.offsetWidth + 20

openSetButton.addEventListener('click', (event) => {
    editSetView.style.transform = `translateX(-${viewTranslationX}px)`
    openSetView.style.transform = `translateX(-${viewTranslationX}px)`
})


const goBackToSetView = () => {
    editSetView.style.transform = 'translateX(0px)'
    openSetView.style.transform = 'translateX(0px)'
}

document.getElementById('back-to-set-button').addEventListener('click', (event) => goBackToSetView())

const loadSet = (event) => {
    // Load songs from set
    goBackToSetView()
}