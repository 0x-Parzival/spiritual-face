# Canonical Krishna face

## Cloudflare Workers deployment

The current Cloudflare Workers address is
`https://spiritual-face.keshavbruh.workers.dev/?embed=1`. Deploy this GitHub
repository (`0x-Parzival/spiritual-face`) as static assets from the repository
root. `index.html`, the hashed model, poster, JavaScript and `_headers` are
already publishable files. The `_headers` file gives hashed assets long browser
cache lifetimes while HTML revalidates.

Cloudflare Workers sends ordinary `.glb` files uncompressed. The viewer loads
the matching `.glb.gz` asset (447,769 bytes) and decodes it if the browser
receives raw gzip bytes. It falls back to the ordinary GLB if compressed loading
is unavailable. Verify `face-ready`, speech and poster handoff before replacing
the GitHub Pages URL in consuming sites.
Generated files in this repository come from
`public/spiritualai-xyz/fast/` in the Spiritual AI workspace.

The current unpacked model is 585,856 bytes, with 42 active facial controls
and 11 unused names retained for compatibility. The roughly 43 KB startup
WebP poster appears first. Four matching full-face WebP frames
provide early speech mouth shapes and blinking while 3D loads; the first rendered
3D frame then takes over.

## AI and TTS on any website

Embed `https://spiritual-face.keshavbruh.workers.dev/?embed=1` in an iframe,
then import `connectKrishna` from
`https://spiritual-face.keshavbruh.workers.dev/embed.mjs` on the parent website:

```js
const audio = document.querySelector('#voice');
const avatar = connectKrishna(document.querySelector('#krishna'));
avatar.bind(audio);
avatar.start(replyFromYourLLM);
audio.src = ttsUrlFromYourServer;
await audio.play();
```

The host retains its own LLM, TTS, and API keys. The adapter sends text and
audio playback timing to the avatar; it samples amplitude from same-origin,
blob, or CORS-enabled media. For any other audio system, call
`avatar.start(text)`, `avatar.level(normalizedVolume, elapsed, duration)` during
playback, then `avatar.stop()`. Playback without readable audio samples uses
timed text lip shapes; exact phoneme sync needs TTS phoneme timestamps.

## Historical source notes

This folder is the single source of truth. Deploy this repo, then embed the
deployed viewer URL everywhere. Do not copy the folder if you want updates to
propagate automatically: copied files become independent snapshots.

For Spiritual AI's deployment:
It includes the GLB, facial morphs, blink and gaze tracking, head movement, 30+
four expression cues (blink, laugh, chuckle, sigh), speech lip-sync, orbit/depth
controls, and the local Basis decoder.

`krishna-light-1024.glb` is the production model: 1K texture, high-precision
Meshopt geometry and morph compression, approximately 4.6 MB over compressed HTTP.

## Embed

```html
<iframe
  src="https://spiritualai.store/spiritualai-xyz/index.html?embed=1"
  title="Spiritual AI face"
  allow="microphone; autoplay"
  style="width:100%;height:100%;border:0;background:transparent"
></iframe>
```

For another deployment, replace the origin while keeping the same path.

`?embed=1` hides the demo controls. The parent page can control the face with
`postMessage`:

```js
const face = document.querySelector('iframe').contentWindow;
face.postMessage({ type: 'face-emotion', emotion: 'Happy' }, '*');
face.postMessage({ type: 'face-cursor', x: 0.2, y: -0.1 }, '*');
face.postMessage({ type: 'face-animate', text: 'Hello there.' }, '*');
face.postMessage({ type: 'face-stop' }, '*');
```

Supported messages and expression names are in `expressions.mjs`. The viewer
also sends `face-ready`, `face-speaking`, and `face-native-ended` events back
to the parent.

The standalone copy uses browser speech fallback. Spiritual AI server voice,
Gemini Live, and LiveKit remain optional integrations and require equivalent
endpoints on the host site.
