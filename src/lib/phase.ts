import { addDays, differenceInCalendarDays, format } from 'date-fns'
import type { DayCheckin } from '@/lib/plan'
import { EMPTY_CHECKIN, GOAL_WEIGHT, PLAN_END, PLAN_START, dateKey } from '@/lib/plan'

/**
 * 阶段（Phase）：一次「体重目标追踪」。
 * 新建阶段时，当前阶段会被归档（status = archived + 冻结一份成果快照），
 * 历史体重 / 打卡记录仍然按日期保存在原来的表里，
 * 每个阶段按自己的日期区间去取数据，因此不会互相干扰。
 */
export interface WeightPhase {
  /** bigint 主键；0 表示还没同步到云端的临时阶段 */
  id: number
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  startWeight: number | null
  goalWeight: number
  status: 'active' | 'archived'
  /** 归档时冻结的成果快照 */
  summary: PhaseSummary | null
  createdAt: string
  archivedAt: string | null
}

/** 归档时冻结的成果快照 */
export interface PhaseSummary {
  endWeight: number | null
  endWeightDate: string | null
  lost: number | null
  goalReached: boolean
  /** 有体重记录的天数 */
  recordedDays: number
  /** 打过卡（任意一项）的天数 */
  checkinDays: number
  /** 三项全完成的天数 */
  fullDays: number
  plannedDays: number
  actualDays: number
}

/** 新建 / 编辑阶段表单 */
export interface PhaseDraft {
  name: string
  startDate: string
  endDate: string
  startWeight: number | null
  goalWeight: number
}

/** 新阶段默认时长（约 8 周，和最初 50 天的节奏接近） */
export const DEFAULT_PHASE_DAYS = 56

export const DEFAULT_PHASE_NAME = '第 1 阶段'

/** 升级脚本还没执行时的提示文案 */
export const PHASE_SETUP_HINT_FALLBACK =
  '云端还没有建好阶段数据表：请在 Supabase 控制台的 SQL Editor 里执行 supabase-phases.sql，然后刷新页面。'

export const phaseName = (index: number): string => `第 ${index} 阶段`

/** 解析 YYYY-MM-DD 为本地时区日期（避免 new Date(str) 按 UTC 解析导致日期偏移） */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const isValidWeight = (v: number | null): v is number =>
  v != null && Number.isFinite(v) && v >= 20 && v <= 300

/** 解析体重输入（20 ~ 300 kg，保留 1 位小数）；非法返回 null */
export function parseWeightInput(s: string): number | null {
  const v = Number.parseFloat(s)
  if (!isValidWeight(v)) return null
  return Math.round(v * 10) / 10
}

/** 阶段总天数（含首尾） */
export function phaseTotalDays(phase: WeightPhase): number {
  return (
    differenceInCalendarDays(parseDateKey(phase.endDate), parseDateKey(phase.startDate)) + 1
  )
}

/** 距离阶段目标日剩余天数（>= 0） */
export function phaseDaysLeft(today: Date, phase: WeightPhase): number {
  return Math.max(0, differenceInCalendarDays(parseDateKey(phase.endDate), today))
}

/** 阶段已过去的天数索引（从 0 开始，未开始则为 0） */
export function phaseDayIndex(today: Date, phase: WeightPhase): number {
  return Math.max(0, differenceInCalendarDays(today, parseDateKey(phase.startDate)))
}

/** 阶段时间进度 0 ~ 1 */
export function phaseProgress(today: Date, phase: WeightPhase): number {
  const total = phaseTotalDays(phase)
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, (phaseDayIndex(today, phase) + 1) / total))
}

/** 是否已经过了阶段的目标日 */
export function isPhaseExpired(phase: WeightPhase, today: Date): boolean {
  return differenceInCalendarDays(parseDateKey(phase.endDate), today) < 0
}

/** 阶段区间内的所有日期 key */
export function phaseDateKeys(phase: WeightPhase): string[] {
  const keys: string[] = []
  const total = phaseTotalDays(phase)
  const start = parseDateKey(phase.startDate)
  for (let i = 0; i < total; i++) keys.push(dateKey(addDays(start, i)))
  return keys
}

/** 阶段区间内的日期 key（含首尾，字符串可直接比较） */
export const keyInPhase = (key: string, phase: WeightPhase): boolean =>
  key >= phase.startDate && key <= phase.endDate

/** 阶段区间内的体重记录，按日期升序 */
export function phaseWeightEntries(
  weights: Record<string, number>,
  phase: WeightPhase,
): Array<{ key: string; value: number }> {
  return Object.keys(weights)
    .filter((k) => keyInPhase(k, phase))
    .sort()
    .map((k) => ({ key: k, value: weights[k] }))
}

