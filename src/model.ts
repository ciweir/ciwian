// ===================== 玩家 2D 骨骼模型 =====================
// 表现层独立：不改命中/判定，只把火柴人升级为锥形肢体 + 武器挂点 + 飘带 + 拖尾。
import { G } from './state'
import type { Player, WeaponId } from './types'
import { sampleWeaponClip, type SkelPose, type WeaponClipKey } from './content/weaponPoses'

const DOWN = Math.PI / 2
const TAU = Math.PI * 2

const PAL = {
  outline: '#1A0F08',
  far: '#8E4512',
  near: '#E08A2E',
  torso: '#B45A16',
  torsoHi: '#D9771F',
  head: '#F0A24A',
  scarf: 'rgba(200,68,58,.72)',
  scarfHi: 'rgba(232,106,82,.55)',
  metal: '#C8CCD4',
  metalHi: '#F2F5FA',
  gold: '#D4A94E',
  goldHi: '#F0D79A',
}

const TRAIL_COLORS: Record<WeaponId, string> = {
  fist: '255,200,120',
  spear: '255,215,140',
  dual: '160,220,255',
  hammer: '255,150,50',
  bow: '240,215,154',
}

interface Pt { x: number; y: number }
type Pose = SkelPose
interface Joints {
  hip: Pt; chest: Pt; neck: Pt; head: Pt; sh: Pt
  elbowN: Pt; handN: Pt; elbowF: Pt; handF: Pt
  kneeN: Pt; footN: Pt; kneeF: Pt; footF: Pt
}

function buildPose(p: Player): Pose {
  const swing = p.moving ? Math.sin(p.walk) * 0.55 : 0
  const breathe = Math.sin(G.gameTime * 2.2) * 0.02
  const armN1 = DOWN - 0.35 + swing * 0.55 + breathe
  const armF1 = DOWN + 0.35 - swing * 0.55 - breathe
  const base: Pose = {
    lean: p.moving ? 0.08 : breathe,
    crouch: 0,
    armN1, armN2: armN1 + 0.15,
    armF1, armF2: armF1 - 0.15,
    legN1: DOWN + swing, legN2: DOWN + swing * 0.2,
    legF1: DOWN - swing, legF2: DOWN - swing * 0.2,
    weapon: armN1,
    bowPull: 0,
  }

  if (p.dashT > 0) {
    return {
      ...base, lean: 0.55,
      armN1: 2.7, armN2: 2.9, armF1: 2.5, armF2: 2.7,
      legN1: 1.35, legN2: 1.05, legF1: 0.65, legF2: 0.9,
      weapon: 2.6,
    }
  }
  if (p.charging) {
    return sampleWeaponClip(base, G.weapon, 'charge', Math.min(1, p.chargeT / 0.5))
  }
  if (p.act === 'heavy') {
    const k = Math.min(1, p.atkT / p.atkDur)
    const key: WeaponClipKey = k < 0.4 ? 'heavyWind' : 'heavyStrike'
    return sampleWeaponClip(base, G.weapon, key, k < 0.4 ? k / 0.4 : (k - 0.4) / 0.6)
  }
  if (p.act === 'atk') {
    const key = ('atk' + p.atkStage) as WeaponClipKey
    return sampleWeaponClip(base, G.weapon, key, Math.min(1, p.atkT / p.atkDur))
  }
  return base
}

