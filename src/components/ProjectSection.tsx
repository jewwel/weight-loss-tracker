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
  CalendarHeart,
  CheckCircle2,
  CircleHelp,
  Download,
  FolderKanban,
  ListTodo,
  PencilLine,
  Plus,
  Target,
  X,
} from 'lucide-react'
import { dateKey } from '@/lib/plan'
import { parseLocalDate } from '@/lib/reading'
import type { Project, ProjectTodo, TaskSummary } from '@/lib/project'
import {
  buildTaskStats,
  overallProgress,
  projectDateKeys,
  projectDays,
  targetProgressAt,
  taskSummaryToMarkdown,
  validateProject,
} from '@/lib/project'
import { useProjectData } from '@/hooks/useProjectData'

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
          整体进度 {p.actual}%
        </p>
      )}
      <p className="text-xs text-[#A3A3A3]">当日目标 {p.target}%</p>
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

export default function ProjectSection({
  today,
  userId,
}: {
  today: Date
  userId: string
}) {
  const todayKey = dateKey(today)
  const {
    project,
    todos,
    logs,
    taskSummaries,
    loading,
    saveProject,
    addTodo,
    setTodoProgress,
    removeTodo,
    saveTaskSummary,
  } = useProjectData(userId)

  // 项目表单状态
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState(todayKey)
  const [endDate, setEndDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // 待办表单状态
  const [todoTitle, setTodoTitle] = useState('')
  const [todoHours, setTodoHours] = useState('')
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  // 任务总结状态
  const [summaryTodoId, setSummaryTodoId] = useState<number | null>(null)
  const [reflection, setReflection] = useState('')

  const flash = (msg: string) => {
    setSavedFlash(msg)
    window.setTimeout(() => setSavedFlash(null), 2500)
  }

  const startEdit = () => {
    if (project) {
      setName(project.name)
      setGoal(project.goal)
      setStartDate(project.startDate)
      setEndDate(project.endDate)
    }
    setFormError(null)
    setEditing(true)
  }

  const formProject: Project = {
    name: name.trim(),
    goal: goal.trim(),
    startDate,
    endDate,
  }

  const submitProject = () => {
    const error = validateProject(formProject)
    if (error) {
      setFormError(error)
      return
    }
    saveProject(formProject)
    setEditing(false)
    flash('项目已保存，开始推进吧')
  }

  const submitTodo = () => {
    const title = todoTitle.trim()
    const hours = Number.parseFloat(todoHours)
    if (!title || Number.isNaN(hours) || hours <= 0) return
    addTodo(title, Math.round(hours * 10) / 10)
    setTodoTitle('')
    setTodoHours('')
  }

  const overall = useMemo(() => overallProgress(todos), [todos])
  const doneCount = todos.filter(t => t.progress >= 100).length
  const totalHours =
    Math.round(todos.reduce((s, t) => s + t.estimateHours, 0) * 10) / 10

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!project) return []
    let last: number | null = null
    return projectDateKeys(project).map((key, i) => {
      if (key <= todayKey && logs[key] != null) last = logs[key]
      return {
        key,
        label: key.slice(5),
        actual: key <= todayKey ? last : null,
        target: targetProgressAt(project, i),
      }
    })
  }, [project, logs, todayKey])

  const leftDays = project
    ? Math.max(
        0,
        differenceInCalendarDays(parseLocalDate(project.endDate), today)
      )
    : 0

  const summaryFor = (todo: ProjectTodo) =>
    taskSummaries.find(s => s.todoId === todo.id)

  const openSummaryForm = (todo: ProjectTodo) => {
    const existing = summaryFor(todo)
    setReflection(existing?.reflection ?? '')
    setSummaryTodoId(todo.id)
  }

  const submitSummary = (todo: ProjectTodo) => {
    const stats = buildTaskStats(todo)
    if (!stats) return
    const summary: TaskSummary = {
      title: todo.title,
      estimateHours: todo.estimateHours,
      startedDate: stats.startedDate,
      completedDate: stats.completedDate,
      reflection: reflection.trim(),
      stats,
    }
    saveTaskSummary(todo.id, summary)
    setSummaryTodoId(null)
    flash('任务总结已保存到云端')
  }

  const downloadSummary = (s: TaskSummary) => {
    if (!project) return
    const blob = new Blob([taskSummaryToMarkdown(s, project.name)], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `任务总结-${s.title}-${s.completedDate}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showForm = !loading && (project == null || editing)

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-3xl px-5 py-6"
    >
      <div className="mb-5">
        <h2 className="font-serif-sc text-2xl font-bold text-[#F5F5F5]">
          项目管理
        </h2>
        <p className="mt-1 text-sm text-[#A3A3A3]">
          把大目标拆成小任务，一件一件完成它。
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[#6E6E6E]">正在轻轻取出你的项目……</p>
        </div>
      ) : showForm ? (
        /* 项目表单 */
        <div className="shadow-softer rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
          <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
            {project ? '修改项目' : '立一个项目，然后拆解它'}
          </p>
          <p className="mt-1 text-xs text-[#A3A3A3]">
            先定好名称、目标和时间，再把工作拆成一件件待办。
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                项目名称
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：上线个人博客"
                className={`${inputCls} w-full`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#A3A3A3]">
                项目目标
              </label>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="这个项目要做到什么程度？验收标准是什么？"
                rows={2}
                className={`${inputCls} w-full resize-none`}
              />
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
            </div>

            {formError && <p className="text-xs text-[#C0665F]">{formError}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submitProject}
                className="rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
              >
                保存项目
              </button>
              {project && (
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
      ) : project ? (
        <>
          {/* 项目摘要 */}
          <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-6 w-6 shrink-0 text-[#F5F5F5]" />
                <div>
                  <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
                    {project.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E6E6E]">
                    {project.startDate} → {project.endDate} · 共{' '}
                    {projectDays(project)} 天
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
            {project.goal && (
              <p className="mt-3 rounded-2xl bg-[#1C1C1C] px-4 py-3 text-sm leading-relaxed text-[#A3A3A3]">
                {project.goal}
              </p>
            )}
          </div>

          {/* 待办列表 */}
          <div className="shadow-softer mb-4 rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
            <div className="flex items-center gap-3">
              <ListTodo className="h-5 w-5 text-[#F5F5F5]" />
              <p className="text-sm font-medium text-[#F5F5F5]">待办事项</p>
              <span className="rounded-full bg-[#1C1C1C] px-3 py-1 text-xs text-[#A3A3A3]">
                {doneCount}/{todos.length} 已完成
              </span>
            </div>

            {/* 新增待办 */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={todoTitle}
                onChange={e => setTodoTitle(e.target.value)}
                placeholder="要做的一件具体的事"
                className={`${inputCls} min-w-0 flex-1`}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitTodo()
                }}
              />
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={todoHours}
                onChange={e => setTodoHours(e.target.value)}
                placeholder="预估小时"
                className={`${inputCls} w-28`}
              />
              <button
                type="button"
                onClick={submitTodo}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F5F5F5] px-4 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0]"
              >
                <Plus className="h-4 w-4" />
                添加
              </button>
            </div>

            {/* 待办列表 */}
            <div className="mt-4 space-y-3">
              {todos.length === 0 && (
                <p className="py-4 text-center text-sm text-[#6E6E6E]">
                  还没有待办，把项目拆成几件小事吧。
                </p>
              )}
              {todos.map(todo => {
                const done = todo.progress >= 100
                const existing = summaryFor(todo)
                const stats = done ? buildTaskStats(todo) : null
                return (
                  <div
                    key={todo.id}
                    className="rounded-2xl bg-[#1C1C1C] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {done && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#F5F5F5]" />
                        )}
                        <div>
                          <p
                            className={`text-sm ${
                              done
                                ? 'text-[#6E6E6E] line-through'
                                : 'text-[#F5F5F5]'
                            }`}
                          >
                            {todo.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#6E6E6E]">
                            预估 {todo.estimateHours} 小时
                            {todo.completedDate &&
                              ` · 完成于 ${todo.completedDate}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTodo(todo.id)}
                        className="shrink-0 text-[#6E6E6E] transition-colors hover:text-[#F5F5F5]"
                        aria-label="删除这个待办"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={todo.progress}
                        onChange={e =>
                          setTodoProgress(todo, Number(e.target.value))
                        }
                        className="flex-1 accent-[#F5F5F5]"
                      />
                      <span className="w-10 text-right text-xs text-[#A3A3A3]">
                        {todo.progress}%
                      </span>
                    </div>

                    {/* 任务完成总结 */}
                    {done && stats && (
                      <div className="mt-2 border-t border-[#262626] pt-2">
                        {summaryTodoId === todo.id ? (
                          <div className="space-y-3">
                            <p className="flex items-center gap-1.5 text-xs text-[#6E6E6E]">
                              <CircleHelp className="h-3.5 w-3.5" />
                              用了 {stats.daysUsed} 天 · 预估{' '}
                              {stats.estimateHours} 小时 · {stats.startedDate} →{' '}
                              {stats.completedDate}
                            </p>
                            <textarea
                              value={reflection}
                              onChange={e => setReflection(e.target.value)}
                              placeholder="这件事做得怎么样？有什么经验留下来？"
                              rows={3}
                              className={`${inputCls} w-full resize-none`}
                            />
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => submitSummary(todo)}
                                className="rounded-2xl bg-[#F5F5F5] px-4 py-2 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0]"
                              >
                                保存总结到云端
                              </button>
                              <button
                                type="button"
                                onClick={() => setSummaryTodoId(null)}
                                className="text-xs text-[#A3A3A3] underline underline-offset-2"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            {existing ? (
                              <>
                                <span className="text-xs text-[#6E6E6E]">
                                  总结已保存 · 完成于 {existing.completedDate}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadSummary(existing)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5F5F5] px-3 py-1.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0]"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  导出总结（Markdown）
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openSummaryForm(todo)}
                                  className="text-xs text-[#6E6E6E] underline underline-offset-2 hover:text-[#F5F5F5]"
                                >
                                  重新生成
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openSummaryForm(todo)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5F5F5] px-3 py-1.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                生成任务总结
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 跟踪曲线 */}
          <div className="shadow-soft rounded-3xl border border-[#262626] bg-[#141414] px-4 py-5 sm:px-6">
            {Object.keys(logs).length > 0 ? (
              <>
                <div className="mb-2 flex items-center gap-4 px-2 text-xs text-[#A3A3A3]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-5 rounded bg-[#F5F5F5]" />
                    实际整体进度
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0 w-5 border-t-2 border-dashed border-[#6E6E6E]" />
                    计划曲线（线性推进）
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
                          id="projectGradient"
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
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#6E6E6E' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#F5F5F5"
                        strokeWidth={2.5}
                        fill="url(#projectGradient)"
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
                <FolderKanban className="mb-3 h-8 w-8 text-[#4A4A4A]" />
                <p className="text-sm text-[#A3A3A3]">
                  先添加待办并更新进度，
                  <br />
                  跟踪曲线就会从这里开始生长。
                </p>
              </div>
            )}
          </div>

          {/* 统计卡 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <StatCard
              icon={<Target className="h-4 w-4" />}
              label="整体进度"
              value={`${overall}%`}
              hint={
                todos.length > 0
                  ? '按各任务预估工时加权计算'
                  : '先添加几件待办吧'
              }
            />
            <StatCard
              icon={<ListTodo className="h-4 w-4" />}
              label="任务完成"
              value={`${doneCount} / ${todos.length}`}
              hint={
                todos.length > 0 && doneCount === todos.length
                  ? '全部完成，值得庆祝'
                  : '一件一件来，不着急'
              }
            />
            <StatCard
              icon={<CalendarHeart className="h-4 w-4" />}
              label="预估总工时"
              value={todos.length > 0 ? `${totalHours} 小时` : '—'}
              hint={
                leftDays > 0
                  ? `距离截止还有 ${leftDays + 1} 天`
                  : '已到截止日，复盘一下吧'
              }
            />
            <StatCard
              icon={<FolderKanban className="h-4 w-4" />}
              label="项目周期"
              value={`${projectDays(project)} 天`}
              hint={`${project.startDate} → ${project.endDate}`}
            />
          </div>
        </>
      ) : null}
    </motion.section>
  )
}
