import Lenis from 'lenis'

let _lenis = null
let _rafId = null

export function initLenis() {
  _lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })
  function raf(time) {
    _lenis.raf(time)
    _rafId = requestAnimationFrame(raf)
  }
  _rafId = requestAnimationFrame(raf)
}

export function destroyLenis() {
  cancelAnimationFrame(_rafId)
  _lenis?.destroy()
  _lenis = null
}

export function scrollToTop() {
  if (_lenis) _lenis.scrollTo(0, { duration: 0.7 })
  else window.scrollTo(0, 0)
}