/** 阶段区间内的体重记录（对象形式） */
export function weightsInPhase(
  weights: Record<string, number>,
  phase: WeightPhase,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { key, value } of phaseWeightEntries(weights, phase)) out[key] = value
  return out
}

const CHECK_KEYS: Array<keyof DayCheckin> = ['exercise', 'snackFree', 'weighed']

/** 某天打卡完成项数（0 ~ 3） */
export function checkinLevel(
  checkins: Record<string, Partial<DayCheckin>>,
  key: string,
): number {
  const day: DayCheckin = { ...EMPTY_CHECKIN, ...(checkins[key] ?? {}) }
  return CHECK_KEYS.reduce((sum, k) => sum + (day[k] ? 1 : 0), 0)
}

/** 收集阶段区间内最后一次体重记录 */
export function lastWeightInPhase(
  weights: Record<string, number>,
  phase: WeightPhase,
): { key: string; value: number } | null {
  const entries = phaseWeightEntries(weights, phase)
  return entries.length > 0 ? entries[entries.length - 1] : null
}

/** 归档前算一份成果快照，冻结进 weight_phases.summary */
export function buildPhaseSummary(
  phase: WeightPhase,
  weights: Record<string, number>,
  checkins: Record<string, Partial<DayCheckin>>,
): PhaseSummary {
  const entries = phaseWeightEntries(weights, phase)
  const last = entries.length > 0 ? entries[entries.length - 1] : null
  const plannedDays = phaseTotalDays(phase)

  let checkinDays = 0
  let fullDays = 0
  for (const key of phaseDateKeys(phase)) {
    const level = checkinLevel(checkins, key)
    if (level > 0) checkinDays += 1
    if (level === CHECK_KEYS.length) fullDays += 1
  }

  const endWeight = last ? last.value : null
  return {
    endWeight,
    endWeightDate: last ? last.key : null,
    lost:
      endWeight != null && phase.startWeight != null
        ? Math.round((phase.startWeight - endWeight) * 10) / 10
        : null,
    goalReached: endWeight != null && endWeight <= phase.goalWeight,
    recordedDays: entries.length,
    checkinDays,
    fullDays,
    plannedDays,
    actualDays: last
      ? Math.max(1, differenceInCalendarDays(parseDateKey(last.key), parseDateKey(phase.startDate)) + 1)
      : plannedDays,
  }
}

/** 阶段日期区间展示：07-28 → 09-15（跨年时补上年份） */
export function phaseRangeLabel(phase: WeightPhase): string {
  const sameYear = phase.startDate.slice(0, 4) === phase.endDate.slice(0, 4)
  const start = sameYear ? phase.startDate.slice(5) : phase.startDate
  return `${start} → ${phase.endDate.slice(5)}`
}

export const phaseFullRangeLabel = (phase: WeightPhase): string =>
  `${phase.startDate} → ${phase.endDate}`

/** 新阶段的默认表单值：默认从今天开始，起点体重取「最近一次记录的体重」 */
export function defaultPhaseDraft(
  today: Date,
  prev: WeightPhase | null,
  currentWeight: number | null,
  nextName: string,
): PhaseDraft {
  const todayKey = dateKey(today)
  // 不能和上一阶段重叠：至少晚于上一阶段的起始日一天
  const minStart = prev ? dateKey(addDays(parseDateKey(prev.startDate), 1)) : todayKey
  const startDate = todayKey > minStart ? todayKey : minStart
  return {
    name: nextName,
    startDate,
    endDate: dateKey(addDays(parseDateKey(startDate), DEFAULT_PHASE_DAYS - 1)),
    startWeight: currentWeight,
    goalWeight: prev ? prev.goalWeight : GOAL_WEIGHT,
  }
}

/** 校验阶段表单，返回错误信息；null 表示通过 */
export function validatePhaseDraft(
  draft: PhaseDraft,
  prev: WeightPhase | null,
): string | null {
  if (!draft.name.trim()) return '给这个阶段起个名字吧'
  if (!draft.startDate || !draft.endDate) return '请选择起始日期和目标日期'
  if (draft.endDate <= draft.startDate) return '目标日期要晚于起始日期'
  if (draft.startWeight != null && !isValidWeight(draft.startWeight))
    return '起始体重要在 20 ~ 300 kg 之间'
  if (!isValidWeight(draft.goalWeight)) return '目标体重要在 20 ~ 300 kg 之间'
  if (draft.startWeight != null && draft.goalWeight >= draft.startWeight)
    return '目标体重要低于起始体重'
  if (prev && draft.startDate <= prev.startDate)
    return `起始日期要晚于上一阶段的 ${prev.startDate}`
  return null
}

