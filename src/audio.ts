// ===================== WebAudio 程序化音效（零外部资源） =====================
import { G } from './state'

let AC: AudioContext | null = null
let noiseBuf: AudioBuffer | null = null
let master: GainNode | null = null

/** 主音量（0~1），设置菜单调节 */
export function setVolume(v: number): void { if (master) master.gain.value = v }

/** 主增益节点（BGM 接入用） */
export function masterNode(): GainNode { audio(); return master! }

export function audio(): AudioContext {
  if (!AC) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    AC = new Ctor()
    master = AC.createGain()
    master.gain.value = G.settings.volume   // 应用设置中的音量
    master.connect(AC.destination)
    const len = AC.sampleRate * 0.5
    const buf = AC.createBuffer(1, len, AC.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    noiseBuf = buf
  }
  if (AC.state === 'suspended') AC.resume()
  return AC
}

export function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
  try {
    const ac = audio(), t = ac.currentTime + delay
    const o = ac.createOscillator(), g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(master!)
    o.start(t); o.stop(t + dur + 0.02)
  } catch (e) { /* 音频不可用时静默 */ }
}

export function noiseHit(dur: number, vol: number, fc: number): void {
  try {
    const ac = audio(), t = ac.currentTime
    const s = ac.createBufferSource(); s.buffer = noiseBuf
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    s.connect(f); f.connect(g); g.connect(master!)
    s.start(t); s.stop(t + dur)
  } catch (e) { /* 静默 */ }
}

export const sfx = {
  hit()   { tone(160, 60, .09, 'sine', .5); noiseHit(.05, .12, 1500) },        // 普攻"咚"
  crit()  { tone(950, 1500, .12, 'square', .25); noiseHit(.06, .1, 3000) },    // 暴击高音
  heavy() { tone(95, 38, .35, 'sawtooth', .5); noiseHit(.18, .25, 500) },      // 蓄力重击
  musou() { tone(180, 1600, .5, 'sawtooth', .35); tone(90, 45, .7, 'sine', .5, .1); noiseHit(.4, .2, 2500) },
  level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .12, 'triangle', .25, i * .07)) }, // 升级琶音
  hurt()  { tone(220, 80, .15, 'square', .25) },
  death() { tone(320, 70, .14, 'sine', .3); noiseHit(.1, .18, 900) },
  dash()  { noiseHit(.08, .1, 2000) },
  bow()   { tone(1300, 350, .07, 'triangle', .2); noiseHit(.04, .07, 4200) },   // 弓弦"绷"
  gem()   { tone(1200, 1600, .05, 'sine', .08) },
  rock()  { tone(400, 200, .1, 'triangle', .15) },
  ui()    { tone(700, 480, .06, 'square', .12); tone(180, 110, .09, 'sine', .22) },  // 菜单"木鱼/堂鼓"
}
