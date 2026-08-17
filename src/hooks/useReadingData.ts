import { useCallback, useEffect, useState } from 'react'
import type { ReadingPlan, ReadingSummary, SummaryStats } from '@/lib/reading'
import { supabase } from '@/lib/supabase'

interface ReadingPlanRow {
  book_name: string
  purpose: string | null
  questions: unknown
  start_date: string
  end_date: string
  total_pages: number
}

interface ReadingSummaryRow {
  id: number
  book_name: string
  purpose: string | null
  questions: unknown
  answers: unknown
  reflection: string | null
  start_date: string
  end_date: string
  finished_date: string
  total_pages: number
  stats: unknown
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((q): q is string => typeof q === 'string') : []

function rowToPlan(row: ReadingPlanRow): ReadingPlan {
  return {
    bookName: row.book_name,
    purpose: row.purpose ?? '',
    questions: asStringArray(row.questions),
    startDate: row.start_date,
    endDate: row.end_date,
    totalPages: row.total_pages,
  }
}

export interface StoredSummary extends ReadingSummary {
  id: number
}

function rowToSummary(row: ReadingSummaryRow): StoredSummary {
  return {
    id: row.id,
    bookName: row.book_name,
    purpose: row.purpose ?? '',
    questions: asStringArray(row.questions),
    answers: asStringArray(row.answers),
    reflection: row.reflection ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
    finishedDate: row.finished_date,
    totalPages: row.total_pages,
    stats: (row.stats ?? {}) as SummaryStats,
  }
}

/** 读书计划与每日进度，登录后从 Supabase 同步 */
export function useReadingData(userId: string | null) {
  const [plan, setPlan] = useState<ReadingPlan | null>(null)
  const [entries, setEntries] = useState<Record<string, number>>({})
  const [summaries, setSummaries] = useState<StoredSummary[]>([])
  const [loading, setLoading] = useState(userId != null)

  // userId 变化（登录/登出）时在渲染期重置本地状态，避免在 effect 里同步 setState
  const [prevUserId, setPrevUserId] = useState(userId)
  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setPlan(null)
    setEntries({})
    setSummaries([])
    setLoading(userId != null)
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const [planRes, entriesRes, summariesRes] = await Promise.all([
        supabase
          .from('reading_plans')
          .select(
            'book_name, purpose, questions, start_date, end_date, total_pages'
          )
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('reading_entries')
          .select('date, page')
          .eq('user_id', userId),
        supabase
          .from('reading_summaries')
          .select(
            'id, book_name, purpose, questions, answers, reflection, start_date, end_date, finished_date, total_pages, stats'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      const map: Record<string, number> = {}
      for (const row of entriesRes.data ?? []) map[row.date] = row.page
      setPlan(planRes.data ? rowToPlan(planRes.data) : null)
      setEntries(map)
      setSummaries((summariesRes.data ?? []).map(rowToSummary))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const savePlan = useCallback(
    (next: ReadingPlan) => {
      setPlan(next)
      if (!userId) return
      supabase
        .from('reading_plans')
        .upsert(
          {
            user_id: userId,
            book_name: next.bookName,
            purpose: next.purpose,
            questions: next.questions,
            start_date: next.startDate,
            end_date: next.endDate,
            total_pages: next.totalPages,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('[sync] 保存读书计划失败:', error.message)
        })
    },
    [userId]
  )

  const setPage = useCallback(
    (key: string, page: number) => {
      setEntries(prev => ({ ...prev, [key]: page }))
      if (!userId) return
      supabase
        .from('reading_entries')
        .upsert(
          { user_id: userId, date: key, page },
          { onConflict: 'user_id,date' }
        )
        .then(({ error }) => {
          if (error) console.error('[sync] 保存阅读进度失败:', error.message)
        })
    },
    [userId]
  )

  const removePage = useCallback(
    (key: string) => {
      setEntries(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      if (!userId) return
      supabase
        .from('reading_entries')
        .delete()
        .eq('user_id', userId)
        .eq('date', key)
        .then(({ error }) => {
          if (error) console.error('[sync] 删除阅读进度失败:', error.message)
        })
    },
    [userId]
  )

  const saveSummary = useCallback(
    (summary: ReadingSummary) => {
      if (!userId) return
      supabase
        .from('reading_summaries')
        .insert({
          user_id: userId,
          book_name: summary.bookName,
          purpose: summary.purpose,
          questions: summary.questions,
          answers: summary.answers,
          reflection: summary.reflection,
          start_date: summary.startDate,
          end_date: summary.endDate,
          finished_date: summary.finishedDate,
          total_pages: summary.totalPages,
          stats: summary.stats,
        })
        .select('id')
        .single()
        .then(({ data: row, error }) => {
          if (error) {
            console.error('[sync] 保存读书总结失败:', error.message)
            return
          }
          setSummaries(prev => [{ ...summary, id: row.id }, ...prev])
        })
    },
    [userId]
  )

  return {
    plan,
    entries,
    summaries,
    loading,
    savePlan,
    setPage,
    removePage,
    saveSummary,
  }
}
