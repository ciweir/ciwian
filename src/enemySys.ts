// ===================== 敌人：FSM AI + 波次生成 =====================
import { G, grand } from './state'
import { rand, TAU, ENEMY_COLOR, ENEMY_CAP, WAVE_INTERVAL, swapRemove, BOSS_NAMES, bossKindFor,
  RUSH_LENGTH, RUSH_SEQ, RUSH_REST, rushEffWave } from './config'
import type { Enemy, EnemyType, BossKind } from './types'
import { hurtPlayer, gainExp, countKill, killEnemy } from './combat'
import { addShake } from './fx'
import { tone, sfx } from './audio'
import { unlock } from './achievements'

export function aliveEnemies(): number { return G.enemies.length + G.spawnQueue.length }

/**
 * 波次规则：
 *   波次每 30s +1；enemyHP = 50 × 1.2^wave；每波数量 = 5 + wave × 2，同屏上限 60；每 5 波出 Boss
 */
export function makeEnemy(type: EnemyType, x: number, y: number, kind?: BossKind, effWave = G.wave): Enemy {
  const baseHP = 50 * Math.pow(1.2, effWave)        // 敌人血量公式：enemyHP = 50 × 1.2^effWave
  const speedMul = G.dailyMod?.enemySpeedMul ?? 1
  const defBonus = G.dailyMod?.enemyDefBonus ?? 0
  const e: Enemy = {
    type, x, y, vx: 0, vy: 0, h: 0, vh: 0, rot: 0, vrot: 0,
    hp: baseHP, maxHp: baseHP, def: effWave + defBonus,  // enemyDef 随波次线性增长
    state: 'idle', stateT: rand(0.1, 0.6),          // FSM: Idle/Chase/Attack/Stagger/Dead
    speed: 95 + effWave * 2, flash: 0, touchCd: 0, throwT: rand(1, 2),
    face: 1, walk: rand(0, 6), launched: false, dead: false,
    scale: 1, color: ENEMY_COLOR, lw: 4, touchDmg: 5,
    specialT: rand(2.5, 4), summonT: 5,
  }
  if (type === 'thrower') { e.color = '#555'; e.speed = 80 }
  if (type === 'elite') { e.hp = e.maxHp = baseHP * 5; e.speed *= 0.6; e.color = '#C03028'; e.lw = 6; e.scale = 1.35; e.touchDmg = 10 }
  if (type === 'boss') {
    const k = kind || 'charger'
    e.bossKind = k
    e.hp = e.maxHp = baseHP * 50; e.speed = 58; e.color = '#8a0f0f'; e.lw = 8; e.scale = 2.2; e.touchDmg = 15; e.def = effWave * 2 + defBonus
    e.throwT = 6                                     // 借用为召唤计时
    if (k === 'spitter') { e.hp = e.maxHp = baseHP * 45; e.speed = 40; e.color = '#5A2A6A'; e.summonT = 2.5 }
    if (k === 'twins') { e.hp = e.maxHp = baseHP * 28; e.speed = 78; e.scale = 1.7; e.color = '#A02020'; e.lw = 6 }
    if (k === 'overlord') { e.hp = e.maxHp = baseHP * 90; e.speed = 62; e.scale = 2.8; e.color = '#3A0A14'; e.lw = 9; e.touchDmg = 20; e.summonT = 3 }
  }
  e.speed *= speedMul
  return e
}

/** 在玩家视野外一圈取点（无限世界，不夹边界） */
export function aroundSpawnPos(): { x: number; y: number } {
  const ang = grand(0, TAU)                        // 种子化（每日挑战确定性）
  const d = Math.hypot(G.W, G.H) / 2 + grand(60, 200)
  return { x: G.player.x + Math.cos(ang) * d, y: G.player.y + Math.sin(ang) * d }
}

/** 推入出生预警队列（红圈提示后才真正刷出，Boss 预警更久；eff = 有效波次，Boss Rush 用） */
function queueSpawn(type: EnemyType, x: number, y: number, kind?: BossKind, eff?: number): void {
  G.spawnQueue.push({ x, y, type, t: type === 'boss' ? 1.2 : 0.6, kind, eff })
}

