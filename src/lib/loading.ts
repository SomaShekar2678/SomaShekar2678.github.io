import { useSyncExternalStore } from 'react'

/**
 * Measured loading progress. Progress only advances when a real task completes
 * (fonts ready, hero scene module loaded, first frame rendered) — nothing is faked.
 */
type TaskId = 'fonts' | 'scene-module' | 'first-frame'

const TASKS: TaskId[] = ['fonts', 'scene-module', 'first-frame']
const done = new Set<TaskId>()
const listeners = new Set<() => void>()
let snapshot = 0

function emit() {
  snapshot = done.size / TASKS.length
  listeners.forEach((l) => l())
}

export function completeTask(id: TaskId) {
  if (done.has(id)) return
  done.add(id)
  emit()
}

/** Used when WebGL is unavailable: the scene tasks are not applicable, so they are resolved immediately. */
export function completeSceneTasks() {
  completeTask('scene-module')
  completeTask('first-frame')
}

export function useLoadProgress(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => 0,
  )
}
