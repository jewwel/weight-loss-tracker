import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
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
} from '@/lib/plan'

interface ChartPoint {
  key: string
  label: string
  weight: number | null
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.weight == null) return null
  return (
    <div className="rounded-2xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-2.5 shadow-soft">
      <p className="text-xs text-[#9B9084]">{p.key}</p>
      <p className="font-serif-sc text-lg font-semibold text-[#5C544B]">{p.weight.toFixed(1)} kg</p>
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
    <div className="shadow-softer rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-5 py-4">
      <div className="flex items-center gap-2 text-[#9B9084]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-serif-sc mt-1.5 text-xl font-bold text-[#5C544B]">{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-[#B4ABA0]">{hint}</p>}
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
      })
    }
    return points
  }, [weights, todayKey])

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
        <h2 className="font-serif-sc text-2xl font-bold text-[#5C544B]">体重记录</h2>
        <p className="mt-1 text-sm text-[#9B9084]">
          数字只是参考，状态才是答案。
        </p>
      </div>

      {/* 起始体重引导 / 展示 */}
      {startWeight == null || editingStart ? (
        <div className="shadow-softer mb-4 rounded-3xl border border-[#F0DDC9] bg-[#FDF6EC] px-6 py-5">
          <p className="font-serif-sc text-lg font-semibold text-[#5C544B]">
            先告诉我你的起始体重吧
          </p>
          <p className="mt-1 text-xs text-[#9B9084]">
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
              className="w-36 rounded-2xl border border-[#EFE6DA] bg-white px-4 py-2.5 text-lg text-[#5C544B] outline-none focus:border-[#E8967A]"
            />
            <span className="text-sm text-[#9B9084]">kg</span>
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
              className="rounded-2xl bg-[#8FA383] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7C9473]"
            >
              保存
            </button>
            {editingStart && (
              <button
                type="button"
                onClick={() => setEditingStart(false)}
                className="text-sm text-[#9B9084] underline underline-offset-2"
              >
                取消
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#EFE6DA] bg-[#FFFDF9] px-5 py-3 text-sm">
          <span className="text-[#9B9084]">
            起始体重 <span className="font-serif-sc font-semibold text-[#5C544B]">{startWeight.toFixed(1)} kg</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setStartInput(startWeight.toFixed(1))
              setEditingStart(true)
            }}
            className="inline-flex items-center gap-1 text-[#C4A88A] hover:text-[#E8967A]"
          >
            <PencilLine className="h-3.5 w-3.5" /> 修改
          </button>
        </div>
      )}

      {/* 今日称重 */}
      <div className="shadow-softer mb-4 rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <Scale className="h-5 w-5 text-[#E8967A]" />
          <p className="text-sm font-medium text-[#5C544B]">今日称重</p>
          {weights[todayKey] != null && (
            <span className="rounded-full bg-[#F0F4EC] px-3 py-1 text-xs text-[#7C9473]">
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
            className="w-40 rounded-2xl border border-[#EFE6DA] bg-white px-4 py-2.5 text-lg text-[#5C544B] outline-none focus:border-[#E8967A]"
          />
          <span className="text-sm text-[#9B9084]">kg</span>
          <button
            type="button"
            onClick={() => {
              const v = parseWeight(todayInput)
              if (v == null) return
              setWeight(todayKey, v)
              setTodayInput('')
              flash('今天的数字已温柔记下')
            }}
            className="rounded-2xl bg-[#E8967A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#DE8465]"
          >
            记录今日体重
          </button>
          {savedFlash && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-[#8FA383]"
            >
              {savedFlash}
            </motion.span>
          )}
        </div>

        {/* 历史补录 */}
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 text-xs text-[#B4ABA0] hover:text-[#E8967A]"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
          />
          查看 / 补录历史日期
        </button>
        {historyOpen && (
          <div className="mt-3 rounded-2xl bg-[#FBF7EF] px-4 py-4">
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
                className="rounded-2xl border border-[#EFE6DA] bg-white px-3 py-2 text-sm text-[#5C544B] outline-none focus:border-[#E8967A]"
              />
              <input
                type="number"
                step="0.1"
                value={historyInput}
                onChange={(e) => setHistoryInput(e.target.value)}
                placeholder={weights[historyDate] != null ? weights[historyDate].toFixed(1) : '这一天还没有记录'}
                className="w-40 rounded-2xl border border-[#EFE6DA] bg-white px-4 py-2 text-sm text-[#5C544B] outline-none focus:border-[#E8967A]"
              />
              <button
                type="button"
                onClick={() => {
                  const v = parseWeight(historyInput)
                  if (v == null) return
                  setWeight(historyDate, v)
                  flash('已补录，补上也算数')
                }}
                className="rounded-2xl bg-[#8FA383] px-4 py-2 text-xs font-medium text-white hover:bg-[#7C9473]"
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
                  className="text-xs text-[#B4ABA0] underline underline-offset-2 hover:text-[#E8967A]"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 曲线 */}
      <div className="shadow-soft rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-4 py-5 sm:px-6">
        {hasAnyWeight ? (
          <div className="h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="warmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F2B8A0" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#F2B8A0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F3EDE3" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={6}
                  tick={{ fontSize: 11, fill: '#B4ABA0' }}
                  tickLine={false}
                  axisLine={{ stroke: '#EFE6DA' }}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: '#B4ABA0' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={GOAL_WEIGHT}
                  stroke="#8FA383"
                  strokeDasharray="6 4"
                  label={{
                    value: `目标 ${GOAL_WEIGHT}kg`,
                    position: 'insideTopRight',
                    fill: '#8FA383',
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#E8967A"
                  strokeWidth={2.5}
                  fill="url(#warmGradient)"
                  connectNulls={false}
                  dot={{ r: 3, fill: '#E8967A', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#DE8465', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <CalendarHeart className="mb-3 h-8 w-8 text-[#F2B8A0]" />
            <p className="text-sm text-[#9B9084]">
              还没有体重记录，明早称一次，
              <br />
              曲线就会从这里开始生长。
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
