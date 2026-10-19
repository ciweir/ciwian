// ===================== 核心数值：伤害 / 连击 / 无双 / 经验 =====================
import { G, grand } from './state'
import { rand, MILESTONES, WEAPONS } from './config'
import type { Enemy, HitOpts, WeaponId } from './types'
import { unlock } from './achievements'
import { spawnDamageText, spawnHealText, spawnDeathParticles, mkParticle, hitStop, addShake, particleCap } from './fx'
import { sfx, noiseHit } from './audio'
import { showGameOver, setMusouUI } from './ui'
import { vibrate } from './fx'

// 伤害公式：damage = (atk × skillCoef − enemyDef) × critMult × comboBonus
//   critMult   = 2.5（暴击）或 1；暴击率 = 基础15% + 每级+2% + 技能加成
//   comboBonus = 1 + min(floor(combo/5) × 0.1, 1)  —— 每5连+10%，上限+100%
export function comboBonus(): number { return 1 + Math.min(Math.floor(G.combo / 5) * 0.1, 1) }

// 复用返回对象，避免高频调用产生 GC（调用方均需立即消费）
const dmgOut = { dmg: 0, crit: false }
export function calcDamage(skillCoef: number, enemy: Enemy): { dmg: number; crit: boolean } {
  const p = G.player
  let critChance = 0.15 + (p.level - 1) * 0.02 + p.critBonus
  if (G.weapon === 'dual' && p.evolvedMap.dual) critChance += 0.15   // 超武·瞬狱双牙
  const crit = Math.random() < critChance
  const critMult = crit ? 2.5 : 1
  dmgOut.dmg = Math.max(1, Math.round((p.atk * skillCoef - enemy.def) * critMult * comboBonus()))
  dmgOut.crit = crit
  return dmgOut
}

// 连击：comboWindow(默认1.2s) 内持续命中累加；超时断连显示 0.3s 灰色 COMBO BREAK
export function addCombo(): void {
  G.combo++; G.comboTimer = G.player.comboWindow; G.comboPop = 0.2
  if (G.combo > G.maxCombo) G.maxCombo = G.combo
  if (G.combo >= 20) unlock('combo20')
  if (G.combo >= 50) unlock('combo50')
}
export function breakCombo(): void { if (G.combo >= 5) G.comboBreakT = 0.3; G.combo = 0 }

// 无双槽：命中 +2、击杀 +8、上限 100（受"战意"技能倍率加成）
export function addMusou(n: number): void {
  G.musou = Math.min(100, Math.max(0, G.musou + n * G.player.musouGain))
  setMusouUI(G.musou)
}

// 经验：expToNext = 100 × 1.15^level；升级自动成长 + 触发技能三选一
export function gainExp(n: number): void {
  const p = G.player
  p.exp += n
  while (p.exp >= p.expNext) {
    p.exp -= p.expNext
    p.level++
    p.expNext = Math.round(100 * Math.pow(1.15, p.level))
    p.atk += 4; p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + 25)
    G.levelFlashT = 0.5
    G.levelUpPending++
    if (p.level >= 10) unlock('level10')
    sfx.level()
  }
}

/** 宝石入列：超过 80 颗时合并进最近的宝石 */
function pushGem(g: { x: number; y: number; vx: number; vy: number; val: number }): void {
  if (G.gems.length >= 80) {
    let nearest: (typeof G.gems)[0] | null = null, nd = Infinity
    for (const o of G.gems) {
      const d = Math.abs(o.x - g.x) + Math.abs(o.y - g.y)
      if (d < nd) { nd = d; nearest = o }
    }
    if (nearest) { nearest.val += g.val; return }
  }
  G.gems.push(g)
}

export function hurtEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, opts: HitOpts = {}): void {
  const p = G.player
  e.hp -= dmg
  e.flash = 0.1                                   // 受击白闪 0.1s
  spawnDamageText(e.x, e.y - 40 * e.scale - e.h, dmg, crit, !!opts.musou)
  addCombo(); addMusou(2)                         // 命中 +2 无双
  if (p.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * p.lifesteal)  // 吸血
  if (crit) { hitStop(); sfx.crit() }             // 暴击顿帧
  if (e.hp <= 0) { killEnemy(e, kx, opts); return }
  if (opts.launch) {                              // 击飞：抛物线 + 翻滚
    e.launched = true; e.vh = rand(340, 430); e.vrot = rand(-12, 12)
    e.vx = kx; e.vy = rand(-60, 60); e.state = 'stagger'; e.stateT = 1.2
  } else {
    e.state = 'stagger'; e.stateT = 0.16; e.vx = kx; e.vy = rand(-40, 40)
  }
}

/** 击杀计数 + 里程碑播报（50/100/200…） */
export function countKill(): void {
  addMusou(8)                                     // 击杀 +8 无双
  G.kills++
  unlock('firstBlood')
  if (G.kills >= 100) unlock('kill100')
  if (G.kills >= 500) unlock('kill500')
  if (MILESTONES.includes(G.kills)) {
    G.milestoneText = G.kills + ' 击杀！'
    G.milestoneT = 1.4
    sfx.level()
  }
}

/** 击杀回血：普通 +1（静默）、精英 +3、Boss +30（绿字提示） */
function killHeal(type: Enemy['type']): void {
  const p = G.player
  const amt = type === 'boss' ? 30 : type === 'elite' ? 3 : 1
  const before = p.hp
  p.hp = Math.min(p.maxHp, p.hp + amt)
  const gained = Math.round(p.hp - before)
  if (gained >= 3) spawnHealText(p.x, p.y - 50, gained)
}

