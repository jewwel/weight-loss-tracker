import { describe, expect, it } from 'vitest'
import type { DayCheckin } from '@/lib/plan'
import { dateKey } from '@/lib/plan'
import type { WeightPhase } from '@/lib/phase'
import {
  archivedEndDate,
  buildPhaseSummary,
  defaultPhaseDraft,
  keyInPhase,
  phaseDaysLeft,
  phaseProgress,
  phaseToMarkdown,
  phaseTotalDays,
  phaseWeightEntries,
  validatePhaseDraft,
} from '@/lib/phase'

const TODAY = new Date(2026, 9, 12) // 2026-10-12

const phase1: WeightPhase = {
  id: 1,
  name: '第 1 阶段',
  startDate: '2026-07-28',
  endDate: '2026-09-15',
  startWeight: 78,
  goalWeight: 65,
  status: 'active',
  summary: null,
  createdAt: '2026-07-28',
  archivedAt: null,
}

describe('默认新阶段', () => {
  it('从今天开始，默认 56 天，起点取最近一次体重，目标沿用上一阶段', () => {
    const draft = defaultPhaseDraft(TODAY, phase1, 74.2, '第 2 阶段')
    expect(draft.name).toBe('第 2 阶段')
    expect(draft.startDate).toBe('2026-10-12')
    expect(draft.endDate).toBe('2026-12-06') // 今天 + 55 天
    expect(draft.startWeight).toBe(74.2)
    expect(draft.goalWeight).toBe(65)
  })

  it('上一阶段还没开始完就新建时，起点会被推到它之后，避免区间重叠', () => {
    const future: WeightPhase = { ...phase1, startDate: '2026-11-01', endDate: '2026-12-31' }
    const draft = defaultPhaseDraft(TODAY, future, null, '第 2 阶段')
    expect(draft.startDate).toBe('2026-11-02')
  })
})

describe('归档时旧阶段的结束日期', () => {
  it('新阶段开始得比原计划晚：保留原计划日期，不改写历史', () => {
    expect(archivedEndDate(phase1, '2026-10-12')).toBe('2026-09-15')
  })

  it('新阶段开始得比原计划早：提前一天收尾，不重叠', () => {
    const future: WeightPhase = { ...phase1, endDate: '2026-12-31' }
    expect(archivedEndDate(future, '2026-10-12')).toBe('2026-10-11')
  })

  it('极端情况下也不会早于自己的起始日', () => {
    const future: WeightPhase = { ...phase1, startDate: '2026-11-01', endDate: '2026-12-31' }
    expect(archivedEndDate(future, '2026-10-12')).toBe('2026-11-01')
  })
})

describe('表单校验', () => {
  const base = {
    name: '第 2 阶段',
    startDate: '2026-10-12',
    endDate: '2026-12-06',
    startWeight: 74.2,
    goalWeight: 65,
  }

  it('通过合法表单', () => {
    expect(validatePhaseDraft(base, phase1)).toBeNull()
  })

  it('目标日期必须晚于起始日期', () => {
    expect(validatePhaseDraft({ ...base, endDate: '2026-10-12' }, phase1)).toContain('晚于')
  })

  it('目标体重必须低于起始体重', () => {
    expect(validatePhaseDraft({ ...base, goalWeight: 80 }, phase1)).toContain('低于起始体重')
  })

  it('起始日期必须晚于上一阶段', () => {
    expect(validatePhaseDraft({ ...base, startDate: '2026-07-28' }, phase1)).toContain('上一阶段')
  })

  it('体重超出合理范围会被拦下', () => {
    expect(validatePhaseDraft({ ...base, goalWeight: 10 }, phase1)).toContain('20 ~ 300')
    expect(validatePhaseDraft({ ...base, startWeight: 500 }, phase1)).toContain('20 ~ 300')
  })

  it('名称不能为空', () => {
    expect(validatePhaseDraft({ ...base, name: '  ' }, phase1)).toContain('名字')
  })
})

