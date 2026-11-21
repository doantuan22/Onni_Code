import { validateManifest, playbackOrder, chooseVariation, resolveChange } from './player-contract.mjs';

/** Native stepped image animation: no canvas and no per-frame JavaScript timer. */
export function buildTimeline(manifest, name, order = playbackOrder(manifest.states[name])) {
  const state = manifest.states[name];
  const durationMs = order.reduce((sum, index) => sum + state.frames[index].durationMs, 0);
  const visibility = visible => {
    let time = 0;
    const frames = order.map(index => {
      const result = { offset: time / durationMs, opacity: visible(index) ? 1 : 0, easing: 'steps(1, end)' };
      time += state.frames[index].durationMs;
      return result;
    });
    return [...frames, { ...frames.at(-1), offset: 1 }];
  };
  const body = [...new Set(order)].map(index => {
    const frame = state.frames[index];
    return { src: frame.src, width: manifest.canvas.width, height: manifest.canvas.height,
      x: manifest.anchor.x - frame.anchor.x, y: manifest.anchor.y - frame.anchor.y,
      keyframes: visibility(i => i === index) };
  });
  const effects = behind => state.effects.filter(e => Boolean(e.behind) === behind).flatMap(effect =>
    effect.cues.filter(cue => order.includes(cue.frame)).map(cue => ({ src: effect.src,
      width: effect.width, height: effect.height,
      x: cue.attach.x - effect.origin.x, y: cue.attach.y - effect.origin.y,
      keyframes: visibility(index => index === cue.frame),
    })));
  return { durationMs, layers: [...effects(true), ...body, ...effects(false)] };
}

export function createMascotPlayer(root, value, {
  baseUrl, onError = () => {}, onComplete = () => {},
  imageFactory = () => new Image(), random = Math.random,
  schedule = setTimeout, unschedule = clearTimeout,
} = {}) {
  const manifest = validateManifest(value);
  const images = new Map(), animations = new Set(), pending = new Set();
  let generation = 0, dead = false, current, activeBridge = false, variationTimer;
  let settings;
  const url = src => new URL(src, baseUrl).href;
  const valid = token => !dead && token === generation;
  const stop = () => {
    unschedule(variationTimer);
    for (const animation of animations) animation.cancel();
    animations.clear();
  };
  function decode(src) {
    if (!images.has(src)) {
      const image = imageFactory();
      image.src = url(src);
      let timeout;
      let cancel;
      const promise = Promise.race([
        Promise.resolve().then(() => image.decode()),
        new Promise((_, reject) => {
          cancel = () => { image.src = ''; reject(Error('Image decode cancelled: ' + src)); };
          pending.add(cancel);
          timeout = schedule(() => reject(Error('Image decode timed out: ' + src)), 10000);
        }),
      ]).catch(() => { images.delete(src); throw Error('Image decode failed: ' + src); })
        .finally(() => { unschedule(timeout); pending.delete(cancel); });
      images.set(src, promise);
    }
    return images.get(src);
  }
  async function prepare(name, moving) {
    const state = manifest.states[name];
    const order = moving ? state.frames.map((_, i) => i) : [state.staticFrame];
    const sources = new Set(buildTimeline(manifest, name, order).layers.map(layer => layer.src));
    await Promise.all([...sources].map(decode));
  }
  function draw(name, order, repeating, moving) {
    const plan = buildTimeline(manifest, name, order);
    const group = root.ownerDocument.createElement('span');
    Object.assign(group.style, { position: 'absolute', inset: '0', display: 'block' });
    const local = [];
    for (const layer of plan.layers) {
      const image = root.ownerDocument.createElement('img');
      image.src = url(layer.src);
      image.alt = '';
      image.draggable = false;
      image.decoding = 'async';
      image.width = layer.width; image.height = layer.height;
      image.setAttribute('aria-hidden', 'true');
      Object.assign(image.style, { position: 'absolute', imageRendering: 'pixelated',
        width: layer.width / manifest.canvas.width * 100 + '%',
        height: layer.height / manifest.canvas.height * 100 + '%',
        left: layer.x / manifest.canvas.width * 100 + '%',
        top: layer.y / manifest.canvas.height * 100 + '%',
        opacity: String(layer.keyframes[0].opacity) });
      group.append(image);
      if (moving) {
        const animation = image.animate(layer.keyframes, { duration: plan.durationMs,
          iterations: repeating ? Infinity : 1, fill: 'forwards', easing: 'linear' });
        animation.finished.catch(() => {});
        local.push(animation); animations.add(animation);
      }
    }
    root.append(group);
    return { group, local, finished: local[0]?.finished ?? Promise.resolve() };
  }
  async function render(name, options, token, initialFrame, thenState) {
    const state = manifest.states[name];
    const moving = options.animated && !options.reducedMotion && typeof root.animate === 'function';
    await prepare(name, moving);
    if (!valid(token)) return;
    stop(); root.replaceChildren();
    current = name; activeBridge = Boolean(thenState);
    if (!moving) { draw(name, [state.staticFrame], false, false); return; }
    const order = playbackOrder(state);
    if (initialFrame !== undefined && initialFrame !== order[0]) {
      const intro = draw(name, [initialFrame], false, true);
      intro.finished.then(() => { if (valid(token)) void render(name, options, token, undefined, thenState).catch(error => { if (valid(token)) onError(error); }); }, () => {});
      return;
    }
    const repeating = !thenState && state.playback !== 'once' && (options.loop ?? true);
    const base = draw(name, order, repeating, true);
    base.finished.then(() => {
      if (!valid(token)) return;
      activeBridge = false;
      if (thenState) void render(thenState, options, token).catch(error => { if (valid(token)) onError(error); });
      else onComplete(name);
    }, () => {});
    const variation = state.idleVariations;
    function nextVariation(delay) {
      const [lo, hi] = variation.intervalMs;
      const interval = () => lo + random() * (hi - lo);
      variationTimer = schedule(() => {
        if (!valid(token)) return;
        for (const animation of base.local) animation.pause();
        base.group.style.visibility = 'hidden';
        const selectedOrder = chooseVariation(variation, random());
        const selected = draw(name, selectedOrder, false, true);
        const nextDelay = Math.max(1, interval() - buildTimeline(manifest, name, selectedOrder).durationMs);
        selected.finished.then(() => {
          if (!valid(token)) return;
          for (const animation of selected.local) { animations.delete(animation); animation.cancel(); }
          selected.group.remove();
          base.group.style.visibility = '';
          for (const animation of base.local) animation.play();
          nextVariation(nextDelay);
        }, () => {});
      }, delay ?? interval());
    }
    if (variation && repeating) nextVariation();
  }
  return {
    setState(options) {
      if (dead) return;
      const unchanged = settings && ['state', 'animated', 'loop', 'reducedMotion'].every(key => settings[key] === options[key]);
      if (unchanged) return;
      const changedMotion = settings && (settings.animated !== options.animated || settings.loop !== options.loop || settings.reducedMotion !== options.reducedMotion);
      settings = { ...options };
      const token = ++generation;
      stop();
      const change = resolveChange(manifest, current, options.state, options.reducedMotion || !options.animated, activeBridge);
      if (change.continue && !changedMotion) return;
      void render(change.state, options, token, change.initialFrame, change.thenState).catch(error => { if (valid(token)) onError(error); });
    },
    destroy() {
      dead = true; ++generation; stop();
      for (const cancel of pending) cancel();
      images.clear(); root.replaceChildren();
    },
  };
}