export function killEnemy(e: Enemy, kx: number, opts: HitOpts = {}): void {
  e.dead = true
  countKill()
  killHeal(e.type)
  sfx.death()
  spawnDeathParticles(e.x, e.y - 20, e.color)
  // 尸体翻滚飞出屏幕（布娃娃退化方案，上限 30 防堆积）
  if (G.corpses.length > 30) G.corpses.shift()
  G.corpses.push({
    x: e.x, y: e.y - 20, vx: (kx || rand(-1, 1)) * rand(200, 380), vh: rand(200, 380), h: e.h || 0,
    rot: 0, vrot: rand(-14, 14), color: e.color, lw: e.lw, scale: e.scale, t: 0,
  })
  // 经验宝石：普通1颗 / 精英3颗 / Boss 8颗（超量时自动合并到最近宝石，防视觉噪音与卡顿）
  const gemN = e.type === 'boss' ? 8 : e.type === 'elite' ? 3 : 1
  const gemV = e.type === 'boss' ? 50 : e.type === 'elite' ? 20 : 5
  for (let i = 0; i < gemN; i++)
    pushGem({ x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), vx: rand(-60, 60), vy: rand(-60, 60), val: gemV })
  // 精英死亡爆炸，伤害周围敌人
  if (e.type === 'elite') {
    addShake(6); noiseHit(.2, .3, 600)
    for (const o of G.enemies) {
      if (o === e || o.dead) continue
      if (Math.hypot(o.x - e.x, o.y - e.y) < 130) {
        const r = calcDamage(3, o)
        hurtEnemy(o, r.dmg, r.crit, Math.sign(o.x - e.x || 1) * 300, {})
      }
    }
    for (let i = 0; i < 16 && G.particles.length < particleCap(); i++) G.particles.push(mkParticle(e.x, e.y - 20, '#FF6020', rand(2, 5)))
  }
  if (e.type === 'boss') {
    addShake(8)
    G.bossKills++
    for (let i = 0; i < 30 && G.particles.length < particleCap(); i++) G.particles.push(mkParticle(e.x, e.y - 30, '#FFD040', rand(3, 6)))
    unlock('boss1')
    // 双子：伴侣死亡令另一只立即暴走
    if (e.bossKind === 'twins') {
      const partner = G.enemies.find(o => o.type === 'boss' && o.bossKind === 'twins' && !o.dead)
      if (partner && !partner.enraged) {
        partner.enraged = true
        partner.speed = 110 * (G.dailyMod?.enemySpeedMul ?? 1); partner.touchDmg = 18
        G.milestoneText = '双子暴走！'; G.milestoneT = 1.4
        addShake(6); sfx.musou()
      }
    }
    // 最终霸主：击杀即通关（金雨 + 慢动作 + 结算倒计时）
    if (e.bossKind === 'overlord') {
      G.victory = true; G.victoryT = 2.0
      G.slowmoT = 1.5
      G.milestoneText = '武林霸主已陨落！'; G.milestoneT = 1.8
      for (let i = 0; i < 80 && G.particles.length < particleCap(); i++) {
        const pt = mkParticle(rand(G.camX, G.camX + G.W), G.camY - 20, '#F0D79A', rand(2, 5))
        pt.vy = rand(60, 220); pt.vx = rand(-40, 40); pt.life = rand(1.2, 2.2)
        G.particles.push(pt)
      }
      unlock('boss1')
    } else {
      // Boss 宝箱：拾取随机奖励
      G.chests.push({ x: e.x, y: e.y, t: 0, life: 30 })
    }
  }
  // 武器掉落：精英 25%（种子化）/ Boss 必掉（不掉当前武器）
  if (e.type === 'boss' || (e.type === 'elite' && grand(0, 1) < 0.25)) {
    const pool = (Object.keys(WEAPONS) as WeaponId[]).filter(w => w !== G.weapon)
    G.weaponDrops.push({ x: e.x, y: e.y, weapon: pool[(grand(0, pool.length)) | 0], t: 0, life: 25 })
  }
}

export function hurtPlayer(dmg: number): void {
  const p = G.player
  if (p.invuln > 0 || p.dashT > 0 || G.gameOver || G.victory) return
  p.hp -= dmg; p.hurtFlash = 0.25; p.invuln = 0.6
  addShake(4); sfx.hurt(); vibrate(50)
  breakCombo()
  if (p.hp <= 0) {
    // 局外强化「复活」：半血复活一次，击退周围敌人
    if (p.revives > 0) {
      p.revives--
      p.hp = p.maxHp * 0.5
      p.invuln = 2
      G.milestoneText = '复活！'; G.milestoneT = 1.4
      G.shockwaves.push({ x: p.x, y: p.y - 20, t: 0, dur: 0.4, maxR: 260, color: '255,255,120' })
      for (const e of G.enemies) {
        if (e.dead) continue
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1
        if (d < 260) { e.state = 'stagger'; e.stateT = 0.6; e.vx = dx / d * 500; e.vy = dy / d * 500 }
      }
      addShake(8); sfx.musou()
      return
    }
    p.hp = 0
    G.gameOver = true
    showGameOver()
  }
}
