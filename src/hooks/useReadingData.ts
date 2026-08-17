import { useCallback, useEffect, useState } from 'react'
import type { ReadingPlan } from '@/lib/reading'
import { supabase } from '@/lib/supabase'

interface ReadingPlanRow {
  book_name: string
  purpose: string | null
  questions: unknown
  start_date: string
  end_date: string
  total_pages: number
}

function rowToPlan(row: ReadingPlanRow): ReadingPlan {
  return {
    bookName: row.book_name,
    purpose: row.purpose ?? '',
    questions: Array.isArray(row.questions)
      ? row.questions.filter((q): q is string => typeof q === 'string')
      : [],
    startDate: row.start_date,
    endDate: row.end_date,
    totalPages: row.total_pages,
  }
}

/** 读书计划与每日进度，登录后从 Supabase 同步 */
export function useReadingData(userId: string | null) {
  const [plan, setPlan] = useState<ReadingPlan | null>(null)
  const [entries, setEntries] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(userId != null)

  // userId 变化（登录/登出）时在渲染期重置本地状态，避免在 effect 里同步 setState
  const [prevUserId, setPrevUserId] = useState(userId)
  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setPlan(null)
    setEntries({})
    setLoading(userId != null)
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const [planRes, entriesRes] = await Promise.all([
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
      ])
      if (cancelled) return
      const map: Record<string, number> = {}
      for (const row of entriesRes.data ?? []) map[row.date] = row.page
      setPlan(planRes.data ? rowToPlan(planRes.data) : null)
      setEntries(map)
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

  return { plan, entries, loading, savePlan, setPage, removePage }
}
