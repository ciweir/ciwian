// ===================== 世界物件：石块 / 宝石 / 尸体 / 武器掉落 / 宝箱 / 计时器 =====================
import { G, grand } from './state'
import { WEAPONS, SKILLS, swapRemove, rand } from './config'
import { hurtPlayer, gainExp, breakCombo, calcDamage, hurtEnemy, addMusou, comboBonus } from './combat'
import { updateFx, addShake, mkParticle, spawnHealText, particleCap } from './fx'
import { sfx } from './audio'
import { updateWaves } from './enemySys'
import { unlock } from './achievements'
import { addCoins } from './meta'

/** 宝箱奖励表（每日挑战走种子，全员同奖励） */
function openChest(): void {
  const p = G.player
  const roll = grand(0, 1)
  let msg: string
  if (roll < 0.25) {                                    // 回血 50%
    const healed = Math.round(Math.min(p.maxHp - p.hp, p.maxHp * 0.5))
    p.hp += healed
    if (healed > 0) spawnHealText(p.x, p.y - 50, healed)
    msg = '宝箱：气血回复 50%'
  } else if (roll < 0.5) {                              // 金币 +50
    addCoins(50)
    msg = '宝箱：金币 +50'
  } else if (roll < 0.7) {                              // 无双槽 +50
    addMusou(50)
    msg = '宝箱：无双 +50'
  } else if (roll < 0.9) {                              // 随机被动技能
    const s = SKILLS[(grand(0, SKILLS.length)) | 0]
    s.apply(p)
    p.passives[s.id] = (p.passives[s.id] || 0) + 1
    msg = '宝箱：被动「' + s.name + '」'
  } else if (p.weaponLvs[G.weapon] < 5) {               // 武器 +1 级
    p.weaponLvs[G.weapon]++
    msg = '宝箱：' + WEAPONS[G.weapon].name + ' Lv.' + p.weaponLvs[G.weapon]
  } else {
    addCoins(30)
    msg = '宝箱：金币 +30'
  }
  G.milestoneText = msg
  G.milestoneT = 1.4
  sfx.level()
}

/** 点到线段的最短距离平方（箭矢快速飞行防穿透） */
function segDist2(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const px = x1 + dx * t - cx, py = y1 + dy * t - cy
  return px * px + py * py
}

