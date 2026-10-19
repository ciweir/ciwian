// ===================== 敌人 2D 骨骼模型（小怪/精英） =====================
// 追击者：斗笠 + 爪；投掷者：兜帽 + 石块；精英：角 + 护甲。
// Boss、空中/翻滚状态仍回退旧 drawStick，避免一次改太多。
import { G } from './state'
import type { Enemy } from './types'

const DOWN = Math.PI / 2
const TAU = Math.PI * 2

export interface Pt { x: number; y: number }
interface Pal {
  outline: string; near: string; far: string; torso: string
  cloth: string; hat: string; hatHi: string; eye: string; accent: string
}
interface Pose {
  lean: number; crouch: number
  armN1: number; armN2: number; armF1: number; armF2: number
  legN1: number; legN2: number; legF1: number; legF2: number
}
interface Joints {
  hip: Pt; chest: Pt; neck: Pt; head: Pt; sh: Pt
  elbowN: Pt; handN: Pt; elbowF: Pt; handF: Pt
  kneeN: Pt; footN: Pt; kneeF: Pt; footF: Pt
}

const PAL_FLASH: Pal = {
  outline: '#5A5A5A', near: '#FFFFFF', far: '#E2E2E2', torso: '#F2F2F2',
  cloth: '#D8D8D8', hat: '#E8E8E8', hatHi: '#FFFFFF', eye: '#FF4040', accent: '#FFD0C0',
}
const PAL_THROWER: Pal = {
  outline: '#07090B', near: '#4E545C', far: '#30353C', torso: '#3D434A',
  cloth: '#343A40', hat: '#434A52', hatHi: '#666E78', eye: '#FF6A50', accent: '#8C8C8C',
}
const PAL_ELITE: Pal = {
  outline: '#1A0504', near: '#A82C24', far: '#5E1712', torso: '#7A1F18',
  cloth: '#4A100D', hat: '#8C2018', hatHi: '#C8443A', eye: '#FF8A60', accent: '#D4A94E',
}
const PAL_CHASER: Pal = {
  outline: '#05070A', near: '#333A43', far: '#1C2128', torso: '#282E36',
  cloth: '#4A4035', hat: '#3B352B', hatHi: '#5A5140', eye: '#FF4A3A', accent: '#8C241C',
}

function palette(e: Enemy, flash: boolean): Pal {
  if (flash) return PAL_FLASH
  if (e.type === 'thrower') return PAL_THROWER
  if (e.type === 'elite') return PAL_ELITE
  return PAL_CHASER
}

function buildPose(e: Enemy): Pose {
  const moving = e.state === 'chase' || e.state === 'bossCharge'
  const swing = moving ? Math.sin(e.walk) * 0.55 : Math.sin(G.gameTime * 1.8 + e.x * 0.01) * 0.12
  let lean = moving ? 0.22 : 0.08
  let crouch = 2
  let armN1 = DOWN - 0.15 + swing * 0.5
  let armN2 = armN1 + 0.2
  let armF1 = DOWN + 0.25 - swing * 0.5
  let armF2 = armF1 - 0.2
  let legN1 = DOWN + swing
  let legN2 = DOWN + swing * 0.2
  let legF1 = DOWN - swing
  let legF2 = DOWN - swing * 0.2

  if (e.state === 'stagger') {
    lean = -0.3
    armN1 = -1.9; armF1 = -1.7
    armN2 = armN1 + 0.3; armF2 = armF1 - 0.3
    legN1 = DOWN + 0.25; legF1 = DOWN - 0.25
  } else if (e.type === 'thrower' && e.state === 'attack') {
    lean = -0.05
    armN1 = -1.9; armN2 = -1.75
    armF1 = 0.15; armF2 = 0.3
  } else if (e.type === 'elite' && moving) {
    lean = 0.26; crouch = 1
  }
  return { lean, crouch, armN1, armN2, armF1, armF2, legN1, legN2, legF1, legF2 }
}

function makeJoints(pose: Pose): Joints {
  const hip = { x: 0, y: -14 + pose.crouch }
  const chest = { x: pose.lean * 8, y: -28 + pose.crouch }
  const neck = { x: pose.lean * 10, y: -34 + pose.crouch }
  const head = { x: pose.lean * 11 + 1, y: -40 + pose.crouch }
  const sh = { x: pose.lean * 9, y: -30 + pose.crouch }
  const armLen = 9, legLen = 8
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

export function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w1: number, w2: number, fill: string, outline: string): void {
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
  ctx.strokeStyle = outline
  ctx.lineWidth = 1.7
  ctx.stroke()
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline: string): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU)
  ctx.fillStyle = fill; ctx.fill()
  ctx.strokeStyle = outline; ctx.lineWidth = 1.6; ctx.stroke()
}