function makeJoints(pose: Pose): Joints {
  const hip = { x: 0, y: -16 + pose.crouch }
  const chest = { x: pose.lean * 9, y: -31 + pose.crouch }
  const neck = { x: pose.lean * 11, y: -38 + pose.crouch }
  const head = { x: pose.lean * 12 + 2, y: -45 + pose.crouch }
  const sh = { x: pose.lean * 10, y: -33 + pose.crouch }
  const armLen = 8, legLen = 8.5
  const elbowN = { x: sh.x + Math.cos(pose.armN1) * armLen, y: sh.y + Math.sin(pose.armN1) * armLen }
  const handN = { x: elbowN.x + Math.cos(pose.armN2) * armLen, y: elbowN.y + Math.sin(pose.armN2) * armLen }
  const elbowF = { x: sh.x + Math.cos(pose.armF1) * armLen, y: sh.y + Math.sin(pose.armF1) * armLen }
  const handF = { x: elbowF.x + Math.cos(pose.armF2) * armLen, y: elbowF.y + Math.sin(pose.armF2) * armLen }
  const kneeN = { x: hip.x + Math.cos(pose.legN1) * legLen, y: hip.y + Math.sin(pose.legN1) * legLen }
  const footN = { x: kneeN.x + Math.cos(pose.legN2) * legLen, y: kneeN.y + Math.sin(pose.legN2) * legLen }
  const kneeF = { x: hip.x + Math.cos(pose.legF1) * legLen, y: hip.y + Math.sin(pose.legF1) * legLen }
  const footF = { x: kneeF.x + Math.cos(pose.legF2) * legLen, y: kneeF.y + Math.sin(pose.legF2) * legLen }
  return { hip, chest, neck, head, sh, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF }
}

function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w1: number, w2: number, fill: string): void {
  const dx = b.x - a.x, dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const nx = -dy / d, ny = dx / d
  ctx.beginPath()
  ctx.moveTo(a.x + nx * w1 / 2, a.y + ny * w1 / 2)
  ctx.lineTo(b.x + nx * w2 / 2, b.y + ny * w2 / 2)
  ctx.lineTo(b.x - nx * w2 / 2, b.y - ny * w2 / 2)
  ctx.lineTo(a.x - nx * w1 / 2, a.y - ny * w1 / 2)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = PAL.outline
  ctx.lineWidth = 1.8
  ctx.stroke()
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = PAL.outline
  ctx.lineWidth = 1.8
  ctx.stroke()
}

function weaponDir(pose: Pose): Pt {
  return { x: Math.cos(pose.weapon), y: Math.sin(pose.weapon) }
}

