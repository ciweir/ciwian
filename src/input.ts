// ===================== 输入：键盘 + 触屏摇杆/按钮/双击冲刺 =====================
import { G } from './state'
import { audio } from './audio'
import { vibrate } from './fx'
import { spawnRipple } from './ui'
import { toLocal } from './orientation'

export const keys: Record<string, boolean> = {}
export const joy = { active: false, id: -1, dx: 0, dy: 0 }

export interface Actions {
  pressAttack(): void
  startCharge(): void
  releaseCharge(): void
  pressMusou(): void
  doDash(dx: number, dy: number): void
  playerX(): number   // 双击冲刺默认方向参考（屏幕坐标）
  togglePause(): void
}

export function initInput(a: Actions): void {
  // ---- PC 键盘：WASD移动，J攻 K重 L无双 空格冲刺 ----
  window.addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return   // 名号/恢复码输入框中不拦截按键（空格可输入）
    const k = e.key.toLowerCase()
    keys[k] = true
    if (k === 'j') a.pressAttack()
    if (k === 'k' && !e.repeat) a.startCharge()
    if (k === 'l') a.pressMusou()
    if (k === 'escape' || k === 'p') a.togglePause()
    if (k === ' ') {
      e.preventDefault()
      const dx = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0)
      const dy = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0)
      a.doDash(dx, dy)
    }
    audio()
  })
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase()
    keys[k] = false
    if (k === 'k') a.releaseCharge()
  })

  // ---- 虚拟摇杆 ----
  const joyEl = document.getElementById('joy') as HTMLElement
  const knob = document.getElementById('joyKnob') as HTMLElement
  const joyMove = (e: PointerEvent) => {
    const r = joyEl.getBoundingClientRect()
    // 强制方向（伪旋转）下视口坐标与界面坐标错位，统一经 toLocal 逆映射
    const c = toLocal(r.left + r.width / 2, r.top + r.height / 2)
    const pt = toLocal(e.clientX, e.clientY)
    let dx = pt.x - c.x
    let dy = pt.y - c.y
    const d = Math.hypot(dx, dy), max = 45
    if (d > max) { dx = dx / d * max; dy = dy / d * max }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    joy.dx = Math.abs(dx) > 8 ? dx / max : 0
    joy.dy = Math.abs(dy) > 8 ? dy / max : 0
  }
  joyEl.addEventListener('pointerdown', e => {
    joy.active = true; joy.id = e.pointerId
    joyEl.setPointerCapture(e.pointerId)
    joyMove(e); audio()
  })
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e) })
  const joyEnd = (e: PointerEvent) => {
    if (e.pointerId === joy.id) {
      joy.active = false; joy.dx = joy.dy = 0
      knob.style.transform = 'translate(-50%,-50%)'
    }
  }
  joyEl.addEventListener('pointerup', joyEnd)
  joyEl.addEventListener('pointercancel', joyEnd)

  // ---- 按钮（鼠标/触摸均生效，带墨滴涟漪 + 震动） ----
  const bindBtn = (id: string, down: () => void, up?: () => void, vibe?: number) => {
    const el = document.getElementById(id) as HTMLElement
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); audio()
      if (vibe) vibrate(vibe)
      spawnRipple(el)
      down()
    })
    if (up) {
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      el.addEventListener('pointerleave', up)
    }
  }
  bindBtn('btnAtk', a.pressAttack, undefined, 10)
  bindBtn('btnHeavy', a.startCharge, a.releaseCharge, 12)
  bindBtn('btnMusou', a.pressMusou, undefined, 20)

  // ---- 空白处双击冲刺（画布在控件下层，天然避开摇杆与按钮区域） ----
  let lastTap = 0
  const cvs = document.getElementById('game') as HTMLCanvasElement
  cvs.addEventListener('pointerdown', e => {
    audio()
    const now = performance.now()
    if (now - lastTap < 300) {
      let dx = joy.dx, dy = joy.dy
      if (!dx && !dy) dx = toLocal(e.clientX, e.clientY).x > a.playerX() ? 1 : -1
      a.doDash(dx, dy)
      lastTap = 0
    } else lastTap = now
  })

  // ---- 防滚动/防缩放（榜单与可滚动子页/音量滑条放行，保留触摸滚动与拖动） ----
  const scrollable = '.lb, #records, #ladder, #shopPage, #settings, input[type=range]'
  document.addEventListener('touchmove', e => {
    if ((e.target as Element | null)?.closest?.(scrollable)) return
    e.preventDefault()
  }, { passive: false })
  document.addEventListener('gesturestart', e => e.preventDefault())

  // ---- 失焦保护：清按键/摇杆/蓄力，切后台自动暂停 ----
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false
    joy.active = false; joy.dx = joy.dy = 0
    knob.style.transform = 'translate(-50%,-50%)'
    a.releaseCharge()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.started && !G.gameOver && !G.paused) a.togglePause()
  })
}
