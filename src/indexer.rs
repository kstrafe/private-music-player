use {
    chrono::{prelude::*, DateTime},
    std::{
        collections::HashMap,
        fs,
        path::{Path, PathBuf},
        sync::{Arc, RwLock},
        thread,
        time::Duration,
    },
};

static SESSION_EXPIRES_MINUTES: i64 = 60 * 24 * 7;
static IGNORABLE_FILES: &[&str] = &["cue", "gif", "jpeg", "jpg", "m3u", "m4a", "md5", "ffp", "png", "webp"];

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
        cleanup_old_sessions(&state);
        thread::sleep(Duration::from_secs(60 * 10));
    }
}

fn update_music_index(state: &State) {
    fn recur<P: AsRef<Path>>(items: &mut Vec<PathBuf>, path: P) {
        if let Ok(music) = fs::read_dir(path) {
            for item in music.flatten() {
                if let Ok(file_type) = item.file_type() {
                    if file_type.is_dir() {
                        recur(items, &item.path());
                    } else if file_type.is_file() && has_music_extension(item.path()) {
                        items.push(item.path().strip_prefix("files/music").unwrap().into());
                    } else {
                        report_unknown_file(item.path());
                    }
                }
            }
        }
    }

    let mut items = Vec::new();
    recur(&mut items, "files/music");
    items.sort();
    *state.music.write().unwrap() = items;
}

fn has_music_extension<P: AsRef<Path>>(path: P) -> bool {
    if let Some(ext) = path.as_ref().extension() {
        if let Some(ext) = ext.to_str() {
            match ext {
                "mp3" | "flac" | "ogg" => return true,
                _ => return false,
            }
        }
    }
    false
}

fn report_unknown_file<P: AsRef<Path> + std::fmt::Debug>(path: P) {
    match path.as_ref().extension() {
        Some(extension) => {
            match extension.to_str() {
                Some(extension) => {
                    let extension = extension.to_lowercase();
                    if !IGNORABLE_FILES.iter().any(|x| x == &extension) {
                        println!("Unknown file: {:?}", path)
                    }
                }
                None => {
                    println!("Unknown file (unable to convert extension): {:?}", path)
                }
            }
        }
        None => {
            println!("Unknown file (unable to retrieve extension): {:?}", path)
        }
    }
}

fn cleanup_old_sessions(state: &State) {
    let now = Utc::now();
    let mut map = state.sessions.read().unwrap().clone();
    let mut to_remove = vec![];
    for (key, value) in map.drain() {
        if now.signed_duration_since(value) > chrono::Duration::minutes(SESSION_EXPIRES_MINUTES) {
            to_remove.push(key);
        }
    }

    println!("Removing old sessions:");
    for key in &to_remove {
        println!("| {}", key);
    }

    if to_remove.is_empty() {
        println!("| No sessions to remove");
    }

    let mut map = state.sessions.write().unwrap();
    for key in to_remove.drain(..) {
        map.remove(&key);
    }
}

#[derive(Clone)]
pub struct State {
    pub music: Arc<RwLock<Vec<PathBuf>>>,
    pub sessions: Arc<RwLock<HashMap<String, DateTime<Utc>>>>,
}

impl State {
    fn new() -> Self {
        Self {
            music: Arc::new(RwLock::new(Vec::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