function weaponTip(pose: Pose, j: Joints): Pt {
  const d = weaponDir(pose)
  const hand = j.handN
  switch (G.weapon) {
    case 'spear': return { x: hand.x + d.x * 52, y: hand.y + d.y * 52 }
    case 'hammer': return { x: hand.x + d.x * 30, y: hand.y + d.y * 30 }
    case 'dual': return { x: hand.x + d.x * 18, y: hand.y + d.y * 18 }
    case 'bow': return { x: hand.x + d.x * 24, y: hand.y + d.y * 24 }
    default: return { x: hand.x + d.x * 9, y: hand.y + d.y * 9 }
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, p: Player, pose: Pose, j: Joints): void {
  const w = G.weapon
  const evolved = !!p.evolvedMap[w]
  const d = weaponDir(pose)
  const hand = j.handN
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (evolved) {
    ctx.save()
    ctx.shadowColor = 'rgba(240,215,154,.65)'
    ctx.shadowBlur = 8
  }

  if (w === 'fist') {
    dot(ctx, j.handN.x, j.handN.y, 3.6, PAL.near)
    dot(ctx, j.handF.x, j.handF.y, 3.2, PAL.far)
  } else if (w === 'spear') {
    const start = { x: hand.x - d.x * 7, y: hand.y - d.y * 7 }
    const end = { x: hand.x + d.x * 40, y: hand.y + d.y * 40 }
    ctx.strokeStyle = evolved ? PAL.goldHi : PAL.gold
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
    ctx.strokeStyle = 'rgba(240,215,154,.45)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
    const base = { x: hand.x + d.x * 38, y: hand.y + d.y * 38 }
    const tip = { x: hand.x + d.x * 52, y: hand.y + d.y * 52 }
    const nx = -d.y * 4.2, ny = d.x * 4.2
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(base.x + nx, base.y + ny)
    ctx.lineTo(base.x - nx, base.y - ny)
    ctx.closePath()
    ctx.fillStyle = evolved ? PAL.goldHi : PAL.metal
    ctx.fill()
    ctx.strokeStyle = PAL.outline
    ctx.lineWidth = 1.6
    ctx.stroke()
    dot(ctx, hand.x, hand.y, 2.2, PAL.gold)
  } else if (w === 'hammer') {
    const end = { x: hand.x + d.x * 20, y: hand.y + d.y * 20 }
    ctx.strokeStyle = evolved ? PAL.gold : PAL.gold
    ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(end.x, end.y); ctx.stroke()
    ctx.save()
    ctx.translate(hand.x + d.x * 24, hand.y + d.y * 24)
    ctx.rotate(pose.weapon)
    ctx.fillStyle = evolved ? PAL.goldHi : PAL.metal
    ctx.fillRect(-4, -8, 15, 16)
    ctx.strokeStyle = PAL.outline
    ctx.lineWidth = 1.8
    ctx.strokeRect(-4, -8, 15, 16)
    ctx.strokeStyle = 'rgba(255,255,255,.35)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(9, -6); ctx.stroke()
    ctx.restore()
    dot(ctx, hand.x, hand.y, 2.4, PAL.gold)
  } else if (w === 'dual') {
    const blades: [Pt, number, string][] = [
      [j.handN, pose.weapon, evolved ? PAL.goldHi : PAL.metal],
      [j.handF, pose.armF1, evolved ? PAL.gold : PAL.metal],
    ]
    for (const [h, ang, col] of blades) {
      const dd = { x: Math.cos(ang), y: Math.sin(ang) }
      const tip = { x: h.x + dd.x * 17, y: h.y + dd.y * 17 }
      ctx.strokeStyle = col
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,.5)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(h.x + dd.x * 2, h.y + dd.y * 2); ctx.lineTo(tip.x, tip.y); ctx.stroke()
      dot(ctx, h.x, h.y, 1.8, PAL.gold)
    }
  } else if (w === 'bow') {
    ctx.save()
    ctx.translate(hand.x, hand.y)
    ctx.rotate(pose.armN1)
    ctx.strokeStyle = evolved ? PAL.goldHi : PAL.gold
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(0, 0, 14, -1.05, 1.05); ctx.stroke()
    const ax = Math.cos(-1.05) * 14, ay = Math.sin(-1.05) * 14
    const bx = Math.cos(1.05) * 14, by = Math.sin(1.05) * 14
    const pull = 4 + pose.bowPull * 5
    ctx.strokeStyle = 'rgba(240,235,210,.7)'
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(-pull, 0); ctx.lineTo(bx, by); ctx.stroke()
    ctx.strokeStyle = evolved ? PAL.goldHi : PAL.metalHi
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(-pull + 2, 0); ctx.lineTo(24, 0); ctx.stroke()
    ctx.fillStyle = PAL.metalHi
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(21, -2.5); ctx.lineTo(21, 2.5); ctx.closePath(); ctx.fill()
    ctx.restore()
    dot(ctx, hand.x, hand.y, 2, PAL.gold)
  }

  if (evolved) ctx.restore()

  if (p.act === 'none' && !p.charging && Math.sin(G.gameTime * 2.8) > 0.985) {
    const tip = weaponTip(pose, j)
    ctx.fillStyle = 'rgba(240,215,154,.85)'
    ctx.fillRect(tip.x - 3, tip.y - 0.6, 6, 1.2)
    ctx.fillRect(tip.x - 0.6, tip.y - 3, 1.2, 6)
  }
}

