import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { differenceInCalendarDays } from 'date-fns'
import {
  BookOpen,
  BookMarked,
  CalendarHeart,
  ChevronDown,
  CircleHelp,
  PencilLine,
  Plus,
  Target,
  X,
} from 'lucide-react'
import { dateKey } from '@/lib/plan'
import type { ReadingPlan } from '@/lib/reading'
import {
  avgPagesPerDay,
  cleanQuestions,
  parseLocalDate,
  planDateKeys,
  targetPageAt,
  totalDays,
  validatePlan,
} from '@/lib/reading'
import { useReadingData } from '@/hooks/useReadingData'

interface ChartPoint {
  key: string
  label: string
  actual: number | null
  target: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2.5 shadow-soft">
      <p className="text-xs text-[#A3A3A3]">{p.key}</p>
      {p.actual != null && (
        <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
          读到第 {p.actual} 页
        </p>
      )}
      <p className="text-xs text-[#A3A3A3]">当日目标 {p.target} 页</p>
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
      <p className="font-serif-sc mt-1.5 text-xl font-bold text-[#F5F5F5]">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs leading-relaxed text-[#6E6E6E]">{hint}</p>
      )}
    </div>
  )
}

const inputCls =
  'rounded-2xl border border-[#262626] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]'

export default function ReadingSection({
  today,
  userId,
}: {
  today: Date
  userId: string
}) {
  const todayKey = dateKey(today)
  const { plan, entries, loading, savePlan, setPage, removePage } =
    useReadingData(userId)

  // 表单状态
  const [editing, setEditing] = useState(false)
  const [bookName, setBookName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [questions, setQuestions] = useState<string[]>([''])
  const [startDate, setStartDate] = useState(todayKey)
  const [endDate, setEndDate] = useState('')
  const [totalPagesInput, setTotalPagesInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // 进度记录状态
  const [todayInput, setTodayInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyDate, setHistoryDate] = useState(todayKey)
  const [historyInput, setHistoryInput] = useState('')
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const flash = (msg: string) => {
    setSavedFlash(msg)
    window.setTimeout(() => setSavedFlash(null), 2500)
  }

  const startEdit = () => {
    if (plan) {
      setBookName(plan.bookName)
      setPurpose(plan.purpose)
      setQuestions(plan.questions.length > 0 ? plan.questions : [''])
      setStartDate(plan.startDate)
      setEndDate(plan.endDate)
      setTotalPagesInput(String(plan.totalPages))
    }
    setFormError(null)
    setEditing(true)
  }

  const formPlan: ReadingPlan = {
    bookName: bookName.trim(),
    purpose: purpose.trim(),
    questions: cleanQuestions(questions),
    startDate,
    endDate,
    totalPages: Number.parseInt(totalPagesInput, 10),
  }
  const formValid = validatePlan(formPlan) == null

  const submitPlan = () => {
    const error = validatePlan(formPlan)
    if (error) {
      setFormError(error)
      return
    }
    savePlan(formPlan)
    setEditing(false)
    flash('读书计划已保存，开始这趟阅读吧')
  }

  const parsePage = (s: string): number | null => {
    const v = Number.parseInt(s, 10)
    if (Number.isNaN(v) || v < 0 || (plan && v > plan.totalPages * 2))
      return null
    return v
  }

  // 最近一次（<=今天）的进度
  const current = useMemo(() => {
    const keys = Object.keys(entries)
      .filter(k => k <= todayKey)
      .sort()
    const last = keys[keys.length - 1]
    return last ? { key: last, value: entries[last] } : null
  }, [entries, todayKey])

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!plan) return []
    let last: number | null = null
    return planDateKeys(plan).map((key, i) => {
      if (key <= todayKey) {
        if (entries[key] != null) last = entries[key]
      }
      return {
        key,
        label: key.slice(5),
        // 实际曲线：当天没记录就沿用最近一次的进度，让累计线连续
        actual: key <= todayKey ? last : null,
        target: targetPageAt(plan, i),
      }
    })
  }, [plan, entries, todayKey])

  const yDomain = useMemo<[number, number]>(() => {
    if (!plan) return [0, 100]
    return [0, Math.ceil(plan.totalPages * 1.05)]
  }, [plan])

  const leftDays = plan
    ? Math.max(0, differenceInCalendarDays(parseLocalDate(plan.endDate), today))
    : 0
  const remaining =
    plan && current ? Math.max(0, plan.totalPages - current.value) : null
  const dailyNeed =
    remaining != null && remaining > 0 && leftDays > 0
      ? Math.round((remaining / (leftDays + 1)) * 10) / 10
      : null
  const progress =
    plan && current
      ? Math.min(100, Math.round((current.value / plan.totalPages) * 100))
      : null

  const showForm = !loading && (plan == null || editing)

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-5 py-6"
    >
      <div className="mb-5">
        <h2 className="font-serif-sc text-2xl font-bold text-[#F5F5F5]">
          读书计划
        </h2>
        <p className="mt-1 text-sm text-[#A3A3A3]">
          读过的每一页，都在悄悄重塑你。
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[#6E6E6E]">正在轻轻取出你的读书计划……</p>
        </div>
      ) : showForm ? (
        /* 计划表单 */
        <div className="shadow-softer rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
          <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
            {plan ? '修改读书计划' : '定一个小目标，读完一本书'}
          </p>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            先想清楚为什么读、读完要能回答什么，再安排节奏。
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                书籍名称
              </label>
              <input
                type="text"
                value={bookName}
                onChange={e => setBookName(e.target.value)}
                placeholder="例如《认知觉醒》"
                className={`${inputCls} w-full`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                学习目的
              </label>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="为什么想读这本书？希望它帮你解决什么问题？"
                rows={2}
                className={`${inputCls} w-full resize-none`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                学完之后，应该能回答这些问题
              </label>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q}
                      onChange={e =>
                        setQuestions(prev =>
                          prev.map((old, j) => (j === i ? e.target.value : old))
                        )
                      }
                      placeholder={`问题 ${i + 1}`}
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions(prev =>
                          prev.length > 1
                            ? prev.filter((_, j) => j !== i)
                            : prev
                        )
                      }
                      className="text-[#6E6E6E] transition-colors hover:text-[#F5F5F5]"
                      aria-label="删除这个问题"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setQuestions(prev => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-xs text-[#A3A3A3] transition-colors hover:text-[#F5F5F5]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加一个问题
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                  开始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                  结束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                  总页数
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalPagesInput}
                  onChange={e => setTotalPagesInput(e.target.value)}
                  placeholder="例如 320"
                  className={`${inputCls} w-32`}
                />
              </div>
            </div>

            {formValid && (
              <p className="text-xs text-[#A3A3A3]">
                共 {totalDays(formPlan)} 天，平均每天约{' '}
                {avgPagesPerDay(formPlan)} 页。
              </p>
            )}
            {formError && <p className="text-xs text-[#C0665F]">{formError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submitPlan}
                className="rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
              >
                保存计划
              </button>
              {plan && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-sm text-[#A3A3A3] underline underline-offset-2"
                >
                  取消
                </button>
              )}
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
          </div>
        </div>
      ) : plan ? (
        <>
          {/* 计划摘要 */}
          <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BookMarked className="h-6 w-6 shrink-0 text-[#F5F5F5]" />
                <div>
                  <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
                    《{plan.bookName}》
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E6E6E]">
                    {plan.startDate} → {plan.endDate} · 共 {plan.totalPages} 页
                    · 每天约 {avgPagesPerDay(plan)} 页
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-[#A3A3A3] hover:text-[#F5F5F5]"
              >
                <PencilLine className="h-3.5 w-3.5" /> 修改
              </button>
            </div>
            {plan.purpose && (
              <p className="mt-3 rounded-2xl bg-[#1C1C1C] px-4 py-3 text-sm leading-relaxed text-[#A3A3A3]">
                {plan.purpose}
              </p>
            )}
            {plan.questions.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs text-[#6E6E6E]">
                  <CircleHelp className="h-3.5 w-3.5" />
                  读完后，试着回答：
                </p>
                <ul className="space-y-1.5">
                  {plan.questions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[#A3A3A3]">
                      <span className="text-[#6E6E6E]">{i + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 今日进度 */}
          <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpen className="h-5 w-5 text-[#F5F5F5]" />
              <p className="text-sm font-medium text-[#F5F5F5]">今日阅读</p>
              {entries[todayKey] != null && (
                <span className="rounded-full bg-[#1C1C1C] px-3 py-1 text-xs text-[#A3A3A3]">
                  已记录到第 {entries[todayKey]} 页
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="0"
                max={plan.totalPages}
                value={todayInput}
                onChange={e => setTodayInput(e.target.value)}
                placeholder={
                  entries[todayKey] != null
                    ? String(entries[todayKey])
                    : current
                      ? `上次读到第 ${current.value} 页`
                      : '今天读到第几页'
                }
                className="w-44 rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2.5 text-lg text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
              />
              <span className="text-sm text-[#A3A3A3]">页</span>
              <button
                type="button"
                onClick={() => {
                  const v = parsePage(todayInput)
                  if (v == null) return
                  setPage(todayKey, v)
                  setTodayInput('')
                  flash('今天的阅读已记下')
                }}
                className="rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
              >
                记录今日进度
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
              onClick={() => setHistoryOpen(v => !v)}
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
                    min={plan.startDate}
                    max={todayKey}
                    value={historyDate}
                    onChange={e => {
                      setHistoryDate(e.target.value)
                      const p = entries[e.target.value]
                      setHistoryInput(p != null ? String(p) : '')
                    }}
                    className="rounded-2xl border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
                  />
                  <input
                    type="number"
                    min="0"
                    max={plan.totalPages}
                    value={historyInput}
                    onChange={e => setHistoryInput(e.target.value)}
                    placeholder={
                      entries[historyDate] != null
                        ? String(entries[historyDate])
                        : '这一天还没有记录'
                    }
                    className="w-40 rounded-2xl border border-[#262626] bg-[#141414] px-4 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = parsePage(historyInput)
                      if (v == null) return
                      setPage(historyDate, v)
                      flash('已补录，补上也算数')
                    }}
                    className="rounded-2xl bg-[#F5F5F5] px-4 py-2 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0]"
                  >
                    保存这一天
                  </button>
                  {entries[historyDate] != null && (
                    <button
                      type="button"
                      onClick={() => {
                        removePage(historyDate)
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
            {current || entries[plan.startDate] != null ? (
              <>
                <div className="mb-2 flex items-center gap-4 px-2 text-xs text-[#A3A3A3]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-5 rounded bg-[#F5F5F5]" />
                    实际进度
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0 w-5 border-t-2 border-dashed border-[#6E6E6E]" />
                    计划曲线（每天约 {avgPagesPerDay(plan)} 页）
                  </span>
                </div>
                <div className="h-64 w-full sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 12, right: 12, bottom: 0, left: -18 }}
                    >
                      <defs>
                        <linearGradient
                          id="readGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#F5F5F5"
                            stopOpacity={0.16}
                          />
                          <stop
                            offset="100%"
                            stopColor="#F5F5F5"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="#262626"
                        strokeDasharray="3 6"
                        vertical={false}
                      />
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
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#F5F5F5"
                        strokeWidth={2.5}
                        fill="url(#readGradient)"
                        connectNulls={false}
                        dot={{ r: 3, fill: '#F5F5F5', strokeWidth: 0 }}
                        activeDot={{
                          r: 5,
                          fill: '#F5F5F5',
                          stroke: '#0A0A0A',
                          strokeWidth: 2,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="target"
                        stroke="#6E6E6E"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: '#6E6E6E',
                          stroke: '#0A0A0A',
                          strokeWidth: 2,
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <BookOpen className="mb-3 h-8 w-8 text-[#4A4A4A]" />
                <p className="text-sm text-[#A3A3A3]">
                  先在上面记录今天的阅读进度，
                  <br />
                  实际曲线就会从这里开始生长。
                </p>
              </div>
            )}
          </div>

          {/* 统计卡 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <StatCard
              icon={<BookOpen className="h-4 w-4" />}
              label="已读到"
              value={current ? `第 ${current.value} 页` : '还没开始哦'}
              hint={current ? `记录于 ${current.key}` : '今天读几页就有啦'}
            />
            <StatCard
              icon={<Target className="h-4 w-4" />}
              label="阅读进度"
              value={progress != null ? `${progress}%` : '—'}
              hint={
                remaining != null
                  ? remaining > 0
                    ? `还剩 ${remaining} 页`
                    : '整本书都读完了'
                  : '先记录一次进度吧'
              }
            />
            <StatCard
              icon={<CalendarHeart className="h-4 w-4" />}
              label="剩余日均需读"
              value={dailyNeed != null ? `${dailyNeed} 页/天` : '—'}
              hint={
                dailyNeed != null
                  ? `剩余 ${leftDays + 1} 天 · 按计划节奏就好`
                  : remaining === 0
                    ? '去回答那几个问题，检验一下收获吧'
                    : '不着急，一天一页也是前进'
              }
            />
            <StatCard
              icon={<BookMarked className="h-4 w-4" />}
              label="计划周期"
              value={`${totalDays(plan)} 天`}
              hint={`每天约 ${avgPagesPerDay(plan)} 页 · ${plan.startDate} → ${plan.endDate}`}
            />
          </div>
        </>
      ) : null}
    </motion.section>
  )
}
