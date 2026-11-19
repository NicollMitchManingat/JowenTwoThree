import { useCallback, useEffect, useRef, useState } from 'react'

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement

function fullscreenAPI() {
  const root = document.documentElement
  if (root.requestFullscreen && document.exitFullscreen && document.fullscreenEnabled !== false) {
    return { enter: () => root.requestFullscreen({ navigationUI: 'hide' }), exit: () => document.exitFullscreen() }
  }
  if (root.webkitRequestFullscreen && document.webkitExitFullscreen && document.webkitFullscreenEnabled !== false) {
    return { enter: () => root.webkitRequestFullscreen(), exit: () => document.webkitExitFullscreen() }
  }
  return null
}

// One automatic attempt per app visit, retained through navigation/session refresh.
// The browser owns Back/Escape; never insert history entries to trap navigation.
export default function useAppFullscreen(enabled) {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(fullscreenElement()))
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)
  const attempted = useRef(false), pending = useRef(false), mounted = useRef(false)
  const manualRequest = useRef(false)

  useEffect(() => {
    mounted.current = true
    const changed = () => {
      attempted.current = true
      setIsFullscreen(Boolean(fullscreenElement()))
      setError(null)
    }
    const failed = () => {
      if (manualRequest.current) setError('Fullscreen is unavailable. You can keep using the app normally.')
    }
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('webkitfullscreenchange', changed)
    document.addEventListener('fullscreenerror', failed)
    document.addEventListener('webkitfullscreenerror', failed)
    return () => {
      mounted.current = false
      document.removeEventListener('fullscreenchange', changed)
      document.removeEventListener('webkitfullscreenchange', changed)
      document.removeEventListener('fullscreenerror', failed)
      document.removeEventListener('webkitfullscreenerror', failed)
    }
  }, [])

  const changeFullscreen = useCallback(async (enter, automatic = false) => {
    const api = fullscreenAPI()
    if (!enabled || !api || pending.current) return
    attempted.current = true
    pending.current = true
    manualRequest.current = !automatic
    setIsBusy(true)
    setError(null)
    try {
      // Invoke synchronously within the click, before user activation expires.
      await (enter ? api.enter() : api.exit())
      if (mounted.current) setIsFullscreen(Boolean(fullscreenElement()))
    } catch {
      // A blocked automatic request must not interrupt the original app action.
      if (mounted.current && !automatic) setError('Fullscreen is unavailable. You can keep using the app normally.')
    } finally {
      pending.current = false
      if (mounted.current) setIsBusy(false)
    }
  }, [enabled])

  const onAppClick = useCallback(event => {
    if (!enabled || attempted.current || pending.current || fullscreenElement() || event.button !== 0) return
    if (!window.matchMedia?.('(pointer: coarse) and (min-width: 600px)').matches) return
    // Leave keyboard/file interactions and the explicit toggle in control.
    if (event.target.closest?.('[data-fullscreen-toggle], input, textarea, select, [contenteditable], a[download]')) return
    void changeFullscreen(true, true)
  }, [enabled, changeFullscreen])

  const toggle = useCallback(() => {
    void changeFullscreen(!fullscreenElement())
  }, [changeFullscreen])

  return { supported: Boolean(fullscreenAPI()), isFullscreen, isBusy, error, toggle, onAppClick }
}
