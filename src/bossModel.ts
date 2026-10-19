// ===================== Boss 2D 骨骼/剪影 =====================
// 行为与判定沿用原 Boss FSM；这里只替换地面状态的外观。
// 裂地者：巨拳/角；咒雨术士：浮空法袍/法球；双子：面具/双刃；霸主：披风/冠冕/巨刃。
import { G } from './state'
import type { Enemy } from './types'
import { limb, dot, type Pt } from './enemyModel'
import { BOSS_FX, type BossFxDef } from './content/bossFx'

const DOWN = Math.PI / 2
const TAU = Math.PI * 2

interface BPal {
  outline: string; near: string; far: string; torso: string
  cloth: string; gold: string; horn: string; eye: string; blade: string; mask: string
}
const PAL_FLASH: BPal = {
  outline: '#5A5A5A', near: '#FFFFFF', far: '#E2E2E2', torso: '#F2F2F2',
  cloth: '#D8D8D8', gold: '#FFE0A0', horn: '#FFFFFF', eye: '#FF4040', blade: '#FFFFFF', mask: '#FFFFFF',
}
const PAL_CHARGER: BPal = {
  outline: '#120504', near: '#B43A2A', far: '#6E1C14', torso: '#8C241C',
  cloth: '#3A0A08', gold: '#D4A94E', horn: '#C9A878', eye: '#FF6A40', blade: '#C8CCD4', mask: '#C9A878',
}
const PAL_SPITTER: BPal = {
  outline: '#0A0510', near: '#6A3A7A', far: '#3A1C46', torso: '#4A2456',
  cloth: '#2E1638', gold: '#D4A94E', horn: '#B46AFF', eye: '#FF8A80', blade: '#C8A0FF', mask: '#E0C8FF',
}
const PAL_TWIN_A: BPal = {
  outline: '#180504', near: '#C04030', far: '#701A12', torso: '#8C241C',
  cloth: '#4A100D', gold: '#D4A94E', horn: '#C8443A', eye: '#FF6A50', blade: '#F0E6D2', mask: '#EFE3C8',
}
const PAL_TWIN_B: BPal = {
  outline: '#0A0508', near: '#6E3230', far: '#2E1212', torso: '#4A1A18',
  cloth: '#1A0808', gold: '#C8A050', horn: '#8C241C', eye: '#FF4A3A', blade: '#C8CCD4', mask: '#2A1010',
}
const PAL_OVERLORD: BPal = {
  outline: '#0A0306', near: '#5A1020', far: '#2A050C', torso: '#3A0A14',
  cloth: '#1A0508', gold: '#D4A94E', horn: '#C8A050', eye: '#FF2A2A', blade: '#E8D6A8', mask: '#C8A050',
}

function palette(e: Enemy, flash: boolean): BPal {
  if (flash) return PAL_FLASH
  const k = e.bossKind || 'charger'
  if (k === 'spitter') return PAL_SPITTER
  if (k === 'twins') return e.variant === 1 ? PAL_TWIN_B : PAL_TWIN_A
  if (k === 'overlord') return PAL_OVERLORD
  return PAL_CHARGER
}

interface BPose {
  lean: number; crouch: number
  armN1: number; armN2: number; armF1: number; armF2: number
  legN1: number; legN2: number; legF1: number; legF2: number
}
interface BJoints {
  hip: Pt; chest: Pt; neck: Pt; head: Pt; sh: Pt
  elbowN: Pt; handN: Pt; elbowF: Pt; handF: Pt
  kneeN: Pt; footN: Pt; kneeF: Pt; footF: Pt
}

function bossPose(e: Enemy): BPose {
  const moving = e.state === 'chase' || e.state === 'bossCharge'
  const swing = moving ? Math.sin(e.walk) * 0.45 : Math.sin(G.gameTime * 1.4 + e.x * 0.01) * 0.1
  let lean = e.bossKind === 'overlord' ? 0.12 : 0.18
  let crouch = 0
  let armN1 = DOWN - 0.25 + swing * 0.5
  let armN2 = armN1 + 0.2
  let armF1 = DOWN + 0.25 - swing * 0.5
  let armF2 = armF1 - 0.2
  let legN1 = DOWN + swing
  let legN2 = DOWN + swing * 0.2
  let legF1 = DOWN - swing
  let legF2 = DOWN - swing * 0.2

  if (e.state === 'bossTelegraph') {
    lean = -0.18; crouch = 4
    armN1 = -2.0; armN2 = -2.15; armF1 = -1.85; armF2 = -2.0
    legN1 = DOWN + 0.3; legF1 = DOWN - 0.3
  } else if (e.state === 'bossCharge') {
    lean = 0.5
    armN1 = 2.5; armN2 = 2.7; armF1 = 2.35; armF2 = 2.55
    legN1 = 1.3; legN2 = 1.0; legF1 = 0.7; legF2 = 0.9
  } else if (e.state === 'stagger') {
    lean = -0.35
    armN1 = -1.9; armN2 = -1.6; armF1 = -1.75; armF2 = -1.45
    legN1 = DOWN + 0.3; legF1 = DOWN - 0.3
  } else if (e.bossKind === 'twins') {
    lean += 0.05
  }
  return { lean, crouch, armN1, armN2, armF1, armF2, legN1, legN2, legF1, legF2 }
}

