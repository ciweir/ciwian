// ===================== 渲染：氛围 / 火柴人(武器) / 特效 / HUD / 小地图 =====================
import { G } from './state'
import { PLAYER_COLOR, WEAPONS, WAVE_INTERVAL, RADAR_RANGE, BOSS_NAMES, RUSH_LENGTH, clamp, rand } from './config'
import type { WeaponId } from './types'
import { orient } from './orientation'
import { drawPlayerModel } from './model'
import { drawFoeModel } from './enemyModel'
import { drawBossModel } from './bossModel'
import { drawBiome } from './biome'

export const cvs = document.getElementById('game') as HTMLCanvasElement
export const ctx = cvs.getContext('2d')!
let DPR = 1

export function resizeCanvas(): void {
  DPR = Math.min(window.devicePixelRatio || 1, 2)   // 限制 DPR 保性能
  // 强制方向（伪旋转）时逻辑宽高互换：包裹层已旋转，画布跟着包裹层走
  const rotated = orient.rot !== 0
  G.W = rotated ? window.innerHeight : window.innerWidth
  G.H = rotated ? window.innerWidth : window.innerHeight
  cvs.width = G.W * DPR; cvs.height = G.H * DPR
  cvs.style.width = G.W + 'px'; cvs.style.height = G.H + 'px'
  vignetteGrad = null                                // 尺寸变化，重建暗角梯度
}

