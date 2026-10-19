// 数据化内容：Boss 地面预警/符阵/冲撞配色
import type { BossKind } from '../types'

export interface BossFxDef {
  ring: string        // 前摇外环
  ring2: string       // 前摇内环/高光
  rune: string        // 符阵/狂暴环
  charge: string      // 冲撞拖尘
  eye: string         // 狂暴眼/核心光
}

export const BOSS_FX: Record<BossKind, BossFxDef> = {
  charger: {
    ring: '255,110,60', ring2: '255,200,120', rune: '255,80,40', charge: '255,160,90', eye: '255,90,60',
  },
  spitter: {
    ring: '180,120,255', ring2: '240,220,255', rune: '180,106,255', charge: '200,150,255', eye: '255,140,170',
  },
  twins: {
    ring: '255,90,70', ring2: '255,210,180', rune: '255,60,50', charge: '255,120,90', eye: '255,100,80',
  },
  overlord: {
    ring: '255,50,40', ring2: '240,190,100', rune: '255,60,40', charge: '255,80,50', eye: '255,40,30',
  },
}
