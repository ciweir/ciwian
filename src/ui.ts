// ===================== UI：主菜单/子页 / 技能三选一 / 暂停菜单 / 结算 =====================
import { G, dailySeed } from './state'
import { WEAPONS, SKILLS, ACHIEVEMENTS, RUSH_LENGTH, dailyModFor } from './config'
import type { WeaponId, WeaponDef, SkillDef } from './types'
import { setVolume, sfx } from './audio'
import { setMusicVolume, stopBGM } from './bgm'
import { achievementCount, unlock, getUnlocked, loadAchievements } from './achievements'
import { META_UPGRADES, getCoins, addCoins, getUpgradeLv, upgradeCost, buyUpgrade, earnCoins, getStats, recordRun, updateLocalBest, loadMeta, loadStats } from './meta'
import { lbEnabled, settleDaily, fetchTop, boardLoading, renderBoard, getPlayerName, setPlayerName } from './leaderboard'
import { getSaveCode, fmtCode, adoptCode, applyProfile, summarizeProfile, uploadSave, downloadSave, autoCloudSave, cloudReady } from './savevault'
import { saveShareImage, type ShareInfo } from './share'
import { setOrient, orient, type OrientMode } from './orientation'

const $ = (id: string) => document.getElementById(id) as HTMLElement

export type StartMode = 'normal' | 'daily' | 'rush'
let selectedWeapon: WeaponId = 'fist'
let hooks: { onStart: (w: WeaponId, mode: StartMode) => void; onRestart: () => void; onChangeWeapon: () => void }

// ---- 分区导航：menu / start(择器) / records(武林录) / ladder(天梯) / shopPage(强化) / settings ----
const PAGES = ['menu', 'start', 'records', 'ladder', 'shopPage', 'settings'] as const
function showPage(id: string): void {
  for (const p of PAGES) $(p).style.display = p === id ? 'flex' : 'none'
}
/** 覆盖所有菜单/结算浮层（开局前清场） */
function hideAllOverlays(): void {
  for (const p of PAGES) $(p).style.display = 'none'
  $('over').style.display = 'none'
  $('win').style.display = 'none'
  $('pause').style.display = 'none'
  $('skillModal').style.display = 'none'
}
let settingsFrom: 'menu' | 'pause' = 'menu'
/** 最近一局结算快照（战绩图用；重开后仍可生成） */
let lastResult: ShareInfo | null = null
function saveMsg(t: string): void { $('saveMsg').textContent = t }

// ---- 设置持久化 ----
function loadSettings(): void {
  try {
    const s = JSON.parse(localStorage.getItem('matchless_settings') || 'null')
    if (s) {
      G.settings.shake = s.shake !== false
      if (typeof s.volume === 'number') G.settings.volume = s.volume
      if (typeof s.music === 'number') G.settings.music = s.music
    }
  } catch (e) { /* 忽略 */ }
  ($('optShake') as HTMLInputElement).checked = G.settings.shake
  ;($('optVol') as HTMLInputElement).value = String(Math.round(G.settings.volume * 100))
  ;($('optMusic') as HTMLInputElement).value = String(Math.round((G.settings.music ?? 0.6) * 100))
  ;($('optOrient') as HTMLSelectElement).value = orient.mode
  setVolume(G.settings.volume)
}
let saveTimer = 0
function saveSettings(): void {   // 防抖：拖动滑条时 300ms 合并一次写入
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem('matchless_settings', JSON.stringify(G.settings)) } catch (e) { /* 忽略 */ }
  }, 300)
}

