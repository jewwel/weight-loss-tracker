import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { PencilLine, TrendingDown, Target, Scale, CalendarHeart, ChevronDown } from 'lucide-react'
import type { PlanData } from '@/hooks/usePlanData'
import {
  GOAL_WEIGHT,
  PLAN_END,
  PLAN_START,
  dateKey,
  daysLeft,
  targetWeightAt,
} from '@/lib/plan'

interface ChartPoint {
  key: string
  label: string
  weight: number | null
  target: number | null
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.weight == null && p.target == null) return null
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2.5 shadow-soft">
      <p className="text-xs text-[#A3A3A3]">{p.key}</p>
      {p.weight != null && (
        <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">{p.weight.toFixed(1)} kg</p>
      )}
      {p.target != null && (
        <p className="text-xs text-[#A3A3A3]">今日目标 {p.target.toFixed(1)} kg</p>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="shadow-softer rounded-3xl border border-[#262626] bg-[#141414] px-5 py-4">
      <div className="flex items-center gap-2 text-[#A3A3A3]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-serif-sc mt-1.5 text-xl font-bold text-[#F5F5F5]">{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-[#6E6E6E]">{hint}</p>}
    </div>
  )
}

export default function WeightSection({
  today,
  data,
  setStartWeight,
  setWeight,
  removeWeight,
}: {
  today: Date
  data: PlanData
  setStartWeight: (w: number) => void
  setWeight: (key: string, w: number) => void
  removeWeight: (key: string) => void
}) {
  const todayKey = dateKey(today)
  const { startWeight, weights } = data

  const [startInput, setStartInput] = useState('')
  const [editingStart, setEditingStart] = useState(false)
  const [todayInput, setTodayInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyDate, setHistoryDate] = useState(todayKey)
  const [historyInput, setHistoryInput] = useState('')
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const parseWeight = (s: string): number | null => {
    const v = Number.parseFloat(s)
    if (Number.isNaN(v) || v < 20 || v > 300) return null
    return Math.round(v * 10) / 10
  }

  const flash = (msg: string) => {
    setSavedFlash(msg)
    window.setTimeout(() => setSavedFlash(null), 2500)
  }

  // 最近一次（<=今天）的体重记录
  const current = useMemo(() => {
    const keys = Object.keys(weights)
      .filter((k) => k <= todayKey)
      .sort()
    const last = keys[keys.length - 1]
    return last ? { key: last, value: weights[last] } : null
  }, [weights, todayKey])

  // 目标曲线的起点体重：优先起始体重；没设置时用最早一条体重记录兜底
  const curveStartWeight = useMemo(() => {
    if (startWeight != null) return startWeight
    const keys = Object.keys(weights).sort()
    return keys.length > 0 ? weights[keys[0]] : null
  }, [startWeight, weights])

  const chartData = useMemo<ChartPoint[]>(() => {
    const total = differenceInCalendarDays(PLAN_END, PLAN_START)
    const points: ChartPoint[] = []
    for (let i = 0; i <= total; i++) {
      const d = addDays(PLAN_START, i)
      const key = dateKey(d)
      points.push({
        key,
        label: format(d, 'MM-dd'),
        weight: key <= todayKey ? weights[key] ?? null : null,
        target: curveStartWeight != null ? targetWeightAt(i, curveStartWeight) : null,
      })
    }
    return points
  }, [weights, todayKey, curveStartWeight])

  const yDomain = useMemo<[number, number]>(() => {
    const vals = chartData
      .map((p) => p.weight)
      .filter((v): v is number => v != null)
    const all = [...vals, GOAL_WEIGHT, ...(startWeight != null ? [startWeight] : [])]
    if (all.length === 0) return [GOAL_WEIGHT - 5, GOAL_WEIGHT + 5]
    return [Math.floor(Math.min(...all) - 1), Math.ceil(Math.max(...all) + 1)]
  }, [chartData, startWeight])

  const lost = startWeight != null && current ? startWeight - current.value : null
  const toGoal = current ? current.value - GOAL_WEIGHT : null
  const left = daysLeft(today)
  const dailyNeed =
    toGoal != null && toGoal > 0 && left > 0 ? toGoal / left : null

  const hasAnyWeight = Object.keys(weights).length > 0

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-5 py-6"
    >
      <div className="mb-5">
        <h2 className="font-serif-sc text-2xl font-bold text-[#F5F5F5]">体重记录</h2>
        <p className="mt-1 text-sm text-[#A3A3A3]">
          数字只是参考，状态才是答案。
        </p>
      </div>

      {/* 起始体重引导 / 展示 */}
      {startWeight == null || editingStart ? (
        <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
          <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
            先告诉我你的起始体重吧
          </p>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            它只是一切的起点，之后每一个数字都值得被温柔记录。
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              placeholder="例如 72.5"
              className="w-36 rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2.5 text-lg text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
            />
            <span className="text-sm text-[#A3A3A3]">kg</span>
            <button
              type="button"
              onClick={() => {
                const v = parseWeight(startInput)
                if (v == null) return
                setStartWeight(v)
                setEditingStart(false)
                setStartInput('')
                flash('起始体重已记下，谢谢你愿意开始')
              }}
              className="rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
            >
              保存
            </button>
            {editingStart && (
              <button
                type="button"
                onClick={() => setEditingStart(false)}
                className="text-sm text-[#A3A3A3] underline underline-offset-2"
              >
                取消
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#262626] bg-[#141414] px-5 py-3 text-sm">
          <span className="text-[#A3A3A3]">
            起始体重 <span className="font-serif-sc font-semibold text-[#F5F5F5]">{startWeight.toFixed(1)} kg</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setStartInput(startWeight.toFixed(1))
              setEditingStart(true)
            }}
            className="inline-flex items-center gap-1 text-[#A3A3A3] hover:text-[#F5F5F5]"
          >
            <PencilLine className="h-3.5 w-3.5" /> 修改
          </button>
        </div>
      )}

      {/* 今日称重 */}
      <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <Scale className="h-5 w-5 text-[#F5F5F5]" />
          <p className="text-sm font-medium text-[#F5F5F5]">今日称重</p>
          {weights[todayKey] != null && (
            <span className="rounded-full bg-[#1C1C1C] px-3 py-1 text-xs text-[#A3A3A3]">
              已记录 {weights[todayKey].toFixed(1)} kg
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="number"
            step="0.1"
            min="20"
            max="300"
            value={todayInput}
            onChange={(e) => setTodayInput(e.target.value)}
            placeholder={weights[todayKey] != null ? weights[todayKey].toFixed(1) : '今天早上的数字'}
            className="w-40 rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2.5 text-lg text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
          />
          <span className="text-sm text-[#A3A3A3]">kg</span>
          <button
            type="button"
            onClick={() => {
              const v = parseWeight(todayInput)
              if (v == null) return
              setWeight(todayKey, v)
              setTodayInput('')
              flash('今天的数字已温柔记下')
            }}
            className="rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
          >
            记录今日体重
          </button>
          {savedFlash && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-[#A3A3A3]"
            >
              {savedFlash}
            </motion.span>
          )}
        </div>

        {/* 历史补录 */}
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-xs text-[#6E6E6E] hover:text-[#F5F5F5]"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
          />
          查看 / 补录历史日期
        </button>
        {historyOpen && (
          <div className="mt-3 rounded-2xl bg-[#1C1C1C] px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                min={dateKey(PLAN_START)}
                max={todayKey}
                value={historyDate}
                onChange={(e) => {
                  setHistoryDate(e.target.value)
                  const w = weights[e.target.value]
                  setHistoryInput(w != null ? w.toFixed(1) : '')
                }}
                className="rounded-2xl border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
              />
              <input
                type="number"
                step="0.1"
                value={historyInput}
                onChange={(e) => setHistoryInput(e.target.value)}
                placeholder={weights[historyDate] != null ? weights[historyDate].toFixed(1) : '这一天还没有记录'}
                className="w-40 rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
              />
              <button
                type="button"
                onClick={() => {
                  const v = parseWeight(historyInput)
                  if (v == null) return
                  setWeight(historyDate, v)
                  flash('已补录，补上也算数')
                }}
                className="rounded-2xl bg-[#F5F5F5] px-4 py-2 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0]"
              >
                保存这一天
              </button>
              {weights[historyDate] != null && (
                <button
                  type="button"
                  onClick={() => {
                    removeWeight(historyDate)
                    setHistoryInput('')
                    flash('已清除这一天的记录')
                  }}
                  className="text-xs text-[#6E6E6E] underline underline-offset-2 hover:text-[#F5F5F5]"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 曲线 */}
      <div className="shadow-soft rounded-3xl border border-[#262626] bg-[#141414] px-4 py-5 sm:px-6">
        {hasAnyWeight || startWeight != null ? (
          <>
            <div className="mb-2 flex items-center gap-4 px-2 text-xs text-[#A3A3A3]">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded bg-[#F5F5F5]" />
                实际体重
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0 w-5 border-t-2 border-dashed border-[#6E6E6E]" />
                目标曲线（贴近真实减重节奏）
              </span>
            </div>
            <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="warmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5F5F5" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#F5F5F5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={6}
                  tick={{ fontSize: 11, fill: '#6E6E6E' }}
                  tickLine={false}
                  axisLine={{ stroke: '#262626' }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: '#6E6E6E' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={GOAL_WEIGHT}
                  stroke="#6E6E6E"
                  strokeDasharray="6 4"
                  label={{
                    value: `目标 ${GOAL_WEIGHT}kg`,
                    position: 'insideTopRight',
                    fill: '#6E6E6E',
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#F5F5F5"
                  strokeWidth={2.5}
                  fill="url(#warmGradient)"
                  connectNulls={false}
                  dot={{ r: 3, fill: '#F5F5F5', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#F5F5F5', stroke: '#0A0A0A', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#6E6E6E"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6E6E6E', stroke: '#0A0A0A', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <CalendarHeart className="mb-3 h-8 w-8 text-[#4A4A4A]" />
            <p className="text-sm text-[#A3A3A3]">
              先在上面记录起始体重，
              <br />
              目标曲线和体重曲线就会从这里开始生长。
            </p>
          </div>
        )}
      </div>

      {/* 统计卡 */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <StatCard
          icon={<Scale className="h-4 w-4" />}
          label="当前体重"
          value={current ? `${current.value.toFixed(1)} kg` : '还未称重哦'}
          hint={current ? `记录于 ${current.key}` : '明早称一次就有啦'}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="已减重"
          value={
            lost == null
              ? '—'
              : lost > 0
                ? `${lost.toFixed(1)} kg`
                : lost === 0
                  ? '0 kg'
                  : '慢慢来'
          }
          hint={
            lost == null
              ? '先记录起始和今天的体重吧'
              : lost > 0
                ? '悄悄在变轻，继续温柔坚持'
                : '身体还在适应，正常的起伏'
          }
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label={`距目标 ${GOAL_WEIGHT}kg`}
          value={
            toGoal == null
              ? '—'
              : toGoal <= 0
                ? '目标已达成'
                : `还差 ${toGoal.toFixed(1)} kg`
          }
          hint={
            toGoal != null && toGoal <= 0
              ? '太了不起了，请好好庆祝一下'
              : '不着急，一步一步来'
          }
        />
        <StatCard
          icon={<CalendarHeart className="h-4 w-4" />}
          label="预计日均需减"
          value={dailyNeed != null ? `${dailyNeed.toFixed(2)} kg/天` : '—'}
          hint={
            dailyNeed != null
              ? `剩余 ${left} 天 · 只是个参考数字，别给自己压力，健康最重要`
              : '好好吃饭、好好睡觉，比数字更重要'
          }
        />
      </div>
    </motion.section>
  )
}
