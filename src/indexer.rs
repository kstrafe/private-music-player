use {
    actix_web::cookie::Key,
    std::{fs, path::{Path, PathBuf}, sync::{Arc, RwLock}, thread, time::Duration},
};

pub fn create_state_updater_with_thread() -> State {
    let state = State::new();
    let state_for_updater = state.clone();
    thread::Builder::new()
        .name("state-updater".to_string())
        .spawn(move || {
            update_state_loop(state_for_updater);
        })
        .expect("Unable to start the updater thread");

    state
}

fn update_state_loop(state: State) {
    loop {
        update_music_index(&state);
        thread::sleep(Duration::from_secs(60 * 30));
    }
}

fn update_music_index(state: &State) {
    fn recur<P: AsRef<Path>>(state: &State, items: &mut Vec<PathBuf>, path: P) {
        if let Ok(music) = fs::read_dir(path) {
            for item in music {
                if let Ok(item) = item {
                    if let Ok(file_type) = item.file_type() {
                        if file_type.is_file() && has_music_extension(item.path()) {
                            items.push(item.path().strip_prefix("files/music").unwrap().into());
                        } else if file_type.is_dir() {
                            recur(state, items, &item.path());
                        } else {
                            eprintln!("indexer: Skipping file: {:?}", item.path())
                        }
                    }
                }
            }
        }
    }

    let mut items = Vec::new();
    recur(&state, &mut items, "files/music");
    items.sort();
    *state.music.write().unwrap() = items;
}

fn has_music_extension<P: AsRef<Path>>(path: P) -> bool {
    if let Some(ext) = path.as_ref().extension() {
        if let Some(ext) = ext.to_str() {
            match ext {
                "mp3"
                | "flac"
                | "ogg"
                => return true,
                _ => return false,
            }
        }
    }
    false
}

#[derive(Clone)]
pub struct State {
    pub key: Arc<Key>,
    pub music: Arc<RwLock<Vec<PathBuf>>>,
}

impl State {
    fn new() -> Self {
        Self {
            key: Arc::new(Key::generate()),
            music: Arc::new(RwLock::new(Vec::new())),
        }
    }
}
