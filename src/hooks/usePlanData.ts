import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CheckKey, DayCheckin } from '@/lib/plan'
import { EMPTY_CHECKIN, GOAL_WEIGHT, PLAN_END, PLAN_START, dateKey } from '@/lib/plan'
import type { PhaseDraft, PhaseSummary, WeightPhase } from '@/lib/phase'
import {
  DEFAULT_PHASE_NAME,
  PHASE_SETUP_HINT_FALLBACK,
  archivedEndDate,
  buildPhaseSummary,
  defaultPhaseDraft,
  draftToPhase,
  legacyPhaseFallback,
  phaseName,
  validatePhaseDraft,
} from '@/lib/phase'
import { supabase } from '@/lib/supabase'

export interface PlanData {
  startWeight: number | null
  weights: Record<string, number>
  checkins: Record<string, Partial<DayCheckin>>
}

/** 升级脚本还没执行时，给用户的提示 */
export const PHASE_SETUP_HINT = PHASE_SETUP_HINT_FALLBACK

const LEGACY_STORAGE_KEY = 'qingying-plan-v1'

const EMPTY_DATA: PlanData = {
  startWeight: null,
  weights: {},
  checkins: {},
}

interface PhaseRow {
  id: number
  name: string
  start_date: string
  end_date: string
  start_weight: number | null
  goal_weight: number
  status: string
  summary: unknown
  created_at: string
  archived_at: string | null
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** 把 jsonb 快照还原成 PhaseSummary；空对象（新建阶段的占位）返回 null */
function asSummary(v: unknown): PhaseSummary | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (Object.keys(o).length === 0) return null
  return {
    endWeight: num(o.endWeight),
    endWeightDate: typeof o.endWeightDate === 'string' ? o.endWeightDate : null,
    lost: num(o.lost),
    goalReached: o.goalReached === true,
    recordedDays: num(o.recordedDays) ?? 0,
    checkinDays: num(o.checkinDays) ?? 0,
    fullDays: num(o.fullDays) ?? 0,
    plannedDays: num(o.plannedDays) ?? 0,
    actualDays: num(o.actualDays) ?? 0,
  }
}

function rowToPhase(row: PhaseRow): WeightPhase {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    startWeight: num(row.start_weight),
    goalWeight: num(row.goal_weight) ?? GOAL_WEIGHT,
    status: row.status === 'archived' ? 'archived' : 'active',
    summary: asSummary(row.summary),
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }
}

