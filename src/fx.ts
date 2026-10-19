// ===================== 打击感与特效（白闪/顿帧/震屏/粒子/伤害数字） =====================
import { G } from './state'
import { rand, swapRemove } from './config'
import type { Particle, DmgText } from './types'

// ---------------- 对象池（减少 GC 压力） ----------------
const particlePool: Particle[] = []
const textPool: DmgText[] = []
function obtainParticle(): Particle { return particlePool.pop() || { x: 0, y: 0, vx: 0, vy: 0, size: 1, color: '', t: 0, life: 0 } }
function releaseParticle(p: Particle): void { particlePool.push(p) }
function obtainText(): DmgText { return textPool.pop() || { x: 0, y: 0, val: 0, crit: false, musou: false, t: 0, life: 0 } }
function releaseText(t: DmgText): void { textPool.push(t) }

/** 粒子数量上限（动态画质：低配减半） */
export function particleCap(): number { return G.lowQuality ? 150 : 300 }

/** 暴击顿帧：全局 timeScale 降至 0.3，持续 0.08s */
export function hitStop(): void { G.hitstopT = Math.max(G.hitstopT, 0.08) }

/** 手机震动反馈（不支持的平台静默） */
export function vibrate(pattern: number | number[]): void {
  try { (navigator as any).vibrate?.(pattern) } catch (e) { /* 静默 */ }
}

/** 屏幕震动：普攻 3px / 重击 8px，0.3s 衰减（可在设置中关闭） */
export function addShake(amp: number): void {
  if (!G.settings.shake) return
  G.shakeAmp = Math.max(G.shakeAmp, amp); G.shakeT = 0.3
}

export function mkParticle(x: number, y: number, color: string, size: number): Particle {
  const p = obtainParticle()
  p.x = x; p.y = y
  p.vx = rand(-180, 180); p.vy = rand(-260, -40)
  p.size = size; p.color = color; p.t = 0; p.life = rand(0.4, 0.9)
  return p
}

/** 死亡粒子：12–20 个小方块 + 重力 */
export function spawnDeathParticles(x: number, y: number, color: string): void {
  const n = 12 + (Math.random() * 9 | 0)
  for (let i = 0; i < n && G.particles.length < particleCap(); i++) G.particles.push(mkParticle(x, y, color, rand(2, 5)))
}

/** 伤害数字：上飘 + 0.5×→1.2×→1.0× 弹性缩放，颜色分级 白 < 暴击红 < 无双金 */
export function spawnDamageText(x: number, y: number, val: number, crit: boolean, musou: boolean): void {
  if (G.texts.length > 60) releaseText(G.texts.shift()!)
  const t = obtainText()
  t.x = x + rand(-8, 8); t.y = y; t.val = val; t.crit = crit; t.musou = musou; t.t = 0; t.life = 0.8; t.heal = false
  G.texts.push(t)
}

/** 治疗数字（绿色 +N） */
export function spawnHealText(x: number, y: number, val: number): void {
  if (G.texts.length > 60) releaseText(G.texts.shift()!)
  const t = obtainText()
  t.x = x + rand(-8, 8); t.y = y; t.val = val; t.crit = false; t.musou = false; t.t = 0; t.life = 0.9; t.heal = true
  G.texts.push(t)
}

/** 粒子与伤害数字的每帧更新（含重力，swap-remove + 对象池回收） */
export function updateFx(dt: number): void {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i]
    p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt
    if (p.t >= p.life) { releaseParticle(p); swapRemove(G.particles, i) }
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i]
    t.t += dt; t.y -= 45 * dt
    if (t.t >= t.life) { releaseText(t); swapRemove(G.texts, i) }
  }
  // 斩击弧光与冲击波环
  for (let i = G.slashes.length - 1; i >= 0; i--) {
    G.slashes[i].t += dt
    if (G.slashes[i].t >= G.slashes[i].dur) swapRemove(G.slashes, i)
  }
  for (let i = G.shockwaves.length - 1; i >= 0; i--) {
    G.shockwaves[i].t += dt
    if (G.shockwaves[i].t >= G.shockwaves[i].dur) swapRemove(G.shockwaves, i)
  }
}