describe('区间取值与快照', () => {
  const weights: Record<string, number> = {
    '2026-07-27': 79, // 阶段之前
    '2026-07-28': 78,
    '2026-08-10': 76.4,
    '2026-09-15': 73.2,
    '2026-09-16': 73, // 阶段之后
    '2026-10-12': 74,
  }
  const checkins: Record<string, Partial<DayCheckin>> = {
    '2026-07-28': { exercise: true, snackFree: true, weighed: true }, // 满分
    '2026-08-10': { exercise: true }, // 1/3
    '2026-09-15': { exercise: true, snackFree: true }, // 2/3
    '2026-10-12': { exercise: true, snackFree: true, weighed: true }, // 阶段之外
  }

  it('只统计阶段区间内的记录', () => {
    const entries = phaseWeightEntries(weights, phase1)
    expect(entries.map((e) => e.key)).toEqual(['2026-07-28', '2026-08-10', '2026-09-15'])
    expect(keyInPhase('2026-09-16', phase1)).toBe(false)
    expect(keyInPhase('2026-09-15', phase1)).toBe(true)
  })

  it('快照冻结结束体重、减重、达标与打卡天数', () => {
    const summary = buildPhaseSummary(phase1, weights, checkins)
    expect(summary.endWeight).toBe(73.2)
    expect(summary.endWeightDate).toBe('2026-09-15')
    expect(summary.lost).toBe(4.8) // 78 -> 73.2
    expect(summary.goalReached).toBe(false) // 73.2 > 65
    expect(summary.recordedDays).toBe(3)
    expect(summary.checkinDays).toBe(3) // 阶段内三次都有打卡
    expect(summary.fullDays).toBe(1)
    expect(summary.plannedDays).toBe(phaseTotalDays(phase1))
    expect(summary.actualDays).toBe(50) // 07-28 → 09-15
  })

  it('达标判定按结束体重 ≤ 目标体重', () => {
    const close: WeightPhase = { ...phase1, goalWeight: 74 }
    expect(buildPhaseSummary(close, weights, checkins).goalReached).toBe(true)
  })

  it('没有记录时快照不报错', () => {
    const summary = buildPhaseSummary(phase1, {}, {})
    expect(summary.endWeight).toBeNull()
    expect(summary.lost).toBeNull()
    expect(summary.recordedDays).toBe(0)
    expect(summary.goalReached).toBe(false)
  })
})

describe('阶段进度', () => {
  it('剩余天数与时间进度', () => {
    const phase: WeightPhase = { ...phase1, startDate: '2026-10-01', endDate: '2026-10-10' }
    expect(phaseDaysLeft(new Date(2026, 9, 12), phase)).toBe(0)
    expect(phaseDaysLeft(new Date(2026, 9, 5), phase)).toBe(5)
    expect(phaseTotalDays(phase)).toBe(10)
    expect(phaseProgress(new Date(2026, 9, 5), phase)).toBeCloseTo(0.5)
    expect(phaseProgress(new Date(2026, 9, 30), phase)).toBe(1)
  })
})

describe('导出 Markdown', () => {
  it('包含关键成果数字', () => {
    const weights = { '2026-07-28': 78, '2026-09-15': 73.2 }
    const archived: WeightPhase = { ...phase1, status: 'archived', archivedAt: '2026-10-12T00:00:00.000Z' }
    const md = phaseToMarkdown(archived, weights, {})
    expect(md).toContain('# 第 1 阶段 · 体重阶段总结')
    expect(md).toContain('2026-07-28 → 2026-09-15（计划 50 天）')
    expect(md).toContain('减 4.8 kg')
    expect(md).toContain('| 2026-09-15 | 73.2 |')
  })
})

describe('端到端：2026-10-12 归档第 1 阶段并新建第 2 阶段', () => {
  it('旧阶段保留原区间并冻结快照，新阶段从今天开始', () => {
    const weights = { '2026-07-28': 78, '2026-09-15': 73.2 }
    const draft = defaultPhaseDraft(TODAY, phase1, 73.2, '第 2 阶段')
    expect(validatePhaseDraft(draft, phase1)).toBeNull()

    const finalEnd = archivedEndDate(phase1, draft.startDate)
    expect(finalEnd).toBe('2026-09-15') // 不重叠，也不改写历史

    const snapshot = buildPhaseSummary({ ...phase1, endDate: finalEnd }, weights, {})
    expect(snapshot.lost).toBe(4.8)

    // 新阶段与旧阶段区间互不重叠
    expect(draft.startDate > finalEnd).toBe(true)
    expect(dateKey(TODAY)).toBe(draft.startDate)
  })
})
