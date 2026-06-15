# KYWELL INTELLIGENCE AI APP

An **advanced-maths AI assistant** in a mobile-style chat app — **installable on
phones** as a PWA (Add to Home Screen, runs full-screen, works offline).

It answers maths questions (arithmetic, algebra, calculus, equation solving,
factoring, limits and more) and politely declines anything that isn't maths.
Everything runs **fully offline in the browser** — there is no backend and no API
key. The maths is computed locally by the bundled
[nerdamer](https://nerdamer.com) symbolic engine.

## Install on a phone

1. Open the app's URL in a mobile browser (must be served over **https**, or
   `localhost` for local testing).
2. Tap the **install** button in the app's top bar, or use the browser menu:
   - **Android / Chrome:** "Install app" / "Add to Home screen".
   - **iPhone / Safari:** Share → "Add to Home Screen".
3. Launch it from your home screen — it opens full-screen like a native app and
   works without a connection.

## Lock screen (fingerprint / face / password)

On first launch you secure the app; to enter afterwards you unlock with either:

- **Fingerprint / face** — device biometrics via
  [WebAuthn](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API)
  (secure origin only — `https`/`localhost`).
- **Password** — a fallback you create, stored **only on your device**, hashed
  with SHA-256 + a random salt (the plain password is never stored or sent).

"Reset app security" clears both and returns to setup. Credentials live in this
browser/device's `localStorage` only — there is no account or server.

## What it can do

| Ask… | Example |
|------|---------|
| Arithmetic / evaluate | `2^10 + sqrt(144)` |
| Differentiate | `differentiate x^3 + 2x^2 - 5x + 1` |
| Integrate (indefinite/definite) | `integrate x*sin(x)`, `integrate x^2 from 0 to 3` |
| Solve equations | `solve x^2 - 5x + 6 = 0 for x` |
| Factor / expand | `factor x^2 - 9`, `expand (x+1)^2` |
| Simplify | `simplify (x^2 - 1)/(x - 1)` |
| Limits | `limit of sin(x)/x as x approaches 0` |

Tips: use `^` for powers and `*` for multiply. Unicode like `×`, `÷`, `√`, `π`,
`x²` and words like `times`/`divided by` are understood too.

## Run locally

Service workers and biometrics need `https` **or** `localhost`, so serve the
folder (don't open it with `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Lock screen + chat UI, PWA meta + service-worker registration |
| `style.css` | Mobile-first styling |
| `app.js` | Lock screen (WebAuthn + password), maths engine, install prompt |
| `manifest.webmanifest` | PWA manifest (name, icons, display mode) |
| `sw.js` | Service worker — offline app-shell cache |
| `icons/` | App icons (192/512/maskable, apple-touch, favicon) |
| `vendor/nerdamer.all.min.js` | Bundled offline symbolic-maths engine |