const TAU = Math.PI * 2
const KAI = '"KaiTi","STKaiti","STKaitiSC","SimSun",serif'   // 国风楷体
// 梯度缓存（避免每帧创建对象）
let floorGrad: CanvasGradient | null = null, floorGx = 0, floorGy = 0
let vignetteGrad: CanvasGradient | null = null
// 字体缓存：ctx.font 赋值有开销，热路径去重
let lastFont = ''
function setFont(f: string): void { if (f !== lastFont) { ctx.font = f; lastFont = f } }
// 玩家光环梯度缓存（translate 复用）
let haloGrad: CanvasGradient | null = null
// 血条梯度缓存（0→h 纵向，配合 translate 使用）
const barGrads = new Map<string, CanvasGradient>()
function barGrad(c0: string, c1: string, h: number): CanvasGradient {
  const key = c0 + '|' + c1 + '|' + h
  let g = barGrads.get(key)
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, c0); g.addColorStop(1, c1)
    barGrads.set(key, g)
  }
  return g
}
function line(x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}
function rr(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

// ---------------- 氛围尘埃（相机周围循环的漂浮微粒） ----------------
interface Mote { x: number; y: number; r: number; vx: number; vy: number; a: number }
let motes: Mote[] = []
function initMotes(): void {
  if (motes.length) return
  for (let i = 0; i < 60; i++)
    motes.push({ x: rand(-800, 800), y: rand(-500, 500), r: rand(1, 2.6), vx: rand(-6, 6), vy: rand(-14, -5), a: rand(.05, .16) })
}
function updateMotes(dt: number): void {
  for (const m of motes) {
    m.x += m.vx * dt; m.y += m.vy * dt
    // 无限世界：围绕相机视野循环
    if (m.y < G.camY - 40) { m.y = G.camY + G.H + rand(0, 40); m.x = rand(G.camX, G.camX + G.W) }
    if (m.x < G.camX - 60) m.x = G.camX + G.W + rand(0, 60)
    else if (m.x > G.camX + G.W + 60) m.x = G.camX - rand(0, 60)
  }
}

/** 脚下投影 */
function shadow(x: number, y: number, scale: number): void {
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  ctx.beginPath(); ctx.ellipse(x, y + 2, 11 * scale, 4 * scale, 0, 0, TAU); ctx.fill()
}

interface StickOpts {
  color: string; lw: number; flip?: number
  walk: number; moving: boolean
  rot?: number; h?: number; scale?: number; flash?: number
  weapon?: WeaponId; eye?: string
  pose?: {
    dash?: boolean; charge?: boolean
    atk?: boolean; stage?: number; p?: number
    heavy?: boolean
  }
}

/** 通用火柴人（四肢摆动 + 手持武器 + 眼睛，受击白闪） */
export function drawStick(x: number, y: number, o: StickOpts): void {
  ctx.save()
  ctx.translate(x, y - (o.h || 0))
  if (o.rot) ctx.rotate(o.rot)
  ctx.scale((o.flip || 1) * (o.scale || 1), (o.scale || 1))
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.lineWidth = o.lw || 4
  const col = (o.flash || 0) > 0 ? '#FFF' : o.color   // 受击白闪
  ctx.strokeStyle = col; ctx.fillStyle = col

  const hip = { x: 0, y: -16 }, sh = { x: 0, y: -34 }, head = { x: 2, y: -44 }
  const swing = o.moving ? Math.sin(o.walk) * 0.55 : 0
  let legA = Math.PI / 2 + swing, legB = Math.PI / 2 - swing
  let armA = Math.PI / 2 - 0.3 + swing * 0.5, armB = Math.PI / 2 + 0.3 - swing * 0.5
  let lean = 0

  const pose = o.pose || {}
  if (pose.dash) { lean = 0.5; armA = 2.2; armB = 2.4; legA = 2.6; legB = 1.9 }
  if (pose.charge) { lean = 0.2; armA = 1.8; armB = 1.9; legA = Math.PI / 2 + 0.4; legB = Math.PI / 2 - 0.4 }
  if (pose.atk) {    // 三连段姿势：直拳 / 摆拳 / 飞踢，节奏区分
    const p = pose.p || 0
    if (o.weapon === 'bow') {          // 弓：双臂前伸拉弓（各段共用射击站姿）
      armA = 0.05; armB = -0.35; lean = 0.3
    } else {
      if (pose.stage === 1) { armA = p < 0.35 ? -1.0 + p * 2.4 : 0.05; lean = 0.15 }
      if (pose.stage === 2) { armB = p < 0.35 ? -1.0 + p * 2.4 : 0.05; armA = 1.6; lean = 0.25 }
      if (pose.stage === 3) { legA = p < 0.4 ? Math.PI / 2 - p * (Math.PI / 2) / 0.4 : 0.1; armA = 2.6; armB = 2.8; lean = 0.35 }
    }
  }
  if (pose.heavy) {  // 蓄力重击：双臂下砸（弓为聚力射击）
    const p = pose.p || 0
    if (o.weapon === 'bow') { armA = 0; armB = 0.3; lean = 0.35 }
    else {
      const a = p < 0.4 ? -2.6 : -2.6 + ((p - 0.4) / 0.6) * 2.9
      armA = a; armB = a; lean = 0.3
    }
  }

  const legLen = 16, armLen = 14
  line(hip.x, hip.y, hip.x + Math.cos(legA) * legLen, hip.y + Math.sin(legA) * legLen)
  line(hip.x, hip.y, hip.x + Math.cos(legB) * legLen, hip.y + Math.sin(legB) * legLen)
  line(hip.x, hip.y, sh.x + lean * 10, sh.y)                       // 身体（带前倾）
  const sx = sh.x + lean * 10
  const hx1 = sx + Math.cos(armA) * armLen, hy1 = sh.y + Math.sin(armA) * armLen   // 主手
  const hx2 = sx + Math.cos(armB) * armLen, hy2 = sh.y + Math.sin(armB) * armLen   // 副手
  line(sx, sh.y, hx1, hy1)
  line(sx, sh.y, hx2, hy2)

  // 手持武器
  if (o.weapon && (o.flash || 0) <= 0) drawWeapon(o.weapon, armA, armB, hx1, hy1, hx2, hy2)

  // 头 + 眼睛
  ctx.strokeStyle = col
  ctx.beginPath(); ctx.arc(head.x + lean * 12, head.y, 8, 0, TAU); ctx.stroke()
  if (o.eye) {
    ctx.fillStyle = (o.flash || 0) > 0 ? '#FFF' : o.eye
    ctx.beginPath(); ctx.arc(head.x + lean * 12 + 3.5, head.y - 1, 1.8, 0, TAU); ctx.fill()
  }
  ctx.restore()
}

/** 武器绘制（跟随手臂角度） */
function drawWeapon(w: WeaponId, armA: number, armB: number, hx1: number, hy1: number, hx2: number, hy2: number): void {
  ctx.strokeStyle = '#C8CCD4'; ctx.fillStyle = '#C8CCD4'; ctx.lineWidth = 3
  if (w === 'spear') {
    const dx = Math.cos(armA), dy = Math.sin(armA)
    line(hx1 - dx * 8, hy1 - dy * 8, hx1 + dx * 36, hy1 + dy * 36)      // 枪杆
    ctx.beginPath()                                                      // 枪头
    ctx.moveTo(hx1 + dx * 44, hy1 + dy * 44)
    ctx.lineTo(hx1 + dx * 34 - dy * 4, hy1 + dy * 34 + dx * 4)
    ctx.lineTo(hx1 + dx * 34 + dy * 4, hy1 + dy * 34 - dx * 4)
    ctx.closePath(); ctx.fill()
  } else if (w === 'dual') {
    for (const [hx, hy, a] of [[hx1, hy1, armA], [hx2, hy2, armB]] as const) {
      const dx = Math.cos(a), dy = Math.sin(a)
      ctx.lineWidth = 4
      line(hx, hy, hx + dx * 15, hy + dy * 15)                           // 刀刃
      ctx.lineWidth = 3
    }
  } else if (w === 'hammer') {
    const dx = Math.cos(armA), dy = Math.sin(armA)
    line(hx1, hy1, hx1 + dx * 16, hy1 + dy * 16)                         // 锤柄
    ctx.save()
    ctx.translate(hx1 + dx * 18, hy1 + dy * 18)
    ctx.rotate(armA)
    ctx.fillRect(-3, -7, 12, 14)                                         // 锤头
    ctx.restore()
  } else if (w === 'bow') {
    ctx.strokeStyle = '#D4A94E'                                          // 鎏金弓身
    ctx.save()
    ctx.translate(hx1, hy1)
    ctx.rotate(armA)
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(0, 0, 15, -1.05, 1.05); ctx.stroke()        // 弓臂（朝前弓起）
    ctx.lineWidth = 1.2
    line(Math.cos(-1.05) * 15, Math.sin(-1.05) * 15,
         Math.cos(1.05) * 15, Math.sin(1.05) * 15)                       // 弓弦
    ctx.restore()
  } else {
    ctx.fillStyle = '#FFB050'                                            // 拳套
    ctx.beginPath(); ctx.arc(hx1, hy1, 3.5, 0, TAU); ctx.fill()
    ctx.beginPath(); ctx.arc(hx2, hy2, 3.5, 0, TAU); ctx.fill()
  }
}

/** 视野裁剪：只画相机附近的实体 */
function inView(x: number, y: number, margin: number): boolean {
  return x > G.camX - margin && x < G.camX + G.W + margin && y > G.camY - margin && y < G.camY + G.H + margin
}

export function render(dtR: number): void {
  if (!G.lowQuality) { initMotes(); updateMotes(dtR) }   // 低配时尘埃不更新不绘制
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  // 屏幕震动：0.3s 衰减
  let sx = 0, sy = 0
  if (G.shakeT > 0) {
    G.shakeT -= dtR
    const k = G.shakeAmp * Math.max(0, G.shakeT / 0.3)
    sx = rand(-k, k); sy = rand(-k, k)
    if (G.shakeT <= 0) G.shakeAmp = 0
  }

  // ==================== 世界层（相机 + 震屏） ====================
  ctx.save()
  ctx.translate(-G.camX + sx, -G.camY + sy)

  // 无限世界地面：玩家中心径向光（梯度缓存，移动超 120px 才重建）+ 棋盘纹 + 网格
  const p0 = G.player
  if (!floorGrad || Math.hypot(p0.x - floorGx, p0.y - floorGy) > 120) {
    floorGrad = ctx.createRadialGradient(p0.x, p0.y, 80, p0.x, p0.y, 760)
    floorGrad.addColorStop(0, '#20202c')
    floorGrad.addColorStop(1, '#101019')
    floorGx = p0.x; floorGy = p0.y
  }
  ctx.fillStyle = floorGrad
  ctx.fillRect(G.camX - 40, G.camY - 40, G.W + 80, G.H + 80)
  // 大棋盘纹（视野内，无限延伸；低配时跳过）
  if (!G.lowQuality) {
    ctx.fillStyle = 'rgba(255,255,255,.014)'
    const tile = 120
    const tx0 = Math.floor(G.camX / tile) * tile, tx1 = G.camX + G.W
    const ty0 = Math.floor(G.camY / tile) * tile, ty1 = G.camY + G.H
    for (let tx = tx0; tx < tx1; tx += tile)
      for (let ty = ty0; ty < ty1; ty += tile)
        if (((tx + ty) / tile) % 2 === 0) ctx.fillRect(tx, ty, tile, tile)
  }
  // 网格（视野内，无限延伸）
  ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1
  const gx0 = Math.floor(G.camX / 60) * 60, gx1 = G.camX + G.W
  const gy0 = Math.floor(G.camY / 60) * 60, gy1 = G.camY + G.H
  for (let gx = gx0; gx <= gx1; gx += 60) line(gx, G.camY - 20, gx, G.camY + G.H + 20)
  for (let gy = gy0; gy <= gy1; gy += 60) line(G.camX - 20, gy, G.camX + G.W + 20, gy)
  // 氛围尘埃（低配时关闭）
  if (!G.lowQuality) {
    for (const m of motes) {
      if (!inView(m.x, m.y, 10)) continue
      ctx.fillStyle = 'rgba(255,220,160,' + m.a + ')'
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill()
    }
  }

  // 场景层：夜雨竹林（屏幕边缘竹影/暖光/雨/萤火）
  drawBiome(ctx)

  // 出生预警圈（红圈收缩提示）
  for (const s of G.spawnQueue) {
    if (!inView(s.x, s.y, 80)) continue
    const total = s.type === 'boss' ? 1.2 : 0.6
    const k = clamp(s.t / total, 0, 1)
    const r = (s.type === 'boss' ? 46 : 26) * (0.5 + k)
    ctx.strokeStyle = s.type === 'boss' ? 'rgba(255,40,40,.9)' : 'rgba(255,80,80,.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = s.type === 'boss' ? 'rgba(255,40,40,.25)' : 'rgba(255,80,80,.12)'
    ctx.beginPath(); ctx.arc(s.x, s.y, r * (1 - k), 0, TAU); ctx.fill()
  }

  // 超武·陨星锤：爆炸预警圈
  for (const ex of G.explosions) {
    const k = clamp(ex.t / 0.35, 0, 1)
    ctx.strokeStyle = 'rgba(255,120,30,' + (1 - k * 0.5) + ')'
    ctx.lineWidth = 3
    ctx.setLineDash([8, 6])
    ctx.beginPath(); ctx.arc(ex.x, ex.y, 200 * (1 - k * 0.4), 0, TAU); ctx.stroke()
    ctx.setLineDash([])
  }

  // 宝石（发光青色菱形，脉动）
  const gemPulse = 0.7 + 0.3 * Math.sin(G.gameTime * 5)
  for (const g of G.gems) {
    if (!inView(g.x, g.y, 40)) continue
    ctx.fillStyle = 'rgba(64,224,208,' + 0.15 * gemPulse + ')'
    ctx.beginPath(); ctx.arc(g.x, g.y, 10, 0, TAU); ctx.fill()
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#40E0D0'; ctx.fillRect(-4, -4, 8, 8); ctx.restore()
  }
  // 石块
  ctx.fillStyle = '#999'
  for (const r of G.rocks) { ctx.beginPath(); ctx.arc(r.x, r.y, 6, 0, TAU); ctx.fill() }

  // 箭矢（金色流线 + 箭镞）
  ctx.strokeStyle = '#F0D79A'; ctx.fillStyle = '#F0D79A'; ctx.lineWidth = 2
  for (const a of G.arrows) {
    if (!inView(a.x, a.y, 30)) continue
    const d = Math.hypot(a.vx, a.vy) || 1
    const ux = a.vx / d, uy = a.vy / d
    line(a.x - ux * 12, a.y - uy * 12, a.x + ux * 4, a.y + uy * 4)
    ctx.beginPath()
    ctx.moveTo(a.x + ux * 8, a.y + uy * 8)
    ctx.lineTo(a.x + ux * 2 - uy * 3, a.y + uy * 2 + ux * 3)
    ctx.lineTo(a.x + ux * 2 + uy * 3, a.y + uy * 2 - ux * 3)
    ctx.closePath(); ctx.fill()
  }

  // Boss 宝箱（金色木箱，浮动发光，即将消失时闪烁）
  for (const c of G.chests) {
    if (!inView(c.x, c.y, 60)) continue
    const bob = Math.sin(c.t * 3) * 3
    ctx.globalAlpha = c.life < 3 ? Math.max(0.25, c.life / 3) : 1
    // 光晕
    ctx.fillStyle = 'rgba(212,169,78,' + (0.14 + 0.08 * Math.sin(c.t * 5)) + ')'
    ctx.beginPath(); ctx.arc(c.x, c.y + bob, 24, 0, TAU); ctx.fill()
    // 箱体
    ctx.fillStyle = '#6B4A1E'
    ctx.fillRect(c.x - 11, c.y - 8 + bob, 22, 16)
    ctx.fillStyle = '#8A6230'
    ctx.fillRect(c.x - 11, c.y - 12 + bob, 22, 6)          // 箱盖
    ctx.strokeStyle = '#D4A94E'; ctx.lineWidth = 2
    ctx.strokeRect(c.x - 11, c.y - 12 + bob, 22, 24)
    line(c.x, c.y - 12 + bob, c.x, c.y + 12 + bob)          // 鎏金箍
    ctx.fillStyle = '#F0D79A'                                // 锁扣
    ctx.fillRect(c.x - 2.5, c.y - 4 + bob, 5, 6)
    ctx.globalAlpha = 1
  }

  // 武器掉落物（金色浮动图标，即将消失时闪烁）
  for (const d of G.weaponDrops) {
    if (!inView(d.x, d.y, 60)) continue
    const bob = Math.sin(d.t * 4) * 4
    ctx.globalAlpha = d.life < 3 ? Math.max(0.2, d.life / 3) : 1
    ctx.fillStyle = 'rgba(255,200,60,.18)'
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 17, 0, TAU); ctx.fill()
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(d.x, d.y + bob, 17, 0, TAU); ctx.stroke()
    ctx.fillStyle = '#FFD700'; setFont('bold 15px system-ui'); ctx.textAlign = 'center'
    ctx.fillText(WEAPONS[d.weapon].icon, d.x, d.y + bob + 5)
    ctx.globalAlpha = 1
  }

  // 敌人
  for (const e of G.enemies) {
    if (!inView(e.x, e.y, 120)) continue
    shadow(e.x, e.y, e.scale)
    // Boss 狂暴：红色脉冲光环
    if (e.type === 'boss' && e.enraged) {
      ctx.fillStyle = 'rgba(255,30,30,' + (0.12 + 0.08 * Math.sin(G.gameTime * 8)) + ')'
      ctx.beginPath(); ctx.arc(e.x, e.y - 30, 42 * e.scale, 0, TAU); ctx.fill()
    }
    if (e.h <= 0 && !e.launched && e.rot === 0) {
      if (e.type === 'boss') drawBossModel(ctx, e)
      else drawFoeModel(ctx, e)
    } else {
      drawStick(e.x, e.y, {
        color: e.color, lw: e.lw, flip: e.face, walk: e.walk,
        moving: e.state === 'chase' || e.state === 'bossCharge',
        rot: e.rot, h: e.h, scale: e.scale, flash: e.flash,
        eye: e.type === 'boss' ? '#FF4040' : e.type === 'elite' ? '#FF7050' : '#C04040',
      })
    }
    if (e.type === 'elite') {   // 精英头顶血条（Boss 用顶部大血条）
      const bw = 40 * e.scale
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - bw / 2, e.y - 62 * e.scale - e.h, bw, 5)
      ctx.fillStyle = '#FF8050'
      ctx.fillRect(e.x - bw / 2, e.y - 62 * e.scale - e.h, bw * clamp(e.hp / e.maxHp, 0, 1), 5)
    }
  }
  // 尸体
  for (const c of G.corpses) {
    if (!inView(c.x, c.y, 120)) continue
    drawStick(c.x, c.y + 20, { color: c.color, lw: c.lw, rot: c.rot, h: c.h, scale: c.scale, walk: 0, moving: false })
  }

  // 玩家（脚下光环 + 投影，光环梯度缓存复用）
  const p = G.player
  shadow(p.x, p.y, 1)
  if (!haloGrad) {
    haloGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 46)
    haloGrad.addColorStop(0, 'rgba(255,140,0,.16)')
    haloGrad.addColorStop(1, 'rgba(255,140,0,0)')
  }
  ctx.save()
  ctx.translate(p.x, p.y - 20)
  ctx.fillStyle = haloGrad
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill()
  ctx.restore()
  // 蓄力满提示圈
  if (p.charging && p.chargeT >= 0.5) {
    ctx.strokeStyle = 'rgba(120,190,255,' + (0.5 + 0.5 * Math.sin(G.gameTime * 20)) + ')'
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 22, 34, 0, TAU); ctx.stroke()
  }
  drawPlayerModel(ctx, dtR)

  // 蓄力进度文字（世界坐标）
  if (p.charging) {
    ctx.fillStyle = '#80C0FF'; ctx.textAlign = 'center'; setFont('12px system-ui')
    ctx.fillText(p.chargeT >= 0.5 ? '松开释放!' : '蓄力中…', p.x, p.y - 64)
  }

  // ---- 斩击弧光与冲击波环（叠加发光） ----
  ctx.globalCompositeOperation = 'lighter'
  for (const s of G.slashes) {
    const k = s.t / s.dur
    const ang = s.face > 0 ? 0 : Math.PI
    ctx.strokeStyle = s.heavy ? 'rgba(255,170,70,' + 0.9 * (1 - k) + ')' : 'rgba(255,235,190,' + 0.85 * (1 - k) + ')'
    ctx.lineWidth = (s.heavy ? 16 : 9) * (1 - k * 0.5)
    ctx.beginPath(); ctx.arc(s.x, s.y, s.range * (0.35 + 0.65 * k), ang - s.arc, ang + s.arc); ctx.stroke()
  }
  for (const w of G.shockwaves) {
    const k = w.t / w.dur
    ctx.strokeStyle = 'rgba(' + w.color + ',' + 0.8 * (1 - k) + ')'
    ctx.lineWidth = 5 * (1 - k) + 1
    ctx.beginPath(); ctx.arc(w.x, w.y, w.maxR * k, 0, TAU); ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // 粒子
  for (const pt of G.particles) {
    if (!inView(pt.x, pt.y, 20)) continue
    ctx.globalAlpha = 1 - pt.t / pt.life
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
  }
  ctx.globalAlpha = 1

  // 伤害数字：描边 + 0.5×→1.2×→1.0× 弹性缩放，白 < 暴击红 < 无双金
  for (const t of G.texts) {
    const k = t.t / t.life
    let s = k < 0.3 ? 0.5 + (k / 0.3) * 0.7 : 1.2 - ((k - 0.3) / 0.7) * 0.2
    if (t.crit) s *= 1.5                                  // 暴击数字放大 1.5×
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
    setFont((t.crit ? 'bold ' : '') + Math.round(16 * s) + 'px system-ui')
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,.75)'
    const str = t.heal ? '+' + t.val : String(t.val)
    ctx.strokeText(str, t.x, t.y)
    ctx.fillStyle = t.heal ? '#6AE08A' : t.musou ? '#FFD700' : t.crit ? '#FF4040' : '#FFF'
    ctx.fillText(str, t.x, t.y)
  }
  ctx.globalAlpha = 1

  ctx.restore()
  // ==================== 屏幕层 HUD ====================
  drawHUD()
  drawRadar()
  drawBossBar()

  // 击杀里程碑播报
  if (G.milestoneT > 0) {
    const a = clamp(G.milestoneT / 0.4, 0, 1)
    ctx.globalAlpha = a
    setFont('bold 46px ' + KAI); ctx.textAlign = 'center'
    ctx.fillStyle = '#F0D79A'
    ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 6
    ctx.strokeText(G.milestoneText, G.W / 2, G.H * 0.28)
    ctx.fillText(G.milestoneText, G.W / 2, G.H * 0.28)
    ctx.globalAlpha = 1
  }

  // 成就解锁弹窗（队首）
  if (G.achvToasts.length > 0) {
    const t = G.achvToasts[0]
    const a = clamp(t.t / 0.4, 0, 1)
    ctx.globalAlpha = a
    const bw = 240, bx = (G.W - bw) / 2, by = 82
    ctx.fillStyle = 'rgba(28,22,8,.88)'; rr(bx, by, bw, 32, 6); ctx.fill()
    ctx.strokeStyle = '#D4A94E'; ctx.lineWidth = 1.5; rr(bx, by, bw, 32, 6); ctx.stroke()
    ctx.fillStyle = '#F0D79A'; setFont('bold 16px ' + KAI); ctx.textAlign = 'center'
    ctx.fillText(t.text, G.W / 2, by + 22)
    ctx.globalAlpha = 1
  }

  // 全屏闪光与暗角
  if (G.musouFlashT > 0) { ctx.fillStyle = 'rgba(255,230,120,' + G.musouFlashT * 1.2 + ')'; ctx.fillRect(0, 0, G.W, G.H) }
  if (G.levelFlashT > 0) { ctx.fillStyle = 'rgba(120,255,160,' + G.levelFlashT * 0.5 + ')'; ctx.fillRect(0, 0, G.W, G.H) }
  if (p.hurtFlash > 0) { ctx.fillStyle = 'rgba(255,0,0,' + p.hurtFlash * 0.5 + ')'; ctx.fillRect(0, 0, G.W, G.H) }
  if (G.slowmoT > 0) { ctx.fillStyle = 'rgba(60,40,120,0.18)'; ctx.fillRect(0, 0, G.W, G.H) }

  // 边缘暗角（氛围；梯度缓存，低配时关闭）
  if (!G.lowQuality) {
    if (!vignetteGrad) {
      vignetteGrad = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.42, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.75)
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)')
      vignetteGrad.addColorStop(1, 'rgba(0,0,0,.5)')
    }
    ctx.fillStyle = vignetteGrad
    ctx.fillRect(0, 0, G.W, G.H)
  }
}

