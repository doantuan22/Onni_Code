import { installSceneWorker } from './worker-runtime'

installSceneWorker(globalThis as unknown as Parameters<typeof installSceneWorker>[0])