function drawFigure(ctx: CanvasRenderingContext2D, p: Player, pose: Pose, j: Joints, flash: boolean): void {
  const far = flash ? '#FF8A7A' : PAL.far
  const near = flash ? '#FFD0C4' : PAL.near
  const torso = flash ? '#F2A08E' : PAL.torso
  const head = flash ? '#FFE2D6' : PAL.head

  // 远侧肢体先画，形成前后层次
  limb(ctx, j.hip, j.kneeF, 4.8, 3.8, far)
  limb(ctx, j.kneeF, j.footF, 3.8, 3, far)
  limb(ctx, j.sh, j.elbowF, 3.9, 3.3, far)
  limb(ctx, j.elbowF, j.handF, 3.3, 2.7, far)

  // 躯干
  ctx.beginPath()
  ctx.moveTo(j.hip.x - 3.7, j.hip.y)
  ctx.lineTo(j.chest.x - 4.7, j.chest.y)
  ctx.lineTo(j.chest.x + 4.7, j.chest.y)
  ctx.lineTo(j.hip.x + 3.7, j.hip.y)
  ctx.closePath()
  ctx.fillStyle = torso
  ctx.fill()
  ctx.strokeStyle = PAL.outline
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,190,110,.28)'
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.moveTo(j.chest.x - 2, j.chest.y + 2); ctx.lineTo(j.hip.x - 1, j.hip.y - 3); ctx.stroke()

  // 腰带
  ctx.strokeStyle = PAL.gold
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(j.hip.x - 4.2, j.hip.y - 2); ctx.lineTo(j.hip.x + 4.2, j.hip.y - 2); ctx.stroke()

  // 近侧肢体
  limb(ctx, j.hip, j.kneeN, 5.1, 4.2, near)
  limb(ctx, j.kneeN, j.footN, 4.2, 3.2, near)
  limb(ctx, j.sh, j.elbowN, 4.2, 3.5, near)
  limb(ctx, j.elbowN, j.handN, 3.5, 2.9, near)

  // 头 + 头带 + 发髻 + 眼
  dot(ctx, j.head.x, j.head.y, 8.2, head)
  ctx.strokeStyle = 'rgba(200,68,58,.85)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(j.head.x - 7, j.head.y - 5); ctx.quadraticCurveTo(j.head.x, j.head.y - 7.5, j.head.x + 7, j.head.y - 5); ctx.stroke()
  ctx.strokeStyle = PAL.outline
  ctx.lineWidth = 2.2
  ctx.beginPath(); ctx.moveTo(j.head.x - 1, j.head.y - 8); ctx.lineTo(j.head.x - 5, j.head.y - 13); ctx.stroke()
  dot(ctx, j.head.x - 5, j.head.y - 14, 1.8, head)
  ctx.fillStyle = p.hurtFlash > 0 ? '#7A1A10' : '#2A0F08'
  ctx.beginPath(); ctx.arc(j.head.x + 3.6, j.head.y - 1, 1.9, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,220,160,.7)'
  ctx.beginPath(); ctx.arc(j.head.x + 4.2, j.head.y - 1.7, .6, 0, TAU); ctx.fill()

  drawWeapon(ctx, p, pose, j)
}

// ---- 飘带：世界坐标，低配关闭 ----
let scarf: Pt[] = []
function updateScarf(p: Player, pose: Pose, dt: number): void {
  const base = { x: p.x + pose.lean * 12 * p.face, y: p.y - 36 + pose.crouch }
  if (scarf.length !== 4 || Math.hypot(scarf[0].x - base.x, scarf[0].y - base.y) > 140) {
    scarf = [
      { ...base },
      { x: base.x - p.face * 7, y: base.y + 2 },
      { x: base.x - p.face * 14, y: base.y + 4 },
      { x: base.x - p.face * 21, y: base.y + 6 },
    ]
  }
  const k = 1 - Math.exp(-dt * 12)
  scarf[0].x += (base.x - scarf[0].x) * k
  scarf[0].y += (base.y - scarf[0].y) * k
  for (let i = 1; i < scarf.length; i++) {
    const len = 7 + (p.dashT > 0 ? 3 : 0)
    const target = {
      x: scarf[i - 1].x - p.face * len,
      y: scarf[i - 1].y + 2 + Math.sin(G.gameTime * 4 + i) * 1.4,
    }
    scarf[i].x += (target.x - scarf[i].x) * k * 0.8
    scarf[i].y += (target.y - scarf[i].y) * k * 0.8
  }
}

