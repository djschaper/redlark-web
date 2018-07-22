const pdfWindow = document.getElementById("pdf-window")
const fileSelector = document.getElementById('file-selector')
const setSongList = document.getElementById('set-song-list')

function getSongFiles(folder) {
    var xhttp = new XMLHttpRequest()
    xhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            const files = JSON.parse(this.responseText)
            pdfWindow.setAttribute('src', files[0].link)

            // Clear file list
            while (fileSelector.firstChild) {
                fileSelector.removeChild(fileSelector.firstChild)
            }
            // Add new files to list
            files.forEach(file => {
                const option = document.createElement('option')
                option.setAttribute('value', file.link)
                option.innerText = file.name
                fileSelector.appendChild(option)
            })
        }
    }
    xhttp.open("GET", `/song?folder=${folder}`, true)
    xhttp.send()
}

let dragged

const drag = (event) => {
    dragged = event.target
    console.log(`Saved dragged object: ${dragged}`)
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

console.log('Setting up event listeners...')

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