export function initUI(h: typeof hooks): void {
  hooks = h
  // 上次选用武器持久化
  try {
    const w = localStorage.getItem('matchless_weapon') as WeaponId | null
    if (w && WEAPONS[w]) selectedWeapon = w
  } catch (e) { /* 忽略 */ }
  // 武器卡片（可点选，也可 Tab + Enter/Space）
  const wrap = $('weaponCards')
  const selectWeapon = (w: WeaponDef) => {
    selectedWeapon = w.id
    try { localStorage.setItem('matchless_weapon', w.id) } catch (e) { /* 忽略 */ }
    wrap.querySelectorAll('.card').forEach(c => {
      const on = (c as HTMLElement).dataset.wid === w.id
      c.classList.toggle('sel', on)
      c.setAttribute('aria-pressed', String(on))
    })
  }
  for (const w of Object.values(WEAPONS)) {
    const el = document.createElement('div')
    el.className = 'card' + (w.id === selectedWeapon ? ' sel' : '')
    el.dataset.wid = w.id
    el.tabIndex = 0
    el.setAttribute('role', 'button')
    el.setAttribute('aria-pressed', String(w.id === selectedWeapon))
    el.setAttribute('aria-label', w.name + '：' + w.desc.replace(/\n/g, '，'))
    el.innerHTML = `<div class="icon">${w.icon}</div><div class="name">${w.name}</div><div class="desc">${w.desc.replace(/\n/g, '<br>')}</div>`
    const choose = () => selectWeapon(w)
    el.addEventListener('pointerdown', e => { e.preventDefault(); choose() })
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() }
    })
    wrap.appendChild(el)
  }
  // 菜单按钮：木鱼按键音 + 墨滴涟漪
  const menuBtns = ['menuStart', 'menuRecords', 'menuLadder', 'menuShop', 'menuSettings',
    'startBtn', 'dailyBtn', 'rushBtn', 'backMenu1', 'backMenu2', 'backMenu3', 'backMenu4', 'backMenu5',
    'ladderRefresh', 'saveName', 'saveCode', 'saveUpload', 'saveRestore',
    'restart', 'changeWeapon', 'shareOver', 'resume', 'pauseRestart', 'pauseWeapon', 'pauseSettings',
    'winRestart', 'winWeapon', 'shareWin']
  for (const id of menuBtns) {
    $(id).addEventListener('pointerdown', () => { sfx.ui(); spawnRipple($(id)) })
  }
  // ---- 主菜单分区导航 ----
  $('menuStart').addEventListener('click', () => showPage('start'))
  $('menuRecords').addEventListener('click', () => { renderRecords(); showPage('records') })
  $('menuLadder').addEventListener('click', () => { renderLadder(); showPage('ladder') })
  $('menuShop').addEventListener('click', () => { refreshShop(); showPage('shopPage') })
  $('menuSettings').addEventListener('click', () => { settingsFrom = 'menu'; showPage('settings') })
  $('backMenu1').addEventListener('click', () => { refreshMenuFooter(); showPage('menu') })
  $('backMenu2').addEventListener('click', () => { refreshMenuFooter(); showPage('menu') })
  $('backMenu3').addEventListener('click', () => { refreshMenuFooter(); showPage('menu') })
  $('backMenu4').addEventListener('click', () => { refreshMenuFooter(); showPage('menu') })
  $('backMenu5').addEventListener('click', () => {
    if (settingsFrom === 'pause') { $('settings').style.display = 'none'; $('pause').style.display = 'flex' }
    else { refreshMenuFooter(); showPage('menu') }
  })
  // ---- 择器页三种开局 ----
  $('startBtn').addEventListener('click', () => { hideAllOverlays(); hooks.onStart(selectedWeapon, 'normal') })
  $('dailyBtn').addEventListener('click', () => { hideAllOverlays(); hooks.onStart(selectedWeapon, 'daily') })
  $('rushBtn').addEventListener('click', () => { hideAllOverlays(); hooks.onStart(selectedWeapon, 'rush') })
  const d = new Date()
  $('dailyBtn').textContent = `每日挑战 ${d.getMonth() + 1}/${d.getDate()}`
  const mod = dailyModFor(dailySeed())
  const modInfo = $('dailyModInfo')
  modInfo.textContent = ''
  const modTag = document.createElement('span'); modTag.className = 'dmTag'; modTag.textContent = '今日词条'
  const modName = document.createElement('b'); modName.textContent = mod.name
  const modDesc = document.createElement('span'); modDesc.className = 'dmDesc'; modDesc.textContent = ' · ' + mod.desc
  modInfo.append(modTag, modName, modDesc)
  // ---- 武林录改名 ----
  $('saveName').addEventListener('click', () => {
    const input = $('nameInput') as HTMLInputElement
    input.value = setPlayerName(input.value)
    sfx.gem()
  })
  // ---- 云存档（设置页） ----
  $('saveCode').textContent = '存档码 ' + fmtCode(getSaveCode())
  $('saveCode').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getSaveCode())
      saveMsg('存档码已复制')
    } catch (e) { saveMsg('复制失败，手动抄写上方存档码即可') }
  })
  $('saveUpload').addEventListener('click', async () => {
    if (!cloudReady()) { saveMsg('未接入云端：需在 src/leaderboard.ts 填入 CloudBase 环境 ID'); return }
    saveMsg('上传中…')
    const r = await uploadSave()
    saveMsg(r === 'ok' ? '已上传 ' + new Date().toLocaleTimeString() : r === null ? '未接入云端' : '上传失败，请稍后再试')
  })
  $('saveRestore').addEventListener('click', async () => {
    if (!cloudReady()) { saveMsg('未接入云端：需在 src/leaderboard.ts 填入 CloudBase 环境 ID'); return }
    const raw = ($('restoreCode') as HTMLInputElement).value.replace(/[-\s]/g, '').toUpperCase()
    const code = /^[A-Z2-9]{8}$/.test(raw) ? raw : getSaveCode()
    saveMsg('读取云端存档…')
    const r = await downloadSave(code)
    if (r.kind === 'fail') { saveMsg('读取失败，请稍后再试'); return }
    if (r.kind === 'notfound') { saveMsg('该存档码在云端还没有存档'); return }
    const summary = summarizeProfile(r.json)
    if (!summary || !confirm('用云端档案覆盖本机进度？\n' + summary)) { saveMsg('已取消恢复'); return }
    applyProfile(r.json)
    adoptCode(code)
    loadMeta(); loadStats(); loadAchievements(); loadSettings()
    $('saveCode').textContent = '存档码 ' + fmtCode(getSaveCode())
    ;($('restoreCode') as HTMLInputElement).value = ''
    refreshMenuFooter(); refreshShop()
    saveMsg('已恢复：' + summary)
  })
  // ---- 战绩图（结算面板） ----
  $('shareOver').addEventListener('click', () => { if (lastResult) saveShareImage(lastResult) })
  $('shareWin').addEventListener('click', () => { if (lastResult) saveShareImage(lastResult) })
  // ---- 天梯刷新 ----
  $('ladderRefresh').addEventListener('click', () => renderLadder())
  refreshMenuFooter()
  // ---- 局内结算入口 ----
  $('restart').addEventListener('click', () => { $('over').style.display = 'none'; hooks.onRestart() })
  $('changeWeapon').addEventListener('click', () => {
    $('over').style.display = 'none'
    showStart()
    hooks.onChangeWeapon()
  })
  // 通关结算按钮
  $('winRestart').addEventListener('click', () => { $('win').style.display = 'none'; hooks.onRestart() })
  $('winWeapon').addEventListener('click', () => {
    $('win').style.display = 'none'
    showStart()
    hooks.onChangeWeapon()
  })
  // 暂停菜单
  $('resume').addEventListener('click', togglePause)
  $('pauseRestart').addEventListener('click', () => { $('pause').style.display = 'none'; G.paused = false; hooks.onRestart() })
  $('pauseWeapon').addEventListener('click', () => {
    $('pause').style.display = 'none'
    G.paused = false
    showStart()
    hooks.onChangeWeapon()
  })
  $('pauseSettings').addEventListener('click', () => { settingsFrom = 'pause'; showPage('settings') })
  // 设置项
  $('optShake').addEventListener('change', e => { G.settings.shake = (e.target as HTMLInputElement).checked; saveSettings() })
  $('optVol').addEventListener('input', e => { G.settings.volume = Number((e.target as HTMLInputElement).value) / 100; setVolume(G.settings.volume); saveSettings() })
  $('optMusic').addEventListener('input', e => { G.settings.music = Number((e.target as HTMLInputElement).value) / 100; setMusicVolume(G.settings.music); saveSettings() })
  $('optOrient').addEventListener('change', e => setOrient((e.target as HTMLSelectElement).value as OrientMode))
  loadSettings()
  refreshShop()
  showPage('menu')   // 初始进入主菜单（#start 在 DOM 中靠后，需显式归位）
}