function bar(x: number, y: number, w: number, h: number, ratio: number, c0: string, c1: string, label: string): void {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(x, y, w, h, h / 2); ctx.fill()
  const r = clamp(ratio, 0, 1)
  if (r > 0.01) {
    ctx.save()
    ctx.translate(x, y)                       // 缓存梯度基于 0→h，translate 复用
    ctx.fillStyle = barGrad(c0, c1, h)
    rr(0, 0, Math.max(h, w * r), h, h / 2); ctx.fill()
    ctx.restore()
  }
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; rr(x, y, w, h, h / 2); ctx.stroke()
  if (label) { ctx.fillStyle = '#FFF'; setFont('10px system-ui'); ctx.textAlign = 'left'; ctx.fillText(label, x + 5, y + h - 3) }
}

function drawHUD(): void {
  const p = G.player
  const dailyTag = G.daily ? ' · 每日试炼' + (G.dailyMod ? ' · ' + G.dailyMod.name : '') : ''
  const narrow = G.W < 560                            // 竖屏窄幅：条变短，波次/时间移到左列下方
  const barW = narrow ? 130 : 200
  bar(16, 14, barW, 14, p.hp / p.maxHp, '#E0584A', '#8C1F14', '气血')
  bar(16, 32, barW, 8, p.exp / p.expNext, '#6AA8A4', '#2E5E5C', '境界 Lv.' + p.level)
  bar(16, 44, barW, 10, G.musou / 100, '#F0D79A', '#9C7526', G.musou >= 100 ? '无双 · 就绪' : '无双')
  // 当前武器（等级 / 超武形态）
  const wdef = WEAPONS[G.weapon]
  const wlv = p.weaponLvs[G.weapon]
  const evolved = p.evolvedMap[G.weapon]
  ctx.fillStyle = evolved ? '#F0D79A' : '#D4A94E'
  setFont('bold 13px ' + KAI); ctx.textAlign = 'left'
  ctx.fillText('兵器：' + (evolved ? wdef.evo.name + ' ★超武' : wdef.name + ' Lv.' + wlv), 16, 70)
  // 波次与时间（Boss Rush 显示连战进度，隐藏下波倒计时；窄屏改左列堆叠避免与血条重叠）
  if (narrow) {
    ctx.fillStyle = '#E8E0CE'; setFont('bold 19px ' + KAI); ctx.textAlign = 'left'
    if (G.bossRush) {
      ctx.fillText('群雄轮战 ' + Math.min(G.wave, RUSH_LENGTH) + '/' + RUSH_LENGTH + dailyTag, 16, 94)
      setFont('13px ' + KAI); ctx.fillStyle = '#A9A08C'
      ctx.fillText(G.brRest >= 0 ? '休整 ' + Math.ceil(G.brRest) + ' 息' : Math.floor(G.gameTime) + ' 息', 16, 112)
    } else {
      ctx.fillText('第 ' + G.wave + ' 波' + dailyTag, 16, 94)
      setFont('13px ' + KAI); ctx.fillStyle = '#A9A08C'
      ctx.fillText(Math.floor(G.gameTime) + ' 息   下波 ' + (WAVE_INTERVAL - Math.floor(G.waveTimer)) + ' 息', 16, 112)
    }
  } else {
    ctx.fillStyle = '#E8E0CE'; setFont('bold 19px ' + KAI); ctx.textAlign = 'center'
    if (G.bossRush) {
      ctx.fillText('群雄轮战 ' + Math.min(G.wave, RUSH_LENGTH) + '/' + RUSH_LENGTH + dailyTag, G.W / 2, 26)
      setFont('13px ' + KAI); ctx.fillStyle = '#A9A08C'
      ctx.fillText(G.brRest >= 0 ? '休整 ' + Math.ceil(G.brRest) + ' 息' : Math.floor(G.gameTime) + ' 息', G.W / 2, 44)
    } else {
      ctx.fillText('第 ' + G.wave + ' 波' + dailyTag, G.W / 2, 26)
      setFont('13px ' + KAI); ctx.fillStyle = '#A9A08C'
      ctx.fillText(Math.floor(G.gameTime) + ' 息   下波 ' + (WAVE_INTERVAL - Math.floor(G.waveTimer)) + ' 息', G.W / 2, 44)
    }
  }
  // 连击 + 击杀数
  ctx.textAlign = 'right'
  if (G.combo > 1) {
    const s = 1 + G.comboPop * 2
    setFont('bold ' + Math.round(26 * s) + 'px ' + KAI)
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'
    ctx.strokeText(G.combo + ' 连击', G.W - 20, 40)
    ctx.fillStyle = G.combo >= 20 ? '#F0D79A' : '#D4A94E'
    ctx.fillText(G.combo + ' 连击', G.W - 20, 40)
  }
  setFont('13px ' + KAI); ctx.fillStyle = '#A9A08C'
  ctx.fillText('击杀 ' + G.kills, G.W - 20, 60)
  // 断连提示：0.3s 灰色
  if (G.comboBreakT > 0) {
    setFont('bold 20px ' + KAI); ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(150,145,135,' + G.comboBreakT / 0.3 + ')'
    ctx.fillText('连击中断', G.W / 2, G.H * 0.35)
  }
}

