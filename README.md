# Canonical Krishna face

This folder is the single source of truth. Deploy this repo, then embed the
deployed viewer URL everywhere. Do not copy the folder if you want updates to
propagate automatically: copied files become independent snapshots.

For Spiritual AI's deployment:
It includes the GLB, facial morphs, blink and gaze tracking, head movement, 30+
expressions, speech lip-sync, orbit/depth controls, and the local Basis decoder.

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