/** Esc / P 暂停切换（技能弹窗/通关演出中不响应） */
export function togglePause(): void {
  if (!G.started || G.gameOver || G.levelUpPending > 0 || G.victory) return
  G.paused = !G.paused
  if (G.paused) {
    const modTag = G.daily && G.dailyMod ? ' · 词条 ' + G.dailyMod.name : ''
    $('pauseStats').textContent = (G.bossRush ? '群雄轮战 ' + Math.min(G.wave, RUSH_LENGTH) + '/' + RUSH_LENGTH + ' · ' : '波次 ' + G.wave + ' · ') +
      '击杀 ' + G.kills + ' · 存活 ' + Math.floor(G.gameTime) + 's' + modTag
    $('pause').style.display = 'flex'
  } else {
    $('pause').style.display = 'none'
  }
}

/** 从局内回到择器页（换武器流程） */
export function showStart(): void {
  refreshMenuFooter()
  showPage('start')
}

/** 主菜单页脚：成就进度 + 金币 */
function refreshMenuFooter(): void {
  const c = achievementCount()
  $('menuAchv').textContent = `成就 ${c.got}/${c.total}`
  $('menuCoins').textContent = String(getCoins())
}

// ---------------- 武林录：生涯统计 + 成就图鉴 ----------------
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h > 0 ? h + ' 时 ' + m + ' 分' : m > 0 ? m + ' 分 ' + Math.floor(sec % 60) + ' 秒' : Math.floor(sec) + ' 秒'
}

