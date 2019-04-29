const openSongFolder = document.getElementById('opensong-folder')
const openSongFolderBrowser = document.getElementById('opensong-folder-browser')

openSongFolderBrowser.addEventListener('change', (event) => {
    if (openSongFolderBrowser.files.length == 0) {
        // Don't change the value if no file was selected via the browser
        return
    }
    openSongFolder.value = openSongFolderBrowser.files[0].path
})