export function spawnWave(): void {
  G.wave++
  if (G.bossRush) {
    // Boss Rush：每波一名 Boss（靠近玩家出生），强度按连战序号折算有效波次
    const kind = RUSH_SEQ[Math.min(G.wave, RUSH_LENGTH) - 1]
    const ang = grand(0, TAU)
    queueSpawn('boss', G.player.x + Math.cos(ang) * 360, G.player.y + Math.sin(ang) * 360, kind, rushEffWave(G.wave))
    return
  }
  if (G.wave >= 5) unlock('wave5')
  if (G.wave >= 10) unlock('wave10')
  const eliteChance = G.dailyMod?.eliteChance ?? 0.12
  const spawnMul = G.dailyMod?.spawnMul ?? 1
  const n = Math.min(Math.round((5 + G.wave * 2) * spawnMul), ENEMY_CAP - aliveEnemies())   // 每波数量 = 5 + wave × 2
  for (let i = 0; i < n; i++) {
    const p = aroundSpawnPos()
    let type: EnemyType = 'chaser'
    const r = grand(0, 1)                            // 种子化波次构成
    if (G.wave >= 3 && r < eliteChance) type = 'elite'
    else if (G.wave >= 2 && r < 0.32) type = 'thrower'
    queueSpawn(type, p.x, p.y)
  }
  if (G.wave % 5 === 0) {                            // 每 5 波出 Boss（形态轮换，第20波霸主）
    const p = aroundSpawnPos()
    queueSpawn('boss', p.x, p.y, bossKindFor(G.wave))
  }
}

/** 出生预警倒计时 → 真正刷出（Boss 出场横幅，双子成双） */
export function updateSpawnQueue(dt: number): void {
  for (let i = G.spawnQueue.length - 1; i >= 0; i--) {
    const s = G.spawnQueue[i]
    s.t -= dt
    if (s.t <= 0) {
      if (s.type === 'boss') {
        const kind = s.kind || 'charger'
        if (kind === 'twins') {
          for (const off of [-70, 70]) {
            const b = makeEnemy('boss', s.x + off, s.y, kind, s.eff)
            b.state = 'chase'
            b.variant = off < 0 ? 0 : 1
            G.enemies.push(b)
          }
        } else {
          const b = makeEnemy('boss', s.x, s.y, kind, s.eff)
          b.state = 'chase'
          G.enemies.push(b)
        }
        G.milestoneText = BOSS_NAMES[kind] + ' 现身！'
        G.milestoneT = 1.8
        addShake(6); sfx.musou()
      } else {
        const e = makeEnemy(s.type, s.x, s.y)
        e.state = 'chase'
        G.enemies.push(e)
      }
      swapRemove(G.spawnQueue, i)
    }
  }
}

/** 敌人间挤压分离（包围盒早退 + 视野门控：屏外敌人不参与） */
function separation(): void {
  const arr = G.enemies
  const vx0 = G.camX - 200, vx1 = G.camX + G.W + 200
  const vy0 = G.camY - 200, vy1 = G.camY + G.H + 200
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i]
    if (a.dead || a.h > 0 || a.launched) continue
    if (a.x < vx0 || a.x > vx1 || a.y < vy0 || a.y > vy1) continue   // 屏外不算
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j]
      if (b.dead || b.h > 0 || b.launched) continue
      if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue
      const min = 13 * (a.scale + b.scale)
      const adx = Math.abs(b.x - a.x); if (adx > min) continue   // 包围盒早退，避免 hypot
      const ady = Math.abs(b.y - a.y); if (ady > min) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy)
      if (d > 0 && d < min) {
        const push = (min - d) / 2 / d, px = dx * push, py = dy * push
        if (a.state === 'chase') { a.x -= px; a.y -= py }
        if (b.state === 'chase') { b.x += px; b.y += py }
      }
    }
  }
}