function renderRecords(): void {
  const s = getStats()
  const cells: [string, string | number][] = [
    ['出战', s.runs + ' 场'], ['通关', s.wins + ' 次'], ['累计击杀', s.kills], ['斩落 Boss', s.bosses],
    ['累计时长', fmtTime(s.time)], ['最高波次', s.maxWave], ['最高连击', s.bestCombo],
  ]
  const cg = $('careerStats')
  cg.innerHTML = ''
  for (const [k, v] of cells) {
    const el = document.createElement('div')
    el.className = 'cStat'
    const ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = k
    const cv = document.createElement('span'); cv.className = 'cv'; cv.textContent = String(v)
    el.append(ck, cv)
    cg.appendChild(el)
  }
  const got = getUnlocked()
  const grid = $('achvGrid')
  grid.innerHTML = ''
  for (const a of ACHIEVEMENTS) {
    const el = document.createElement('div')
    el.className = 'achv' + (got.has(a.id) ? ' on' : '')
    el.innerHTML = `<div class="aName">${a.name}</div><div class="aDesc">${a.desc}</div>`
    grid.appendChild(el)
  }
  ;($('nameInput') as HTMLInputElement).value = getPlayerName()
}

// ---------------- 天梯：每日挑战榜单（未接云端时展示本地最佳） ----------------
function renderLadder(): void {
  const box = $('ladderList')
  const tip = $('ladderTip')
  let db = { wave: 0, kills: 0 }
  try { db = JSON.parse(localStorage.getItem('matchless_daily_' + dailySeed()) || 'null') || db } catch (e) { /* 忽略 */ }
  $('ladderLocal').textContent = db.wave
    ? `今日本地最佳 — 波次 ${db.wave} / 击杀 ${db.kills}`
    : '今日尚无本地记录，去每日挑战里留名吧'
  if (!lbEnabled()) {
    tip.textContent = '未接入云端：在 src/leaderboard.ts 填入 CloudBase 环境 ID，即可与全服侠客同榜竞技'
    renderBoard(box, null)
    return
  }
  tip.textContent = ''
  boardLoading(box)
  fetchTop().then(rows => renderBoard(box, rows))
}

// ---------------- 局外强化商店 ----------------
export function refreshShop(): void {
  $('coins').textContent = String(getCoins())
  const grid = $('shopGrid')
  grid.innerHTML = ''
  for (const def of META_UPGRADES) {
    const lv = getUpgradeLv(def.id)
    const maxed = lv >= def.max
    const cost = upgradeCost(def)
    const afford = getCoins() >= cost
    const el = document.createElement('div')
    el.className = 'shopItem'
    el.innerHTML =
      `<div class="sIcon">${def.icon}</div>` +
      `<div class="sName">${def.name}</div>` +
      `<div class="sPips">${'●'.repeat(lv)}${'○'.repeat(def.max - lv)}</div>` +
      `<button class="sBuy" ${maxed || !afford ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' 币'}</button>`
    if (!maxed && afford) {
      el.querySelector('.sBuy')!.addEventListener('pointerdown', e => {
        e.preventDefault()
        if (buyUpgrade(def.id)) { sfx.gem(); refreshShop() }
      })
    }
    grid.appendChild(el)
  }
}

/** 无双按钮三态：<80% 灰化 / ≥80% 微光(warm) / 100% 金环(ready)（分档去抖，避免每次命中都操作 DOM） */
let musouBand = -1
export function setMusouUI(v: number): void {
  const band = v >= 100 ? 2 : v >= 80 ? 1 : 0
  if (band === musouBand) return
  musouBand = band
  const el = $('btnMusou')
  el.classList.toggle('ready', band === 2)
  el.classList.toggle('warm', band === 1)
}

/** 命中联动：攻击键微闪（节奏可视化正反馈） */
export function flashAtkBtn(): void {
  const el = $('btnAtk')
  el.classList.remove('hitflash')
  void el.offsetWidth            // 重启动画
  el.classList.add('hitflash')
}

