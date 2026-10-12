import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Archive,
  CalendarRange,
  Flag,
  Loader2,
  PencilLine,
  Plus,
  Target,
  TrendingDown,
} from 'lucide-react'
import { addDays } from 'date-fns'
import type { PhaseDraft, WeightPhase } from '@/lib/phase'
import {
  DEFAULT_PHASE_DAYS,
  PHASE_SETUP_HINT_FALLBACK,
  archivedEndDate,
  defaultPhaseDraft,
  isPhaseExpired,
  isValidWeight,
  parseWeightInput,
  phaseDaysLeft,
  phaseFullRangeLabel,
  phaseName,
  phaseProgress,
  validatePhaseDraft,
} from '@/lib/phase'
import { dateKey } from '@/lib/plan'

const INPUT_CLASS =
  'rounded-2xl border border-[#262626] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]'
const FIELD_LABEL = 'mb-1.5 block text-xs text-[#A3A3A3]'

type Mode = 'view' | 'create' | 'edit'

/** 表单里体重用字符串保存，避免输入过程中被数字化打断 */
interface FormState {
  name: string
  startDate: string
  endDate: string
  startWeight: string
  goalWeight: string
}

const toForm = (draft: PhaseDraft): FormState => ({
  name: draft.name,
  startDate: draft.startDate,
  endDate: draft.endDate,
  startWeight: draft.startWeight != null ? draft.startWeight.toFixed(1) : '',
  goalWeight: draft.goalWeight.toFixed(1),
})

const toDraft = (form: FormState): PhaseDraft => ({
  name: form.name.trim(),
  startDate: form.startDate,
  endDate: form.endDate,
  startWeight: form.startWeight.trim() === '' ? null : parseWeightInput(form.startWeight),
  goalWeight: parseWeightInput(form.goalWeight) ?? Number.NaN,
})

