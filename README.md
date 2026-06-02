# bps-website
Website for Bluesky Protocol Services

## Running locally

The prototypes are standalone HTML pages served from the `prototypes/`
directory. To serve them locally, run (requires Python 3.7+, preinstalled on
macOS and most Linux distributions):

```
python3 -m http.server 8000 --directory prototypes
```

Then open either page in your browser:

- http://localhost:8000/landing-bsky.html
- http://localhost:8000/landing-nosky.html
