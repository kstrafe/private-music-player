/* jshint esversion: 9 */

// Global state helpers ====================================

function getLS(name, otherwise) { if (typeof(Storage) !== "undefined") {
        var last = localStorage.getItem(name);
        if (last !== null) {
            return last;
        } else {
            return otherwise;
        }
    }
}

function strToBool(string) { if (string === "false") { return false; } else { return true; } }

// Global state ============================================

const state = {
    audio:         document.getElementById('player'),
    excludedList:  document.getElementById('excluded'),
    filter:        document.getElementById('filter'),
    includedList:  document.getElementById('included'),
    nextButton:    document.getElementById('next-button'),
    prevButton:    document.getElementById('prev-button'),
    shuffleButton: document.getElementById('shuffle-button'),
    toCurrent:     document.getElementById('to-current'),

    chunk: { handler: null, index: 0 },
    currentlyPlaying: undefined,
    isPlaying: true,
    leftOrRightPlaying: "Left",
    list: [],
    playingIndex: -1,
    realClick: true,
    regex: new RegExp(getLS("regex", "")),
    shuffle: strToBool(getLS("shuffle", "false")),
    history: { items: [], index: -1 },
    upperCaseRegex: /.*\p{Lu}.*$/u,

    logger: {
        contexts: {
            'play': false,
        },
        log(...args) {
            if (args.length <= 1) {
                throw "Must provide at least 2 arguments to `log`"
            }
            var ctx = args.splice(0, 1);

            var isOn = this.contexts[ctx];
            if (isOn === undefined) {
                this.contexts[ctx] = true;
                isOn = true;
            }

            if (isOn) {
                console.log('[' + ctx + ']', ...args);
            }
        }
    },
};

// Methods =================================================

function tryRehomeItem(item) {
    if (item.parentNode !== null) {
        return item;
    }

    var children;
    if (state.leftOrRightPlaying === "Left") {
        children = state.includedList.children;
    } else {
        children = state.excludedList.children;
    }

    for (var idx in children) {
        if (children[idx].innerHTML == item.innerHTML) {
            return children[idx];
        }
    }
    return null;
}

function ensureRehomedHistory(direction) {
    function log(...args) { state.logger.log("rehome", ...args); }
    while (true) {
        var item = state.history.items[state.history.index];
        log("Ensuring item is not orphaned:", item.innerHTML);
        if (item.parentNode !== null &&
            ((state.leftOrRightPlaying === "Left" && item.parentNode === state.includedList) ||
                (state.leftOrRightPlaying === "Right" && item.parentNode === state.excludedList))) {
            log("Item has parent in currently playing list, no rehoming necessary");
            return state.history.index;
        }

        var children;
        if (state.leftOrRightPlaying === "Left") {
            children = state.includedList.children;
        } else {
            children = state.excludedList.children;
        }

        for (var idx in children) {
            if (children[idx].innerHTML == item.innerHTML) {
                state.history.items[state.history.index] = children[idx];
                log("Item content found in list, rehoming on index:", idx);
                return state.history.index;
            }
        }

        state.history.items.splice(state.history.index, 1);
        if (state.history.index >= 0 && state.history.index < state.history.items.length)
            log("Attempting to use next item instead");
        else {
            if (direction > 0) {
                state.history.index = state.history.items.length - 1;
            } else if (direction < 0) {
                state.history.index = 0;
            }
            log("No rehomable items found, list exhausted, current index:", state.history.index, 'history:', state.history.items.length);
            return null;
        }

    }
}

function playViaItemDiscovery(item) {
    state.realClick = false;
    item.click();
    item.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
    });
}

function onPlayPrev() {
    function log(...args) { state.logger.log("onprev", ...args); }

    if (state.history.index <= 0) {
        log("No more history to play");
        return;
    }
    state.history.index -= 1;
    log("Attempting to play history item:", state.history.index + '/' + state.history.items.length);

    if (ensureRehomedHistory(-1) == null) {
        log("No more history to play (no item in the history could be rehomed)");
        return;
    }

    var item = state.history.items[state.history.index];
    playViaItemDiscovery(item);
}

