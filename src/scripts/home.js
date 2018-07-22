const MUSICAL_KEYS = [
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
// Add the minors programmatically because I'm lazy
MUSICAL_KEYS.concat(MUSICAL_KEYS.map(key => key + 'm'))
const SHEET_MUSIC_DELIMITER = 'sheet'

const pdfWindow = document.getElementById('pdf-window')
const fileSelector = document.getElementById('file-selector')
const setSongList = document.getElementById('set-song-list')
const songList = document.getElementById('song-list')
const songSearchbox = document.getElementById('song-searchbox')

const allSongs = Array.from(songList.children).map(song => ({
    title: song.innerText.toLowerCase(),
    html: song.outerHTML
}))

function getSongFiles(folder) {
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            const files = JSON.parse(this.responseText)

            // Clear file list
            fileSelector.innerText = ''

            // Add new files to list
            const options = files.map(file => {
                const option = document.createElement('option')
                option.setAttribute('value', file.link)
                const filenameSplit = file.name.replace('.pdf', '').split('-')
                let key = filenameSplit[filenameSplit.length - 1].trim()
                const isSheetMusic = key.toLowerCase().includes(SHEET_MUSIC_DELIMITER)
                if (isSheetMusic) key = key.split(' ')[0].trim()

                let optionText = file.name
                if (MUSICAL_KEYS.includes(key)) {
                    optionText = key
                    if (isSheetMusic) {
                        optionText = optionText + ' (Sheet)'
                    }
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
            pdfWindow.setAttribute('src', options[0].value)
        }
    }
    xhttp.open("GET", `/song?folder=${folder}`, true)
    xhttp.send()
}

// Handle drag and drop
let dragged

const drag = (event) => {
    dragged = event.target
}

const allowDrop = (event) => {
    event.preventDefault()
}

let setSongId = 0;

const addToSet = (event) => {
    if (setSongList.contains(dragged)) {
        return
    }

    event.preventDefault()
    const copy = dragged.cloneNode(true)
    copy.setAttribute("id", `${dragged.getAttribute("id")}-${setSongId}`)
    setSongId++
    setSongList.appendChild(copy)
    dragged = null
}

const removeElement = (event, parentId) => {
    event.preventDefault()
    const parent = document.getElementById(parentId)
    if (parent.contains(dragged)) {
        parent.removeChild(dragged)
    }
    dragged = null
}

// Set up event listeners
setSongList.addEventListener('drop', addToSet)
setSongList.addEventListener('dragover', allowDrop)

const setSongListSortable = Sortable.create(setSongList, {
    filter: '.remove',
    onFilter: function (evt) {
        var el = setSongListSortable.closest(evt.item); // get dragged item
        el && el.parentNode.removeChild(el);
    }
})

fileSelector.addEventListener('change', (event) => {
    pdfWindow.setAttribute('src', event.target.value)
})

const searchSongs = (event) => {
    const search = event.target.value.toLowerCase()
    songList.innerText = ''
    songList.innerHTML = allSongs.filter(song => song.title.indexOf(search) >= 0).map(song => song.html).join('')
}
// Use timeout to wait for the value to be written to the event target
songSearchbox.addEventListener('keydown', (event) => setTimeout(() => searchSongs(event), 50))