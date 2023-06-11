var list = [];
var chunkIndex = 0;
var chunkHandler = undefined;
var regex = new RegExp("");
const upperCaseRegex = /.*\p{Lu}.*$/u;
var audio = document.getElementById('player');
var audioSource = document.getElementById('audioSource');
var previousClick = undefined;
var leftOrRightPlaying = "Right";
var toCurrent = document.getElementById('to-current');
var shuffleButton = document.getElementById('shuffle-button');
var shuffle = false;

function store_shuffle() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("shuffle", shuffle);
    }
}

if (typeof(Storage) !== "undefined") {
    var storedShuffle = localStorage.getItem("shuffle");
    if (storedShuffle !== null) {
        shuffle = storedShuffle;
    }
}

toCurrent.onclick = function() {
    if (previousClick !== undefined) {
        previousClick.scrollIntoView();
    }
};

shuffleButton.onclick = function() {
    shuffle = !shuffle;
    console.log("Setting fontweight", (shuffle ? "900" : "0"));
    shuffleButton.style.fontWeight = shuffle ? "bold" : "normal";
};

audio.onended = function() {
    if (leftOrRightPlaying == "Left") {
        var included = document.getElementById('included');
        var le = included.children[Math.floor(1 + Math.random() * included.childElementCount)];
        le.click()
        le.scrollIntoView();
    } else {
    }
}

audio.onvolumechange = store_volume;

function store_volume() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("volume", audio.volume);
    }
}

if (typeof(Storage) !== "undefined") {
    var last_volume = localStorage.getItem("volume");
    if (last_volume !== null && last_volume != 0) {
        audio.volume = last_volume;
    }
}

function play_song(side) {
    return function(event) {
        leftOrRightPlaying = side;

        if (previousClick !== undefined)
            previousClick.style.color = "white";
        previousClick = event.target;

        audio.pause();
        event.target.style.color = "red";
        audioSource.src = "/files/music/" + event.target.innerHTML;
        audio.load();
        audio.play();
    };
}

function processFilterChunk() {
    var included = document.getElementById('included');
    var processed = 0;
    for (var idx = chunkIndex; idx < list.length; ++idx) {
        if (regex.test(list[idx])) {
            processed += 1;
            const para = document.createElement("p");
            const node = document.createTextNode(list[idx]);
            para.appendChild(node);
            para.addEventListener('click', play_song("Left"));
            included.appendChild(para);

            if (processed == 100) {
                break;
            }
        }
        chunkIndex = idx + 1;
    }

    if (processed != 0 && chunkIndex < list.length) {
        chunkHandler = setTimeout(processFilterChunk, 50);
    }
}

function input(event) {
    chunkIndex = 0;
    console.log("INPUT");

    if (chunkHandler !== undefined) {
        clearTimeout(chunkHandler);
        chunkHandler = undefined;
    }

    const searchTerm = event.target.value;
    const caseSensitive = upperCaseRegex.test(searchTerm) ? '' : 'i';
    console.log('case:', caseSensitive);
    regex = new RegExp(event.target.value, caseSensitive);
    document.getElementById('included').innerHTML = '';

    processFilterChunk();
}

document.getElementById('filter').addEventListener('input', input);

function getList(callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(JSON.parse(xmlHttp.responseText));
    }
    const asynchronous = true;
    xmlHttp.open("GET", "/list", asynchronous);
    xmlHttp.send(null);
}

function updateList(newList) {
    list = newList;
    var newNodes = [];

    for (idx in list) {
        const para = document.createElement("p");
        const node = document.createTextNode(list[idx]);
        para.appendChild(node);
        para.addEventListener('click', play_song("Right"));
        newNodes.push(para);
    }

    document.getElementById('excluded').replaceChildren(...newNodes);
}

setInterval(getList, 3600_000, updateList);

getList(updateList);
