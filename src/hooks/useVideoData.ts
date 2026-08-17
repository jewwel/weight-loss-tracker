import { useCallback, useEffect, useState } from 'react'
import type {
  Project,
  ProjectTodo,
  TaskStats,
  TaskSummary,
} from '@/lib/project'
import { overallProgress } from '@/lib/project'
import { dateKey } from '@/lib/plan'
import { supabase } from '@/lib/supabase'

// 英语视频学习复用项目管理的通用类型与计算逻辑（src/lib/project.ts），
// 只是落到 video_* 一组表里。

interface TodoRow {
  id: number
  title: string
  estimate_hours: number
  progress: number
  created_at: string
  completed_at: string | null
}

interface TaskSummaryRow {
  id: number
  todo_id: number | null
  title: string
  estimate_hours: number
  started_date: string
  completed_date: string
  reflection: string | null
  stats: unknown
}

export interface StoredTaskSummary extends TaskSummary {
  id: number
  todoId: number | null
}

const rowToTodo = (row: TodoRow): ProjectTodo => ({
  id: row.id,
  title: row.title,
  estimateHours: row.estimate_hours,
  progress: row.progress,
  createdDate: row.created_at.slice(0, 10),
  completedDate: row.completed_at,
})

const rowToSummary = (row: TaskSummaryRow): StoredTaskSummary => ({
  id: row.id,
  todoId: row.todo_id,
  title: row.title,
  estimateHours: row.estimate_hours,
  startedDate: row.started_date,
  completedDate: row.completed_date,
  reflection: row.reflection ?? '',
  stats: (row.stats ?? {}) as TaskStats,
})

/** 英语视频学习数据，登录后从 Supabase 同步 */
export function useVideoData(userId: string | null) {
  const [plan, setPlan] = useState<Project | null>(null)
  const [todos, setTodos] = useState<ProjectTodo[]>([])
  const [logs, setLogs] = useState<Record<string, number>>({})
  const [taskSummaries, setTaskSummaries] = useState<StoredTaskSummary[]>([])
  const [loading, setLoading] = useState(userId != null)

  // userId 变化（登录/登出）时在渲染期重置本地状态，避免在 effect 里同步 setState
  const [prevUserId, setPrevUserId] = useState(userId)
  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setPlan(null)
    setTodos([])
    setLogs({})
    setTaskSummaries([])
    setLoading(userId != null)
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const [planRes, todosRes, logsRes, summariesRes] = await Promise.all([
        supabase
          .from('video_plans')
          .select('name, goal, start_date, end_date')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('video_todos')
          .select(
            'id, title, estimate_hours, progress, created_at, completed_at'
          )
          .eq('user_id', userId)
          .order('id'),
        supabase
          .from('video_progress_logs')
          .select('date, progress')
          .eq('user_id', userId),
        supabase
          .from('video_task_summaries')
          .select(
            'id, todo_id, title, estimate_hours, started_date, completed_date, reflection, stats'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setPlan(
        planRes.data
          ? {
              name: planRes.data.name,
              goal: planRes.data.goal ?? '',
              startDate: planRes.data.start_date,
              endDate: planRes.data.end_date,
            }
          : null
      )
      setTodos((todosRes.data ?? []).map(rowToTodo))
      const logMap: Record<string, number> = {}
      for (const row of logsRes.data ?? []) logMap[row.date] = row.progress
      setLogs(logMap)
      setTaskSummaries((summariesRes.data ?? []).map(rowToSummary))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const savePlan = useCallback(
    (next: Project) => {
      setPlan(next)
      if (!userId) return
      supabase
        .from('video_plans')
        .upsert(
          {
            user_id: userId,
            name: next.name,
            goal: next.goal,
            start_date: next.startDate,
            end_date: next.endDate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error)
            console.error('[sync] 保存视频学习计划失败:', error.message)
        })
    },
    [userId]
  )

  /** 记录当天的整体进度快照（本地 + 云端） */
  const logOverall = useCallback(
    (nextTodos: ProjectTodo[]) => {
      if (!userId || nextTodos.length === 0) return
      const key = dateKey(new Date())
      const overall = overallProgress(nextTodos)
      setLogs(prev => ({ ...prev, [key]: overall }))
      supabase
        .from('video_progress_logs')
        .upsert(
          { user_id: userId, date: key, progress: overall },
          { onConflict: 'user_id,date' }
        )
        .then(({ error }) => {
          if (error)
            console.error('[sync] 保存视频学习进度快照失败:', error.message)
        })
    },
    [userId]
  )

  const addTodo = useCallback(
    (title: string, estimateHours: number) => {
      if (!userId) return
      supabase
        .from('video_todos')
        .insert({ user_id: userId, title, estimate_hours: estimateHours })
        .select('id, title, estimate_hours, progress, created_at, completed_at')
        .single()
        .then(({ data: row, error }) => {
          if (error) {
            console.error('[sync] 添加学习任务失败:', error.message)
            return
          }
          setTodos(prev => {
            const next = [...prev, rowToTodo(row)]
            logOverall(next)
            return next
          })
        })
    },
    [userId, logOverall]
  )

  const setTodoProgress = useCallback(
    (todo: ProjectTodo, progress: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(progress)))
      const completedDate =
        clamped >= 100 ? (todo.completedDate ?? dateKey(new Date())) : null
      setTodos(prev => {
        const next = prev.map(t =>
          t.id === todo.id ? { ...t, progress: clamped, completedDate } : t
        )
        logOverall(next)
        return next
      })
      if (!userId) return
      supabase
        .from('video_todos')
        .update({ progress: clamped, completed_at: completedDate })
        .eq('id', todo.id)
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error)
            console.error('[sync] 更新学习任务进度失败:', error.message)
        })
    },
    [userId, logOverall]
  )

  const removeTodo = useCallback(
    (id: number) => {
      setTodos(prev => {
        const next = prev.filter(t => t.id !== id)
        logOverall(next)
        return next
      })
      if (!userId) return
      supabase
        .from('video_todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) console.error('[sync] 删除学习任务失败:', error.message)
        })
    },
    [userId, logOverall]
  )

  const saveTaskSummary = useCallback(
    (todoId: number, summary: TaskSummary) => {
      if (!userId) return
      supabase
        .from('video_task_summaries')
        .insert({
          user_id: userId,
          todo_id: todoId,
          title: summary.title,
          estimate_hours: summary.estimateHours,
          started_date: summary.startedDate,
          completed_date: summary.completedDate,
          reflection: summary.reflection,
          stats: summary.stats,
        })
        .select('id')
        .single()
        .then(({ data: row, error }) => {
          if (error) {
            console.error('[sync] 保存学习任务总结失败:', error.message)
            return
          }
          setTaskSummaries(prev => [
            { ...summary, id: row.id, todoId },
            ...prev,
          ])
        })
    },
    [userId]
  )

  return {
    plan,
    todos,
    logs,
    taskSummaries,
    loading,
    savePlan,
    addTodo,
    setTodoProgress,
    removeTodo,
    saveTaskSummary,
  }
}
