/**
 * What a guard hears and feels, so they need not read the screen for the
 * common case. A rising double beep is a yes; a long low buzz is a no.
 *
 * Browsers only allow sound after a tap, so the gate's Start button calls
 * `unlockAudio` before anything is scanned.
 */

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, startS: number, lengthS: number, type: OscillatorType, volume = 0.25) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = ctx.currentTime + startS
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + lengthS)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + lengthS)
}

export function signal(kind: 'ok' | 'bad' | 'warn'): void {
  try {
    if (kind === 'ok') {
      tone(880, 0, 0.12, 'sine')
      tone(1320, 0.13, 0.16, 'sine')
      navigator.vibrate?.(60)
    } else if (kind === 'bad') {
      tone(180, 0, 0.6, 'square', 0.18)
      navigator.vibrate?.([250, 100, 250])
    } else {
      tone(620, 0, 0.14, 'triangle')
      tone(620, 0.22, 0.14, 'triangle')
      navigator.vibrate?.([120, 80, 120])
    }
  } catch {
    /* sound is a courtesy, never a failure */
  }
}
