// 数据化内容：五武器攻击/重击/蓄力姿态
// 模型只负责采样；新增武器或调整动作只改这里，不再改 model.ts 的姿态分支。
import type { WeaponId } from '../types'

export interface SkelPose {
  lean: number
  crouch: number
  armN1: number; armN2: number
  armF1: number; armF2: number
  legN1: number; legN2: number
  legF1: number; legF2: number
  weapon: number
  bowPull: number
}
export type PoseOverride = Partial<SkelPose>
export interface PoseKeyframe { t: number; pose: PoseOverride }
export type WeaponClipKey = 'atk1' | 'atk2' | 'atk3' | 'heavyWind' | 'heavyStrike' | 'charge'
export type WeaponClips = Partial<Record<WeaponClipKey, PoseKeyframe[]>>

const kf = (t: number, pose: PoseOverride): PoseKeyframe => ({ t, pose })
const still = (pose: PoseOverride): PoseKeyframe[] => [kf(0, pose)]

export const WEAPON_CLIPS: Record<WeaponId, WeaponClips> = {
  fist: {
    atk1: [
      kf(0, { lean: .1, armN1: -.5, armN2: -.4, armF1: 2.5, armF2: 2.7, weapon: -.5 }),
      kf(.3, { lean: .2, armN1: .1, armN2: .1, armF1: 2.5, armF2: 2.7, weapon: .1 }),
      kf(1, { lean: .16, armN1: .3, armN2: .3, armF1: 2.6, armF2: 2.8, weapon: .3 }),
    ],
    atk2: [
      kf(0, { lean: .12, armF1: -.5, armF2: -.4, armN1: 2.4, armN2: 2.6, weapon: 2.4 }),
      kf(.3, { lean: .22, armF1: .1, armF2: .1, armN1: 2.4, armN2: 2.6, weapon: 2.4 }),
      kf(1, { lean: .18, armF1: .3, armF2: .3, armN1: 2.5, armN2: 2.7, weapon: 2.5 }),
    ],
    atk3: [
      kf(0, { lean: .15, crouch: 2, armN1: -.4, armF1: -.3, weapon: -.4 }),
      kf(.3, { lean: .3, crouch: 2, armN1: .2, armF1: .2, legN1: 0, legN2: .2, weapon: .2 }),
      kf(1, { lean: .2, crouch: 1, armN1: .4, armF1: .4, weapon: .4 }),
    ],
    heavyWind: still({ lean: -.12, crouch: 3, armN1: -2.2, armN2: -2.3, armF1: -2, armF2: -2.2, weapon: -2.2 }),
    heavyStrike: still({ lean: .3, crouch: 2, armN1: .6, armN2: .6, armF1: .5, armF2: .5, weapon: .6 }),
    charge: still({ lean: -.08, crouch: 4, armN1: 2.5, armN2: 2.7, armF1: 2.4, armF2: 2.6, weapon: 2.5 }),
  },
  spear: {
    atk1: [
      kf(0, { lean: -.02, armN1: -.4, armN2: -.35, armF1: 2.5, armF2: 2.7, weapon: -.4 }),
      kf(.3, { lean: .22, armN1: .05, armN2: .05, armF1: 2.5, armF2: 2.7, weapon: .05 }),
      kf(1, { lean: .18, armN1: .25, armN2: .25, armF1: 2.6, armF2: 2.8, weapon: .25 }),
    ],
    atk2: [
      kf(0, { lean: .1, armN1: .9, armN2: .95, armF1: 2.4, armF2: 2.6, weapon: .9 }),
      kf(.3, { lean: .2, armN1: .55, armN2: .65, armF1: .15, armF2: .25, weapon: .6 }),
      kf(1, { lean: .16, armN1: .7, armN2: .8, armF1: .3, armF2: .4, weapon: .7 }),
    ],
    atk3: [
      kf(0, { lean: .05, armN1: -.3, armN2: -.3, armF1: 2.4, armF2: 2.6, weapon: -.3 }),
      kf(.3, { lean: .3, armN1: .08, armN2: .08, armF1: 2.5, armF2: 2.7, legN1: 0, legN2: .2, weapon: .08 }),
      kf(1, { lean: .24, armN1: .3, armN2: .3, armF1: 2.55, armF2: 2.75, weapon: .3 }),
    ],
    heavyWind: still({ lean: -.1, crouch: 2, armN1: 2.5, armN2: 2.75, armF1: 2.3, armF2: 2.5, weapon: 2.5 }),
    heavyStrike: still({ lean: .35, crouch: 1, armN1: .1, armN2: .1, armF1: 2.5, armF2: 2.7, weapon: .1 }),
    charge: still({ lean: -.05, crouch: 3, armN1: 2.5, armN2: 2.75, armF1: 2.4, armF2: 2.6, weapon: 2.5 }),
  },
  dual: {
    atk1: [
      kf(0, { lean: .14, armN1: -.8, armN2: -.7, armF1: 2.5, armF2: 2.7, weapon: -.8 }),
      kf(.3, { lean: .22, armN1: .6, armN2: .7, armF1: 2.5, armF2: 2.7, weapon: .6 }),
      kf(1, { lean: .18, armN1: .8, armN2: .9, armF1: 2.55, armF2: 2.75, weapon: .8 }),
    ],
    atk2: [
      kf(0, { lean: .14, armF1: -.8, armF2: -.7, armN1: 2.4, armN2: 2.6, weapon: 2.4 }),
      kf(.3, { lean: .22, armF1: .6, armF2: .7, armN1: 2.4, armN2: 2.6, weapon: 2.4 }),
      kf(1, { lean: .18, armF1: .8, armF2: .9, armN1: 2.5, armN2: 2.7, weapon: 2.5 }),
    ],
    atk3: [
      kf(0, { lean: .18, armN1: -.7, armN2: -.6, armF1: -.5, armF2: -.4, weapon: -.7 }),
      kf(.3, { lean: .3, armN1: .4, armN2: .5, armF1: .25, armF2: .35, weapon: .4 }),
      kf(1, { lean: .22, armN1: .6, armN2: .7, armF1: .4, armF2: .5, weapon: .6 }),
    ],
    heavyWind: still({ lean: -.06, crouch: 3, armN1: -1.9, armN2: -1.8, armF1: -1.7, armF2: -1.6, weapon: -1.9 }),
    heavyStrike: still({ lean: .3, crouch: 2, armN1: .7, armN2: .8, armF1: .4, armF2: .5, weapon: .7 }),
    charge: still({ lean: -.05, crouch: 3, armN1: 2.5, armN2: 2.7, armF1: 2.4, armF2: 2.6, weapon: 2.5 }),
  },
  hammer: {
    atk1: [
      kf(0, { lean: -.1, crouch: 2, armN1: -2.4, armN2: -2.5, armF1: -2.2, armF2: -2.4, weapon: -2.4 }),
      kf(.34, { lean: .35, crouch: 1, armN1: .45, armN2: .45, armF1: 2.4, armF2: 2.6, weapon: .45 }),
      kf(1, { lean: .26, crouch: 0, armN1: .6, armN2: .6, armF1: 2.5, armF2: 2.7, weapon: .6 }),
    ],
    atk2: [
      kf(0, { lean: -.04, crouch: 2, armN1: -1.5, armN2: -1.6, armF1: 2.3, armF2: 2.5, weapon: -1.5 }),
      kf(.34, { lean: .22, crouch: 1, armN1: .8, armN2: .9, armF1: 2.4, armF2: 2.6, weapon: .8 }),
      kf(1, { lean: .18, crouch: 0, armN1: .9, armN2: 1, armF1: 2.5, armF2: 2.7, weapon: .9 }),
    ],
    atk3: [
      kf(0, { lean: -.14, crouch: 3, armN1: -2.7, armN2: -2.8, armF1: -2.4, armF2: -2.6, weapon: -2.7 }),
      kf(.34, { lean: .4, crouch: 2, armN1: .5, armN2: .5, armF1: 2.3, armF2: 2.5, legN1: .2, legN2: .3, weapon: .5 }),
      kf(1, { lean: .3, crouch: 1, armN1: .65, armN2: .65, armF1: 2.4, armF2: 2.6, weapon: .65 }),
    ],
    heavyWind: still({ lean: -.16, crouch: 4, armN1: -2.6, armN2: -2.7, armF1: -2.3, armF2: -2.5, weapon: -2.6 }),
    heavyStrike: still({ lean: .38, crouch: 2, armN1: .55, armN2: .55, armF1: 2.3, armF2: 2.5, weapon: .55 }),
    charge: still({ lean: -.12, crouch: 4, armN1: 2.6, armN2: 2.8, armF1: 2.3, armF2: 2.5, weapon: 2.6 }),
  },
  bow: {
    atk1: [
      kf(0, { lean: .14, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .2 }),
      kf(.4, { lean: .2, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .85 }),
      kf(1, { lean: .18, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .6 }),
    ],
    atk2: [
      kf(0, { lean: .16, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .25 }),
      kf(.4, { lean: .22, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .9 }),
      kf(1, { lean: .2, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .7 }),
    ],
    atk3: [
      kf(0, { lean: .18, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .3 }),
      kf(.4, { lean: .24, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: 1 }),
      kf(1, { lean: .22, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .8 }),
    ],
    heavyWind: still({ lean: .12, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .85 }),
    heavyStrike: still({ lean: .22, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: 1 }),
    charge: still({ lean: .16, armN1: 0, armN2: .05, armF1: -.05, armF2: -.02, weapon: 0, bowPull: .7 }),
  },
}

