// ===================== 战绩分享卡：结算面板一键生成 PNG（分享或下载） =====================

export interface ShareInfo {
  win: boolean
  title: string        // 结算大标题，如 武 林 至 尊 / 阵 亡
  lines: string[]      // 统计行（3~4 行）
  date: string         // 落款：日期 · 模式
}

const GOLD = '#E8C766'
const BONE = '#EFE3C8'
const DIM = '#D8CBB0'
const SEAL = '#C13B2E'

export function saveShareImage(info: ShareInfo): void {
  const W = 900, H = 1200
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const c = cv.getContext('2d')!
  const kai = '"KaiTi","STKaiti","SimSun",serif'

  // 背景：墨色纵向渐变 + 金晕
  const bg = c.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#221b15'); bg.addColorStop(1, '#0d0b09')
  c.fillStyle = bg; c.fillRect(0, 0, W, H)
  const vin = c.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, 640)
  vin.addColorStop(0, 'rgba(255,214,140,0.10)'); vin.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = vin; c.fillRect(0, 0, W, H)

  // 双线边框
  c.strokeStyle = 'rgba(212,169,78,0.5)'
  c.lineWidth = 3; c.strokeRect(26, 26, W - 52, H - 52)
  c.lineWidth = 1; c.strokeRect(40, 40, W - 80, H - 80)

  // 顶部：游戏名 + 印章
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.fillStyle = '#F0E6D2'
  c.font = '88px ' + kai
  c.fillText('火 柴 无 双', W / 2 - 30, 168)
  c.fillStyle = SEAL
  c.fillRect(W / 2 + 250, 96, 76, 76)
  c.fillStyle = '#F6EBDD'
  c.font = '54px ' + kai
  c.fillText('武', W / 2 + 288, 152)

  // 火柴人（居中偏上）：胜者金环披身，败者墨色黯淡
  drawStick(c, W / 2, info.win ? 500 : 510, info.win)

  // 结算大标题
  c.fillStyle = info.win ? GOLD : '#C8B9A6'
  c.font = '72px ' + kai
  c.fillText(info.title, W / 2, 810)

  // 统计行
  c.fillStyle = DIM
  c.font = '38px ' + kai
  info.lines.forEach((ln, i) => c.fillText(ln, W / 2, 890 + i * 62))

  // 落款
  c.fillStyle = 'rgba(216,203,176,0.55)'
  c.font = '28px ' + kai
  c.fillText(info.date + ' · 择器而战，与友共赏', W / 2, 1130)

  exportCanvas(cv)
}

function drawStick(c: CanvasRenderingContext2D, x: number, y: number, win: boolean): void {
  if (win) {
    // 背后金色光环
    const halo = c.createRadialGradient(x, y - 40, 30, x, y - 40, 240)
    halo.addColorStop(0, 'rgba(232,199,102,0.22)'); halo.addColorStop(1, 'rgba(232,199,102,0)')
    c.fillStyle = halo
    c.fillRect(x - 260, y - 300, 520, 520)
  }
  c.strokeStyle = BONE
  c.lineWidth = 10; c.lineCap = 'round'
  // 头 + 躯干
  c.beginPath(); c.arc(x, y - 170, 36, 0, Math.PI * 2); c.stroke()
  c.beginPath(); c.moveTo(x, y - 134); c.lineTo(x, y - 20); c.stroke()
  // 腿（弓步）
  c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x - 62, y + 70); c.stroke()
  c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 52, y + 76); c.stroke()
  // 手臂（挥砍势）
  c.beginPath(); c.moveTo(x, y - 110); c.lineTo(x + 72, y - 58); c.stroke()
  c.beginPath(); c.moveTo(x, y - 110); c.lineTo(x - 44, y - 66); c.stroke()
  // 兵刃 + 三层剑气残影
  c.strokeStyle = GOLD; c.lineWidth = 8
  c.beginPath(); c.moveTo(x + 72, y - 58); c.lineTo(x + 128, y - 92); c.stroke()
  const arcs = [[150, 0.55], [176, 0.32], [202, 0.16]]
  for (const [r, a] of arcs) {
    c.strokeStyle = 'rgba(232,199,102,' + a + ')'
    c.lineWidth = 7
    c.beginPath(); c.arc(x, y - 110, r, -0.5, 1.1); c.stroke()
  }
  // 飞溅火星
  c.fillStyle = GOLD
  for (const [px, py] of [[x + 180, y - 160], [x + 205, y - 110], [x + 165, y - 60]]) {
    c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill()
  }
}

function exportCanvas(cv: HTMLCanvasElement): void {
  cv.toBlob(blob => {
    if (!blob) return
    const file = new File([blob], 'matchless.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      void navigator.share({ files: [file], title: '火柴无双' }).catch(() => { /* 用户取消 */ })
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '火柴无双-战绩.png'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 3000)
  })
}