export function updateEnemies(dt: number): void {
  const pl = G.player
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i]
    if (e.dead) { swapRemove(G.enemies, i); continue }
    // 远处敌人降频更新（1/3 频率、3 倍步长补偿），玩家看不见的 AI 不烧 CPU
    const farX = e.x < G.camX - 500 || e.x > G.camX + G.W + 500
    const farY = e.y < G.camY - 500 || e.y > G.camY + G.H + 500
    const far = farX || farY
    if (far && (G.frame + i) % 3 !== 0) continue
    const edt = far ? dt * 3 : dt
    e.flash = Math.max(0, e.flash - edt)
    e.touchCd -= edt

    // 甩掉太远的杂兵自动回传到玩家附近（保持战斗压力，Boss 除外）
    if (e.state === 'chase' && e.type !== 'boss' &&
        (Math.abs(e.x - pl.x) > G.W / 2 + 700 || Math.abs(e.y - pl.y) > G.H / 2 + 700)) {
      const np = aroundSpawnPos()
      e.x = np.x; e.y = np.y
    }

    // Boss 二阶段：半血狂暴（提速/加伤/技能冷却缩短/冲撞更快）
    if (e.type === 'boss' && !e.enraged && e.hp <= e.maxHp / 2) {
      e.enraged = true
      e.speed = 92 * (G.dailyMod?.enemySpeedMul ?? 1); e.touchDmg = 20
      e.specialT = Math.min(e.specialT, 0.5)
      e.summonT = Math.min(e.summonT, 1)
      G.milestoneText = 'BOSS 狂暴！'; G.milestoneT = 1.6
      addShake(8); sfx.musou()
      unlock('bossEnrage')
    }

    // 空中状态（被击飞）：抛物线 + 翻滚，飞出场外计为击杀
    if (e.h > 0 || e.vh > 0) {
      e.h += e.vh * edt; e.vh -= 1400 * edt; e.rot += e.vrot * edt
      e.x += e.vx * edt; e.y += e.vy * edt; e.vx *= 0.995
      if (e.h <= 0) {
        e.h = 0
        if (e.launched) { e.launched = false; e.vrot = 0; e.rot = 0; e.state = 'stagger'; e.stateT = 0.5 }
      }
      // 飞出视野（相机范围 + 余量）= 击杀；Boss 必须走 killEnemy 结算（宝箱/双子/通关）
      if (e.x < G.camX - 160 || e.x > G.camX + G.W + 160 || e.y < G.camY - 160 || e.y > G.camY + G.H + 160) {
        if (e.type === 'boss') killEnemy(e, 0, {})
        else { e.dead = true; countKill(); gainExp(5) }
      }
      continue
    }

    const dx = pl.x - e.x, dy = pl.y - e.y, dist = Math.hypot(dx, dy) || 1
    e.face = dx > 0 ? 1 : -1

    switch (e.state) {
      case 'idle':
        e.stateT -= edt
        e.x += Math.sin(G.gameTime * 2 + i) * 8 * edt
        if (e.stateT <= 0) e.state = 'chase'
        break

      case 'chase': {
        if (e.type === 'thrower' && dist < 200) { e.state = 'attack'; break }
        e.x += dx / dist * e.speed * edt
        e.y += dy / dist * e.speed * edt
        e.walk += edt * 8
        // Boss 技能（按形态组合：冲撞 / 环形弹幕 / 召唤）
        if (e.type === 'boss') {
          const kind = e.bossKind || 'charger'
          e.specialT -= edt; e.summonT -= edt; e.throwT -= edt
          // 冲撞：裂地者 / 双子 / 霸主
          if ((kind === 'charger' || kind === 'twins' || kind === 'overlord') && e.specialT <= 0) {
            e.specialT = e.enraged ? 2.0 : 3.5
            e.state = 'bossTelegraph'; e.stateT = e.enraged ? 0.45 : 0.7
          }
          // 环形弹幕：术士 / 霸主
          if ((kind === 'spitter' || kind === 'overlord') && e.summonT <= 0) {
            e.summonT = e.enraged ? 2.5 : 4
            ringBarrage(e, e.enraged ? 14 : 10, 240)
            if (e.enraged) aimedBurst(e)
          }
          // 召唤小兵：裂地者 / 霸主
          if ((kind === 'charger' || kind === 'overlord') && e.throwT <= 0 && aliveEnemies() < ENEMY_CAP - 4) {
            e.throwT = e.enraged ? 4.5 : 6
            const n = e.enraged ? 4 : 3
            for (let k = 0; k < n; k++) queueSpawn('chaser', e.x + rand(-50, 50), e.y + rand(-50, 50))
          }
        }
        // 接触伤害
        if (dist < 26 * e.scale + 10 && e.touchCd <= 0) {
          hurtPlayer(e.touchDmg)
          e.touchCd = 0.9
          e.vx = -dx / dist * 150; e.vy = -dy / dist * 150
          e.state = 'stagger'; e.stateT = 0.25
        }
        break
      }

      case 'attack':   // 投掷型：200px 停下，每 2s 投掷石块
        if (dist > 260) { e.state = 'chase'; break }
        e.throwT -= edt
        if (e.throwT <= 0) {
          e.throwT = 2
          G.rocks.push({ x: e.x, y: e.y - 30, vx: dx / dist * 260, vy: dy / dist * 260, t: 0 })
          tone(400, 200, .1, 'triangle', .15)
        }
        break

      case 'bossTelegraph':    // Boss 蓄力（红闪预警）
        e.stateT -= edt; e.flash = 0.05
        if (e.stateT <= 0) {
          e.state = 'bossCharge'; e.stateT = 0.55
          const sp = e.enraged ? 880 : 720
          e.vx = dx / dist * sp; e.vy = dy / dist * sp
          addShake(5)
        }
        break

      case 'bossCharge':
        e.stateT -= edt
        e.x += e.vx * edt; e.y += e.vy * edt; e.walk += edt * 20
        if (dist < 40 && e.touchCd <= 0) { hurtPlayer(20); e.touchCd = 1 }
        if (e.stateT <= 0) e.state = 'chase'
        break

      case 'stagger':
        e.stateT -= edt
        e.x += e.vx * edt; e.y += e.vy * edt; e.vx *= 0.86; e.vy *= 0.86
        if (e.stateT <= 0) { e.state = 'chase'; e.rot = 0; e.vrot = 0 }
        break
    }
  }
  separation()
}