function onPlayNext() {
    function log(...args) { state.logger.log("onnext", ...args); }

    function internalPlayNext(fromList) {
        const children = fromList.children;
        const count = fromList.childElementCount;
        if (count === 0) {
            log("There is nothing to play in the selected list");
            return;
        }

        var item = null;

        if (state.shuffle) {
            log("Choosing random item");
            item = children[Math.floor(Math.random() * count)];
        } else {
            log("Choosing next item");
            state.playingIndex += 1;
            if (state.playingIndex >= count) {
                state.playingIndex = 0;
            }
            item = children[state.playingIndex];
        }

        playViaItemDiscovery(item);
    }

    if (state.history.index !== state.history.items.length - 1) {
        log("Inside a history chain, play next in history");
        state.history.index += 1;
        if (ensureRehomedHistory(1) == null) {
            log("Unable to find rehomable history, playing natural next instead");
            onPlayNext();
            return;
        }
        var item = state.history.items[state.history.index];
        state.history.index -= 1;
        playViaItemDiscovery(item);
        state.history.index += 1;
        return;
    }

    if (state.leftOrRightPlaying == "Left") {
        log("Play included/left/top list");
        internalPlayNext(state.includedList);
    } else if (state.leftOrRightPlaying == "Right") {
        log("Play excluded/right/bottom list");
        internalPlayNext(state.excludedList);
    } else {
        console.error("leftOrRightPlaying is neither Left nor Right:", state.leftOrRightPlaying);
    }
}

function truncateNextHistory() {
    function log(...args) { state.logger.log("histor", ...args); }

    if (state.history.index !== state.history.items.length - 1) {
        log("Truncated following history");
        state.history.items.length = state.history.index + 1;
    }
}

function markShuffleButton() {
    var p = document.createElement("p")
    if (state.shuffle) {
        p.innerHTML = "🔀";
    } else {
        p.innerHTML = "➡️";
    }
    state.shuffleButton.replaceChildren(p);
}

function onShuffleButtonClicked() {
    state.shuffle = !state.shuffle;
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("shuffle", state.shuffle);
    }

    truncateNextHistory();
    markShuffleButton();
}

function focusOnCurrentlyPlaying() {
    if (state.currentlyPlaying !== undefined) {
        let target = state.currentlyPlaying;
        let parent = target.parentNode;
        if (parent == null) {
            return;
        }
        let value = target.offsetTop - (parent.offsetTop + parent.offsetHeight / 2);
        parent.scrollTo({top: value, behavior: 'smooth'});
    }
}

function setActiveRegex(value) {
    const caseSensitive = state.upperCaseRegex.test(value) ? '' : 'i';
    state.regex = new RegExp(value, caseSensitive);

    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("regex", value);
    }
}

function storeVolume() {
    if (typeof(Storage) !== "undefined") {
        localStorage.setItem("volume", state.audio.volume);
    }
}

async function playAudio() {
    if (state.audio.paused && !state.isPlaying) {
        await state.audio.play();
        navigator.mediaSession.playbackState = "playing";
    }
} 

function pauseAudio() {
    if (!state.audio.paused && state.isPlaying) {
        state.audio.pause();
        navigator.mediaSession.playbackState = "paused";
    }
}

function onPreviousTrack() {
    function log(...args) { state.logger.log("onprev", ...args); }
    if (state.audio.currentTime < 5) {
        log("Play time within 5 seconds, choose previous track");
        onPlayPrev();
        return;
    }
    log("Play time beyond 5 seconds, seek zero");
    state.audio.currentTime = 0;
}

