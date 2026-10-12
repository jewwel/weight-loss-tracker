import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ChevronDown, Download, Flag, Sparkles, Target } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { DayCheckin } from '@/lib/plan'
import type { PhaseSummary, WeightPhase } from '@/lib/phase'
import {
  buildPhaseSummary,
  downloadText,
  phaseDateKeys,
  phaseFullRangeLabel,
  phaseTotalDays,
  phaseToMarkdown,
} from '@/lib/phase'

interface Point {
  key: string
  weight: number | null
}

function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: Point }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.weight == null) return null
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] px-3 py-2">
      <p className="text-[11px] text-[#6E6E6E]">{p.key}</p>
      <p className="font-serif-sc text-sm font-semibold text-[#F5F5F5]">
        {p.weight.toFixed(1)} kg
      </p>
    </div>
  )
}

const statText = (summary: PhaseSummary): string => {
  if (summary.lost == null) return '暂无对比'
  if (summary.lost > 0) return `减 ${summary.lost.toFixed(1)} kg`
  if (summary.lost === 0) return '持平'
  return `增 ${Math.abs(summary.lost).toFixed(1)} kg`
}

export default function PhaseHistory({
  phases,
  weights,
  checkins,
  defaultOpen = false,
}: {
  phases: WeightPhase[]
  weights: Record<string, number>
  checkins: Record<string, Partial<DayCheckin>>
  /** 初始是否展开归档列表 */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState<number | null>(null)

  /** 归档阶段优先用冻结快照，老数据没有快照时实时算一份 */
  const cards = useMemo(
    () =>
      phases.map((phase) => ({
        phase,
        summary: phase.summary ?? buildPhaseSummary(phase, weights, checkins),
      })),
    [phases, weights, checkins],
  )

  if (cards.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-5 py-2"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shadow-softer flex w-full items-center justify-between rounded-3xl border border-[#262626] bg-[#141414] px-6 py-4 text-left transition-colors hover:border-[#3A3A3A]"
      >
        <span className="flex items-center gap-2.5">
          <Archive className="h-4 w-4 text-[#A3A3A3]" />
          <span className="font-serif-sc text-base font-semibold text-[#F5F5F5]">
            历史阶段
          </span>
          <span className="rounded-full bg-[#1C1C1C] px-2.5 py-0.5 text-xs text-[#A3A3A3]">
            {cards.length}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-[#6E6E6E]">
          {open ? '收起' : '展开归档记录'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {cards.map(({ phase, summary }) => {
                const isOpen = expanded === phase.id
                const points: Point[] = phaseDateKeys(phase).map((key) => ({
                  key,
                  weight: weights[key] ?? null,
                }))
                const values = points
                  .map((p) => p.weight)
                  .filter((v): v is number => v != null)
                const domain: [number, number] =
                  values.length > 0
                    ? [
                        Math.floor(Math.min(...values, phase.goalWeight) - 1),
                        Math.ceil(Math.max(...values, phase.goalWeight) + 1),
                      ]
                    : [phase.goalWeight - 5, phase.goalWeight + 5]

                return (
                  <div
                    key={phase.id}
                    className="rounded-3xl border border-[#262626] bg-[#141414] px-5 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-serif-sc text-base font-medium text-[#F5F5F5]">
                            {phase.name}
                          </p>
                          <span className="rounded-full bg-[#1C1C1C] px-2.5 py-0.5 text-xs text-[#6E6E6E]">
                            已归档
                          </span>
                          {summary.goalReached && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#1C2A1F] px-2.5 py-0.5 text-xs text-[#7FBF8F]">
                              <Sparkles className="h-3 w-3" />
                              达标
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#6E6E6E]">
                          {phaseFullRangeLabel(phase)} · {phaseTotalDays(phase)} 天
                          {phase.archivedAt
                            ? ` · 归档于 ${phase.archivedAt.slice(0, 10)}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : phase.id)}
                          className="rounded-2xl border border-[#262626] bg-[#1C1C1C] px-3.5 py-2 text-xs text-[#A3A3A3] transition-colors hover:border-[#F5F5F5] hover:text-[#F5F5F5]"
                        >
                          {isOpen ? '收起详情' : '查看详情'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadText(
                              `${phase.name}体重阶段总结-${phase.endDate}.md`,
                              phaseToMarkdown(phase, weights, checkins),
                              'text/markdown',
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-[#262626] bg-[#1C1C1C] px-3.5 py-2 text-xs text-[#A3A3A3] transition-colors hover:border-[#F5F5F5] hover:text-[#F5F5F5]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          导出
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-[#1C1C1C] px-3.5 py-3">
                        <p className="flex items-center gap-1 text-[11px] text-[#6E6E6E]">
                          <Flag className="h-3 w-3" /> 起点 → 结束
                        </p>
                        <p className="font-serif-sc mt-1 text-sm font-semibold text-[#F5F5F5]">
                          {phase.startWeight != null ? phase.startWeight.toFixed(1) : '—'} →{' '}
                          {summary.endWeight != null ? summary.endWeight.toFixed(1) : '—'} kg
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#1C1C1C] px-3.5 py-3">
                        <p className="flex items-center gap-1 text-[11px] text-[#6E6E6E]">
                          <Target className="h-3 w-3" /> 阶段变化
                        </p>
                        <p className="font-serif-sc mt-1 text-sm font-semibold text-[#F5F5F5]">
                          {statText(summary)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#1C1C1C] px-3.5 py-3">
                        <p className="text-[11px] text-[#6E6E6E]">目标体重</p>
                        <p className="font-serif-sc mt-1 text-sm font-semibold text-[#F5F5F5]">
                          {phase.goalWeight.toFixed(1)} kg
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#1C1C1C] px-3.5 py-3">
                        <p className="text-[11px] text-[#6E6E6E]">记录 / 打卡天数</p>
                        <p className="font-serif-sc mt-1 text-sm font-semibold text-[#F5F5F5]">
                          {summary.recordedDays} / {summary.checkinDays} 天
                        </p>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 rounded-2xl bg-[#1C1C1C] px-3 py-4">
                            {values.length > 0 ? (
                              <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart
                                    data={points}
                                    margin={{ top: 8, right: 10, bottom: 0, left: -20 }}
                                  >
                                    <YAxis
                                      domain={domain}
                                      tick={{ fontSize: 10, fill: '#6E6E6E' }}
                                      tickLine={false}
                                      axisLine={false}
                                    />
                                    <ReferenceLine
                                      y={phase.goalWeight}
                                      stroke="#6E6E6E"
                                      strokeDasharray="5 4"
                                    />
                                    <Tooltip content={<MiniTooltip />} />
                                    <Line
                                      type="monotone"
                                      dataKey="weight"
                                      stroke="#F5F5F5"
                                      strokeWidth={2}
                                      connectNulls
                                      dot={{ r: 2.5, fill: '#F5F5F5', strokeWidth: 0 }}
                                      activeDot={{ r: 4, fill: '#F5F5F5', stroke: '#0A0A0A', strokeWidth: 2 }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <p className="py-6 text-center text-xs text-[#6E6E6E]">
                                这一阶段没有留下体重记录
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6E6E6E]">
                              <span>
                                实际用时 {summary.actualDays} 天 / 计划 {summary.plannedDays} 天
                              </span>
                              <span>
                                满分天数 {summary.fullDays} 天
                              </span>
                              {summary.endWeightDate && (
                                <span>最后一次称重 {summary.endWeightDate}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
