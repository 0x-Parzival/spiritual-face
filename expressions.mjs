// Shared cue vocabulary for the renderer and the voice adapter.
export const EXPRESSIONS = {
  laugh: { emotion: 'Happy', jaw: .35, pulse: 9, tilt: -.035, seconds: 1.8, delivery: 'laughing warmly' },
  laugh_harder: { emotion: 'Happy', jaw: .6, pulse: 12, tilt: -.09, seconds: 2.4, delivery: 'laughing heartily' },
  sigh: { emotion: 'Relieved', jaw: .18, pulse: 0, tilt: .025, seconds: 1.8, delivery: 'sighing softly with a long breath' },
  chuckle: { emotion: 'Amused', jaw: .16, pulse: 10, tilt: -.02, seconds: 1.2, delivery: 'chuckling gently' },
  gasp: { emotion: 'Surprised', jaw: .65, pulse: 0, tilt: -.04, seconds: .9, delivery: 'a sudden surprised intake of breath' },
  angry: { emotion: 'Angry', jaw: 0, pulse: 0, tilt: .025, seconds: 3, delivery: 'firm and angry, with controlled intensity' },
  excited: { emotion: 'Excited', jaw: .12, pulse: 5, tilt: -.025, seconds: 3, delivery: 'excited and enthusiastic' },
  whisper: { emotion: 'Tender', jaw: 0, pulse: 0, tilt: .025, seconds: 4, delivery: 'a quiet intimate whisper' },
  cry: { emotion: 'Sad', jaw: .12, pulse: 15, tilt: .06, seconds: 3, delivery: 'tearful with a trembling voice' },
  scream: { emotion: 'Fearful', jaw: .85, pulse: 0, tilt: -.07, seconds: 2, delivery: 'a sustained intense shout' },
  sing: { emotion: 'Warm', jaw: .22, pulse: 2, tilt: -.02, seconds: 4, delivery: 'singing melodically with sustained vowels' },
  snort: { emotion: 'Disgusted', jaw: .06, pulse: 18, tilt: .04, seconds: .65, delivery: 'a brief amused nasal snort' },
  exhale: { emotion: 'Relieved', jaw: .2, pulse: 0, tilt: .02, seconds: 1.8, delivery: 'a slow relaxed exhalation' },
  gulp: { emotion: 'Concerned', jaw: 0, pulse: 0, tilt: -.025, seconds: 1, delivery: 'a nervous pause and audible swallow' },
  giggle: { emotion: 'Playful', jaw: .18, pulse: 14, tilt: .04, seconds: 1.6, delivery: 'light playful giggling' },
  sarcastic: { emotion: 'Sarcastic', jaw: 0, pulse: 0, tilt: -.06, seconds: 3, delivery: 'dry, gently sarcastic and affectionate' },
  curious: { emotion: 'Curious', jaw: 0, pulse: 0, tilt: .055, seconds: 3, delivery: 'curious and attentive with questioning intonation' },
};
const TAG = /<(laugh_harder|laugh|sigh|chuckle|gasp|angry|excited|whisper|cry|scream|sing|snort|exhale|gulp|giggle|sarcastic|curious)>/gi;

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
  if (['sigh', 'exhale', 'gasp', 'sing'].includes(name)) shapes.mouthFunnel = .3 * envelope;
  if (['laugh', 'laugh_harder', 'chuckle', 'giggle'].includes(name)) {
    shapes.eyeSquint_L = shapes.eyeSquint_R = .45 * envelope;
  }
  if (name === 'gulp') { shapes.throatSwallow = Math.sin(elapsed / cue.seconds * Math.PI); shapes.mouthClose = .8 * envelope; }
  return { shapes, tilt: cue.tilt * envelope, emotion: cue.emotion, whisper: name === 'whisper' };
}