/** 表不存在（还没执行升级脚本）时的错误识别 */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const message = error.message ?? ''
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|could not find the table|schema cache/i.test(message)
  )
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
  const [phases, setPhases] = useState<WeightPhase[]>([])
  /** 云端是否已经建好 weight_phases 表 */
  const [phasesReady, setPhasesReady] = useState(true)
  const [phaseSaving, setPhaseSaving] = useState(false)
  const [importPending, setImportPending] = useState(false)

  const userId = session?.user.id ?? null
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)

  // 监听登录状态（含 GitHub OAuth 跳转回来后的会话恢复）
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

  // 登录后拉取云端数据（体重 / 打卡 / 阶段）
  useEffect(() => {
    if (!userId) {
      setData(EMPTY_DATA)
      setPhases([])
      setPhasesReady(true)
      return
    }
    let cancelled = false
    setDataLoading(true)
    ;(async () => {
      const [settingsRes, weightsRes, checkinsRes, phasesRes] = await Promise.all([
        supabase
          .from('plan_settings')
          .select('start_weight')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('weight_entries').select('date, weight').eq('user_id', userId),
        supabase.from('checkins').select('date, item_key, done').eq('user_id', userId),
        supabase
          .from('weight_phases')
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: true }),
      ])
      if (cancelled) return

      const weights: Record<string, number> = {}
      for (const row of weightsRes.data ?? []) weights[row.date] = row.weight
      const checkins: Record<string, Partial<DayCheckin>> = {}
      for (const row of checkinsRes.data ?? []) {
        const day = (checkins[row.date] ??= {})
        ;(day as Record<string, boolean>)[row.item_key] = row.done
      }
      const startWeight = settingsRes.data?.start_weight ?? null

      const tableMissing = isMissingTableError(phasesRes.error)
      let loaded: WeightPhase[] = tableMissing
        ? []
        : ((phasesRes.data ?? []) as PhaseRow[]).map(rowToPhase)

      // 云端表已就绪但一条阶段都没有：自动补一个，老数据沿用原来的计划区间
      if (!tableMissing && loaded.length === 0) {
        const hasHistory =
          startWeight != null ||
          Object.keys(weights).length > 0 ||
          Object.keys(checkins).length > 0
        const seed: PhaseDraft = hasHistory
          ? {
              name: DEFAULT_PHASE_NAME,
              startDate: dateKey(PLAN_START),
              endDate: dateKey(PLAN_END),
              startWeight,
              goalWeight: GOAL_WEIGHT,
            }
          : defaultPhaseDraft(today, null, null, DEFAULT_PHASE_NAME)
        const { data: row, error } = await supabase
          .from('weight_phases')
          .insert({
            user_id: userId,
            name: seed.name,
            start_date: seed.startDate,
            end_date: seed.endDate,
            start_weight: seed.startWeight,
            goal_weight: seed.goalWeight,
            status: 'active',
            summary: {},
          })
          .select('*')
          .single()
        if (cancelled) return
        if (error) console.error('[sync] 初始化阶段失败:', error.message)
        if (!error && row) loaded = [rowToPhase(row as PhaseRow)]
      }

      if (cancelled) return
      setData({ startWeight, weights, checkins })
      setPhases(loaded)
      setPhasesReady(!tableMissing)
      setDataLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, today])

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

  const activePhase = useMemo(
    () => phases.find((p) => p.status === 'active') ?? null,
    [phases],
  )

  const archivedPhases = useMemo(
    () =>
      phases
        .filter((p) => p.status === 'archived')
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [phases],
  )

  /** 最近一次（<= 今天）的体重记录，用于新阶段的默认起点 */
  const currentWeight = useMemo(() => {
    const keys = Object.keys(data.weights)
      .filter((k) => k <= todayKey)
      .sort()
    const last = keys[keys.length - 1]
    return last ? data.weights[last] : null
  }, [data.weights, todayKey])

  /** 阶段表不可用（未执行升级脚本）时为 true */
  const needsPhaseSetup = !phasesReady
  const needsNewPhase = phasesReady && activePhase == null

  /** 当前展示的阶段：进行中的 → 兜底 → 待创建草案 */
  const phase = useMemo<WeightPhase>(() => {
    if (activePhase) return activePhase
    if (!phasesReady) return legacyPhaseFallback(data.startWeight)
    const latest = phases.length > 0 ? phases[phases.length - 1] : null
    return draftToPhase(
      defaultPhaseDraft(today, latest, currentWeight, phaseName(phases.length + 1)),
    )
  }, [activePhase, phasesReady, phases, today, currentWeight, data.startWeight])

  /** 补录 / 打卡能回溯到的最早日期：所有阶段里最早的那天 */
  const earliestDate = useMemo(() => {
    const starts = phases.map((p) => p.startDate)
    if (starts.length === 0) return phase.startDate
    return starts.reduce((min, s) => (s < min ? s : min), starts[0])
  }, [phases, phase.startDate])

  const writeStartWeight = useCallback(
    (w: number, target: WeightPhase | null, ready: boolean) => {
      if (!userId) return
      if (ready && target && target.id !== 0) {
        supabase
          .from('weight_phases')
          .update({ start_weight: w })
          .eq('id', target.id)
          .eq('user_id', userId)
          .then(({ error }) => {
            if (error) console.error('[sync] 保存起始体重失败:', error.message)
          })
        return
      }
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

  /** 保存当前阶段的起始体重（会自动同步到所处的阶段） */
  const setStartWeight = useCallback(
    (w: number) => {
      setData((prev) => ({ ...prev, startWeight: w }))
      if (activePhase) {
        setPhases((prev) =>
          prev.map((p) => (p.id === activePhase.id ? { ...p, startWeight: w } : p)),
        )
        writeStartWeight(w, activePhase, phasesReady)
        return
      }
      // 兜底模式（没有阶段表）仍然写回 plan_settings；
      // 已经有阶段表但还没新建阶段时，等新建阶段一并写入
      if (!phasesReady) writeStartWeight(w, null, false)
    },
    [activePhase, phasesReady, writeStartWeight],
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

  /**
   * 新建阶段：先把当前阶段归档（冻结一份成果快照），再创建新阶段。
   * 返回错误信息，null 表示成功。
   */
  const createPhase = useCallback(
    async (draft: PhaseDraft): Promise<string | null> => {
      if (!userId) return '请先登录，再新建阶段'
      if (!phasesReady) return PHASE_SETUP_HINT
      const invalid = validatePhaseDraft(draft, activePhase)
      if (invalid) return invalid

      setPhaseSaving(true)
      try {
        // 1. 归档当前阶段：先落库（也顺带解除「每人一个进行中阶段」的唯一约束）
        if (activePhase) {
          const archived: WeightPhase = {
            ...activePhase,
            endDate: archivedEndDate(activePhase, draft.startDate),
            status: 'archived',
            archivedAt: new Date().toISOString(),
            summary: null,
          }
          archived.summary = buildPhaseSummary(archived, data.weights, data.checkins)
          const { error } = await supabase
            .from('weight_phases')
            .update({
              end_date: archived.endDate,
              status: 'archived',
              summary: archived.summary,
              archived_at: archived.archivedAt,
            })
            .eq('id', activePhase.id)
            .eq('user_id', userId)
          if (error) return `归档当前阶段失败：${error.message}`
          setPhases((prev) => prev.map((p) => (p.id === activePhase.id ? archived : p)))
        }

        // 2. 创建新阶段
        const { data: row, error } = await supabase
          .from('weight_phases')
          .insert({
            user_id: userId,
            name: draft.name.trim(),
            start_date: draft.startDate,
            end_date: draft.endDate,
            start_weight: draft.startWeight,
            goal_weight: draft.goalWeight,
            status: 'active',
            summary: {},
          })
          .select('*')
          .single()
        if (error) return `新建阶段失败：${error.message}`
        setPhases((prev) => [...prev, rowToPhase(row as PhaseRow)])
        return null
      } finally {
        setPhaseSaving(false)
      }
    },
    [activePhase, data.checkins, data.weights, phasesReady, userId],
  )

  /** 编辑当前阶段（名称 / 日期 / 起始体重 / 目标体重） */
  const updateActivePhase = useCallback(
    async (draft: PhaseDraft): Promise<string | null> => {
      const target = activePhase
      if (!userId) return '请先登录'
      if (!phasesReady) return PHASE_SETUP_HINT
      if (!target || target.id === 0) return '当前没有可以编辑的阶段'
      const prevArchived =
        phases
          .filter((p) => p.status === 'archived')
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
          .pop() ?? null
      const invalid = validatePhaseDraft(
        { ...draft, name: draft.name || target.name },
        prevArchived,
      )
      if (invalid) return invalid

      const next: WeightPhase = {
        ...target,
        name: draft.name.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        startWeight: draft.startWeight,
        goalWeight: draft.goalWeight,
      }
      setPhaseSaving(true)
      try {
        const { error } = await supabase
          .from('weight_phases')
          .update({
            name: next.name,
            start_date: next.startDate,
            end_date: next.endDate,
            start_weight: next.startWeight,
            goal_weight: next.goalWeight,
          })
          .eq('id', target.id)
          .eq('user_id', userId)
        if (error) return `保存失败：${error.message}`
        setPhases((prev) => prev.map((p) => (p.id === target.id ? next : p)))
        setData((prev) => ({ ...prev, startWeight: next.startWeight }))
        return null
      } finally {
        setPhaseSaving(false)
      }
    },
    [activePhase, phases, phasesReady, userId],
  )

  const exportJSON = useCallback(() => {
    const payload = {
      app: '轻盈计划',
      exportedAt: new Date().toISOString(),
      goalWeight: GOAL_WEIGHT,
      planRange: ['2026-07-28', '2026-09-15'],
      ...data,
      phases,
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
  }, [data, phases])

  // 旧版本机数据迁移
  const legacyData = useMemo(() => loadLegacy(), [])
  const [dismissedLegacy, setDismissedLegacy] = useState(false)
  const hasLegacyData = legacyData != null && !dismissedLegacy

  const importLegacy = useCallback(() => {
    if (!legacyData || !userId) return
    setImportPending(true)
    ;(async () => {
      if (legacyData.startWeight != null) {
        if (phasesReady && activePhase && activePhase.id !== 0) {
          const { error } = await supabase
            .from('weight_phases')
            .update({ start_weight: legacyData.startWeight })
            .eq('id', activePhase.id)
            .eq('user_id', userId)
          if (error) console.error('[sync] 迁移起始体重失败:', error.message)
        } else {
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
  }, [legacyData, userId, phasesReady, activePhase])

  const dismissLegacy = useCallback(() => setDismissedLegacy(true), [])

  return {
    data,
    setStartWeight,
    setWeight,
    removeWeight,
    toggleCheck,
    exportJSON,
    // 阶段
    phase,
    phases,
    activePhase,
    archivedPhases,
    phasesReady,
    needsPhaseSetup,
    needsNewPhase,
    phaseSaving,
    createPhase,
    updateActivePhase,
    currentWeight,
    earliestDate,
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