/**
 * 归档上一阶段时它的结束日期：
 *  - 新阶段开始得比原计划早 → 旧阶段提前一天收尾（不重叠）
 *  - 新阶段开始得比原计划晚 → 保留原计划日期，不改写历史
 */
export function archivedEndDate(prev: WeightPhase, newStartDate: string): string {
  if (prev.endDate < newStartDate) return prev.endDate
  const dayBefore = dateKey(addDays(parseDateKey(newStartDate), -1))
  return dayBefore > prev.startDate ? dayBefore : prev.startDate
}

/** 云端还没升级（缺少 weight_phases 表）时的兜底阶段：沿用最初写死的计划区间 */
export function legacyPhaseFallback(startWeight: number | null): WeightPhase {
  return {
    id: 0,
    name: DEFAULT_PHASE_NAME,
    startDate: dateKey(PLAN_START),
    endDate: dateKey(PLAN_END),
    startWeight,
    goalWeight: GOAL_WEIGHT,
    status: 'active',
    summary: null,
    createdAt: dateKey(PLAN_START),
    archivedAt: null,
  }
}

/** 由表单内容拼出一个（尚未落库的）阶段，用于展示 / 兜底 */
export function draftToPhase(draft: PhaseDraft, id = 0): WeightPhase {
  return {
    id,
    name: draft.name.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    startWeight: draft.startWeight,
    goalWeight: draft.goalWeight,
    status: 'active',
    summary: null,
    createdAt: new Date().toISOString(),
    archivedAt: null,
  }
}

const fmt = (v: number | null, unit = ' kg'): string => (v == null ? '—' : `${v.toFixed(1)}${unit}`)

/** 把一个阶段的成果渲染成 Markdown，用于归档导出 */
export function phaseToMarkdown(
  phase: WeightPhase,
  weights: Record<string, number>,
  checkins: Record<string, Partial<DayCheckin>>,
): string {
  const summary = phase.summary ?? buildPhaseSummary(phase, weights, checkins)
  const entries = phaseWeightEntries(weights, phase)
  const lines: string[] = [
    `# ${phase.name} · 体重阶段总结`,
    '',
    `- 周期：${phaseFullRangeLabel(phase)}（计划 ${summary.plannedDays} 天）`,
    `- 起始体重：${fmt(phase.startWeight)}`,
    `- 结束体重：${fmt(summary.endWeight)}${summary.endWeightDate ? `（${summary.endWeightDate}）` : ''}`,
    `- 阶段变化：${
      summary.lost == null
        ? '—'
        : summary.lost > 0
          ? `减 ${summary.lost.toFixed(1)} kg`
          : summary.lost === 0
            ? '持平'
            : `增加 ${Math.abs(summary.lost).toFixed(1)} kg`
    }`,
    `- 目标体重：${phase.goalWeight.toFixed(1)} kg · ${
      summary.goalReached
        ? '已达成 🎉'
        : summary.endWeight != null
          ? `还差 ${(summary.endWeight - phase.goalWeight).toFixed(1)} kg`
          : '暂无称重记录'
    }`,
    `- 记录天数：${summary.recordedDays} 天 · 打卡天数：${summary.checkinDays} 天 · 满分天数：${summary.fullDays} 天`,
    `- 实际用时：${summary.actualDays} 天 · 状态：${phase.status === 'archived' ? '已归档' : '进行中'}`,
  ]

  if (entries.length > 0) {
    lines.push('', '## 体重记录', '', '| 日期 | 体重 (kg) | 较上次 |', '| --- | --- | --- |')
    let prevValue: number | null = null
    for (const { key, value } of entries) {
      const diff =
        prevValue == null ? '—' : `${value - prevValue > 0 ? '+' : ''}${(value - prevValue).toFixed(1)}`
      lines.push(`| ${key} | ${value.toFixed(1)} | ${diff} |`)
      prevValue = value
    }
  }

  const checkinRows = phaseDateKeys(phase).filter((k) => checkinLevel(checkins, k) > 0)
  if (checkinRows.length > 0) {
    lines.push('', '## 打卡记录', '', '| 日期 | 运动 | 零食控制 | 称重 |', '| --- | --- | --- | --- |')
    for (const key of checkinRows) {
      const day: DayCheckin = { ...EMPTY_CHECKIN, ...(checkins[key] ?? {}) }
      lines.push(
        `| ${key} | ${day.exercise ? '✓' : '—'} | ${day.snackFree ? '✓' : '—'} | ${day.weighed ? '✓' : '—'} |`,
      )
    }
  }

  lines.push(
    '',
    `> 导出时间：${format(new Date(), 'yyyy-MM-dd HH:mm')} · 轻盈计划`,
    '',
  )
  return lines.join('\n')
}

/** 触发浏览器下载一段文本 */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