function bossJoints(e: Enemy, pose: BPose): BJoints {
  const hip = { x: 0, y: -18 + pose.crouch }
  const chest = { x: pose.lean * 9, y: -36 + pose.crouch }
  const neck = { x: pose.lean * 11, y: -44 + pose.crouch }
  const head = { x: pose.lean * 12 + 2, y: -50 + pose.crouch }
  const sh = { x: pose.lean * 10, y: -36 + pose.crouch }
  const armLen = e.bossKind === 'charger' ? 13 : 12
  const legLen = 12
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

function blade(ctx: CanvasRenderingContext2D, hand: Pt, angle: number, len: number, width: number, color: string, outline: string, guard: string, curve = 0): void {
  const dx = Math.cos(angle), dy = Math.sin(angle)
  const nx = -dy, ny = dx
  const tip = { x: hand.x + dx * len + nx * curve, y: hand.y + dy * len + ny * curve }
  const mid = { x: hand.x + dx * len * 0.55 + nx * curve * 0.45, y: hand.y + dy * len * 0.55 + ny * curve * 0.45 }
  ctx.strokeStyle = outline
  ctx.lineWidth = width + 2.2
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke()
  dot(ctx, hand.x, hand.y, width * 0.8, guard, outline)
}

function drawHorns(ctx: CanvasRenderingContext2D, head: Pt, pal: BPal, big: boolean): void {
  const s = big ? 1.15 : 1
  ctx.strokeStyle = pal.horn
  ctx.lineWidth = big ? 5 : 4
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(head.x - 6, head.y - 7); ctx.quadraticCurveTo(head.x - 15 * s, head.y - 18 * s, head.x - 18 * s, head.y - 9); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(head.x + 6, head.y - 7); ctx.quadraticCurveTo(head.x + 15 * s, head.y - 18 * s, head.x + 18 * s, head.y - 9); ctx.stroke()
}

function drawCrown(ctx: CanvasRenderingContext2D, head: Pt, pal: BPal): void {
  ctx.fillStyle = pal.gold
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.4
  for (const [x, h] of [[-11, 7], [-4, 12], [3, 9], [10, 6]] as const) {
    ctx.beginPath()
    ctx.moveTo(head.x + x - 3, head.y - 7)
    ctx.lineTo(head.x + x, head.y - 7 - h)
    ctx.lineTo(head.x + x + 3, head.y - 7)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
}

function drawCloak(ctx: CanvasRenderingContext2D, j: BJoints, pal: BPal): void {
  ctx.beginPath()
  ctx.moveTo(j.neck.x - 4, j.neck.y)
  ctx.lineTo(j.hip.x - 17, j.hip.y + 22)
  ctx.lineTo(j.hip.x - 10, j.hip.y + 18)
  ctx.lineTo(j.hip.x - 6, j.hip.y + 25)
  ctx.lineTo(j.hip.x + 2, j.hip.y + 19)
  ctx.lineTo(j.hip.x + 9, j.hip.y + 26)
  ctx.lineTo(j.hip.x + 15, j.hip.y + 18)
  ctx.lineTo(j.neck.x + 5, j.neck.y)
  ctx.closePath()
  ctx.fillStyle = pal.cloth
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.strokeStyle = pal.gold
  ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.moveTo(j.neck.x - 3, j.neck.y + 2); ctx.lineTo(j.hip.x - 15, j.hip.y + 20); ctx.stroke()
}

function drawHumanoidBoss(ctx: CanvasRenderingContext2D, e: Enemy, pal: BPal): void {
  const pose = bossPose(e)
  const j = bossJoints(e, pose)
  const kind = e.bossKind || 'charger'
  const bigArms = kind === 'charger' || kind === 'overlord'

  if (kind === 'overlord') drawCloak(ctx, j, pal)

  // 远侧
  limb(ctx, j.hip, j.kneeF, bigArms ? 7 : 5.4, 5.6, pal.far, pal.outline)
  limb(ctx, j.kneeF, j.footF, 5.6, 4, pal.far, pal.outline)
  limb(ctx, j.sh, j.elbowF, bigArms ? 7.4 : 5.4, 6, pal.far, pal.outline)
  limb(ctx, j.elbowF, j.handF, 6, 4.6, pal.far, pal.outline)

  // 躯干
  ctx.beginPath()
  ctx.moveTo(j.hip.x - 5.2, j.hip.y)
  ctx.lineTo(j.chest.x - 7.4, j.chest.y)
  ctx.lineTo(j.chest.x + 7.4, j.chest.y)
  ctx.lineTo(j.hip.x + 5.2, j.hip.y)
  ctx.closePath()
  ctx.fillStyle = pal.torso
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 2
  ctx.stroke()

  if (kind === 'charger' || kind === 'overlord') {
    // 肩甲 + 胸甲金线
    ctx.fillStyle = pal.gold
    ctx.strokeStyle = pal.outline
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(j.sh.x - 10, j.sh.y - 1)
    ctx.lineTo(j.sh.x - 3, j.sh.y - 7)
    ctx.lineTo(j.sh.x + 4, j.sh.y - 1)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = pal.gold
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(j.chest.x - 5, j.chest.y + 5); ctx.lineTo(j.chest.x + 5, j.chest.y + 5); ctx.stroke()
  }
  if (kind === 'twins') {
    // 交叉绑带
    ctx.strokeStyle = pal.gold
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(j.chest.x - 5, j.chest.y + 2); ctx.lineTo(j.hip.x + 4, j.hip.y - 3); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(j.chest.x + 5, j.chest.y + 2); ctx.lineTo(j.hip.x - 4, j.hip.y - 3); ctx.stroke()
  }

  // 近侧
  limb(ctx, j.hip, j.kneeN, bigArms ? 7.4 : 5.8, 6, pal.near, pal.outline)
  limb(ctx, j.kneeN, j.footN, 6, 4.4, pal.near, pal.outline)
  limb(ctx, j.sh, j.elbowN, bigArms ? 7.8 : 5.8, 6.4, pal.near, pal.outline)
  limb(ctx, j.elbowN, j.handN, 6.4, 5, pal.near, pal.outline)

  // 头
  dot(ctx, j.head.x, j.head.y, 9.4, pal.near, pal.outline)
  ctx.fillStyle = pal.eye
  ctx.beginPath(); ctx.arc(j.head.x + 4.2, j.head.y - 0.5, 2, 0, TAU); ctx.fill()
  if (e.enraged) {
    ctx.fillStyle = 'rgba(255,40,30,.28)'
    ctx.beginPath(); ctx.arc(j.head.x + 4.2, j.head.y - 0.5, 5.5, 0, TAU); ctx.fill()
  }

  if (kind === 'charger') {
    drawHorns(ctx, j.head, pal, true)
  } else if (kind === 'overlord') {
    drawCrown(ctx, j.head, pal)
    drawHorns(ctx, j.head, pal, true)
  } else if (kind === 'twins') {
    // 面具：盖住脸，只留眼缝
    ctx.beginPath()
    ctx.ellipse(j.head.x + 1, j.head.y, 7.4, 8.4, -0.05, 0, TAU)
    ctx.fillStyle = pal.mask
    ctx.fill()
    ctx.strokeStyle = pal.outline
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = pal.eye
    ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(j.head.x - 1, j.head.y - 1); ctx.lineTo(j.head.x + 5, j.head.y - 1); ctx.stroke()
  }

  // 武器/拳
  if (kind === 'charger') {
    dot(ctx, j.handN.x, j.handN.y, 6.4, pal.near, pal.outline)
    dot(ctx, j.handF.x, j.handF.y, 5.8, pal.far, pal.outline)
    ctx.strokeStyle = pal.horn
    ctx.lineWidth = 1.8
    for (const [h, dir] of [[j.handN, 1], [j.handF, -1]] as const) {
      for (const dy of [-3, 0, 3]) {
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + 6 * dir, h.y + dy); ctx.stroke()
      }
    }
  } else if (kind === 'overlord') {
    // 巨刃：宽刃 + 金护手
    blade(ctx, j.handN, pose.armN1, 28, 5.2, pal.blade, pal.outline, pal.gold)
    ctx.strokeStyle = pal.gold
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(j.handN.x - 4, j.handN.y - 4)
    ctx.lineTo(j.handN.x + 4, j.handN.y + 4)
    ctx.stroke()
    dot(ctx, j.handF.x, j.handF.y, 4.2, pal.far, pal.outline)
  } else if (kind === 'twins') {
    const curve = e.variant === 1 ? -5 : 5
    blade(ctx, j.handN, pose.armN1, 19, 3.2, pal.blade, pal.outline, pal.gold, curve)
    blade(ctx, j.handF, pose.armF1, 17, 2.8, pal.blade, pal.outline, pal.gold, -curve)
  }
}

function drawSpitter(ctx: CanvasRenderingContext2D, e: Enemy, pal: BPal): void {
  const bob = Math.sin(G.gameTime * 2 + e.x * 0.02) * 3
  const lean = e.state === 'stagger' ? -0.2 : Math.sin(G.gameTime * 1.2) * 0.04
  ctx.translate(e.x, e.y - 7 - bob)
  ctx.scale(e.face * e.scale, e.scale)

  // 法袍：从肩到地的破边梯形
  ctx.beginPath()
  ctx.moveTo(lean * 10 - 5, -44)
  ctx.lineTo(-17, 0)
  ctx.lineTo(-10, -2)
  ctx.lineTo(-6, 2)
  ctx.lineTo(0, -3)
  ctx.lineTo(7, 2)
  ctx.lineTo(12, -2)
  ctx.lineTo(18, 0)
  ctx.lineTo(lean * 10 + 6, -44)
  ctx.closePath()
  ctx.fillStyle = pal.cloth
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.8
  ctx.stroke()

  // 袖/手
  limb(ctx, { x: lean * 8, y: -34 }, { x: 16, y: -24 }, 7, 5, pal.near, pal.outline)
  limb(ctx, { x: lean * 8, y: -34 }, { x: -14, y: -20 }, 6, 4, pal.far, pal.outline)
  dot(ctx, 17, -23, 2.6, pal.mask, pal.outline)

  // 兜帽 + 眼
  ctx.beginPath()
  ctx.moveTo(-9, -40)
  ctx.quadraticCurveTo(-12, -58, 1, -59)
  ctx.quadraticCurveTo(13, -57, 11, -39)
  ctx.closePath()
  ctx.fillStyle = pal.near
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.7
  ctx.stroke()
  ctx.fillStyle = pal.eye
  ctx.beginPath(); ctx.arc(4, -47, 2.1, 0, TAU); ctx.fill()
  if (e.enraged) {
    ctx.fillStyle = 'rgba(255,40,30,.25)'
    ctx.beginPath(); ctx.arc(4, -47, 5.5, 0, TAU); ctx.fill()
  }

  // 法杖 + 法球
  const staffTop = { x: 18, y: -60 }
  ctx.strokeStyle = pal.gold
  ctx.lineWidth = 2.4
  ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(staffTop.x, staffTop.y); ctx.stroke()
  const pulse = 0.75 + 0.25 * Math.sin(G.gameTime * 4)
  const orb = ctx.createRadialGradient(staffTop.x, staffTop.y, 1, staffTop.x, staffTop.y, 10 * pulse)
  orb.addColorStop(0, 'rgba(240,220,255,.95)')
  orb.addColorStop(0.45, 'rgba(180,106,255,.55)')
  orb.addColorStop(1, 'rgba(180,106,255,0)')
  ctx.fillStyle = orb
  ctx.beginPath(); ctx.arc(staffTop.x, staffTop.y, 10 * pulse, 0, TAU); ctx.fill()
  ctx.fillStyle = pal.mask
  ctx.beginPath(); ctx.arc(staffTop.x, staffTop.y, 2.2, 0, TAU); ctx.fill()

  // 浮空符片
  for (let i = 0; i < 3; i++) {
    const a = G.gameTime * 1.2 + i * TAU / 3
    const x = Math.cos(a) * 22, y = -28 + Math.sin(a) * 8
    ctx.fillStyle = 'rgba(212,169,78,.55)'
    ctx.fillRect(x - 2, y - 4, 4, 8)
  }
}

function groundRing(ctx: CanvasRenderingContext2D, e: Enemy, fx: BossFxDef, radius: number, alpha: number, dashed = true): void {
  ctx.save()
  ctx.strokeStyle = `rgba(${fx.ring},${alpha})`
  ctx.lineWidth = 2
  if (dashed) ctx.setLineDash([7, 9])
  ctx.beginPath(); ctx.ellipse(e.x, e.y, radius, radius * 0.38, 0, 0, TAU); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = `rgba(${fx.ring},${alpha * 0.12})`
  ctx.beginPath(); ctx.ellipse(e.x, e.y, radius, radius * 0.38, 0, 0, TAU); ctx.fill()
  ctx.restore()
}

function groundRune(ctx: CanvasRenderingContext2D, e: Enemy, fx: BossFxDef, radius: number, alpha: number): void {
  ctx.save()
  ctx.strokeStyle = `rgba(${fx.rune},${alpha})`
  ctx.lineWidth = 1.5
  for (const k of [1, 0.72, 0.42]) {
    ctx.beginPath(); ctx.ellipse(e.x, e.y, radius * k, radius * k * 0.38, 0, 0, TAU); ctx.stroke()
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU
    const x0 = e.x + Math.cos(a) * radius * 0.78
    const y0 = e.y + Math.sin(a) * radius * 0.78 * 0.38
    const x1 = e.x + Math.cos(a) * radius
    const y1 = e.y + Math.sin(a) * radius * 0.38
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  ctx.restore()
}

function drawBossGroundFx(ctx: CanvasRenderingContext2D, e: Enemy, fx: BossFxDef): void {
  const pulse = 0.5 + 0.5 * Math.sin(G.gameTime * 9)
  const kind = e.bossKind || 'charger'

  if (kind === 'spitter') {
    const cast = Math.max(0, Math.min(1, 1 - e.summonT / (e.enraged ? 2.5 : 4)))
    groundRune(ctx, e, fx, 42 * e.scale * (1 + cast * 0.18), 0.1 + cast * 0.22)
  }

  if (e.state === 'bossTelegraph') {
    groundRing(ctx, e, fx, (50 + 10 * pulse) * e.scale, 0.32 + 0.2 * pulse)
    groundRing(ctx, e, fx, (28 + 6 * pulse) * e.scale, 0.2 + 0.14 * pulse, false)

    // 冲撞方向：虚线 + 箭头
    const ang = Math.atan2(G.player.y - e.y, G.player.x - e.x)
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(ang)
    ctx.strokeStyle = `rgba(${fx.ring2},${0.32 + 0.22 * pulse})`
    ctx.lineWidth = 2
    ctx.setLineDash([5, 7])
    ctx.beginPath(); ctx.moveTo(22 * e.scale, 0); ctx.lineTo(110 * e.scale, 0); ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = 2.4
    for (const d of [72, 96]) {
      const s = 7 * e.scale
      ctx.beginPath()
      ctx.moveTo(d * e.scale - s * 0.7, -s)
      ctx.lineTo(d * e.scale, 0)
      ctx.lineTo(d * e.scale - s * 0.7, s)
      ctx.stroke()
    }
    ctx.restore()

    // 裂地者：地面裂纹
    if (kind === 'charger') {
      ctx.save()
      ctx.strokeStyle = `rgba(${fx.rune},${0.22 + 0.16 * pulse})`
      ctx.lineWidth = 2
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU + 0.25
        const r0 = 18 * e.scale, r1 = (38 + (i % 3) * 14) * e.scale
        const mx = e.x + Math.cos(a + 0.16) * (r0 + r1) * 0.5
        const my = e.y + Math.sin(a + 0.16) * (r0 + r1) * 0.5 * 0.38
        ctx.beginPath()
        ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * 0.38)
        ctx.lineTo(mx, my)
        ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1 * 0.38)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  if (e.state === 'bossCharge') {
    const ang = Math.atan2(e.vy, e.vx) || 0
    ctx.save()
    ctx.translate(e.x, e.y)
    ctx.rotate(ang)
    ctx.strokeStyle = `rgba(${fx.charge},.3)`
    ctx.lineWidth = 3
    for (const off of [-12, 0, 12]) {
      ctx.beginPath()
      ctx.moveTo(-16 * e.scale, off * e.scale * 0.35)
      ctx.lineTo(-74 * e.scale, off * e.scale * 0.35)
      ctx.stroke()
    }
    ctx.fillStyle = `rgba(${fx.charge},.16)`
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.ellipse(-(20 + i * 16) * e.scale, (i % 2 ? -1 : 1) * 8 * e.scale, 7 * e.scale, 3 * e.scale, 0, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  if (e.enraged) groundRune(ctx, e, fx, 54 * e.scale, 0.16 + 0.12 * pulse)
}

export function drawBossModel(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const pal = palette(e, e.flash > 0)
  const fx = BOSS_FX[e.bossKind || 'charger']
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  drawBossGroundFx(ctx, e, fx)
  if ((e.bossKind || 'charger') === 'spitter') {
    drawSpitter(ctx, e, pal)
  } else {
    ctx.translate(e.x, e.y)
    ctx.scale(e.face * e.scale, e.scale)
    drawHumanoidBoss(ctx, e, pal)
  }
  ctx.restore()
}
