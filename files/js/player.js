var state = {
    list: [],
    chunkIndex: 0,
    chunkHandler: undefined,
    regex: new RegExp(""),
    upperCaseRegex: /.*\p{Lu}.*$/u,
    audio: document.getElementById('player'),
    audioSource: document.getElementById('audioSource'),
    leftOrRightPlaying: "Right",
    toCurrent: document.getElementById('to-current'),
    shuffleButton: document.getElementById('shuffle-button'),
    nextButton: document.getElementById('next-button'),
    shuffle: false,

    previousClick: undefined,
    playingIndex: undefined,
    storedRegex: "",
};

function store_regex() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("regex", state.storedRegex);
    }
}

if (typeof(Storage) !== "undefined") {
    var storedRegex = localStorage.getItem("regex");
    if (storedRegex !== null) {
        state.storedRegex = storedRegex;
    }
}

function store_shuffle() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("shuffle", state.shuffle);
    }
}

if (typeof(Storage) !== "undefined") {
    var storedShuffle = localStorage.getItem("shuffle");
    if (storedShuffle !== null) {
        state.shuffle = storedShuffle;
    }
}

state.nextButton.onclick = playNext;


state.toCurrent.onclick = function() {
    if (state.previousClick !== undefined) {
        state.previousClick.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
        });
    }
};

state.shuffleButton.onclick = function() {
    state.shuffle = !state.shuffle;
    state.shuffleButton.style.fontWeight = state.shuffle ? "bold" : "normal";
};

function playNext() {
    function internalPlayNext(fromList) {
        const children = fromList.children;
        const count = fromList.childElementCount;
        if (count === 0) {
            return;
        }

        var item;

        if (state.shuffle) {
            item = children[Math.floor(1 + Math.random() * count)];
        } else {
            state.playingIndex += 1;
            if (state.playingIndex >= count) {
                state.playingIndex = 0;
            }
            item = children[state.playingIndex];
        }

        item.click()
        item.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
        });
    }

    if (state.leftOrRightPlaying == "Left") {
        const included = document.getElementById('included');
        internalPlayNext(included);
    } else if (state.leftOrRightPlaying = "Right") {
        const excluded = document.getElementById('excluded');
        internalPlayNext(excluded)
    } else {
        console.error("leftOrRightPlaying is neither Left nor Right:", leftOrRightPlaying);
    }
}

state.audio.onended = playNext;

state.audio.onvolumechange = store_volume;

function store_volume() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("volume", state.audio.volume);
    }
}

if (typeof(Storage) !== "undefined") {
    var last_volume = localStorage.getItem("volume");
    if (last_volume !== null && last_volume != 0) {
        state.audio.volume = last_volume;
    }
}

function play_song(side) {
    return function(event) {
        function decodeHtml(html) {
            var txt = document.createElement("textarea");
            txt.innerHTML = html;
            return txt.value;
        }

        state.leftOrRightPlaying = side;

        if (state.previousClick !== undefined)
            state.previousClick.style.color = "white";

        state.previousClick = event.target;
        var parent = state.previousClick.parentNode;
        state.playingIndex = Array.prototype.indexOf.call(parent.children, state.previousClick);

        state.audio.pause();
        event.target.style.color = "red";
        state.audioSource.src = decodeHtml("/files/music/" + event.target.innerHTML);
        state.audio.load();
        state.audio.play();
    };
}

function processFilterChunk() {
    var included = document.getElementById('included');
    var processed = 0;
    for (var idx = state.chunkIndex; idx < state.list.length; ++idx) {
        if (state.regex.test(state.list[idx])) {
            processed += 1;
            const para = document.createElement("p");
            const node = document.createTextNode(state.list[idx]);
            para.appendChild(node);
            para.addEventListener('click', play_song("Left"));

            if (state.previousClick !== undefined) {
                if (state.previousClick.innerHTML === para.innerHTML) {
                    para.style.color = "red";
                    state.previousClick = para;
                    state.playingIndex = included.childElementCount;
                }
            }

            included.appendChild(para);


            if (processed == 100) {
                break;
            }
        }
        state.chunkIndex = idx + 1;
    }

    if (processed != 0 && state.chunkIndex < state.list.length) {
        state.chunkHandler = setTimeout(processFilterChunk, 50);
    }
}

function input(event) {
    handleInput(event.target)
}
function handleInput(target) {
    state.chunkIndex = 0;

    if (state.chunkHandler !== undefined) {
        clearTimeout(state.chunkHandler);
        state.chunkHandler = undefined;
    }

    const searchTerm = target.value;
    const caseSensitive = state.upperCaseRegex.test(searchTerm) ? '' : 'i';
    state.regex = new RegExp(target.value, caseSensitive);
    state.storedRegex = target.value;
    store_regex();
    document.getElementById('included').innerHTML = '';

    processFilterChunk();
}

var filter = document.getElementById('filter');
filter.value = state.storedRegex;
filter.addEventListener('input', input);

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
    state.list = newList;
    var newNodes = [];

    for (idx in state.list) {
        const para = document.createElement("p");
        const node = document.createTextNode(state.list[idx]);
        para.appendChild(node);
        para.addEventListener('click', play_song("Right"));
        newNodes.push(para);
    }

    document.getElementById('excluded').replaceChildren(...newNodes);
    handleInput(filter);
}

setInterval(getList, 3600_000, updateList);

getList(updateList);