function apply(base: SkelPose, override: PoseOverride): SkelPose {
  return { ...base, ...override }
}

function lerp(a: number, b: number, u: number): number { return a + (b - a) * u }

function blend(a: SkelPose, b: SkelPose, u: number): SkelPose {
  return {
    lean: lerp(a.lean, b.lean, u),
    crouch: lerp(a.crouch, b.crouch, u),
    armN1: lerp(a.armN1, b.armN1, u), armN2: lerp(a.armN2, b.armN2, u),
    armF1: lerp(a.armF1, b.armF1, u), armF2: lerp(a.armF2, b.armF2, u),
    legN1: lerp(a.legN1, b.legN1, u), legN2: lerp(a.legN2, b.legN2, u),
    legF1: lerp(a.legF1, b.legF1, u), legF2: lerp(a.legF2, b.legF2, u),
    weapon: lerp(a.weapon, b.weapon, u),
    bowPull: lerp(a.bowPull, b.bowPull, u),
  }
}

/** 在当前基础姿态上采样武器动作；没有配置则原样返回。 */
export function sampleWeaponClip(base: SkelPose, weapon: WeaponId, key: WeaponClipKey, progress: number): SkelPose {
  const clip = WEAPON_CLIPS[weapon]?.[key]
  if (!clip || !clip.length) return base
  const t = Math.max(0, Math.min(1, progress))
  if (t <= clip[0].t) return apply(base, clip[0].pose)
  for (let i = 1; i < clip.length; i++) {
    const a = clip[i - 1], b = clip[i]
    if (t <= b.t) {
      const u = b.t <= a.t ? 1 : (t - a.t) / (b.t - a.t)
      const e = u * u * (3 - 2 * u)
      return blend(apply(base, a.pose), apply(base, b.pose), e)
    }
  }
  return apply(base, clip[clip.length - 1].pose)
}