/** 环形弹幕（术士/霸主） */
function ringBarrage(e: Enemy, n: number, speed: number): void {
  const off = e.enraged ? 0.3 : 0
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + off
    G.rocks.push({ x: e.x, y: e.y - 30, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0 })
  }
  tone(300, 120, .2, 'sawtooth', .25)
}

/** 定向三连（术士狂暴追加） */
function aimedBurst(e: Enemy): void {
  const dx = G.player.x - e.x, dy = G.player.y - 20 - (e.y - 30)
  const base = Math.atan2(dy, dx)
  for (const da of [-0.25, 0, 0.25])
    G.rocks.push({ x: e.x, y: e.y - 30, vx: Math.cos(base + da) * 300, vy: Math.sin(base + da) * 300, t: 0 })
}

/** 波次计时 + 补充刷怪（维持压力）+ 出生预警 */
export function updateWaves(dt: number): void {
  if (G.victory) { updateSpawnQueue(dt); return }   // 通关后不再刷波
  if (G.bossRush) { updateBossRush(dt); return }
  G.waveTimer += dt
  if (G.waveTimer >= WAVE_INTERVAL) { G.waveTimer = 0; spawnWave() }
  G.spawnTick += dt
  if (G.spawnTick > 2.5) {
    G.spawnTick = 0
    if (aliveEnemies() < Math.min(4 + G.wave, 25)) {
      const p = aroundSpawnPos()
      queueSpawn('chaser', p.x, p.y)
    }
  }
  updateSpawnQueue(dt)
}

/** Boss Rush：当前 Boss 阵亡 → 间歇回复 30% 气血 → 下一位登场 */
function updateBossRush(dt: number): void {
  const bossPending = G.enemies.some(e => e.type === 'boss' && !e.dead) ||
    G.spawnQueue.some(s => s.type === 'boss')
  if (!bossPending && G.wave < RUSH_LENGTH) {
    if (G.brRest < 0) {
      G.brRest = RUSH_REST
      const p = G.player
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3)
      G.milestoneText = '下一位：' + BOSS_NAMES[RUSH_SEQ[G.wave]]
      G.milestoneT = 2
      sfx.level()
    } else {
      G.brRest -= dt
      if (G.brRest <= 0) { G.brRest = -1; spawnWave() }
    }
  }
  updateSpawnQueue(dt)
}
