import { ref } from 'vue'

export const audioMuted = ref(localStorage.getItem('audioMuted') === 'true')

let _initialized = false
let clickSynth, flipSynth
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

function charFreq(char) {
  if (!char) return 110 + Math.random() * 40
  const code = char.charCodeAt(0)
  // Hanzi / CJK
  if (code > 0x3000) return 175 + Math.random() * 65
  const c = char.toLowerCase()
  if ('aeiouáéíóúāēīōū'.includes(c)) return 155 + Math.random() * 55  // vowels: bright
  if (/[a-z]/.test(c))               return 88  + Math.random() * 42   // consonants: mid
  if (/[0-9]/.test(c))               return 130 + Math.random() * 35   // digits: mid-high
  if (/\s/.test(c))                  return 0                           // space: silent
  return 68 + Math.random() * 22                                        // punctuation: low
}

export async function playTypeChar(char) {
  if (audioMuted.value) return
  const freq = charFreq(char)
  if (!freq) return
  const now = Date.now()
  if (now - lastClickTime < 28) return
  lastClickTime = now
  try {
    await init()
    clickSynth.triggerAttackRelease(freq, '64n')
  } catch {}
}

export async function playFlip() {
  if (audioMuted.value) return
  try {
    await init()
    flipSynth.triggerAttackRelease('16n')
  } catch {}
}