function drawScarf(ctx: CanvasRenderingContext2D): void {
  if (G.lowQuality || scarf.length < 2) return
  const left: Pt[] = [], right: Pt[] = []
  for (let i = 0; i < scarf.length; i++) {
    const prev = scarf[Math.max(0, i - 1)], next = scarf[Math.min(scarf.length - 1, i + 1)]
    const dx = next.x - prev.x, dy = next.y - prev.y
    const d = Math.hypot(dx, dy) || 1
    const nx = -dy / d, ny = dx / d
    const w = 3.6 * (1 - i / scarf.length) + 0.5
    left.push({ x: scarf[i].x + nx * w, y: scarf[i].y + ny * w })
    right.push({ x: scarf[i].x - nx * w, y: scarf[i].y - ny * w })
  }
  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y)
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y)
  ctx.closePath()
  ctx.fillStyle = PAL.scarf
  ctx.fill()
  ctx.strokeStyle = 'rgba(26,15,8,.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = PAL.scarfHi
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y)
  ctx.stroke()
  ctx.fillStyle = PAL.gold
  ctx.beginPath(); ctx.arc(scarf[0].x, scarf[0].y, 1.4, 0, TAU); ctx.fill()
}

// ---- 武器拖尾：世界坐标，仅攻击时积累 ----
const trail: { x: number; y: number; t: number }[] = []
const TRAIL_LIFE = 0.18

function updateTrail(p: Player, tipWorld: Pt, dt: number): void {
  for (const pt of trail) pt.t += dt
  const attacking = p.act === 'atk' || p.act === 'heavy'
  if (attacking && G.weapon !== 'bow') {
    const last = trail[trail.length - 1]
    if (!last || Math.hypot(last.x - tipWorld.x, last.y - tipWorld.y) > 3.5) {
      trail.push({ x: tipWorld.x, y: tipWorld.y, t: 0 })
    }
  }
  while (trail.length > 14 || (trail.length && trail[0].t > TRAIL_LIFE)) trail.shift()
}

function drawTrail(ctx: CanvasRenderingContext2D): void {
  if (trail.length < 2) return
  const color = G.player.evolvedMap[G.weapon] ? '255,240,190' : TRAIL_COLORS[G.weapon]
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i]
    const life = 1 - b.t / TRAIL_LIFE
    const alpha = Math.max(0, life) * 0.34 * (i / trail.length)
    ctx.strokeStyle = `rgba(${color},${alpha})`
    ctx.lineWidth = 1 + 4.5 * (i / trail.length)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  ctx.restore()
}

// ---- 冲刺墨影 ----
function drawGhosts(ctx: CanvasRenderingContext2D, p: Player, pose: Pose, j: Joints): void {
  if (G.lowQuality || p.dashT <= 0) return
  for (const [offset, alpha] of [[11, 0.16], [21, 0.08]] as const) {
    ctx.save()
    ctx.translate(p.x - p.face * offset, p.y)
    ctx.scale(p.face, 1)
    ctx.strokeStyle = `rgba(255,140,0,${alpha})`
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.kneeN.x, j.kneeN.y); ctx.lineTo(j.footN.x, j.footN.y)
    ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.kneeF.x, j.kneeF.y); ctx.lineTo(j.footF.x, j.footF.y)
    ctx.moveTo(j.sh.x, j.sh.y); ctx.lineTo(j.elbowN.x, j.elbowN.y); ctx.lineTo(j.handN.x, j.handN.y)
    ctx.moveTo(j.sh.x, j.sh.y); ctx.lineTo(j.elbowF.x, j.elbowF.y); ctx.lineTo(j.handF.x, j.handF.y)
    ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.sh.x, j.sh.y)
    ctx.stroke()
    ctx.beginPath(); ctx.arc(j.head.x, j.head.y, 8.2, 0, TAU); ctx.stroke()
    ctx.restore()
  }
}

export function drawPlayerModel(ctx: CanvasRenderingContext2D, dt: number): void {
  const p = G.player
  const pose = buildPose(p)
  const j = makeJoints(pose)
  const tip = weaponTip(pose, j)
  updateTrail(p, { x: p.x + tip.x * p.face, y: p.y + tip.y }, dt)
  drawTrail(ctx)
  drawGhosts(ctx, p, pose, j)
  updateScarf(p, pose, dt)
  drawScarf(ctx)

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(p.face, 1)
  if (p.invuln > 0 && p.dashT > 0) ctx.globalAlpha = 0.55
  drawFigure(ctx, p, pose, j, p.hurtFlash > 0)
  ctx.restore()
  ctx.globalAlpha = 1
}
