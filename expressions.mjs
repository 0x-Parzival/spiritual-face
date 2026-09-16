// Shared cue vocabulary for the renderer and the voice adapter.
export const EXPRESSIONS = {
  blink: { emotion: 'Neutral', jaw: 0, pulse: 0, tilt: 0, seconds: .6, delivery: 'blinking naturally' },
  laugh: { emotion: 'Happy', jaw: .35, pulse: 9, tilt: -.035, seconds: 1.8, delivery: 'laughing warmly' },
  sigh: { emotion: 'Relieved', jaw: .18, pulse: 0, tilt: .025, seconds: 1.8, delivery: 'sighing softly with a long breath' },
  chuckle: { emotion: 'Amused', jaw: .16, pulse: 10, tilt: -.02, seconds: 1.2, delivery: 'chuckling gently' },
};
const TAG = /<(blink|laugh|sigh|chuckle)>/gi;

export function speechCues(text) {
  const cues = [];
  let clean = '', last = 0;
  for (const match of String(text).matchAll(TAG)) {
    clean += text.slice(last, match.index);
    cues.push({ name: match[1].toLowerCase(), offset: clean.length });
    last = match.index + match[0].length;
  }
  clean += text.slice(last);
  return { text: clean, cues };
}

export function voiceDescription(text) {
  const { cues } = speechCues(text);
  return ['a warm, calm, grounded female voice with natural conversational pacing',
    ...new Set(cues.map(cue => EXPRESSIONS[cue.name].delivery))].join('; ');
}

// Put each cue at a playback boundary so it starts with its own audio segment.
export function speechSegments(text) {
  const starts = [...String(text).matchAll(TAG)].map(match => match.index);
  const segments = [];
  let last = 0;
  for (const start of [...starts, text.length]) {
    const segment = text.slice(last, start).trim();
    if (segment) segments.push(segment);
    last = start;
  }
  return segments;
}

export function expressionPose(name, elapsed) {
  if (!Object.hasOwn(EXPRESSIONS, name)) return null;
  const cue = EXPRESSIONS[name];
  if (!cue || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > cue.seconds) return null;
  const envelope = Math.min(1, elapsed / .12, (cue.seconds - elapsed) / .25);
  const beat = cue.pulse ? .35 + .65 * (Math.sin(elapsed * cue.pulse) + 1) / 2 : 1;
  const shapes = { jawOpen: cue.jaw * envelope * beat };
  if (name === 'blink') shapes.eyeBlink_L = shapes.eyeBlink_R = envelope;
  if (['sigh'].includes(name)) shapes.mouthFunnel = .3 * envelope;
  if (['laugh', 'chuckle'].includes(name)) {
    shapes.eyeSquint_L = shapes.eyeSquint_R = .45 * envelope;
  }
  if (name === 'gulp') { shapes.throatSwallow = Math.sin(elapsed / cue.seconds * Math.PI); shapes.mouthClose = .8 * envelope; }
  return { shapes, tilt: cue.tilt * envelope, emotion: cue.emotion, whisper: name === 'whisper' };
}