function onSongClicked(side) {
    return function(event) {
        function log(...args) { state.logger.log("songcl", ...args); }

        if (state.realClick)
            log("Song got directly clicked");

        function decodeHtml(html) {
            var txt = document.createElement("textarea");
            txt.innerHTML = html;
            return txt.value;
        }

        function playHandler(err) {
            function log(...args) { state.logger.log("playin", ...args); }
            log(`${err.message}\nResource: ${src}`);
            state.audio.play().catch(playHandler);
        }

        state.leftOrRightPlaying = side;

        if (state.currentlyPlaying !== undefined)
            state.currentlyPlaying.classList.remove("currently-playing");

        state.currentlyPlaying = event.target;
        var parent = state.currentlyPlaying.parentNode;
        state.playingIndex = Array.prototype.indexOf.call(parent.children, state.currentlyPlaying);

        state.audio.pause();
        event.target.classList.add("currently-playing");

        var src = decodeHtml("/files/music/" + event.target.innerHTML);
        var enc = encodeURIComponent(src).replace(/%2F/g, "/");
        const source = document.createElement("source");
        source.setAttribute("src", enc);

        var curImg = new Image();
        var base = enc.substr(0, enc.lastIndexOf('/'));
        curImg.src = `${base}/?art`;
        curImg.onload = function(){
            var onElem = null;
            if (state.audio.childElementCount === 1) {
                onElem = state.audio.children[0].getAttribute('src');
                onElem = onElem.substr(0, onElem.lastIndexOf('/'));
            }
            if (onElem == base) {
                document.body.style.backgroundImage = `url("${base}/?art")`;
            }
        }


        if (state.realClick) {
            truncateNextHistory();
        } else {
            state.realClick = true;
        }

        if (state.history.index === state.history.items.length - 1) {
            state.history.items.push(event.target);
            state.history.index = state.history.items.length - 1;
        }

        state.audio.replaceChildren(source);

        state.audio.load();
        state.audio.play().catch(playHandler);
        // state.audio.play().catch((err) => {
        //     function log(...args) { state.logger.log("playin", ...args); }
        //     log(`${err.message}\nResource: ${src} ${state.audio.children[0].getAttribute('src')}`);
        //     state.audio.load();
        //     state.audio.play().catch((err) => {
        //         log(`${err.message}\nResource: ${src} ${state.audio.children[0].getAttribute('src')}`);
        //     });
        // });

        navigator.mediaSession.playbackState = "playing";
        if ("mediaSession" in window.navigator) {
            const items = src.split("/");
            const title = items[items.length - 1] || "Unknown";
            const album = items[items.length - 2] || "Unknown";
            const artist = items[items.length - 3] || "Unknown";
            log("Playing new stream | Setting mediaSession variables title:", title, "| artist:", artist, "| album:", album);
            window.navigator.mediaSession.metadata.title = title;
            window.navigator.mediaSession.metadata.album = album;
            window.navigator.mediaSession.metadata.artist = artist;
        } else {
            log("Playing new stream");
        }
    };
}

function handleInput(target) {
    function log(...args) { state.logger.log("filter", ...args); }
    function processFilterChunk() {
        var included = state.includedList;
        var processed = 0;
        for (var idx = state.chunk.index; idx < state.list.length; ++idx) {
            if (state.regex.test(state.list[idx])) {
                processed += 1;
                const para = document.createElement("p");
                const node = document.createTextNode(state.list[idx]);
                para.appendChild(node);
                para.addEventListener('click', onSongClicked("Left"));

                included.appendChild(para);

                if (state.currentlyPlaying !== undefined && state.leftOrRightPlaying === "Left") {
                    if (state.currentlyPlaying.innerHTML === para.innerHTML) {
                        state.currentlyPlaying = para;
                        state.currentlyPlaying.classList.add("currently-playing");
                        state.playingIndex = included.childElementCount - 1;
                    }
                }

                if (processed == 50) {
                    break;
                }
            }
            state.chunk.index = idx + 1;
        }

        if (processed != 0 && state.chunk.index < state.list.length) {
            state.chunk.handler = setTimeout(processFilterChunk, 50);
        } else {
            log("Finished processing all chunks");
        }
    }

    function resetChunkProcessor() {
        if (state.chunk.handler !== null) {
            log("Cancelling in-flight chunk processor");
            clearTimeout(state.chunk.handler);
        }

        state.chunk = { handler: null, index: 0 };
    }

    function clearIncludedList() {
        state.includedList.innerHTML = '';
    }

    log("Start filtering");
    resetChunkProcessor();
    setActiveRegex(target.value);
    clearIncludedList();

    setTimeout(processFilterChunk(), 0);
}

