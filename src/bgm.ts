// ===================== 程序化 BGM（WebAudio 步进音序器，零外部资源） =====================
// 前瞻调度：每 40ms 检查一次，提前 0.15s 排音符；Boss 战加速加配器
import { G } from './state'
import { audio, masterNode } from './audio'

let playing = false
let timer = 0
let step = 0
let nextNote = 0
let bgmGain: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

// A 小调五声音阶
const BASS = [110, 110, 130.81, 98, 110, 110, 164.81, 146.83]          // A2 A2 C3 G2 A2 A2 E3 D3
const LEAD = [220, 261.63, 293.66, 329.63, 392, 440]

export function startBGM(): void {
  if (playing) return
  const ac = audio()
  playing = true
  step = 0
  nextNote = ac.currentTime + 0.1
  bgmGain = ac.createGain()
  bgmGain.gain.value = G.settings.music
  bgmGain.connect(masterNode())
  const len = ac.sampleRate * 0.3
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  timer = window.setInterval(schedule, 40)
}

export function stopBGM(): void {
  playing = false
  window.clearInterval(timer)
  if (bgmGain) { try { bgmGain.disconnect() } catch (e) { /* 忽略 */ } bgmGain = null }
}

export function setMusicVolume(v: number): void { if (bgmGain) bgmGain.gain.value = v }

function schedule(): void {
  if (!playing) return
  const ac = audio()
  // 暂停/切后台/未开局时不排音符，并把时间轴重置到"现在"，防止恢复后音符爆发
  if (document.hidden || G.paused || !G.started || G.gameOver) {
    nextNote = ac.currentTime + 0.1
    return
  }
  const battle = G.enemies.some(e => e.type === 'boss' && !e.dead)
  const bpm = battle ? 132 : G.wave >= 5 ? 120 : 108      // 战斗强度驱动节奏
  while (nextNote < ac.currentTime + 0.15) {
    playStep(step, nextNote, battle)
    nextNote += 60 / bpm / 2                              // 八分音符
    step = (step + 1) % 32                                // 4 小节循环
  }
}

function osc(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, t: number): void {
  const ac = audio()
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g); g.connect(bgmGain!)
  o.start(t); o.stop(t + dur + 0.02)
}

function noise(t: number, dur: number, vol: number, fc: number): void {
  const ac = audio()
  const s = ac.createBufferSource(); s.buffer = noiseBuf
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = fc
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  s.connect(f); f.connect(g); g.connect(bgmGain!)
  s.start(t); s.stop(t + dur)
}

function playStep(s: number, t: number, battle: boolean): void {
  // 底鼓：每拍
  if (s % 8 === 0 || s % 8 === 4) osc(150, 40, .12, 'sine', .5, t)
  // 军鼓：Boss 战加在二四拍
  if (battle && (s % 16 === 8)) noise(t, .12, .18, 1500)
  // 踩镲：反拍
  if (s % 4 === 2) noise(t, .03, .06, 6000)
  // 贝斯线：每八分音符
  if (s % 2 === 0) {
    const n = BASS[((s / 2) | 0) % 8]
    osc(n, n, .18, 'sawtooth', battle ? .16 : .11, t)
  }
  // 主旋律琶音：Boss 战概率触发
  if (battle && [0, 6, 10, 16, 22, 26].includes(s) && Math.random() < 0.7) {
    const n = LEAD[(Math.random() * LEAD.length) | 0]
    osc(n, n, .12, 'square', .05, t)
  }
}
