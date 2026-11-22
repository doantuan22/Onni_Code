# Scenery engine API (P0)

The pure engine remains indexed Canvas2D: scenes use at most **32 palette indexes**, with
`480×270` as the maximum landscape art buffer. Existing `SceneDef` scenes remain valid.

## Theme and time

`themePalettes` and `themeDefaultTime` are optional additions to `SceneDef`; `palettes` and
`defaultTime` are the legacy fallback. `SceneRenderer`, `HostOptions`, and worker messages accept
the resolved `theme: 'light' | 'dark'` and `time`.

```ts
const renderer = new SceneRenderer(scene, {
  width: 480, height: 270, seed: 42, theme: 'dark', time: 'night',
})
```

The host forwards these fields unchanged to worker and main-thread fallback:

```ts
host.update({ theme: resolvedTheme, time: resolvedTime })
```

## Layers, masks, geometry

Use semantic layer names (`sky`, `far`, `mid`, `water`, `fog`, `near`, `fx`) and an indexed
coverage mask. Draw coordinates are art pixels and polygon/curve rasterization is quantized.

```ts
build(ctx) {
  const water = ctx.mask()
  water.rect(0, 170, ctx.width, 100)
  ctx.layer({ kind: 'water', z: 4, mask: water }, (layer) => {
    layer.polygon([{ x: 0, y: 180 }, { x: 480, y: 170 }, { x: 480, y: 270 }], 16)
  })
}
```

## Sprite sheets, particles, cycles, AA

`createSpriteSheet(sprite, frames)` validates metadata and `ctx.spriteFrame()` draws one snapped
frame. `ParticlePool(capacity, seed)` has a hard cap of 160 and advances with `dt <= .2`.
`cycles` rotates only their declared index groups. For UI reading panels, call
`compositeContrast(text, scene, panel, panelAlpha)` on the final local composite; do not apply a
global visibility ceiling or scrim.
