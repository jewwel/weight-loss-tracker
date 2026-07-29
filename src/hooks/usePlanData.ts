import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CheckKey, DayCheckin } from '@/lib/plan'
import { EMPTY_CHECKIN } from '@/lib/plan'
import { supabase } from '@/lib/supabase'

export interface PlanData {
  startWeight: number | null
  weights: Record<string, number>
  checkins: Record<string, Partial<DayCheckin>>
}

const LEGACY_STORAGE_KEY = 'qingying-plan-v1'

const EMPTY_DATA: PlanData = {
  startWeight: null,
  weights: {},
  checkins: {},
}

/** 读取旧版（localStorage 时代）的本机数据，用于一次性迁移到云端 */
function loadLegacy(): PlanData | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlanData>
    const hasContent =
      typeof parsed.startWeight === 'number' ||
      Object.keys(parsed.weights ?? {}).length > 0 ||
      Object.keys(parsed.checkins ?? {}).length > 0
    if (!hasContent) return null
    return {
      startWeight:
        typeof parsed.startWeight === 'number' ? parsed.startWeight : null,
      weights: parsed.weights ?? {},
      checkins: parsed.checkins ?? {},
    }
  } catch {
    return null
  }
}

export function usePlanData() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [data, setData] = useState<PlanData>(EMPTY_DATA)
  const [importPending, setImportPending] = useState(false)

  const userId = session?.user.id ?? null

  // 监听登录状态（含 Google OAuth 跳转回来后的会话恢复）
  useEffect(() => {
    supabase.auth.getSession().then(({ data: s }) => {
      setSession(s.session)
      setAuthLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // 登录后拉取云端数据
  useEffect(() => {
    if (!userId) {
      setData(EMPTY_DATA)
      return
    }
    let cancelled = false
    setDataLoading(true)
    ;(async () => {
      const [settingsRes, weightsRes, checkinsRes] = await Promise.all([
        supabase
          .from('plan_settings')
          .select('start_weight')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('weight_entries').select('date, weight').eq('user_id', userId),
        supabase.from('checkins').select('date, item_key, done').eq('user_id', userId),
      ])
      if (cancelled) return
      const weights: Record<string, number> = {}
      for (const row of weightsRes.data ?? []) weights[row.date] = row.weight
      const checkins: Record<string, Partial<DayCheckin>> = {}
      for (const row of checkinsRes.data ?? []) {
        const day = (checkins[row.date] ??= {})
        ;(day as Record<string, boolean>)[row.item_key] = row.done
      }
      setData({
        startWeight: settingsRes.data?.start_weight ?? null,
        weights,
        checkins,
      })
      setDataLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const login = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
  }, [])

  const logout = useCallback(() => {
    supabase.auth.signOut()
  }, [])

  const setStartWeight = useCallback(
    (w: number) => {
      setData((prev) => ({ ...prev, startWeight: w }))
      if (!userId) return
      supabase
        .from('plan_settings')
        .upsert(
          { user_id: userId, start_weight: w, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) console.error('[sync] 保存起始体重失败:', error.message)
        })
    },
    [userId],
  )

  const setWeight = useCallback(
    (key: string, w: number) => {
      setData((prev) => ({ ...prev, weights: { ...prev.weights, [key]: w } }))
      if (!userId) return
      supabase
        .from('weight_entries')
        .upsert(
          { user_id: userId, date: key, weight: w },
          { onConflict: 'user_id,date' },
        )
        .then(({ error }) => {
          if (error) console.error('[sync] 保存体重失败:', error.message)
        })
    },
    [userId],
  )

  const removeWeight = useCallback(
    (key: string) => {
      setData((prev) => {
        const weights = { ...prev.weights }
        delete weights[key]
        return { ...prev, weights }
      })
      if (!userId) return
      supabase
        .from('weight_entries')
        .delete()
        .eq('user_id', userId)
        .eq('date', key)
        .then(({ error }) => {
          if (error) console.error('[sync] 删除体重失败:', error.message)
        })
    },
    [userId],
  )

  const toggleCheck = useCallback(
    (key: string, item: CheckKey): boolean => {
      const current: DayCheckin = {
        ...EMPTY_CHECKIN,
        ...(data.checkins[key] ?? {}),
      }
      const newValue = !current[item]
      setData((prev) => {
        const day: DayCheckin = { ...EMPTY_CHECKIN, ...(prev.checkins[key] ?? {}) }
        return {
          ...prev,
          checkins: { ...prev.checkins, [key]: { ...day, [item]: newValue } },
        }
      })
      if (userId) {
        supabase
          .from('checkins')
          .upsert(
            { user_id: userId, date: key, item_key: item, done: newValue },
            { onConflict: 'user_id,date,item_key' },
          )
          .then(({ error }) => {
            if (error) console.error('[sync] 保存打卡失败:', error.message)
          })
      }
      return newValue
    },
    [userId, data.checkins],
  )

  const exportJSON = useCallback(() => {
    const payload = {
      app: '轻盈计划',
      exportedAt: new Date().toISOString(),
      goalWeight: 65,
      planRange: ['2026-07-28', '2026-09-15'],
      ...data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    a.href = url
    a.download = `轻盈计划数据-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  // 旧版本机数据迁移
  const legacyData = useMemo(() => loadLegacy(), [])
  const [dismissedLegacy, setDismissedLegacy] = useState(false)
  const hasLegacyData = legacyData != null && !dismissedLegacy

  const importLegacy = useCallback(() => {
    if (!legacyData || !userId) return
    setImportPending(true)
    ;(async () => {
      if (legacyData.startWeight != null) {
        const { error } = await supabase.from('plan_settings').upsert(
          {
            user_id: userId,
            start_weight: legacyData.startWeight,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        if (error) console.error('[sync] 迁移起始体重失败:', error.message)
      }
      const weightRows = Object.entries(legacyData.weights).map(([date, weight]) => ({
        user_id: userId,
        date,
        weight,
      }))
      if (weightRows.length > 0) {
        const { error } = await supabase
          .from('weight_entries')
          .upsert(weightRows, { onConflict: 'user_id,date' })
        if (error) console.error('[sync] 迁移体重记录失败:', error.message)
      }
      const checkinRows: { user_id: string; date: string; item_key: string; done: boolean }[] = []
      for (const [date, items] of Object.entries(legacyData.checkins)) {
        for (const [itemKey, done] of Object.entries(items)) {
          if (typeof done === 'boolean') {
            checkinRows.push({ user_id: userId, date, item_key: itemKey, done })
          }
        }
      }
      if (checkinRows.length > 0) {
        const { error } = await supabase
          .from('checkins')
          .upsert(checkinRows, { onConflict: 'user_id,date,item_key' })
        if (error) console.error('[sync] 迁移打卡记录失败:', error.message)
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      setDismissedLegacy(true)
      setImportPending(false)
    })()
  }, [legacyData, userId])

  const dismissLegacy = useCallback(() => setDismissedLegacy(true), [])

  return {
    data,
    setStartWeight,
    setWeight,
    removeWeight,
    toggleCheck,
    exportJSON,
    // 认证与同步状态
    user: session?.user ?? null,
    isAuthenticated: session != null,
    isLoading: authLoading || (session != null && dataLoading),
    login,
    logout,
    // 本机旧数据迁移
    hasLegacyData,
    importLegacy,
    dismissLegacy,
    importPending,
  }
}
