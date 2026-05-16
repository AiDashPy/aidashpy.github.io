import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let _lenis = null

export function initLenis() {
  _lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })

  // Drive Lenis from GSAP's ticker so ScrollTrigger stays in sync
  _lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => _lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}

export function destroyLenis() {
  _lenis?.destroy()
  _lenis = null
}

export function scrollToTop() {
  if (_lenis) _lenis.scrollTo(0, { duration: 0.7 })
  else window.scrollTo(0, 0)
}
