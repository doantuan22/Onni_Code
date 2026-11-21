/** Shared v2 boundary for the offline preview and React <Mascot/>. No DOM dependencies. */
export const STATE_NAMES = Object.freeze(['idle', 'working', 'thinking', 'success', 'error', 'sleep', 'wake', 'loading', 'celebrate', 'idle-to-working', 'working-to-idle']);

export function validateManifest(m) {
  const fail = field => { throw new Error('Invalid mascot manifest: ' + field); };
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const positive = x => Number.isFinite(x) && x > 0;
  const integer = x => Number.isInteger(x) && x >= 0;
  const point = (p, field) => { if (!object(p) || !integer(p.x) || !integer(p.y)) fail(field); };
  if (!object(m) || m.version !== 2) fail('version (expected 2)');
  if (!object(m.canvas) || !positive(m.canvas.width) || !positive(m.canvas.height) || !Number.isInteger(m.canvas.width) || !Number.isInteger(m.canvas.height)) fail('canvas');
  point(m.anchor, 'anchor');
  if (m.anchor.x > m.canvas.width || m.anchor.y > m.canvas.height || m.anchor.baseline !== m.anchor.y) fail('anchor bounds/baseline');
  if (!Array.isArray(m.sizes) || !m.sizes.length || m.sizes.some(x => !Number.isInteger(x) || !positive(x))) fail('sizes');
  if (!object(m.states) || Object.keys(m.states).length !== STATE_NAMES.length || STATE_NAMES.some(n => !object(m.states[n]))) fail('states (known names required)');
  if (!STATE_NAMES.includes(m.fallbackState)) fail('fallbackState');
  if (m.transitionPolicy?.unsupported !== 'snap-to-static' || m.transitionPolicy?.reducedMotion !== 'destination-static' || m.transitionPolicy?.interrupt !== 'destination-static' || m.transitionPolicy?.sameState !== 'continue') fail('transitionPolicy');
  for (const [name, s] of Object.entries(m.states)) {
    const field = 'states.' + name;
    if (!Array.isArray(s.frames) || s.frames.length < 1 || s.frames.length > 8) fail(field + '.frames');
    const index = (i, path) => { if (!integer(i) || i >= s.frames.length) fail(path); };
    s.frames.forEach((f, i) => {
      if (!object(f) || typeof f.src !== 'string' || !/^frames\/[a-z-]+-\d+\.png$/.test(f.src)) fail(field + '.frames.' + i + '.src');
      if (!positive(f.durationMs)) fail(field + '.frames.' + i + '.durationMs');
      point(f.anchor, field + '.frames.' + i + '.anchor');
      if (f.anchor.x > m.canvas.width || f.anchor.y > m.canvas.height || f.anchor.baseline !== f.anchor.y) fail(field + '.frames.' + i + '.anchor bounds/baseline');
    });
    if (!['loop', 'once', 'pingpong'].includes(s.playback)) fail(field + '.playback');
    if (s.onComplete !== 'hold-last') fail(field + '.onComplete');
    index(s.staticFrame, field + '.staticFrame');
    if (s.sequence !== undefined) {
      if (!Array.isArray(s.sequence) || !s.sequence.length) fail(field + '.sequence');
      s.sequence.forEach(i => index(i, field + '.sequence index'));
    }
    const v = s.idleVariations;
    if (v !== undefined) {
      if (!object(v) || s.playback !== 'loop') fail(field + '.idleVariations');
      if (!Array.isArray(v.intervalMs) || v.intervalMs.length !== 2 || !v.intervalMs.every(positive) || v.intervalMs[1] < v.intervalMs[0]) fail(field + '.idleVariations.intervalMs');
      if (!Array.isArray(v.choices) || !v.choices.length) fail(field + '.idleVariations.choices');
      v.choices.forEach((c, i) => {
        if (!object(c) || !positive(c.weight)) fail(field + '.idleVariations.choices.' + i + '.weight');
        if (!Array.isArray(c.frames) || !c.frames.length) fail(field + '.idleVariations.choices.' + i + '.frames');
        c.frames.forEach(f => index(f, field + '.idleVariations.choices.' + i + '.frames index'));
      });
      if (!positive(v.choices.reduce((sum, c) => sum + c.weight, 0))) fail(field + '.idleVariations total weight');
    }
    if (!Array.isArray(s.effects)) fail(field + '.effects');
    s.effects.forEach((e, i) => {
      const ef = field + '.effects.' + i;
      if (!object(e) || typeof e.name !== 'string' || typeof e.src !== 'string' || !/^effects\/[a-z-]+\.png$/.test(e.src)) fail(ef + '.src/name');
      if (![e.width, e.height].every(x => Number.isInteger(x) && positive(x))) fail(ef + '.dimensions');
      point(e.origin, ef + '.origin');
      if (e.origin.x >= e.width || e.origin.y >= e.height) fail(ef + '.origin bounds');
      if (e.behind !== undefined && typeof e.behind !== 'boolean') fail(ef + '.behind');
      if (!Array.isArray(e.cues)) fail(ef + '.cues');
      e.cues.forEach((c, j) => {
        if (!object(c)) fail(ef + '.cues.' + j);
        index(c.frame, ef + '.cues.' + j + '.frame');
        point(c.attach, ef + '.cues.' + j + '.attach');
        const x = c.attach.x - e.origin.x, y = c.attach.y - e.origin.y;
        if (x < 0 || y < 0 || x + e.width > m.canvas.width || y + e.height > m.canvas.height) fail(ef + '.cues.' + j + ' bounds');
      });
    });
  }
  if (!object(m.transitions)) fail('transitions');
  for (const [pair, via] of Object.entries(m.transitions)) {
    const ends = pair.split('->');
    if (ends.length !== 2 || !ends.every(n => STATE_NAMES.includes(n)) || !STATE_NAMES.includes(via) || m.states[via].playback !== 'once') fail('transitions.' + pair);
  }
  return m;
}

export function playbackOrder(state) {
  const sequence = state.sequence ?? state.frames.map((_, i) => i);
  return state.playback === 'pingpong' ? sequence.concat(sequence.slice(1, -1).reverse()) : [...sequence];
}

/** Validate once at load; pass a [0,1) random value for deterministic consumers. */
export function chooseVariation(variation, random = Math.random()) {
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('Invalid mascot variation random');
  let pick = random * variation.choices.reduce((sum, c) => sum + c.weight, 0);
  return (variation.choices.find(c => (pick -= c.weight) < 0) ?? variation.choices.at(-1)).frames;
}

/** Unsupported changes paint destination staticFrame, then start its normal playback. */
export function resolveChange(m, from, requested, reducedMotion = false, interrupted = false) {
  const to = Object.hasOwn(m.states, requested) ? requested : m.fallbackState;
  const via = !reducedMotion && !interrupted ? m.transitions[from + '->' + to] : undefined;
  if (!reducedMotion && !interrupted && from === to) return { state: to, continue: true };
  return via ? { state: via, thenState: to, initialFrame: 0 } : { state: to, initialFrame: m.states[to].staticFrame };
}
