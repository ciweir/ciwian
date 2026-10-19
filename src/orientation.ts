// ===================== 屏幕方向：跟随 / 强制横屏 / 强制竖屏 =====================
// 强制模式 = CSS 变换"伪方向"：把 #app 整体旋转 90° 并交换宽高，
// 这样系统/WebView 锁死竖屏的设备也能横屏游玩（反之亦然）。
// 旋转后视口坐标与界面局部坐标错位，摇杆/双击冲刺等手动取坐标处须经 toLocal 逆映射。
export type OrientMode = 'auto' | 'landscape' | 'portrait'

/** rot: 0=无旋转, 1=顺时针 90°(竖屏机身→横屏游戏), -1=逆时针 90°(横屏机身→竖屏游戏) */
export const orient = { mode: 'auto' as OrientMode, rot: 0 }

const KEY = 'matchless_orient'
let mq: MediaQueryList
let onChange: () => void = () => {}

function physLandscape(): boolean { return mq.matches }

/** 视口指针坐标 → #app 局部坐标（伪旋转时做逆映射，未旋转时原样返回） */
export function toLocal(cx: number, cy: number): { x: number; y: number } {
  if (orient.rot === 1) return { x: cy, y: window.innerWidth - cx }
  if (orient.rot === -1) return { x: window.innerHeight - cy, y: cx }
  return { x: cx, y: cy }
}

function relayout(): void {
  const app = document.getElementById('app')
  if (!app) return
  let rot = 0
  if (orient.mode === 'landscape' && !physLandscape()) rot = 1
  else if (orient.mode === 'portrait' && physLandscape()) rot = -1
  orient.rot = rot
  app.classList.toggle('rot-cw', rot === 1)
  app.classList.toggle('rot-ccw', rot === -1)
  const w = rot !== 0 ? window.innerHeight : window.innerWidth
  const h = rot !== 0 ? window.innerWidth : window.innerHeight
  if (rot !== 0) { app.style.width = w + 'px'; app.style.height = h + 'px' }
  else { app.style.width = ''; app.style.height = '' }
  // CSS 媒体查询读的是视口尺寸，感知不到包裹层大小 → 用类名补一份紧凑/窄屏规则
  app.classList.toggle('compact', h < 500)
  app.classList.toggle('narrow', w <= 720)
  onChange()
}

export function setOrient(m: OrientMode): void {
  orient.mode = m
  try { localStorage.setItem(KEY, m) } catch (e) { /* 忽略 */ }
  relayout()
}

export function initOrient(onChangeCb: () => void): void {
  onChange = onChangeCb
  mq = window.matchMedia('(orientation: landscape)')
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'landscape' || v === 'portrait') orient.mode = v
  } catch (e) { /* 忽略 */ }
  mq.addEventListener('change', relayout)
  window.addEventListener('resize', relayout)
  relayout()
}