export default function PhasePanel({
  today,
  phase,
  phases,
  needsNewPhase,
  needsPhaseSetup,
  setupHint,
  currentWeight,
  saving,
  onCreate,
  onUpdate,
}: {
  today: Date
  phase: WeightPhase
  /** 全部阶段（用于推算下一个阶段序号） */
  phases: WeightPhase[]
  needsNewPhase: boolean
  needsPhaseSetup: boolean
  setupHint: string
  currentWeight: number | null
  saving: boolean
  onCreate: (draft: PhaseDraft) => Promise<string | null>
  onUpdate: (draft: PhaseDraft) => Promise<string | null>
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  // 没有进行中的阶段时，强制进入新建流程
  const activeMode: Mode = needsNewPhase ? 'create' : mode
  const shown: FormState =
    form ?? toForm(defaultPhaseDraft(today, phase, currentWeight, phaseName(phases.length + 1)))
  const patch = (p: Partial<FormState>) => setForm({ ...shown, ...p })

  const expired = isPhaseExpired(phase, today)
  const left = phaseDaysLeft(today, phase)
  const progress = phaseProgress(today, phase)
  const multiPhase = phases.length > 0

  /** 归档预览日期：日期框被清空时不要拿空字符串去算 */
  const archiveEndPreview =
    shown.startDate && shown.startDate > phase.startDate
      ? archivedEndDate(phase, shown.startDate)
      : phase.endDate

  const openCreate = () => {
    setForm(toForm(defaultPhaseDraft(today, phase, currentWeight, phaseName(phases.length + 1))))
    setFormError(null)
    setMode('create')
  }

  const openEdit = () => {
    setForm(
      toForm({
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        startWeight: phase.startWeight,
        goalWeight: phase.goalWeight,
      }),
    )
    setFormError(null)
    setMode('edit')
  }

  const closeForm = () => {
    setForm(null)
    setFormError(null)
    setMode('view')
  }

  const showFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2800)
  }

  const submit = async () => {
    const draft = toDraft(shown)
    if (shown.startWeight.trim() !== '' && draft.startWeight == null) {
      setFormError('起始体重要在 20 ~ 300 kg 之间')
      return
    }
    if (!isValidWeight(draft.goalWeight)) {
      setFormError('目标体重要在 20 ~ 300 kg 之间')
      return
    }
    const invalid = validatePhaseDraft(draft, activeMode === 'create' ? phase : null)
    if (invalid) {
      setFormError(invalid)
      return
    }
    const error = activeMode === 'create' ? await onCreate(draft) : await onUpdate(draft)
    if (error) {
      setFormError(error)
      return
    }
    closeForm()
    showFlash(activeMode === 'create' ? '新阶段已开始，上一阶段已归档' : '阶段信息已更新')
  }

  const formOpen = activeMode !== 'view'

  return (
    <div className="mb-4 space-y-4">
      {needsPhaseSetup && (
        <div className="flex items-start gap-3 rounded-3xl border border-[#4A3A2A] bg-[#1C1712] px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C0A25F]" />
          <div>
            <p className="text-sm font-medium text-[#E8D9B0]">新建阶段功能暂不可用</p>
            <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">
              {setupHint || PHASE_SETUP_HINT_FALLBACK}
            </p>
          </div>
        </div>
      )}

      {/* 当前阶段：还没有进行中的阶段时，只显示下面的新建表单 */}
      {!needsNewPhase && (
        <div className="shadow-softer rounded-3xl border border-[#262626] bg-[#141414] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarRange className="h-4 w-4 text-[#A3A3A3]" />
                <p className="font-serif-sc truncate text-lg font-semibold text-[#F5F5F5]">
                  {phase.name}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${
                    expired ? 'bg-[#2A1F1C] text-[#C0665F]' : 'bg-[#1C1C1C] text-[#A3A3A3]'
                  }`}
                >
                  {expired ? '已到期' : '进行中'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[#A3A3A3]">
                {phaseFullRangeLabel(phase)} ·{' '}
                {expired ? '目标日已过，可以开一个新阶段了' : `还剩 ${left} 天`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={openEdit}
                disabled={needsPhaseSetup || needsNewPhase || saving}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-[#262626] bg-[#1C1C1C] px-4 py-2 text-xs text-[#A3A3A3] transition-colors hover:border-[#F5F5F5] hover:text-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PencilLine className="h-3.5 w-3.5" />
                编辑阶段
              </button>
              <button
                type="button"
                onClick={openCreate}
                disabled={needsPhaseSetup || needsNewPhase || saving}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F5F5F5] px-4 py-2 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                新建阶段
              </button>
            </div>
          </div>

          {/* 时间进度 */}
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1C1C1C]">
              <motion.div
                className="h-full rounded-full bg-[#F5F5F5]"
                initial={false}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6E6E]">
              <span>已走过 {Math.round(progress * 100)}%</span>
              <span className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Flag className="h-3.5 w-3.5" />
                  起点{' '}
                  <span className="font-serif-sc text-[#A3A3A3]">
                    {phase.startWeight != null ? `${phase.startWeight.toFixed(1)} kg` : '待填写'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  目标{' '}
                  <span className="font-serif-sc text-[#A3A3A3]">
                    {phase.goalWeight.toFixed(1)} kg
                  </span>
                </span>
              </span>
            </div>
          </div>

          {expired && !formOpen && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#1C1C1C] px-4 py-3">
              <p className="text-xs text-[#A3A3A3]">
                这一阶段到期了，归档它，然后开始新的目标追踪吧。
              </p>
              <button
                type="button"
                onClick={openCreate}
                disabled={needsPhaseSetup || saving}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F5F5F5] px-4 py-2 text-xs font-medium text-[#0A0A0A] hover:bg-[#E0E0E0] disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                归档并新建阶段
              </button>
            </div>
          )}
        </div>
      )}

      {/* 新建 / 编辑表单 */}
      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.div
            key={activeMode}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-3xl border border-[#3A3A3A] bg-[#141414] px-6 py-5"
          >
            <p className="font-serif-sc text-lg font-semibold text-[#F5F5F5]">
              {activeMode === 'create' ? '新建体重目标阶段' : '编辑当前阶段'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">
              {activeMode === 'create' ? (
                needsNewPhase ? (
                  '定一个想去的方向，这个阶段就开始了。'
                ) : (
                  <>
                    创建后，当前阶段「{phase.name}」会在{' '}
                    <span className="text-[#F5F5F5]">{archiveEndPreview}</span>{' '}
                    结束并归档：体重和打卡记录都会完整保留，随时可以回看和导出。
                  </>
                )
              ) : (
                '只调整当前阶段，已经归档的历史阶段不会受影响。'
              )}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL} htmlFor="phase-name">
                  阶段名称
                </label>
                <input
                  id="phase-name"
                  value={shown.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder={phaseName(phases.length + 1)}
                  className={`${INPUT_CLASS} w-full`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="phase-start">
                  起始日期
                </label>
                <input
                  id="phase-start"
                  type="date"
                  value={shown.startDate}
                  onChange={(e) => {
                    const value = e.target.value
                    // 目标日期自动跟随，先给一个 8 周的默认周期
                    const suggested = value
                      ? dateKey(addDays(new Date(`${value}T00:00:00`), DEFAULT_PHASE_DAYS - 1))
                      : shown.endDate
                    patch({
                      startDate: value,
                      endDate:
                        !shown.endDate || shown.endDate <= value ? suggested : shown.endDate,
                    })
                  }}
                  className={`${INPUT_CLASS} w-full`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="phase-end">
                  目标日期
                </label>
                <input
                  id="phase-end"
                  type="date"
                  value={shown.endDate}
                  min={shown.startDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                  className={`${INPUT_CLASS} w-full`}
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="phase-start-weight">
                  起始体重（kg）
                </label>
                <input
                  id="phase-start-weight"
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  value={shown.startWeight}
                  onChange={(e) => patch({ startWeight: e.target.value })}
                  placeholder="例如 72.5"
                  className={`${INPUT_CLASS} w-full`}
                />
                {currentWeight != null && (
                  <button
                    type="button"
                    onClick={() => patch({ startWeight: currentWeight.toFixed(1) })}
                    className="mt-1.5 text-xs text-[#6E6E6E] underline-offset-2 hover:text-[#F5F5F5] hover:underline"
                  >
                    用最近一次记录 {currentWeight.toFixed(1)} kg 作为起点
                  </button>
                )}
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="phase-goal-weight">
                  目标体重（kg）
                </label>
                <input
                  id="phase-goal-weight"
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  value={shown.goalWeight}
                  onChange={(e) => patch({ goalWeight: e.target.value })}
                  placeholder="例如 65"
                  className={`${INPUT_CLASS} w-full`}
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-xs text-[#C0665F]">{formError}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-5 py-2.5 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#E0E0E0] disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {activeMode === 'create'
                  ? needsNewPhase
                    ? '开始这个阶段'
                    : '创建并归档当前阶段'
                  : '保存修改'}
              </button>
              {!needsNewPhase && (
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-sm text-[#A3A3A3] underline underline-offset-2 hover:text-[#F5F5F5]"
                >
                  取消
                </button>
              )}
              {activeMode === 'create' && !needsNewPhase && multiPhase && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#6E6E6E]">
                  <TrendingDown className="h-3.5 w-3.5" />
                  上一阶段的成果会被冻结成一份快照
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {flash && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1 text-xs text-[#A3A3A3]"
        >
          {flash}
        </motion.p>
      )}
    </div>
  )
}
