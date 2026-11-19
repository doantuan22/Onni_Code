import { useState, type SetStateAction } from 'react'

/** Follow refreshed settings while an editor is clean; preserve unfinished edits when another
 *  cockpit changes the server value. Values are the small JSON settings returned by the API. */
export function useSyncedDraft<T>(serverValue: T): [T, (value: SetStateAction<T>) => void] {
  const signature = JSON.stringify(serverValue)
  const [state, setState] = useState(() => ({ signature, value: serverValue }))
  if (state.signature !== signature) {
    setState({
      signature,
      value: JSON.stringify(state.value) === state.signature ? serverValue : state.value,
    })
  }
  return [state.value, (value) => setState((current) => ({
    ...current,
    value: typeof value === 'function'
      ? (value as (previous: T) => T)(current.value)
      : value,
  }))]
}
