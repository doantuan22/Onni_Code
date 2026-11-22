import type { SceneDef } from './types'

export type SceneLoader = () => Promise<{ default: SceneDef }>

/** Each production entry must be () => import('../scenes/…'), never an eager import. */
export const sceneLoaders: Readonly<Record<string, SceneLoader>> = {
  'world-matterhorn': () => import('../scenes/world/matterhorn'),
  'world-sahara': () => import('../scenes/world/sahara'),
  'vn-fansipan': () => import('../scenes/vn/fansipan'),
  'vn-phu-quoc': () => import('../scenes/vn/phu-quoc'),
  'world-kyoto': () => import('../scenes/world/kyoto'),
  'world-tromso': () => import('../scenes/world/tromso'),
  'vn-halong': () => import('../scenes/vn/halong'),
  'vn-mu-cang-chai': () => import('../scenes/vn/mu-cang-chai'),
}

export function createSceneRegistry(loaders: Readonly<Record<string, SceneLoader>> = sceneLoaders) {
  const pending = new Map<string, Promise<SceneDef>>()
  return {
    ids: Object.keys(loaders),
    async load(id: string): Promise<SceneDef | undefined> {
      if (!Object.hasOwn(loaders, id)) return undefined
      let result = pending.get(id)
      if (!result) {
        result = loaders[id]!().then(({ default: scene }) => {
          if (scene.id !== id) throw new Error('Scene registry id mismatch')
          return scene
        }).catch((error: unknown) => { pending.delete(id); throw error })
        pending.set(id, result)
      }
      return result
    },
  }
}

export const sceneRegistry = createSceneRegistry()
