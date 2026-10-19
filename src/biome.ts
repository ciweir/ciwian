// ===================== 场景层：夜雨竹林（Phase 0 单场景） =====================
// 世界层内绘制：竹影贴在屏幕边缘，雨/萤火在前景之下；不参与碰撞。
import { G } from './state'

export function drawBiome(ctx: CanvasRenderingContext2D): void {
  const { W, H, camX, camY, gameTime, lowQuality } = G
  const t = gameTime
  const sx = (x: number) => camX + x
  const sy = (y: number) => camY + y

  ctx.save()
  ctx.lineCap = 'round'

  // 左右竹影：屏幕边缘的景框，低配减半
  const stalks = lowQuality ? 2 : 3
  for (const side of [-1, 1]) {
    for (let i = 0; i < stalks; i++) {
      const edge = side < 0 ? 14 + i * 19 : W - 14 - i * 19
      const alpha = 0.1 + i * 0.025
      const sway = Math.sin(t * 0.35 + i * 1.7 + (side > 0 ? 2.1 : 0)) * (6 + i * 2)
      const top = -24
      const bottom = H + 24
      const x0 = sx(edge)
      const y0 = sy(bottom)
      const x1 = sx(edge + sway)
      const y1 = sy(H * 0.52)
      const x2 = sx(edge + sway * 1.5)
      const y2 = sy(top)
      ctx.strokeStyle = `rgba(74,108,92,${alpha})`
      ctx.lineWidth = 4.2 - i * 0.7
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.quadraticCurveTo(sx(edge - 10), sy(H * 0.76), x1, y1)
      ctx.quadraticCurveTo(sx(edge + sway * 0.4), sy(H * 0.24), x2, y2)
      ctx.stroke()

      // 竹节 + 叶片
      ctx.strokeStyle = `rgba(90,125,105,${alpha * 0.9})`
      ctx.lineWidth = 1.4
      for (const k of [0.26, 0.48, 0.7]) {
        const yy = sy(H * k)
        const xx = sx(edge + sway * (1 - k))
        ctx.beginPath(); ctx.moveTo(xx - 7, yy); ctx.lineTo(xx + 7, yy); ctx.stroke()
      }
      ctx.strokeStyle = `rgba(84,118,96,${alpha * 0.75})`
      ctx.lineWidth = 1.2
      for (const [lx, ly, dir] of [[edge + sway, H * 0.28, 1], [edge + sway * 1.3, H * 0.36, -1], [edge + sway * 0.7, H * 0.44, 1]] as const) {
        ctx.beginPath()
        ctx.moveTo(sx(lx), sy(ly))
        ctx.quadraticCurveTo(sx(lx + dir * 18), sy(ly - 5), sx(lx + dir * 30), sy(ly + 4))
        ctx.stroke()
      }
    }
  }

  // 暖光：右下与左上，低亮度，不压住战斗信息
  const glow = ctx.createRadialGradient(sx(W - 70), sy(H * 0.76), 8, sx(W - 70), sy(H * 0.76), 170)
  glow.addColorStop(0, 'rgba(232,140,60,.10)')
  glow.addColorStop(1, 'rgba(232,140,60,0)')
  ctx.fillStyle = glow
  ctx.fillRect(sx(W - 260), sy(H * 0.45), 520, 420)
  const glow2 = ctx.createRadialGradient(sx(40), sy(H * 0.16), 6, sx(40), sy(H * 0.16), 120)
  glow2.addColorStop(0, 'rgba(212,169,78,.07)')
  glow2.addColorStop(1, 'rgba(212,169,78,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(sx(-80), sy(-20), 300, 300)

  if (!lowQuality) {
    // 雨线：屏幕空间循环，低对比度
    ctx.strokeStyle = 'rgba(190,215,225,.055)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 34; i++) {
      const x = ((i * 73 + t * 46) % (W + 90)) - 45
      const y = ((i * 97 + t * 430) % (H + 90)) - 45
      ctx.moveTo(sx(x), sy(y))
      ctx.lineTo(sx(x - 6), sy(y + 16))
    }
    ctx.stroke()

    // 萤火：少量金色光点
    for (let i = 0; i < 7; i++) {
      const x = (i * 131 + Math.sin(t * 0.7 + i) * 26 + W * 0.5) % (W - 60) + 30
      const y = (i * 89 + Math.cos(t * 0.55 + i * 1.3) * 18 + H * 0.62) % (H - 80) + 40
      const a = 0.12 + 0.08 * Math.sin(t * 2 + i)
      ctx.fillStyle = `rgba(240,215,154,${Math.max(0.03, a)})`
      ctx.beginPath(); ctx.arc(sx(x), sy(y), 1.4, 0, Math.PI * 2); ctx.fill()
    }

    // 飘叶：竹影间缓慢下落的叶片
    for (let i = 0; i < 6; i++) {
      const x = (i * 151 + t * 20 + Math.sin(t * 0.4 + i) * 18) % (W - 30) + 15
      const y = (i * 103 + t * 14) % (H - 50) + 15
      ctx.save()
      ctx.translate(sx(x), sy(y))
      ctx.rotate(Math.sin(t * 0.55 + i) * 0.8 + i)
      ctx.fillStyle = 'rgba(90,125,105,.16)'
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
  }

  ctx.restore()
}
