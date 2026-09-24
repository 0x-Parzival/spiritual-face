// Host-side adapter: the website owns its LLM, TTS, and audio playback.
export function connectKrishna(frame) {
  if (!(frame instanceof HTMLIFrameElement) || !frame.src) throw new TypeError('Pass the Krishna iframe');
  const origin = new URL(frame.src).origin;
  const send = (type, data = {}) => frame.contentWindow?.postMessage({ type, ...data }, origin);
  let text = '', audio, interval, analyser, context, samples, startAt = 0, connecting = false, unbind = () => {};

  const start = value => { text = String(value || ''); send('face-animate', { text }); };
  const level = (value, elapsed, duration) => send('face-audio-level', {
    level: String(Math.max(0, Math.min(1, Number(value) || 0))), elapsed, duration,
  });
  const stop = () => { clearInterval(interval); interval = null; level(0); send('face-stop'); };
  const onLoad = () => { if (interval && text) start(text); };
  frame.addEventListener('load', onLoad);

  function bind(element, { meter = true } = {}) {
    if (!(element instanceof HTMLMediaElement)) throw new TypeError('Pass an audio or video element');
    unbind();
    audio = element;
    const tick = () => {
      if (element.paused || element.ended) return;
      let volume = .45; // ponytail: timed text visemes when the website cannot expose the audio waveform.
      if (analyser && context?.state === 'running') {
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
        volume = Math.min(1, Math.sqrt(energy / samples.length) * 7);
      }
      level(volume, Math.max(0, element.currentTime - startAt), Number.isFinite(element.duration) ? element.duration - startAt : undefined);
    };
    const playing = async () => {
      clearInterval(interval);
      startAt = element.currentTime;
      if (text) start(text);
      tick();
      interval = setInterval(tick, 32);
      // Web Audio redirects the element's sound. Only meter a same-origin/blob
      // source or an explicitly CORS-enabled element, and only after resume.
      if (meter && !context && !connecting && globalThis.AudioContext) {
        const source = element.currentSrc || element.src;
        const url = source && new URL(source, document.baseURI);
        if (url && (url.origin === location.origin || url.protocol === 'blob:' || element.crossOrigin)) {
          connecting = true;
          try {
            const candidate = new AudioContext();
            await candidate.resume();
            if (element !== audio || element.paused) { await candidate.close(); return; }
            const node = candidate.createMediaElementSource(element);
            analyser = candidate.createAnalyser();
            analyser.fftSize = 256;
            samples = new Uint8Array(analyser.fftSize);
            node.connect(analyser);
            analyser.connect(candidate.destination);
            context = candidate;
          } catch { /* audio keeps playing; text-timed visemes still work */ }
          finally { connecting = false; }
        }
      }
    };
    element.addEventListener('playing', playing);
    element.addEventListener('pause', stop);
    element.addEventListener('ended', stop);
    unbind = () => {
      element.removeEventListener('playing', playing);
      element.removeEventListener('pause', stop);
      element.removeEventListener('ended', stop);
      if (audio === element) { stop(); audio = null; analyser = context = null; }
      // MediaElementAudioSourceNode cannot be detached from its element. Never
      // close its context while the site may play that element again.
    };
    if (!element.paused) void playing();
    return unbind;
  }
  function bindUtterance(utterance) {
    if (!(utterance instanceof SpeechSynthesisUtterance)) throw new TypeError('Pass a speech synthesis utterance');
    unbind();
    const speaking = () => {
      start(utterance.text);
      const began = performance.now();
      clearInterval(interval);
      interval = setInterval(() => level(.45, (performance.now() - began) / 1000), 32);
    };
    utterance.addEventListener('start', speaking);
    utterance.addEventListener('end', stop);
    utterance.addEventListener('error', stop);
    unbind = () => {
      utterance.removeEventListener('start', speaking);
      utterance.removeEventListener('end', stop);
      utterance.removeEventListener('error', stop);
      stop();
    };
    return unbind;
  }
  return { start, level, stop, bind, bindUtterance, dispose() { unbind(); frame.removeEventListener('load', onLoad); } };
}
