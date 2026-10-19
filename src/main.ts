// ===================== 入口：装配 + 主循环（rAF + delta time） =====================
import './style.css'
import { G, reset } from './state'
import { render, resizeCanvas } from './render'
import { initInput } from './input'
import { initUI, openSkillChoice, togglePause, updateChargeRing, setMusouUI, showVictory } from './ui'
import { pressAttack, startCharge, releaseCharge, pressMusou, doDash, updatePlayer } from './playerSys'
import { updateEnemies, spawnWave } from './enemySys'
import { updateWorld } from './worldSys'
import { loadAchievements } from './achievements'
import { loadMeta, loadStats } from './meta'
import { startBGM, stopBGM } from './bgm'
import { initOrient, orient } from './orientation'

resizeCanvas()
window.addEventListener('orientationchange', resizeCanvas)   // 部分 WebView 转屏不触发 resize，兜底

// 竖屏提示：触屏竖屏时建议横屏；「竖屏开打」点一次永久记住（matchless_rot）
// 用户已显式选择方向（强制横/竖屏）时不再提示
const rotHint = document.getElementById('rotateHint') as HTMLElement
const rotMq = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
let rotOff = false
try { rotOff = localStorage.getItem('matchless_rot') === 'off' } catch (e) { /* 忽略 */ }
function applyRotHint(): void { rotHint.classList.toggle('show', rotMq.matches && !rotOff && orient.mode === 'auto') }
rotMq.addEventListener('change', applyRotHint)
document.getElementById('rotDismiss')?.addEventListener('click', () => {
  rotOff = true
  try { localStorage.setItem('matchless_rot', 'off') } catch (e) { /* 忽略 */ }
  rotHint.classList.remove('show')
})
applyRotHint()
// 屏幕方向系统：包裹层旋转/尺寸切换后同步画布与提示（resize 监听由 initOrient 接管）
initOrient(() => { resizeCanvas(); applyRotHint() })
loadAchievements()
loadMeta()
loadStats()

initUI({
  onStart(w, mode) {
    reset(w, mode === 'daily', mode === 'rush')
    G.started = true; setMusouUI(0); spawnWave(); startBGM()
  },
  onRestart() { reset(G.weapon, G.daily, G.bossRush); G.started = true; setMusouUI(0); spawnWave(); startBGM() },
  onChangeWeapon() { G.started = false; G.gameOver = false; G.victory = false; G.victoryT = 0; stopBGM() },
})

initInput({
  pressAttack, startCharge, releaseCharge, pressMusou, doDash,
  playerX: () => G.player.x - G.camX,   // 屏幕坐标（双击冲刺方向参考）
  togglePause,
})

// 开场先摆一个静态战场做背景
reset('fist')

// 加载动画：初始化完成后至少展示 1.6s 再淡出（品牌感）
window.setTimeout(() => {
  const el = document.getElementById('loading')
  if (!el) return
  el.classList.add('done')
  window.setTimeout(() => el.remove(), 600)
}, 1600)

let last = 0
let emaDt = 1 / 60   // 帧时长滑动平均（动态画质检测）
function loop(t: number): void {
  requestAnimationFrame(loop)
  const dtR = Math.min((t - last) / 1000, 0.05); last = t
  G.frame++
  // 动态画质：持续掉帧自动降特效，恢复后自动升回（滞回防抖动）
  emaDt = emaDt * 0.95 + dtR * 0.05
  if (emaDt > 0.022) G.lowQuality = true
  else if (emaDt < 0.018) G.lowQuality = false
  // 慢动作(无双 2s, timeScale 0.25) 与 暴击顿帧(0.08s, timeScale 0.3)
  let ts = 1
  if (G.slowmoT > 0) { ts = 0.25; G.slowmoT -= dtR }
  else if (G.hitstopT > 0) { ts = 0.3; G.hitstopT -= dtR }
  const dt = dtR * ts

  if (G.started && !G.gameOver && !G.paused) {
    G.gameTime += dt
    updatePlayer(dt)
    updateEnemies(dt)
    updateWorld(dt)
    // 无限世界：相机自由跟随玩家
    G.camX = G.player.x - G.W / 2
    G.camY = G.player.y - G.H / 2
  }
  render(dtR)
  // 蓄力进度环（按钮上的 0.5s 金色圆环）
  updateChargeRing(G.player.charging ? Math.min(G.player.chargeT / 0.5, 1) : 0)

  // 通关演出倒计时 → 胜利结算（暂停时冻结，未开局不触发）
  if (G.victory && !G.gameOver && !G.paused && G.started) {
    G.victoryT -= dtR
    if (G.victoryT <= 0) { G.gameOver = true; showVictory() }
  }

  // 升级弹技能三选一（在 update 之后处理，避免修改进行中的帧）
  if (G.started && !G.gameOver && !G.paused && G.levelUpPending > 0) openSkillChoice()
}
requestAnimationFrame(t => { last = t; requestAnimationFrame(loop) })
