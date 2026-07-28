import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { Flame, Flower2, Footprints } from 'lucide-react'
import type { PlanData } from '@/hooks/usePlanData'
import {
  EMPTY_CHECKIN,
  PLAN_END,
  PLAN_START,
  dateKey,
  isFutureDay,
  weeklyNote,
} from '@/lib/plan'
import type { DayCheckin } from '@/lib/plan'

const LEVEL_COLORS = [
  '#F3EFE8', // 0/3
  '#F6DFC9', // 1/3
  '#EFC49F', // 2/3
  '#8FA383', // 3/3
]

interface Cell {
  key: string
  day: number
  level: number | null // null = 未来
  date: Date
  detail: string
}

export default function Footprint({
  today,
  data,
}: {
  today: Date
  data: PlanData
}) {
  const todayKey = dateKey(today)

  const { weeks, streak, totalChecks, fullDays } = useMemo(() => {
    const total = differenceInCalendarDays(PLAN_END, PLAN_START)
    const firstWeekday = PLAN_START.getDay() // 首行前面的空格数（周日开头）

    const getLevel = (key: string): number => {
      const c: DayCheckin = { ...EMPTY_CHECKIN, ...(data.checkins[key] ?? {}) }
      return (c.exercise ? 1 : 0) + (c.snackFree ? 1 : 0) + (c.weighed ? 1 : 0)
    }

    const cells: Cell[] = []
    let checks = 0
    let full = 0
    for (let i = 0; i <= total; i++) {
      const d = addDays(PLAN_START, i)
      const key = dateKey(d)
      if (isFutureDay(d, today)) {
        cells.push({ key, day: d.getDate(), level: null, date: d, detail: '还没到这一天' })
        continue
      }
      const level = getLevel(key)
      checks += level
      if (level === 3) full += 1
      const c: DayCheckin = { ...EMPTY_CHECKIN, ...(data.checkins[key] ?? {}) }
      const parts = [
        c.exercise ? '运动 ✓' : '运动 —',
        c.snackFree ? '零食控制 ✓' : '零食控制 —',
        c.weighed ? '称重 ✓' : '称重 —',
      ]
      cells.push({ key, day: d.getDate(), level, date: d, detail: parts.join(' · ') })
    }

    // streak：从今天（或昨天，若今天还没打完）往前连续全完成
    let streakCount = 0
    let cursor = today
    if (getLevel(dateKey(cursor)) < 3) cursor = addDays(cursor, -1)
    while (cursor >= PLAN_START && getLevel(dateKey(cursor)) === 3) {
      streakCount += 1
      cursor = addDays(cursor, -1)
    }

    // 按周分行（每行 7 列，周日开头）
    const padded: (Cell | null)[] = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...cells,
    ]
    while (padded.length % 7 !== 0) padded.push(null)
    const weekRows: (Cell | null)[][] = []
    for (let i = 0; i < padded.length; i += 7) weekRows.push(padded.slice(i, i + 7))

    return { weeks: weekRows, streak: streakCount, totalChecks: checks, fullDays: full }
  }, [data.checkins, today])

  const elapsedDays = Math.max(
    0,
    differenceInCalendarDays(today, PLAN_START) + 1,
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-5 py-6"
    >
      <div className="mb-5">
        <h2 className="font-serif-sc text-2xl font-bold text-[#5C544B]">坚持足迹</h2>
        <p className="mt-1 text-sm text-[#9B9084]">
          留下的每一步，都是足迹。
        </p>
      </div>

      {/* 统计行 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="shadow-softer rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-4 text-center">
          <Flame className="mx-auto mb-1 h-5 w-5 text-[#E8967A]" />
          <p className="font-serif-sc text-2xl font-bold text-[#5C544B]">{streak}</p>
          <p className="text-xs text-[#9B9084]">连续全完成天数</p>
        </div>
        <div className="shadow-softer rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-4 text-center">
          <Footprints className="mx-auto mb-1 h-5 w-5 text-[#8FA383]" />
          <p className="font-serif-sc text-2xl font-bold text-[#5C544B]">{totalChecks}</p>
          <p className="text-xs text-[#9B9084]">总完成次数</p>
        </div>
        <div className="shadow-softer rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-4 text-center">
          <Flower2 className="mx-auto mb-1 h-5 w-5 text-[#F2B8A0]" />
          <p className="font-serif-sc text-2xl font-bold text-[#5C544B]">{fullDays}</p>
          <p className="text-xs text-[#9B9084]">满分的日子</p>
        </div>
      </div>

      {/* 热力网格 */}
      <div className="shadow-soft rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-5 sm:px-6">
        <div className="mb-3 flex items-center justify-between text-xs text-[#B4ABA0]">
          <span>07-28 → 09-15 · 已陪伴 {Math.min(elapsedDays, 50)} 天</span>
          <span className="flex items-center gap-1.5">
            少
            {LEVEL_COLORS.map((c) => (
              <span
                key={c}
                className="inline-block h-3 w-3 rounded-md border border-[#EFE6DA]"
                style={{ backgroundColor: c }}
              />
            ))}
            全完成
          </span>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[10px] text-[#C9BFB2]">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="space-y-1.5">
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {row.map((cell, ci) =>
                cell == null ? (
                  <div key={ci} className="aspect-square" />
                ) : (
                  <div
                    key={cell.key}
                    title={`${cell.key}\n${cell.detail}`}
                    className="relative flex aspect-square items-center justify-center rounded-md border transition-transform hover:scale-110"
                    style={{
                      backgroundColor:
                        cell.level == null ? '#EFEAE2' : LEVEL_COLORS[cell.level],
                      borderColor:
                        cell.key === todayKey
                          ? '#E8967A'
                          : cell.level == null
                            ? '#E9E3D9'
                            : '#EFE6DA',
                      borderWidth: cell.key === todayKey ? 2 : 1,
                    }}
                  >
                    <span
                      className="text-[10px] leading-none"
                      style={{
                        color:
                          cell.level === 3
                            ? '#FFFFFF'
                            : cell.level == null
                              ? '#C9C2B6'
                              : '#9B9084',
                      }}
                    >
                      {cell.day}
                    </span>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 每周小结 */}
      <div className="mt-4 rounded-3xl border border-[#F0DDC9] bg-[#FDF6EC] px-6 py-4">
        <p className="text-xs tracking-widest text-[#C4A88A]">本周小结</p>
        <p className="font-serif-sc mt-1.5 text-base font-medium text-[#5C544B]">
          {weeklyNote(today)}
        </p>
      </div>
    </motion.section>
  )
}