function drawHat(ctx: CanvasRenderingContext2D, head: Pt, pal: Pal): void {
  // 斗笠：宽檐 + 低锥顶 + 破边
  ctx.beginPath()
  ctx.moveTo(head.x - 13, head.y - 5)
  ctx.quadraticCurveTo(head.x, head.y - 9, head.x + 13, head.y - 5)
  ctx.lineTo(head.x + 9, head.y - 7)
  ctx.lineTo(head.x + 4, head.y - 6)
  ctx.lineTo(head.x, head.y - 8)
  ctx.lineTo(head.x - 5, head.y - 6)
  ctx.lineTo(head.x - 9, head.y - 7)
  ctx.closePath()
  ctx.fillStyle = pal.hat; ctx.fill()
  ctx.strokeStyle = pal.outline; ctx.lineWidth = 1.6; ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(head.x - 7, head.y - 6)
  ctx.lineTo(head.x, head.y - 16)
  ctx.lineTo(head.x + 7, head.y - 6)
  ctx.closePath()
  ctx.fillStyle = pal.hatHi; ctx.fill()
  ctx.strokeStyle = pal.outline; ctx.lineWidth = 1.4; ctx.stroke()
}

function drawHood(ctx: CanvasRenderingContext2D, head: Pt, pal: Pal): void {
  ctx.beginPath()
  ctx.moveTo(head.x - 10, head.y + 3)
  ctx.quadraticCurveTo(head.x - 10, head.y - 13, head.x + 1, head.y - 14)
  ctx.quadraticCurveTo(head.x + 10, head.y - 12, head.x + 9, head.y + 2)
  ctx.closePath()
  ctx.fillStyle = pal.hat; ctx.fill()
  ctx.strokeStyle = pal.outline; ctx.lineWidth = 1.5; ctx.stroke()
}

function drawHorns(ctx: CanvasRenderingContext2D, head: Pt, pal: Pal): void {
  ctx.strokeStyle = pal.accent
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(head.x - 5, head.y - 7); ctx.quadraticCurveTo(head.x - 12, head.y - 15, head.x - 16, head.y - 11); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(head.x + 5, head.y - 7); ctx.quadraticCurveTo(head.x + 12, head.y - 15, head.x + 16, head.y - 11); ctx.stroke()
}

function drawClaws(ctx: CanvasRenderingContext2D, h: Pt, pal: Pal): void {
  ctx.strokeStyle = pal.accent
  ctx.lineWidth = 1.3
  ctx.lineCap = 'round'
  for (const dy of [-2.2, 0, 2.2]) {
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + 5, h.y + dy); ctx.stroke()
  }
}