/** Boss 顶部大血条（渐变；双子合并显示，按形态冠名） */
function drawBossBar(): void {
  const bosses = G.enemies.filter(e => e.type === 'boss' && !e.dead)
  if (!bosses.length) return
  let hp = 0, maxHp = 0, anyEnraged = false
  for (const b of bosses) { hp += b.hp; maxHp += b.maxHp; if (b.enraged) anyEnraged = true }
  const w = Math.min(420, G.W * 0.5), x = (G.W - w) / 2, y = 54
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(x, y, w, 12, 6); ctx.fill()
  const r = clamp(hp / maxHp, 0, 1)
  if (r > 0.01) {
    ctx.save(); ctx.translate(x, y)
    ctx.fillStyle = barGrad('#FF6060', '#A00808', 12)
    rr(0, 0, Math.max(12, w * r), 12, 6); ctx.fill()
    ctx.restore()
  }
  ctx.strokeStyle = 'rgba(255,80,80,.8)'; ctx.lineWidth = 1.5; rr(x, y, w, 12, 6); ctx.stroke()
  ctx.fillStyle = '#F5D9D5'; setFont('bold 12px ' + KAI); ctx.textAlign = 'center'
  const name = BOSS_NAMES[bosses[0].bossKind || 'charger']
  ctx.fillText(anyEnraged ? name + ' · 狂暴' : name, G.W / 2, y + 10)
}

