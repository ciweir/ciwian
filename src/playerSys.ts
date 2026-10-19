// ===================== 玩家：三连段 / 蓄力重击 / 无双 / 冲刺 =====================
import { G } from './state'
import { WEAPONS, angDiff, rand } from './config'
import type { Enemy, HitOpts } from './types'
import { calcDamage, hurtEnemy } from './combat'
import { addShake, mkParticle, vibrate, spawnHealText } from './fx'
import { sfx } from './audio'
import { keys, joy } from './input'
import { setMusouUI, flashAtkBtn } from './ui'
import { unlock } from './achievements'

function weapon() { return WEAPONS[G.weapon] }
function canAct() { return G.started && !G.paused && !G.gameOver }

// ---- 普攻三连段（系数/节奏由武器定义） ----
export function pressAttack(): void {
  if (!canAct()) return
  const p = G.player
  if (p.act === 'atk') {
    if (p.atkStage < 3) p.buffered = true    // 攻击中按键 = 缓冲续段
    return
  }
  if (p.act === 'none' && !p.charging && p.dashT <= 0) {
    // 连段窗口内续段，否则重新起手
    if (p.chainWindow > 0 && p.atkStage > 0 && p.atkStage < 3) startAttack(p.atkStage + 1)
    else startAttack(1)
  }
}

function startAttack(stage: number): void {
  const p = G.player, w = weapon()
  let dur = w.dur[stage - 1]
  if (G.weapon === 'dual' && p.evolvedMap.dual) dur *= 0.75      // 超武·瞬狱双牙：攻速+33%
  p.act = 'atk'; p.atkStage = stage
  p.atkT = 0; p.atkDur = dur
  p.atkHitDone = false; p.buffered = false; p.chainWindow = 0
  p.vx = p.face * w.lunge[stage - 1]; p.vy = 0                   // 攻击前冲
}

function releaseChainOrIdle(): void {
  const p = G.player
  if (p.buffered && p.atkStage < 3) startAttack(p.atkStage + 1)
  else { p.act = 'none'; p.chainWindow = 0.45 }                  // 连段窗口
}

/** 弓：自动索敌最近敌人（索敌距离内），否则朝面向射出 */
function aimAngle(range: number): number {
  const p = G.player
  let best = range, bestE: Enemy | null = null
  for (const e of G.enemies) {
    if (e.dead || e.h > 0) continue
    const d = Math.hypot(e.x - p.x, e.y - p.y)
    if (d > 60 && d < best) { best = d; bestE = e }
  }
  if (bestE) return Math.atan2(bestE.y - 20 - (p.y - 20), bestE.x - p.x)
  return p.face > 0 ? 0 : Math.PI
}

/** 弓：射箭（普攻多矢扇形 / 重击单矢贯穿），伤害与暴击在出箭时定格 */
function fireArrows(count: number, spread: number, coef: number, opts: HitOpts = {}): void {
  const p = G.player
  const lv = p.weaponLvs[G.weapon]
  const pierce = !!opts.heavy || p.evolvedMap.bow
  const total = count + (p.evolvedMap.bow ? 1 : 0)      // 超武·连珠：多射一矢
  const base = aimAngle(WEAPONS.bow.range)
  for (let i = 0; i < total; i++) {
    const off = (i - (total - 1) / 2) * spread
    const ang = base + off
    const sp = opts.heavy ? 950 : 700
    G.arrows.push({
      x: p.x, y: p.y - 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      t: 0, life: opts.heavy ? 0.85 : 0.75,
      coef: coef * (1 + (lv - 1) * 0.15), crit: Math.random() < 0.15 + (p.level - 1) * 0.02 + p.critBonus,
      pierce, launch: !!opts.launch, hits: [],
    })
  }
  sfx.bow()
  if (opts.heavy) { addShake(4); G.shockwaves.push({ x: p.x, y: p.y - 20, t: 0, dur: 0.25, maxR: 90, color: '255,235,190' }) }
}