function drawSimpleFoe(ctx: CanvasRenderingContext2D, e: Enemy, j: Joints, pal: Pal): void {
  ctx.strokeStyle = pal.near
  ctx.lineWidth = 3.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.kneeN.x, j.kneeN.y); ctx.lineTo(j.footN.x, j.footN.y)
  ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.kneeF.x, j.kneeF.y); ctx.lineTo(j.footF.x, j.footF.y)
  ctx.moveTo(j.sh.x, j.sh.y); ctx.lineTo(j.elbowN.x, j.elbowN.y); ctx.lineTo(j.handN.x, j.handN.y)
  ctx.moveTo(j.sh.x, j.sh.y); ctx.lineTo(j.elbowF.x, j.elbowF.y); ctx.lineTo(j.handF.x, j.handF.y)
  ctx.moveTo(j.hip.x, j.hip.y); ctx.lineTo(j.sh.x, j.sh.y)
  ctx.stroke()
  dot(ctx, j.head.x, j.head.y, 7.4, pal.near, pal.outline)
  ctx.fillStyle = pal.eye
  ctx.beginPath(); ctx.arc(j.head.x + 3.2, j.head.y - 0.5, 1.6, 0, TAU); ctx.fill()
  if (e.type === 'chaser') {
    ctx.strokeStyle = pal.hat
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(j.head.x - 11, j.head.y - 5); ctx.lineTo(j.head.x + 11, j.head.y - 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(j.head.x - 6, j.head.y - 6); ctx.lineTo(j.head.x, j.head.y - 14); ctx.lineTo(j.head.x + 6, j.head.y - 6); ctx.stroke()
  } else if (e.type === 'elite') {
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(j.head.x - 5, j.head.y - 7); ctx.lineTo(j.head.x - 13, j.head.y - 12); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(j.head.x + 5, j.head.y - 7); ctx.lineTo(j.head.x + 13, j.head.y - 12); ctx.stroke()
  } else {
    ctx.strokeStyle = pal.hat
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.arc(j.head.x, j.head.y - 2, 9, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke()
  }
}

export function drawFoeModel(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const flash = e.flash > 0
  const pal = palette(e, flash)
  const pose = buildPose(e)
  const j = makeJoints(pose)
  const elite = e.type === 'elite'
  const simple = G.lowQuality || Math.hypot(e.x - G.player.x, e.y - G.player.y) > 250

  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.scale(e.face * e.scale, e.scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (simple) {
    drawSimpleFoe(ctx, e, j, pal)
    ctx.restore()
    return
  }

  // 破布披风：先画，压在身上不抢剪影
  ctx.beginPath()
  ctx.moveTo(j.neck.x, j.neck.y)
  ctx.lineTo(j.neck.x - 9, j.chest.y + 9)
  ctx.lineTo(j.neck.x - 3, j.chest.y + 6)
  ctx.lineTo(j.neck.x - 8, j.hip.y + 4)
  ctx.lineTo(j.neck.x + 3, j.chest.y + 10)
  ctx.closePath()
  ctx.fillStyle = pal.cloth
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 远侧
  limb(ctx, j.hip, j.kneeF, 4.6, 3.6, pal.far, pal.outline)
  limb(ctx, j.kneeF, j.footF, 3.6, 2.8, pal.far, pal.outline)
  limb(ctx, j.sh, j.elbowF, 3.8, 3.2, pal.far, pal.outline)
  limb(ctx, j.elbowF, j.handF, 3.2, 2.6, pal.far, pal.outline)

  // 躯干
  ctx.beginPath()
  ctx.moveTo(j.hip.x - 3.6, j.hip.y)
  ctx.lineTo(j.chest.x - 4.8, j.chest.y)
  ctx.lineTo(j.chest.x + 4.8, j.chest.y)
  ctx.lineTo(j.hip.x + 3.6, j.hip.y)
  ctx.closePath()
  ctx.fillStyle = pal.torso
  ctx.fill()
  ctx.strokeStyle = pal.outline
  ctx.lineWidth = 1.7
  ctx.stroke()

  if (elite) {
    // 护甲横纹 + 肩甲
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(j.chest.x - 4, j.chest.y + 4); ctx.lineTo(j.chest.x + 4, j.chest.y + 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(j.chest.x - 3.6, j.chest.y + 8); ctx.lineTo(j.chest.x + 3.6, j.chest.y + 8); ctx.stroke()
    ctx.fillStyle = pal.hatHi
    ctx.beginPath(); ctx.moveTo(j.sh.x - 7, j.sh.y - 1); ctx.lineTo(j.sh.x - 2, j.sh.y - 5); ctx.lineTo(j.sh.x + 2, j.sh.y - 1); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = pal.outline; ctx.lineWidth = 1.2; ctx.stroke()
  }

  // 近侧
  limb(ctx, j.hip, j.kneeN, 5, 4, pal.near, pal.outline)
  limb(ctx, j.kneeN, j.footN, 4, 3, pal.near, pal.outline)
  limb(ctx, j.sh, j.elbowN, 4.2, 3.4, pal.near, pal.outline)
  limb(ctx, j.elbowN, j.handN, 3.4, 2.8, pal.near, pal.outline)

  // 投掷者兜帽在头后，避免盖住红眼；斗笠/角在头前
  if (e.type === 'thrower') drawHood(ctx, j.head, pal)
  dot(ctx, j.head.x, j.head.y, 7.6, pal.near, pal.outline)
  ctx.fillStyle = pal.eye
  ctx.beginPath(); ctx.arc(j.head.x + 3.4, j.head.y - 0.5, 1.6, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,80,50,.18)'
  ctx.beginPath(); ctx.arc(j.head.x + 3.4, j.head.y - 0.5, 3.4, 0, TAU); ctx.fill()

  if (e.type === 'chaser') drawHat(ctx, j.head, pal)
  else if (elite) drawHorns(ctx, j.head, pal)

  // 手部细节
  if (e.type === 'thrower') {
    dot(ctx, j.handN.x, j.handN.y, 3.2, '#7A7E84', pal.outline)
    if (e.state === 'attack') dot(ctx, j.handF.x, j.handF.y, 3.6, '#8A8E94', pal.outline)
  } else {
    drawClaws(ctx, j.handN, pal)
    drawClaws(ctx, j.handF, pal)
  }

  ctx.restore()
}
