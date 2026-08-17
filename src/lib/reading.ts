import { addDays, differenceInCalendarDays } from 'date-fns'
import { dateKey } from '@/lib/plan'

/** 读书计划 */
export interface ReadingPlan {
  bookName: string
  purpose: string
  questions: string[]
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  totalPages: number
}

/** 校验计划，返回错误信息；null 表示通过 */
export function validatePlan(plan: ReadingPlan): string | null {
  if (!plan.bookName.trim()) return '先填一下书籍名称吧'
  if (!plan.startDate || !plan.endDate) return '请选择起始和结束日期'
  if (plan.endDate <= plan.startDate) return '结束日期要晚于起始日期'
  if (!Number.isFinite(plan.totalPages) || plan.totalPages <= 0)
    return '总页数要大于 0'
  return null
}

/** 过滤掉空白问题 */
export function cleanQuestions(questions: string[]): string[] {
  return questions.map(q => q.trim()).filter(q => q.length > 0)
}

/** 把 YYYY-MM-DD 解析为本地时区日期（避免 new Date(str) 按 UTC 解析导致日期偏移） */
export function parseLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 计划总天数（含首尾） */
export function totalDays(plan: ReadingPlan): number {
  return (
    differenceInCalendarDays(
      parseLocalDate(plan.endDate),
      parseLocalDate(plan.startDate)
    ) + 1
  )
}

/** 平均每天需要读的页数（1 位小数） */
export function avgPagesPerDay(plan: ReadingPlan): number {
  const days = totalDays(plan)
  if (days <= 0) return plan.totalPages
  return Math.round((plan.totalPages / days) * 10) / 10
}

/**
 * 第 dayIdx 天（0 起）结束时应累计读到的页数（线性计划曲线）。
 * 最后一天恰好等于 totalPages。
 */
export function targetPageAt(plan: ReadingPlan, dayIdx: number): number {
  const days = totalDays(plan)
  if (days <= 0) return plan.totalPages
  const i = Math.min(Math.max(dayIdx + 1, 0), days)
  return Math.min(plan.totalPages, Math.round((plan.totalPages * i) / days))
}

/** 计划区间内每天的日期 key 列表 */
export function planDateKeys(plan: ReadingPlan): string[] {
  const keys: string[] = []
  const days = totalDays(plan)
  for (let i = 0; i < days; i++) {
    keys.push(dateKey(addDays(parseLocalDate(plan.startDate), i)))
  }
  return keys
}

/** 读完一本书后的统计数据 */
export interface SummaryStats {
  plannedDays: number // 计划天数
  actualDays: number // 实际用了多少天
  plannedAvg: number // 计划日均页数
  actualAvg: number // 实际日均页数
  recordedDays: number // 有记录的天数
}

/** 一本书的完成总结 */
export interface ReadingSummary {
  bookName: string
  purpose: string
  questions: string[]
  answers: string[]
  reflection: string
  startDate: string
  endDate: string
  finishedDate: string
  totalPages: number
  stats: SummaryStats
}

/**
 * 计算完成统计。
 * 完成日期取最早一条「页码 >= 总页数」的记录；没有则用今天。
 */
export function buildSummaryStats(
  plan: ReadingPlan,
  entries: Record<string, number>,
  todayKey: string
): { stats: SummaryStats; finishedDate: string } {
  const finishedDate =
    Object.keys(entries)
      .filter(k => entries[k] >= plan.totalPages)
      .sort()[0] ?? todayKey
  const plannedDays = totalDays(plan)
  const actualDays = Math.max(
    1,
    differenceInCalendarDays(
      parseLocalDate(finishedDate),
      parseLocalDate(plan.startDate)
    ) + 1
  )
  return {
    finishedDate,
    stats: {
      plannedDays,
      actualDays,
      plannedAvg: avgPagesPerDay(plan),
      actualAvg: Math.round((plan.totalPages / actualDays) * 10) / 10,
      recordedDays: Object.keys(entries).length,
    },
  }
}

/** 把总结渲染成 Markdown，用于导出 */
export function summaryToMarkdown(s: ReadingSummary): string {
  const lines: string[] = [
    `# 《${s.bookName}》读书总结`,
    '',
    `- 计划周期：${s.startDate} → ${s.endDate}（${s.stats.plannedDays} 天）`,
    `- 完成日期：${s.finishedDate}（实际用了 ${s.stats.actualDays} 天）`,
    `- 总页数：${s.totalPages} 页`,
    `- 计划节奏：${s.stats.plannedAvg} 页/天 · 实际节奏：${s.stats.actualAvg} 页/天`,
    `- 有记录的天数：${s.stats.recordedDays} 天`,
  ]
  if (s.purpose) {
    lines.push('', '## 学习目的', '', s.purpose)
  }
  if (s.questions.length > 0) {
    lines.push('', '## 问题回顾', '')
    s.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q}`)
      const a = s.answers[i]?.trim()
      lines.push(a ? `   ${a}` : '   （未作答）')
      lines.push('')
    })
  }
  if (s.reflection.trim()) {
    lines.push('## 总结', '', s.reflection.trim())
  }
  return lines.join('\n') + '\n'
}