/** 蓄力进度环（主循环每帧调用，内部去抖） */
let lastChargeP = -1
export function updateChargeRing(pct: number): void {
  if (pct === lastChargeP) return
  lastChargeP = pct
  $('btnHeavy').style.setProperty('--p', String(pct))
}

/** 墨滴涟漪：在指定元素内绽放一圈墨晕 */
export function spawnRipple(el: HTMLElement): void {
  const s = document.createElement('span')
  s.className = 'inkRipple'
  el.appendChild(s)
  s.addEventListener('animationend', () => s.remove())
}

/** 升级三选一（暂停游戏）：武器强化/超武进化卡 + 被动技能卡 */
export function openSkillChoice(): void {
  G.paused = true
  const modal = $('skillModal')
  const wrap = $('skillCards')
  wrap.innerHTML = ''
  const p = G.player, wid = G.weapon, wdef = WEAPONS[wid]
  const lv = p.weaponLvs[wid]
  const cards: SkillDef[] = []
  // 超武进化卡（最高优先）：武器 Lv5 + 拥有指定被动
  if (lv >= 5 && !p.evolvedMap[wid] && (p.passives[wdef.evo.need] || 0) > 0) {
    cards.push({
      id: 'evo_' + wid, icon: '神', name: wdef.evo.name,
      desc: '超武进化！\n' + wdef.evo.desc,
      apply: () => {
        p.evolvedMap[wid] = true
        G.milestoneText = '超武觉醒：' + wdef.evo.name
        G.milestoneT = 1.8
        sfx.musou()
      },
    })
  } else if (lv < 5) {
    // 武器强化卡（常驻一格）
    cards.push({
      id: 'wup_' + wid, icon: wdef.icon, name: wdef.name + '强化',
      desc: `武器等级 ${lv}→${lv + 1}\n伤害+15% 范围+8`,
      apply: () => { p.weaponLvs[wid] = lv + 1 },
    })
  }
  // 被动技能补满 3 张（每日挑战走种子，同一世界同一选择序列）
  const pool = [...SKILLS]
  while (cards.length < 3 && pool.length)
    cards.push(pool.splice((G.rng() * pool.length) | 0, 1)[0])
  for (const s of cards) {
    const el = document.createElement('div')
    el.className = 'card' + (s.id.startsWith('evo_') ? ' evo' : '')
    el.tabIndex = 0
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', s.name + '：' + s.desc.replace(/\n/g, '，'))
    el.innerHTML = `<div class="icon">${s.icon}</div><div class="name">${s.name}</div><div class="desc">${s.desc.replace(/\n/g, '<br>')}</div>`
    const choose = () => {
      s.apply(G.player)
      p.passives[s.id] = (p.passives[s.id] || 0) + 1
      G.levelUpPending--
      if (G.levelUpPending > 0) openSkillChoice()   // 连升多级继续选
      else { modal.style.display = 'none'; G.paused = false }
    }
    el.addEventListener('pointerdown', e => { e.preventDefault(); choose() })
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() }
    })
    wrap.appendChild(el)
  }
  modal.style.display = 'flex'
  ;(wrap.firstElementChild as HTMLElement | null)?.focus()
}

