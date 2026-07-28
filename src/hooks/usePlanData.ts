import { useCallback, useState } from 'react'
import type { CheckKey, DayCheckin } from '@/lib/plan'
import { EMPTY_CHECKIN } from '@/lib/plan'

export interface PlanData {
  startWeight: number | null
  weights: Record<string, number>
  checkins: Record<string, Partial<DayCheckin>>
}

const STORAGE_KEY = 'qingying-plan-v1'

const EMPTY_DATA: PlanData = {
  startWeight: null,
  weights: {},
  checkins: {},
}

function load(): PlanData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DATA
    const parsed = JSON.parse(raw) as Partial<PlanData>
    return {
      startWeight:
        typeof parsed.startWeight === 'number' ? parsed.startWeight : null,
      weights: parsed.weights ?? {},
      checkins: parsed.checkins ?? {},
    }
  } catch {
    return EMPTY_DATA
  }
}

function save(data: PlanData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 存储不可用时静默失败
  }
}

export function usePlanData() {
  const [data, setData] = useState<PlanData>(load)

  const update = useCallback((fn: (prev: PlanData) => PlanData) => {
    setData((prev) => {
      const next = fn(prev)
      save(next)
      return next
    })
  }, [])

  const setStartWeight = useCallback(
    (w: number) => update((prev) => ({ ...prev, startWeight: w })),
    [update],
  )

  const setWeight = useCallback(
    (key: string, w: number) =>
      update((prev) => ({ ...prev, weights: { ...prev.weights, [key]: w } })),
    [update],
  )

  const removeWeight = useCallback(
    (key: string) =>
      update((prev) => {
        const weights = { ...prev.weights }
        delete weights[key]
        return { ...prev, weights }
      }),
    [update],
  )

  const toggleCheck = useCallback(
    (key: string, item: CheckKey): boolean => {
      const current: DayCheckin = {
        ...EMPTY_CHECKIN,
        ...(data.checkins[key] ?? {}),
      }
      const newValue = !current[item]
      update((prev) => {
        const day: DayCheckin = { ...EMPTY_CHECKIN, ...(prev.checkins[key] ?? {}) }
        return {
          ...prev,
          checkins: { ...prev.checkins, [key]: { ...day, [item]: newValue } },
        }
      })
      return newValue
    },
    [update, data.checkins],
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

  return {
    data,
    setStartWeight,
    setWeight,
    removeWeight,
    toggleCheck,
    exportJSON,
  }
}