export function updateWorld(dt: number): void {
  updateWaves(dt)
  const p = G.player

  // 投掷石块
  for (let i = G.rocks.length - 1; i >= 0; i--) {
    const r = G.rocks[i]
    r.t += dt; r.x += r.vx * dt; r.y += r.vy * dt
    if (Math.hypot(r.x - p.x, r.y - p.y - 20) < 18) { hurtPlayer(8); swapRemove(G.rocks, i); continue }
    if (r.t > 4 || r.x < G.camX - 40 || r.x > G.camX + G.W + 40 || r.y < G.camY - 40 || r.y > G.camY + G.H + 40) swapRemove(G.rocks, i)
  }

  // 箭矢：直线飞行 + 线段命中判定（贯穿箭可穿透多个敌人）
  for (let i = G.arrows.length - 1; i >= 0; i--) {
    const a = G.arrows[i]
    const px = a.x, py = a.y
    a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt
    let dead = false
    for (const e of G.enemies) {
      if (e.dead || e.h > 0 || a.hits.includes(e)) continue
      if (segDist2(px, py, a.x, a.y, e.x, e.y - 14) > (14 * e.scale) ** 2) continue
      a.hits.push(e)
      const dmg = Math.max(1, Math.round((p.atk * a.coef - e.def) * (a.crit ? 2.5 : 1) * comboBonus()))
      hurtEnemy(e, dmg, a.crit, a.vx * 0.6, { launch: a.launch })
      if (!a.pierce) { dead = true; break }
    }
    if (dead || a.t > a.life ||
        a.x < G.camX - 80 || a.x > G.camX + G.W + 80 || a.y < G.camY - 80 || a.y > G.camY + G.H + 80) {
      swapRemove(G.arrows, i)
    }
  }

  // 经验宝石：自动吸附
  for (let i = G.gems.length - 1; i >= 0; i--) {
    const g = G.gems[i]
    g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 0.9; g.vy *= 0.9
    const dx = p.x - g.x, dy = p.y - 20 - g.y, d = Math.hypot(dx, dy)
    if (d < 130 * p.magnetMul) { g.vx += dx / d * 1400 * dt; g.vy += dy / d * 1400 * dt }
    if (d < 16) { gainExp(g.val); swapRemove(G.gems, i); sfx.gem() }
  }

  // 尸体翻滚飞出
  for (let i = G.corpses.length - 1; i >= 0; i--) {
    const c = G.corpses[i]
    c.t += dt
    c.h += c.vh * dt; c.vh -= 1400 * dt; c.x += c.vx * dt; c.rot += c.vrot * dt
    if (c.h < 0) { c.h = 0; c.vh *= -0.4; c.vx *= 0.6 }
    if (c.t > 3 || c.x < G.camX - 160 || c.x > G.camX + G.W + 160) swapRemove(G.corpses, i)
  }

  // 武器掉落物：浮动 / 过期 / 拾取换装
  for (let i = G.weaponDrops.length - 1; i >= 0; i--) {
    const d = G.weaponDrops[i]
    d.t += dt; d.life -= dt
    if (d.life <= 0) { swapRemove(G.weaponDrops, i); continue }
    if (Math.hypot(d.x - p.x, d.y - p.y) < 28) {
      G.weapon = d.weapon
      swapRemove(G.weaponDrops, i)
      G.milestoneText = '获得 ' + WEAPONS[d.weapon].name + '！'
      G.milestoneT = 1.2
      sfx.level()
      unlock('weaponSwitch')
    }
  }

    // Boss 宝箱：浮动 / 过期 / 拾取随机奖励
  for (let i = G.chests.length - 1; i >= 0; i--) {
    const c = G.chests[i]
    c.t += dt; c.life -= dt
    if (c.life <= 0) { swapRemove(G.chests, i); continue }
    if (Math.hypot(c.x - p.x, c.y - p.y) < 30) {
      swapRemove(G.chests, i)
      openChest()
    }
  }

  // 超武·陨星锤：延迟爆炸（范围 AOE + 击飞）
  for (let i = G.explosions.length - 1; i >= 0; i--) {
    const ex = G.explosions[i]
    ex.t -= dt
    if (ex.t <= 0) {
      swapRemove(G.explosions, i)
      addShake(8); sfx.heavy()
      G.shockwaves.push({ x: ex.x, y: ex.y, t: 0, dur: 0.35, maxR: 200, color: '255,150,40' })
      for (const e of G.enemies) {
        if (e.dead) continue
        const dx = e.x - ex.x, dy = e.y - ex.y, d = Math.hypot(dx, dy)
        if (d < 200) {
          const r = calcDamage(2.5, e)
          hurtEnemy(e, r.dmg, r.crit, (d > 0 ? dx / d : 1) * 500, { launch: true })
        }
      }
      for (let k = 0; k < 24 && G.particles.length < particleCap(); k++) G.particles.push(mkParticle(ex.x, ex.y, '#FFA030', rand(3, 6)))
    }
  }

  // 成就：单局存活 5 分钟
  if (G.gameTime >= 300) unlock('survive300')

  // 成就弹窗队列
  for (let i = G.achvToasts.length - 1; i >= 0; i--) {
    G.achvToasts[i].t -= dt
    if (G.achvToasts[i].t <= 0) swapRemove(G.achvToasts, i)
  }

  updateFx(dt)

  // 连击计时：comboWindow 秒无命中断连
  if (G.combo > 0) {
    G.comboTimer -= dt
    if (G.comboTimer <= 0) breakCombo()
  }
  G.comboBreakT = Math.max(0, G.comboBreakT - dt)
  G.comboPop = Math.max(0, G.comboPop - dt)
  G.levelFlashT = Math.max(0, G.levelFlashT - dt)
  G.musouFlashT = Math.max(0, G.musouFlashT - dt)
  G.milestoneT = Math.max(0, G.milestoneT - dt)
}
