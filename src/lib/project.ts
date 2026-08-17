import { addDays, differenceInCalendarDays } from 'date-fns'
import { dateKey } from '@/lib/plan'
import { parseLocalDate } from '@/lib/reading'

/** 项目 */
export interface Project {
  name: string
  goal: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/** 项目待办事项 */
export interface ProjectTodo {
  id: number
  title: string
  estimateHours: number
  progress: number // 0-100
  createdDate: string // YYYY-MM-DD
  completedDate: string | null
}

/** 校验项目，返回错误信息；null 表示通过 */
export function validateProject(project: Project): string | null {
  if (!project.name.trim()) return '先填一下项目名称吧'
  if (!project.startDate || !project.endDate) return '请选择起始和结束日期'
  if (project.endDate <= project.startDate) return '结束日期要晚于起始日期'
  return null
}

/** 项目总天数（含首尾） */
export function projectDays(project: Project): number {
  return (
    differenceInCalendarDays(
      parseLocalDate(project.endDate),
      parseLocalDate(project.startDate)
    ) + 1
  )
}

/** 第 dayIdx 天（0 起）结束时的计划整体进度（线性 0 → 100） */
export function targetProgressAt(project: Project, dayIdx: number): number {
  const days = projectDays(project)
  if (days <= 0) return 100
  const i = Math.min(Math.max(dayIdx + 1, 0), days)
  return Math.min(100, Math.round((100 * i) / days))
}

/** 项目区间内每天的日期 key 列表 */
export function projectDateKeys(project: Project): string[] {
  const keys: string[] = []
  const days = projectDays(project)
  for (let i = 0; i < days; i++) {
    keys.push(dateKey(addDays(parseLocalDate(project.startDate), i)))
  }
  return keys
}

/** 整体进度：按预估工时加权平均（没有待办时为 0） */
export function overallProgress(todos: ProjectTodo[]): number {
  if (todos.length === 0) return 0
  const totalWeight = todos.reduce(
    (s, t) => s + Math.max(t.estimateHours, 0),
    0
  )
  if (totalWeight <= 0) {
    return Math.round(todos.reduce((s, t) => s + t.progress, 0) / todos.length)
  }
  const weighted = todos.reduce(
    (s, t) => s + t.progress * Math.max(t.estimateHours, 0),
    0
  )
  return Math.round(weighted / totalWeight)
}

/** 任务完成统计 */
export interface TaskStats {
  estimateHours: number
  daysUsed: number
  startedDate: string
  completedDate: string
}

/** 任务完成总结 */
export interface TaskSummary {
  title: string
  estimateHours: number
  startedDate: string
  completedDate: string
  reflection: string
  stats: TaskStats
}

/** 由待办生成统计（要求已完成） */
export function buildTaskStats(todo: ProjectTodo): TaskStats | null {
  if (todo.completedDate == null) return null
  const daysUsed = Math.max(
    1,
    differenceInCalendarDays(
      parseLocalDate(todo.completedDate),
      parseLocalDate(todo.createdDate)
    ) + 1
  )
  return {
    estimateHours: todo.estimateHours,
    daysUsed,
    startedDate: todo.createdDate,
    completedDate: todo.completedDate,
  }
}

/** 把任务总结渲染成 Markdown，用于导出 */
export function taskSummaryToMarkdown(
  s: TaskSummary,
  projectName: string
): string {
  const lines: string[] = [
    `# 任务总结：${s.title}`,
    '',
    `- 所属项目：${projectName}`,
    `- 开始日期：${s.startedDate}`,
    `- 完成日期：${s.completedDate}（用了 ${s.stats.daysUsed} 天）`,
    `- 预估工时：${s.stats.estimateHours} 小时`,
  ]
  if (s.reflection.trim()) {
    lines.push('', '## 总结', '', s.reflection.trim())
  }
  return lines.join('\n') + '\n'
}
