// ===================== 全局游戏状态 =====================
import type { Player, Enemy, Corpse, Particle, DmgText, Gem, Rock, WeaponId, SpawnPoint, WeaponDrop, Arrow, DailyMod } from './types'
import { applyMeta } from './meta'
import { dailyModFor } from './config'

// ---------------- 每日挑战：种子随机 ----------------
/** mulberry32 伪随机（每日挑战确定性用） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
/** 今日种子：YYYYMMDD */
export function dailySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export interface GameState {
  W: number; H: number
  started: boolean; paused: boolean; gameOver: boolean
  weapon: WeaponId
  player: Player
  enemies: Enemy[]; corpses: Corpse[]; particles: Particle[]
  texts: DmgText[]; gems: Gem[]; rocks: Rock[]
  wave: number; waveTimer: number; spawnTick: number; gameTime: number
  combo: number; comboTimer: number; comboBreakT: number; maxCombo: number; comboPop: number
  musou: number                      // 无双槽：命中+2、击杀+8、上限100
  shakeT: number; shakeAmp: number
  hitstopT: number; slowmoT: number
  musouFlashT: number; levelFlashT: number
  levelUpPending: number             // 待处理的升级次数（技能三选一）
  // ---- 大竞技场 + 滚动镜头 ----
  camX: number; camY: number
  // ---- 击杀统计与里程碑播报 ----
  kills: number; milestoneT: number; milestoneText: string
  // ---- 出生预警队列 ----
  spawnQueue: SpawnPoint[]
  // ---- 设置（localStorage 持久化） ----
  settings: { shake: boolean; volume: number; music: number }
  // ---- 每日挑战 ----
  daily: boolean
  dailyMod: DailyMod | null
  rng: () => number
  // ---- 群雄轮战（Boss Rush） ----
  bossRush: boolean
  brRest: number                     // Boss 间歇倒计时（<0 表示尚未进入间歇）
  // ---- 武器掉落物 ----
  weaponDrops: WeaponDrop[]
  // ---- 玩家箭矢（弓） ----
  arrows: Arrow[]
  // ---- 成就解锁弹窗队列 ----
  achvToasts: { text: string; t: number }[]
  // ---- 金币结算统计 ----
  bossKills: number
  // ---- Boss 宝箱（拾取随机奖励） ----
  chests: { x: number; y: number; t: number; life: number }[]
  // ---- 超武：陨星锤延迟爆炸 ----
  explosions: { x: number; y: number; t: number }[]
  // ---- 视觉特效 ----
  slashes: { x: number; y: number; face: number; t: number; dur: number; range: number; arc: number; heavy: boolean }[]
  shockwaves: { x: number; y: number; t: number; dur: number; maxR: number; color: string }[]
  // ---- 通关 ----
  victory: boolean           // 击杀最终 Boss 触发
  victoryT: number           // 胜利演出倒计时（到时显示结算）
  // ---- 性能 ----
  frame: number              // 全局帧计数（分帧更新用）
  lowQuality: boolean        // 动态画质：掉帧时自动降特效
}

/** 玩法随机源：每日挑战走种子，普通局走 Math.random（调参/布局确定性） */
export function grand(a: number, b: number): number { return a + G.rng() * (b - a) }

export function makePlayer(): Player {
  return {
    x: 0, y: 0, vx: 0, vy: 0, face: 1, walk: 0, moving: false,
    hp: 100, maxHp: 100,
    level: 1, exp: 0, expNext: Math.round(100 * Math.pow(1.15, 1)), // expToNext = 100 × 1.15^level
    atk: 12, speed: 240,
    critBonus: 0, musouGain: 1, comboWindow: 1.2, heavyRangeMul: 1, lifesteal: 0, magnetMul: 1,
    weaponLvs: { fist: 1, spear: 1, dual: 1, hammer: 1, bow: 1 },
    evolvedMap: { fist: false, spear: false, dual: false, hammer: false, bow: false },
    passives: {},
    revives: 0,
    act: 'none', atkStage: 0, atkT: 0, atkDur: 0,
    atkHitDone: false, buffered: false, chainWindow: 0,
    charging: false, chargeT: 0,
    dashT: 0, dashDir: { x: 1, y: 0 },
    invuln: 0, hurtFlash: 0,
  }
}

export const G: GameState = {
  W: 0, H: 0,
  started: false, paused: false, gameOver: false,
  weapon: 'fist',
  player: makePlayer(),
  enemies: [], corpses: [], particles: [], texts: [], gems: [], rocks: [],
  wave: 0, waveTimer: 0, spawnTick: 0, gameTime: 0,
  combo: 0, comboTimer: 0, comboBreakT: 0, maxCombo: 0, comboPop: 0,
  musou: 0,
  shakeT: 0, shakeAmp: 0, hitstopT: 0, slowmoT: 0,
  musouFlashT: 0, levelFlashT: 0,
  levelUpPending: 0,
  camX: 0, camY: 0,
  kills: 0, milestoneT: 0, milestoneText: '',
  spawnQueue: [],
  settings: { shake: true, volume: 0.8, music: 0.6 },
  daily: false,
  dailyMod: null,
  rng: Math.random,
  bossRush: false,
  brRest: -1,
  weaponDrops: [],
  arrows: [],
  achvToasts: [],
  bossKills: 0,
  chests: [],
  explosions: [],
  slashes: [],
  shockwaves: [],
  frame: 0,
  lowQuality: false,
  victory: false,
  victoryT: 0,
}

export function reset(weapon: WeaponId, daily = false, bossRush = false): void {
  G.weapon = weapon
  G.daily = daily
  G.bossRush = bossRush
  G.brRest = -1
  const seed = dailySeed()
  G.dailyMod = daily ? dailyModFor(seed) : null
  G.rng = daily ? mulberry32(seed) : Math.random   // 每日挑战：同一种子同一世界
  G.player = makePlayer()
  applyMeta(G.player)                                     // 应用局外金币强化
  if (G.dailyMod?.player) G.dailyMod.player(G.player)
  G.enemies = []; G.corpses = []; G.particles = []
  G.texts = []; G.gems = []; G.rocks = []; G.arrows = []
  G.wave = 0; G.waveTimer = 0; G.spawnTick = 0; G.gameTime = 0
  G.combo = 0; G.comboTimer = 0; G.comboBreakT = 0; G.maxCombo = 0; G.comboPop = 0
  G.musou = 0
  G.shakeT = 0; G.shakeAmp = 0; G.hitstopT = 0; G.slowmoT = 0
  G.musouFlashT = 0; G.levelFlashT = 0
  G.levelUpPending = 0
  G.camX = 0; G.camY = 0
  G.kills = 0; G.milestoneT = 0; G.milestoneText = ''
  G.spawnQueue = []
  G.weaponDrops = []
  G.achvToasts = []
  G.bossKills = 0
  G.chests = []
  G.explosions = []
  G.slashes = []
  G.shockwaves = []
  G.victory = false; G.victoryT = 0
  G.gameOver = false; G.paused = false
}
