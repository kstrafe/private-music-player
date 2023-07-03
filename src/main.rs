#!(feature(proc_macro_hygiene)]
use {
    self::updater::{create_state_updater_with_thread, State},
    actix_files::NamedFile,
    actix_service::Service,
    actix_web::{
        cookie::Cookie,
        error,
        http::{header::ContentType, StatusCode},
        web,
        web::Data,
        App, HttpRequest, HttpResponse, HttpServer, Responder,
    },
    chrono::prelude::*,
    derive_more::Display,
    maud::{html, Markup, DOCTYPE},
    serde_derive::{Deserialize, Serialize},
    sha2::{Digest, Sha512},
    std::{
        fs::File,
        io::{self, Read},
        num::ParseIntError,
        path::PathBuf,
    },
    uuid::Uuid,
};

mod updater;

static PORT: u16 = 8081;
static DESCRIPTION: &str = "Private music player";
static SINGULAR: &str = "Private music player";

fn header(css: Markup) -> Markup {
    let december = Utc::now().month() == 12;
    html! {
        meta charset="UTF-8";
        meta name="viewport" content="width=device-width,maximum-scale=1,minimum-scale=1,minimal-ui";
        @if december {
            link rel="icon" type="image/png" href="/files/favicon/16_christmas.png";
            link rel="icon" type="image/png" href="/files/favicon/32_christmas.png";
            link rel="icon" type="image/png" href="/files/favicon/64_christmas.png";
            link rel="icon" type="image/png" href="/files/favicon/128_christmas.png";
        } @else {
            link rel="icon" type="image/png" href="/files/favicon/16.png";
            link rel="icon" type="image/png" href="/files/favicon/32.png";
            link rel="icon" type="image/png" href="/files/favicon/64.png";
            link rel="icon" type="image/png" href="/files/favicon/128.png";
        }
        link rel="stylesheet" type="text/css" href="/files/css/reset.css";
        (css)
        meta name="description" content=(DESCRIPTION);
        meta property="og:title" content=(SINGULAR);
        meta property="og:description" content=(DESCRIPTION);
        @if december {
            meta property="og:image" content="/files/favicon/128.png";
        } @else {
            meta property="og:image" content="/files/favicon/128_christmas.png";
        }
    }
}

#[derive(Deserialize)]
struct LoginQuery {
    message: Option<String>,
}
async fn login(query: web::Query<LoginQuery>) -> impl Responder {
    let placeholder = query
        .message
        .clone()
        .unwrap_or_else(|| "Password".to_string());
    let html = html! {
        (DOCTYPE)
        html {
            head {
                (header(html! { link rel="stylesheet" type="text/css" href="/files/css/login-style.css"; }))
                title { "Login page" }
            }
            body {
                form class="login-form" action="login" method="POST" {
                    input class="input" name="key" type="password" placeholder=(placeholder) value="";
                    input class="button" type="submit" value="Submit";
                }
            }
        }
    };

    HttpResponse::Ok().body(html.into_string())
}

#[derive(Clone, Deserialize)]
struct LoginForm {
    key: String,
}

pub fn decode_hex(s: &str) -> Result<Vec<u8>, ParseIntError> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
        .collect()
}

fn slurp(path: &PathBuf) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn is_password_correct(form_password: &str) -> bool {
    if let Ok(password) = slurp(&PathBuf::from("password")) {
        let password = password.trim();
        if let Ok(password) = decode_hex(password) {
            let mut hasher = Sha512::new();
            hasher.update(form_password.as_bytes());
            let result = hasher.finalize();
            return result[..] == password;
        }
    }
    false
}

fn is_logged_in(req: &HttpRequest, state: &State) -> bool {
    if let Some(cookie) = req.cookie("session") {
        return state.sessions.read().unwrap().contains_key(cookie.value());
    }
    false
}

async fn login_post(form: web::Form<LoginForm>, state: web::Data<State>) -> impl Responder {
    if is_password_correct(&form.key) {
        let session_id = Uuid::new_v4().to_string();
        state
            .sessions
            .write()
            .unwrap()
            .insert(session_id.clone(), Utc::now());
        return HttpResponse::SeeOther()
            .insert_header(("Location", "/"))
            .cookie(
                Cookie::build("session", session_id)
                    .secure(true)
                    .permanent()
                    .finish(),
            )
            .finish();
    }

    HttpResponse::SeeOther()
        .insert_header(("Location", "/login?message=Wrong password"))
        .finish()
}

#[derive(Debug, Display)]
enum MyError {
    #[display(fmt = "unauthorized")]
    Unauthorized,
    #[display(fmt = "no-artwork-found")]
    NoArtworkFound,
    #[display(fmt = "Redirecting to artwork")]
    ArtWorkRedirect(String),
}

