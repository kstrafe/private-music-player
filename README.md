# Private Music Server #

Are music streaming services letting you down?
Now you can now run your very own private music streaming server!

No major dependencies. No database. Just linux (it might work on others platforms but haven't tested).

# Getting Started #

1. Clone this repository: `git clone github.com/kstrafe/private-music-player`
2. Install `cargo` and `gcc` (If using `nix`, you can use `nix develop` for this purpose).
3. Link your music directory into files/music/. This will be recursively scanned for media.
4. Run `cargo run --release` to start the server. It will run on port 8081.

# Useful Info #

The server indexes the music directory every 10 minutes. The client requests the index from the server every 10 minutes.

Use the `new-password` script to create a new password file.

See [this blogpost](https://kevin.stravers.net/PrivateMusicPlayer) related to this repository.

# How it looks #

![Desktop screenshot](https://kevin.stravers.net/x/PrivateMusicPlayer-desktop.png)
