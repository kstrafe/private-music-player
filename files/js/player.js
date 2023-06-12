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
    playingIndex: -1,
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
    if (state.shuffle) {
        state.shuffleButton.classList.add("selected");
    } else {
        state.shuffleButton.classList.remove("selected");
    }
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

state.audio.onended = function(event) {
    // console.log("onended", event);
    playNext();
}
state.audio.onvolumechange = storeVolume;

// function reportAction(name) {
//     return function reportAction(event) {
//         if (name == "error") {
//             switch (event.target.error.code) {
//                 case event.target.error.MEDIA_ERR_ABORTED:
//                   console.log('You aborted the video playback.');
//                   break;
//                 case event.target.error.MEDIA_ERR_NETWORK:
//                   console.log('A network error caused the audio download to fail.');
//                   break;
//                 case event.target.error.MEDIA_ERR_DECODE:
//                   console.log('The audio playback was aborted due to a corruption problem or because the video used features your browser did not support.');
//                   break;
//                 case event.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
//                   console.log('The video audio not be loaded, either because the server or network failed or because the format is not supported.');
//                   break;
//                 default:
//                   console.log('An unknown error occurred.');
//                   break;
//             }
//             console.log(name, 'message:', event.target.error.message, 'code:', event.target.error.code);
//         }
//         console.log(name, event);
//     };
// }

// state.audio.onabort = reportAction("abort");
// state.audio.oncanplay = reportAction("canplay");
// state.audio.oncanplaythrough = reportAction("canplaythrough");
// state.audio.ondurationchange = reportAction("durationchange");
// state.audio.onemptied = reportAction("emptied");
// state.audio.onencrypted = reportAction("encrypted");
// // state.audio.onended = reportAction("ended");
// state.audio.onerror = reportAction("error");
// state.audio.onloadeddata = reportAction("loadeddata");
// state.audio.onloadedmetadata = reportAction("loadedmetadata");
// state.audio.onloadstart = reportAction("loadstart");
// state.audio.onpause = reportAction("pause");
// state.audio.onplay = reportAction("play");
// state.audio.onplaying = reportAction("playing");
// // state.audio.onprogress = reportAction("progress");
// state.audio.onratechange = reportAction("ratechange");
// state.audio.onseeked = reportAction("seeked");
// state.audio.onseeking = reportAction("seeking");
// state.audio.onstalled = reportAction("stalled");
// state.audio.onsuspend = reportAction("suspend");
// // state.audio.ontimeupdate = reportAction("timeupdate");
// // state.audio.onvolumechange = reportAction("volumechange");
// state.audio.onwaiting = reportAction("waiting");

function storeVolume() {
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
            state.previousClick.classList.remove("currently-playing");

        state.previousClick = event.target;
        var parent = state.previousClick.parentNode;
        state.playingIndex = Array.prototype.indexOf.call(parent.children, state.previousClick);

        state.audio.pause();
        event.target.classList.add("currently-playing");
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

            if (state.previousClick !== undefined && state.leftOrRightPlaying === "Left") {
                if (state.previousClick.innerHTML === para.innerHTML) {
                    state.previousClick = para;
                    state.previousClick.classList.add("currently-playing");
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

setInterval(getList, 300_000, updateList);

getList(updateList);