/** 近战判定：扇形范围（含武器等级加成与超武效果） */
function meleeHit(range: number, arc: number, coef: number, opts: HitOpts = {}): void {
  const p = G.player
  const faceAng = p.face > 0 ? 0 : Math.PI
  // 斩击弧光特效（无论是否命中都出刀光）
  if (G.slashes.length > 24) G.slashes.shift()
  G.slashes.push({ x: p.x, y: p.y - 24, face: p.face, t: 0, dur: opts.heavy ? 0.22 : 0.14, range: range * 0.95, arc, heavy: !!opts.heavy })
  if (opts.heavy) G.shockwaves.push({ x: p.x, y: p.y - 20, t: 0, dur: 0.3, maxR: range * 0.9, color: '255,170,60' })
  let hits = 0
  for (const e of G.enemies) {
    if (e.dead) continue
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy)
    if (d > range + 12 * e.scale) continue
    if (Math.abs(angDiff(Math.atan2(dy, dx), faceAng)) > arc) continue
    const r = calcDamage(coef, e)
    const dir = dx !== 0 ? Math.sign(dx) : p.face
    hurtEnemy(e, r.dmg, r.crit, dir * (opts.power || 220), opts)
    hits++
  }
  // 超武·崩拳：三段释放 360° 冲击波
  if (opts.stage === 3 && G.weapon === 'fist' && p.evolvedMap.fist) {
    for (const e of G.enemies) {
      if (e.dead) continue
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (d < 150) {
        const r = calcDamage(2.0, e)
        hurtEnemy(e, r.dmg, r.crit, Math.sign(e.x - p.x || 1) * 350, {})
        hits++
      }
    }
    addShake(6)
  }
  if (hits > 0) {
    if (opts.heavy) { addShake(8); sfx.heavy() }                 // 重击震屏 8px
    else { addShake(3); sfx.hit(); flashAtkBtn() }               // 普攻震屏 3px + 命中联动闪
  }
}

// ---- 蓄力重击：长按 0.5s 后释放，系数见武器定义，击飞敌人翻滚出场 ----
export function startCharge(): void {
  if (!canAct()) return
  const p = G.player
  if (p.act === 'none' && p.dashT <= 0) { p.charging = true; p.chargeT = 0 }
}
export function releaseCharge(): void {
  const p = G.player
  if (!p.charging) return
  p.charging = false
  if (p.chargeT >= 0.5 && canAct()) {
    p.act = 'heavy'; p.atkT = 0; p.atkDur = 0.5; p.atkHitDone = false
    vibrate(30)
  }
}

// ---- 无双：满槽释放，全屏 AOE + 2s 慢动作 ----
export function pressMusou(): void {
  if (!canAct() || G.musou < 100) return
  G.musou = 0; setMusouUI(0)
  G.slowmoT = 2; G.musouFlashT = 0.45; addShake(8); sfx.musou()
  vibrate([25, 40, 25])
  unlock('musou1')
  const p = G.player
  // 无双奖励：立即回复 40% 最大气血
  const healed = Math.round(Math.min(p.maxHp - p.hp, p.maxHp * 0.4))
  if (healed > 0) { p.hp += healed; spawnHealText(p.x, p.y - 50, healed) }
  G.shockwaves.push({ x: p.x, y: p.y - 20, t: 0, dur: 0.6, maxR: Math.hypot(G.W, G.H) / 2 + 100, color: '255,215,0' })
  for (const e of G.enemies) {
    if (e.dead) continue
    // "全屏" = 当前镜头视野 + 余量
    if (e.x < G.camX - 100 || e.x > G.camX + G.W + 100 || e.y < G.camY - 100 || e.y > G.camY + G.H + 100) continue
    const r = calcDamage(8, e)
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1
    hurtEnemy(e, r.dmg, r.crit, dx / d * 650, { launch: true, musou: true })
  }
}