impl std::error::Error for MyError {}

impl error::ResponseError for MyError {
    fn error_response(&self) -> HttpResponse {
        let mut http = HttpResponse::build(self.status_code());

        match self {
            MyError::ArtWorkRedirect(link) => http.insert_header(("Location", &link[..])).finish(),
            _ => http
                .insert_header(ContentType::html())
                .body(self.to_string()),
        }
    }

    fn status_code(&self) -> StatusCode {
        match self {
            MyError::Unauthorized => StatusCode::UNAUTHORIZED,
            MyError::NoArtworkFound => StatusCode::NOT_FOUND,
            MyError::ArtWorkRedirect(..) => StatusCode::PERMANENT_REDIRECT,
        }
    }
}

async fn get_file_restricted(
    req: HttpRequest,
    suffix: web::Path<PathBuf>,
    state: web::Data<State>,
) -> actix_web::Result<NamedFile> {
    if !is_logged_in(&req, &state) {
        return Err(MyError::Unauthorized.into());
    }

    let mut path = PathBuf::from("files/music/");
    path.push(&*suffix);

    if req.query_string() == "art" {
        for name in [
            "art.png",
            "cover.png",
            "art.webp",
            "cover.webp",
            "art.jpg",
            "cover.jpg",
        ] {
            path.push(name);
            if path.exists() {
                return Err(MyError::ArtWorkRedirect(name.to_string()).into());
            }
            path.pop();
        }

        return Err(MyError::NoArtworkFound.into());
    }

    match NamedFile::open_async(path).await {
        Ok(file) => Ok(file),
        Err(err) => Err(err.into()),
    }
}

async fn get_file(req: HttpRequest) -> actix_web::Result<NamedFile> {
    let mut path = PathBuf::from("files/");
    let rest = req
        .match_info()
        .query("filename")
        .parse::<PathBuf>()
        .unwrap();
    path.push(&rest);
    match NamedFile::open_async(path).await {
        Ok(file) => Ok(file),
        Err(err) => Err(err.into()),
    }
}

async fn redirect_favicon() -> impl Responder {
    HttpResponse::PermanentRedirect()
        .insert_header(("Location", "/files/favicon/128.png"))
        .finish()
}

async fn robots() -> impl Responder {
    HttpResponse::PermanentRedirect()
        .insert_header(("Location", "/files/misc/robots.txt"))
        .finish()
}

async fn player(req: HttpRequest, state: web::Data<State>) -> impl Responder {
    if !is_logged_in(&req, &state) {
        return HttpResponse::SeeOther()
            .insert_header(("Location", "/login"))
            .finish();
    }

    let html = html! {
        (DOCTYPE)
        html {
            head {
                (header(html! { link rel="stylesheet" type="text/css" href="/files/css/style.css"; }))
                title { "Personal Music Player" }
            }
            body {
                input id="filter" class="input" type="text" placeholder="Regex filter (smart case)" {}
                div class="control-row" {
                    audio id="player" class="player" controls {
                        "Your browser does not support the audio format."
                    }
                    div id="prev-button" class="centrist" { p { "⏮️" } }
                    div id="next-button" class="centrist" { p { "⏭️" } }
                    div id="shuffle-button" class="centrist" { }
                    div id="to-current" class="centrist" { p { "🎯" } }
                }
                div id="included" class="included" {}
                script type="text/javascript" src="/files/js/player.js" {}
            }
        }
    };

    HttpResponse::Ok().body(html.into_string())
}

#[derive(Serialize)]
struct List(Vec<PathBuf>);

async fn list(req: HttpRequest, state: web::Data<State>) -> impl Responder {
    if !is_logged_in(&req, &state) {
        return web::Json(List(vec!["Please log in first".into()]));
    }

    let list = state.music.read().unwrap().clone();
    web::Json(List(list))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let state = create_state_updater_with_thread();

    HttpServer::new(move || {
        let state = state.clone();
        App::new()
            .app_data(Data::new(state))
            .wrap_fn(move |req, srv| srv.call(req))
            .route("/", web::get().to(player))
            .route("/login", web::get().to(login))
            .route("/login", web::post().to(login_post))
            .route("/list", web::get().to(list))
            .route("/robots.txt", web::get().to(robots))
            .route("/favicon.ico", web::get().to(redirect_favicon))
            .route(
                "/files/music/{filename:.*}",
                web::get().to(get_file_restricted),
            )
            .route("/files/{filename:.*}", web::get().to(get_file))
    })
    .bind(format!("127.0.0.1:{}", PORT))?
    .run()
    .await
}
