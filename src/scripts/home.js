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

/// Common objects //////////////////////////////////////////////////////
const previewWindow = document.getElementById('preview-window')
const setSongList = document.getElementById('set-song-list')
const songList = document.getElementById('song-list')
const songSearchbox = document.getElementById('song-searchbox')
const setNameInput = document.getElementById('set-name')
const saveSetButton = document.getElementById('save-set-button')
const openSetButton = document.getElementById('open-set-button')
const setList = document.getElementById('set-list')

let allSongs = []

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
                html: song.outerHTML
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
            console.log(sets)
            setList.innerHTML = sets.body.innerHTML
        }
    })
}

const getSong = (event) => {
    const song = event.currentTarget.parentElement
    const songId = song.id.split(SET_ID_PREFIX)[0]
    ajax({
        method: 'GET',
        route: `/song?id=${songId}`,
        type: RESPONSE_TYPES.TEXT,
        handler: (html) => {
            previewWindow.setAttribute('srcdoc', html)
        }
    })
}

/// Main ////////////////////////////////////////////////////////////////

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

const trySaveSet = () => {
    const setName = document.getElementById('set-name').value
}

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
    getSets()
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

Sortable.create(setSongList, {
    draggable: '.song',
    animation: 150
})