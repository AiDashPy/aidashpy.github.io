import { ref } from 'vue'

export const audioMuted = ref(localStorage.getItem('audioMuted') === 'true')

let _initialized = false
let clickSynth, yearSynth, flipSynth
let lastClickTime = 0

async function init() {
  if (_initialized) return
  const Tone = await import('tone')
  await Tone.start()

  clickSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.004 },
  }).toDestination()
  clickSynth.volume.value = -20

  yearSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 },
  }).toDestination()
  yearSynth.volume.value = -8

  flipSynth = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.012, decay: 0.16, sustain: 0, release: 0.05 },
  }).toDestination()
  flipSynth.volume.value = -22

  _initialized = true
}

export function toggleMute() {
  audioMuted.value = !audioMuted.value
  localStorage.setItem('audioMuted', String(audioMuted.value))
}

export async function playTypeChar() {
  if (audioMuted.value) return
  const now = Date.now()
  if (now - lastClickTime < 28) return
  lastClickTime = now
  try {
    await init()
    clickSynth.triggerAttackRelease(100 + Math.random() * 80, '64n')
  } catch {}
}

export async function playYearChange(forward) {
  if (audioMuted.value) return
  try {
    await init()
    yearSynth.triggerAttackRelease(forward ? 'G2' : 'E2', '8n')
  } catch {}
}

export async function playFlip() {
  if (audioMuted.value) return
  try {
    await init()
    flipSynth.triggerAttackRelease('16n')
  } catch {}
}