/** 雷达（右上角）：以玩家为中心探测周围，超界目标贴边显示方向 */
const plotOut: [number, number, boolean] = [0, 0, false]
function drawRadar(): void {
  const R = 52, cx = G.W - R - 20, cy = R + 76
  const k = R / RADAR_RANGE
  const p = G.player
  // 底盘 + 距离环
  ctx.fillStyle = 'rgba(0,0,0,.5)'
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.08)'
  ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, TAU); ctx.stroke()
  // 旋转扫描线
  const sweep = (G.gameTime * 1.6) % TAU
  ctx.strokeStyle = 'rgba(255,140,0,.3)'; ctx.lineWidth = 1.5
  line(cx, cy, cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R)
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke()
  // 投影点（超出半径贴边；复用出参数组避免每帧分配）
  const plot = (wx: number, wy: number): [number, number, boolean] => {
    let dx = (wx - p.x) * k, dy = (wy - p.y) * k
    const d = Math.hypot(dx, dy)
    const edge = d > R - 4
    if (edge) { dx = dx / d * (R - 4); dy = dy / d * (R - 4) }
    plotOut[0] = cx + dx; plotOut[1] = cy + dy; plotOut[2] = edge
    return plotOut
  }
  for (const s of G.spawnQueue) {
    const [x, y] = plot(s.x, s.y)
    ctx.fillStyle = 'rgba(255,80,80,.8)'; ctx.fillRect(x - 1, y - 1, 2, 2)
  }
  for (const d of G.weaponDrops) {
    const [x, y] = plot(d.x, d.y)
    ctx.fillStyle = '#FFD700'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  }
  for (const c of G.chests) {
    const [x, y] = plot(c.x, c.y)
    ctx.fillStyle = '#D4A94E'
    ctx.fillRect(x - 2, y - 2, 4, 4)
    ctx.strokeStyle = '#F0D79A'; ctx.lineWidth = 1
    ctx.strokeRect(x - 2, y - 2, 4, 4)
  }
  for (const e of G.enemies) {
    if (e.dead) continue
    const [x, y, edge] = plot(e.x, e.y)
    if (e.type === 'boss') {
      // Boss：三角形标记 + 脉动
      const r = edge ? 4.5 : 3.5 + Math.sin(G.gameTime * 6)
      ctx.fillStyle = '#FF3030'
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x - r, y + r); ctx.lineTo(x + r, y + r); ctx.closePath(); ctx.fill()
    } else {
      ctx.fillStyle = e.type === 'elite' ? '#FF8050' : 'rgba(255,255,255,.75)'
      const r = e.type === 'elite' ? 2.5 : 1.5
      ctx.fillRect(x - r / 2, y - r / 2, r, r)
    }
  }
  // 玩家（中心）
  ctx.fillStyle = PLAYER_COLOR
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill()
}
