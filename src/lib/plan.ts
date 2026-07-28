import { differenceInCalendarDays, format, isAfter, isBefore } from 'date-fns'

/** 计划常量 */
export const PLAN_START = new Date(2026, 6, 28) // 2026-07-28
export const PLAN_END = new Date(2026, 8, 15) // 2026-09-15
export const GOAL_WEIGHT = 65

export const dateKey = (d: Date): string => format(d, 'yyyy-MM-dd')

const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

export const weekdayCN = (d: Date): string => `星期${WEEKDAYS_CN[d.getDay()]}`

/** 跑步日：周一/周二/周四；力量日：周三/周五/周六/周日 */
export const isRunDay = (d: Date): boolean => {
  const day = d.getDay()
  return day === 1 || day === 2 || day === 4
}

export const todayExercise = (d: Date): { title: string; kind: 'run' | 'strength' } =>
  isRunDay(d)
    ? { title: '5 公里跑步', kind: 'run' }
    : { title: '30 分钟力量训练', kind: 'strength' }

/** 距离目标日剩余天数（>= 0） */
export const daysLeft = (today: Date): number =>
  Math.max(0, differenceInCalendarDays(PLAN_END, today))

/** 距离开始日的天数索引（>= 0） */
export const dayIndex = (today: Date): number =>
  Math.max(0, differenceInCalendarDays(today, PLAN_START))

export const isFutureDay = (d: Date, today: Date): boolean =>
  differenceInCalendarDays(d, today) > 0

export const inPlanRange = (d: Date): boolean =>
  !isBefore(d, PLAN_START) && !isAfter(d, PLAN_END)

/** 每日加油标语（56 条，按 dayIndex 轮换，周期内不重复） */
export const SLOGANS: string[] = [
  '慢慢来，今天也很好。',
  '每一步都算数，包括今天这一步。',
  '不必完美，只要出发。',
  '温柔地对待自己，改变才会长久。',
  '今天的一点点，是明天的一大步。',
  '身体会记得你对它的好。',
  '累了就慢一点，别停下来就好。',
  '你已经在路上了，这就很了不起。',
  '和自己站在一起，而不是对立面。',
  '小小的坚持，会慢慢长成大大的变化。',
  '今天，也请先给自己一个微笑。',
  '节奏慢一点没关系，方向是对的就好。',
  '不必和别人比，只和昨天的自己打个招呼。',
  '照顾好自己，是最温柔的决心。',
  '汗水，是身体写给你的感谢信。',
  '每一次换上跑鞋，都是一次温柔的兑现。',
  '呼吸、迈步、放松，你做得很好。',
  '轻盈不只是体重，也是心情。',
  '今天的自律，会变成明天的从容。',
  '把目标拆小，把日子过好。',
  '一天一天来，花会沿路开放。',
  '你的努力，正在安静地发光。',
  '没关系，慢慢来，反而比较快。',
  '享受流汗的过程，而不只是结果。',
  '好好吃饭、好好睡觉、好好运动，就是最好的计划。',
  '身体正在悄悄变好，请继续相信。',
  '不赶时间，只是走向更好的自己。',
  '温柔的坚持，比严厉的苛责更有力量。',
  '跑过的路，一步都不会白跑。',
  '今天的你，又认真生活了一整天。',
  '允许偶尔停一停，然后继续向前。',
  '改变不是冲刺，是一场长长的散步。',
  '善待自己，从善待今天开始。',
  '每一克努力，都值得被看见。',
  '保持热爱，也保持期待。',
  '风会记得你奔跑的样子。',
  '把"坚持"换成"享受"，一切都会更轻。',
  '今天流的汗，会变成以后的轻松。',
  '你不需要很快，只需要一直在走。',
  '和自己做个约定，然后温柔地兑现它。',
  '生活是一场长跑，今天的配速刚刚好。',
  '不为取悦任何人，只为照顾这个身体。',
  '每一次放下零食，都是一次小小的胜利。',
  '清晨的秤只是记录，不是评判。',
  '数字只是参考，状态才是答案。',
  '今天，也稳稳地向前挪了一小步。',
  '相信过程，时间会给答案。',
  '一点一滴，终会汇聚成光。',
  '愿你被温柔以待，也温柔对待自己。',
  '把每一天，过成自己喜欢的样子。',
  '路还长，风景正好，不必急着抵达。',
  '你的自律里，藏着对自己的爱。',
  '今天也辛苦了，明天继续轻轻加油。',
  '慢一点没关系，我们稳稳地走。',
  '每一个认真生活的人，都在闪闪发光。',
  '朝着 65kg 的方向，一步一步，不慌不忙。',
]

export const todaySlogan = (today: Date): string =>
  SLOGANS[dayIndex(today) % SLOGANS.length]

/** 打卡完成随机鼓励语 */
export const PRAISES: string[] = [
  '做到了，你真的很棒。',
  '又认真了一天，为自己鼓鼓掌。',
  '温柔又坚定，就是你现在的样子。',
  '这一步，走得漂亮。',
  '身体正在偷偷感谢你。',
  '完成啦，给自己一个小小的拥抱。',
  '今天的努力，已悄悄存档。',
  '真好，你又照顾好自己了。',
]

export const randomPraise = (): string =>
  PRAISES[Math.floor(Math.random() * PRAISES.length)]

/** 每周温和小结 */
export const WEEKLY_NOTES: string[] = [
  '这一周，你认真地照顾着自己，辛苦了。',
  '慢慢来，小坚持都会慢慢累积成变化。',
  '有起伏很正常，重要的是你一直在。',
  '这一周的你，比想象中更有毅力。',
  '哪怕只完成了一点点，也值得被肯定。',
  '又是认真生活的一周，送自己一朵小花。',
  '不必苛求全勤，留下的都是足迹。',
]

export const weeklyNote = (today: Date): string => {
  const week = Math.floor(dayIndex(today) / 7)
  return WEEKLY_NOTES[week % WEEKLY_NOTES.length]
}

/** 打卡项 key */
export type CheckKey = 'exercise' | 'snackFree' | 'weighed'
export interface DayCheckin {
  exercise: boolean
  snackFree: boolean
  weighed: boolean
}
export const EMPTY_CHECKIN: DayCheckin = {
  exercise: false,
  snackFree: false,
  weighed: false,
}