function onInput(event) {
    handleInput(event.target);
}

function updateList() {
    function log(...args) { state.logger.log("update", ...args); }

    function updateListInternal(newList) {
        log("Existing list item count:", state.list.length, "incoming list item count:", newList.length);
        state.list = newList;
        var newNodes = [];

        for (var idx in state.list) {
            const para = document.createElement("p");
            const node = document.createTextNode(state.list[idx]);
            para.appendChild(node);
            para.addEventListener('click', onSongClicked("Right"));
            newNodes.push(para);

            if (state.currentlyPlaying !== undefined && state.leftOrRightPlaying === "Right") {
                if (state.currentlyPlaying.innerHTML === para.innerHTML) {
                    state.currentlyPlaying = para;
                    state.currentlyPlaying.classList.add("currently-playing");
                    state.playingIndex = included.childElementCount - 1;
                }
            }
        }

        state.excludedList.replaceChildren(...newNodes);
        handleInput(state.filter);
    }

    log("Sending update request to server");
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        log("Received response:", xmlHttp.status, 'readyState:', xmlHttp.readyState);
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            log("Final response");
            updateListInternal(JSON.parse(xmlHttp.responseText));
        }
    };
    const asynchronous = true;
    xmlHttp.open("GET", "/list", asynchronous);
    xmlHttp.send(null);
}

// Initialization ==========================================

function setFilterFromLastSession() { state.filter.value = getLS("regex", "Greg|Spirit.*Eden"); }
function setVolumeFromLastSession() { state.audio.volume = getLS("volume", 1); }

markShuffleButton();
setFilterFromLastSession();
setVolumeFromLastSession();

// MediaSession setup ======================================

function updatePositionState() {
    if (!isNaN(state.audio.duration) && isFinite(state.audio.duration)) {
        navigator.mediaSession.setPositionState({
            duration: state.audio.duration,
            playbackRate: state.audio.playbackRate,
            position: state.audio.currentTime,
        });
        state.audio.session = navigator.mediaSession;
    }
}

if ("mediaSession" in navigator) {
    window.navigator.mediaSession.metadata = new MediaMetadata();
    state.audio.session = navigator.mediaSession;

    const actionHandlers = [
      ['play',          playAudio],
      ['pause',         pauseAudio],
      ['previoustrack', onPreviousTrack],
      ['nexttrack',     onPlayNext],
    ];

    for (const [action, handler] of actionHandlers) {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
            console.log(`The media session action "${action}" is not supported yet.`);
        }
    }

    if ('setPositionState' in navigator.mediaSession) {
        const audioHandlers = [
          ['ratechange',         updatePositionState],
          ['timeupdate',         updatePositionState],
          ['durationchange',     updatePositionState],
        ];

        for (const [action, handler] of audioHandlers) {
            try {
                state.audio.addEventListener(action, handler);
            } catch (error) {
                console.log(`The audio event "${action}" is not supported yet.`);
            }
        }
    }
} else {
    console.log("System lacks mediaSession navigator");
}

// Event setup =============================================

state.filter.oninput = onInput;
state.audio.onended = onPlayNext;
state.audio.onpause = () => state.isPlaying = false;
state.audio.onplaying = () => state.isPlaying = true;
state.audio.onvolumechange = storeVolume;
state.nextButton.onclick = onPlayNext;
state.prevButton.onclick = onPlayPrev;
state.shuffleButton.onclick = onShuffleButtonClicked;
state.toCurrent.onclick = focusOnCurrentlyPlaying;

setInterval(updateList, 300_000);

// Initial update ==========================================

updateList();