/** 通关结算：通关时间/击杀/连击 + 金币奖励 + 最速通关存档 + 生涯统计 */
export function showVictory(): void {
  stopBGM()
  G.paused = false
  $('pause').style.display = 'none'
  $('skillModal').style.display = 'none'
  const t = Math.floor(G.gameTime)
  const rush = G.bossRush
  const modTag = G.daily && G.dailyMod ? ' · 词条 ' + G.dailyMod.name : ''
  // 金币：常规结算 + 通关奖励（群雄轮战更难，奖励更高）
  const bonus = rush ? 300 : 200
  const earned = earnCoins(G.kills, G.wave, G.bossKills) + bonus
  addCoins(earned)
  recordRun({ kills: G.kills, wave: G.wave, time: t, combo: G.maxCombo, bosses: G.bossKills, win: true })
  updateLocalBest(G.wave, G.kills, t, G.maxCombo, G.daily ? 'matchless_daily_' + dailySeed() : undefined)
  unlock('boss1')
  $('winTime').textContent = String(t)
  $('winKills').textContent = String(G.kills)
  $('winCombo').textContent = String(G.maxCombo)
  $('winCoins').textContent = '+' + earned
  if (rush) {
    // 群雄轮战：只记最速
    let best = 0
    try { best = Number(localStorage.getItem('matchless_rush_best')) || 0 } catch (e) { /* 忽略 */ }
    const nb = best ? Math.min(best, t) : t
    try { localStorage.setItem('matchless_rush_best', String(nb)) } catch (e) { /* 忽略 */ }
    $('winBest').textContent = '群雄轮战最速 ' + nb + ' s · 含通关奖励 ' + bonus
  } else {
    // 常规通关：累计次数 + 最速
    let rec = { clears: 0, best: 0 }
    try { rec = JSON.parse(localStorage.getItem('matchless_win') || 'null') || rec } catch (e) { /* 忽略 */ }
    const nb = { clears: rec.clears + 1, best: rec.best ? Math.min(rec.best, t) : t }
    try { localStorage.setItem('matchless_win', JSON.stringify(nb)) } catch (e) { /* 忽略 */ }
    $('winBest').textContent = '通关 ' + nb.clears + ' 次 · 最速 ' + nb.best + ' s · 含通关奖励 ' + bonus
  }
  if (modTag) $('winBest').textContent += modTag
  lastResult = {
    win: true,
    title: '武 林 至 尊',
    lines: [
      '通关用时 ' + t + ' 秒',
      (G.bossRush ? '群雄轮战 · 五连战全胜' : '无尽霸主 · 应声陨落') + modTag,
      '击杀 ' + G.kills + ' · 最大连击 ' + G.maxCombo,
      '金币 +' + earned,
    ],
    date: new Date().toLocaleDateString('zh-CN'),
  }
  autoCloudSave()
  if (G.daily && lbEnabled()) settleAndRenderBoard($('winLbList'))
  $('win').style.display = 'flex'
  sfx.level(); sfx.musou()
}

/** 结算：存活时间 / 最大连击 / 波次数 + 金币结算 + localStorage 最高分 */
export function showGameOver(): void {
  stopBGM()
  G.paused = false
  $('pause').style.display = 'none'
  $('skillModal').style.display = 'none'
  // 金币结算：击杀×1 + 波次×10 + Boss×50
  const earned = earnCoins(G.kills, G.wave, G.bossKills)
  addCoins(earned)
  const modTag = G.daily && G.dailyMod ? ' · 词条 ' + G.dailyMod.name : ''
  recordRun({ kills: G.kills, wave: G.wave, time: Math.floor(G.gameTime), combo: G.maxCombo, bosses: G.bossKills, win: false })
  const { best: nb, daily: ndb } = updateLocalBest(
    G.wave, G.kills, Math.floor(G.gameTime), G.maxCombo,
    G.daily ? 'matchless_daily_' + dailySeed() : undefined,
  )
  $('stTime').textContent = String(Math.floor(G.gameTime))
  $('stCombo').textContent = String(G.maxCombo)
  $('stCoins').textContent = '+' + earned
  $('stWave').textContent = G.bossRush
    ? '第 ' + G.wave + ' 位'
    : '第 ' + G.wave + ' 波' + (G.daily ? ' · 每日' : '')
  let bestLine = '历史最佳 — 波次 ' + nb.wave + ' / 连击 ' + nb.combo + ' / ' + nb.time + 's'
  if (ndb) bestLine += ' · 今日最佳 — 波次 ' + ndb.wave + ' / 击杀 ' + ndb.kills
  if (modTag) bestLine += modTag
  $('stBest').textContent = bestLine
  lastResult = {
    win: false,
    title: '阵 亡',
    lines: [
      '存活 ' + Math.floor(G.gameTime) + ' 秒',
      (G.bossRush ? '群雄轮战 · 止步第 ' + G.wave + ' 位' : '到达第 ' + G.wave + ' 波' + (G.daily ? ' · 每日挑战' : '')) + modTag,
      '击杀 ' + G.kills + ' · 最大连击 ' + G.maxCombo,
      '金币 +' + earned,
    ],
    date: new Date().toLocaleDateString('zh-CN'),
  }
  autoCloudSave()
  if (G.daily && lbEnabled()) settleAndRenderBoard($('lbList'))
  $('over').style.display = 'flex'
}

/** 提交每日成绩 + 渲染云端 Top20（未配置/失败时显示占位提示） */
function settleAndRenderBoard(box: HTMLElement): void {
  boardLoading(box)
  settleDaily(G.wave, G.kills, Math.floor(G.gameTime)).then(rows => renderBoard(box, rows))
}