// ---- 冲刺：0.2s 无敌帧 ----
export function doDash(dx: number, dy: number): void {
  if (!canAct()) return
  const p = G.player
  if (p.dashT > 0) return
  if (!dx && !dy) { dx = p.face; dy = 0 }
  const l = Math.hypot(dx, dy) || 1
  p.dashDir = { x: dx / l, y: dy / l }
  p.dashT = 0.2; p.invuln = Math.max(p.invuln, 0.3)
  p.charging = false
  sfx.dash(); vibrate(8)
}

export function updatePlayer(dt: number): void {
  const p = G.player, w = weapon()
  p.invuln = Math.max(0, p.invuln - dt)
  p.hurtFlash = Math.max(0, p.hurtFlash - dt)
  p.chainWindow = Math.max(0, p.chainWindow - dt)

  // 输入方向（键盘 + 摇杆）
  let ix = 0, iy = 0
  if (keys['a'] || keys['arrowleft']) ix -= 1
  if (keys['d'] || keys['arrowright']) ix += 1
  if (keys['w'] || keys['arrowup']) iy -= 1
  if (keys['s'] || keys['arrowdown']) iy += 1
  if (joy.active) { ix = joy.dx; iy = joy.dy }

  if (p.dashT > 0) {                                             // 冲刺
    p.dashT -= dt
    p.x += p.dashDir.x * 900 * dt; p.y += p.dashDir.y * 900 * dt
    const tr = mkParticle(p.x, p.y - 20, '#FF8C00', 3); tr.vy = 0; tr.life = 0.25
    G.particles.push(tr)
  } else if (p.act === 'atk' || p.act === 'heavy') {             // 攻击中：前冲衰减
    p.atkT += dt
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.85; p.vy *= 0.85
    const hitAt = p.act === 'heavy' ? 0.18 : p.atkDur * 0.45
    if (!p.atkHitDone && p.atkT >= hitAt) {
      p.atkHitDone = true
      const lv = p.weaponLvs[G.weapon]
      const cMul = 1 + (lv - 1) * 0.15                           // 武器等级：每级伤害 +15%
      const rBonus = (lv - 1) * 8                                // 每级范围 +8
      if (p.act === 'heavy') {
        if (G.weapon === 'bow') fireArrows(1, 0, w.heavyCoef + (lv - 1) * 0.3, { launch: true, heavy: true })
        else meleeHit(w.heavyRange * p.heavyRangeMul + rBonus, w.heavyArc, w.heavyCoef + (lv - 1) * 0.3, { launch: true, power: w.heavyPower, heavy: true })
        // 超武·陨星锤：重击引发延迟爆炸
        if (G.weapon === 'hammer' && p.evolvedMap.hammer)
          G.explosions.push({ x: p.x + p.face * 70, y: p.y, t: 0.35 })
      } else {
        let range = w.range + rBonus, arc = w.arc
        if (G.weapon === 'spear' && p.evolvedMap.spear) { range += 50; arc *= 2 }  // 超武·龙卷枪
        if (G.weapon === 'bow') {
          const counts = [1, 2, 3]
          fireArrows(counts[p.atkStage - 1], 0.12, w.coef[p.atkStage - 1] * cMul, { stage: p.atkStage })
        } else meleeHit(range, arc, w.coef[p.atkStage - 1] * cMul, { stage: p.atkStage })
      }
    }
    if (p.atkT >= p.atkDur) {
      if (p.act === 'heavy') p.act = 'none'
      else releaseChainOrIdle()
    }
  } else {                                                       // 正常移动
    const l = Math.hypot(ix, iy)
    const sp = p.speed * (p.charging ? 0.35 : 1)
    if (l > 0.15) {
      p.x += ix / l * sp * dt; p.y += iy / l * sp * dt
      p.face = ix > 0.1 ? 1 : ix < -0.1 ? -1 : p.face
      p.moving = true; p.walk += dt * 10
    } else p.moving = false
    if (p.charging) {
      p.chargeT += dt
      if (Math.random() < 0.3) G.particles.push(mkParticle(p.x + rand(-15, 15), p.y - rand(0, 40), '#80C0FF', 2))
    }
  }
  // 无限世界：不限制移动范围
}
