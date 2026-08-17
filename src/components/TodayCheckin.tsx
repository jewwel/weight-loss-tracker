import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Dumbbell, Footprints, Salad, Scale, PartyPopper, Undo2 } from 'lucide-react'
import type { CheckKey, DayCheckin } from '@/lib/plan'
import { EMPTY_CHECKIN, PLAN_START, dateKey, randomPraise, todayExercise, weekdayCN } from '@/lib/plan'
import { cn } from '@/lib/utils'

interface Item {
  key: CheckKey
  title: string
  desc: string
  icon: 'run' | 'strength' | 'salad' | 'scale'
}

const ICONS = {
  run: Footprints,
  strength: Dumbbell,
  salad: Salad,
  scale: Scale,
} as const

/** 全完成庆祝：柔和花瓣飘落（一次性） */
function PetalCelebration() {
  const petals = Array.from({ length: 10 }, (_, i) => i)
  const colors = ['#2A2A2A', '#3A3A3A', '#4A4A4A', '#5A5A5A']
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
      {petals.map((i) => {
        const left = 5 + ((i * 37) % 90)
        const size = 10 + ((i * 13) % 10)
        return (
          <motion.div
            key={i}
            className="absolute rounded-[60%_40%_55%_45%]"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.3,
              backgroundColor: colors[i % colors.length],
            }}
            initial={{ y: -24, opacity: 0, rotate: 0 }}
            animate={{
              y: [0, 90, 180],
              x: [0, (i % 2 === 0 ? 1 : -1) * 18, (i % 2 === 0 ? -1 : 1) * 10],
              opacity: [0, 0.9, 0],
              rotate: [0, 120, 240],
            }}
            transition={{ duration: 3, delay: i * 0.15, ease: 'easeIn' }}
          />
        )
      })}
    </div>
  )
}

export default function TodayCheckin({
  todayKey,
  checkins,
  weights,
  onToggle,
}: {
  todayKey: string
  checkins: Record<string, Partial<DayCheckin>>
  weights: Record<string, number>
  onToggle: (key: string, item: CheckKey) => boolean
}) {
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const isToday = selectedKey === todayKey
  const selectedDate = useMemo(() => new Date(`${selectedKey}T00:00:00`), [selectedKey])
  const day: DayCheckin = { ...EMPTY_CHECKIN, ...(checkins[selectedKey] ?? {}) }
  const exercise = todayExercise(selectedDate)
  const hasWeight = weights[selectedKey] != null

  const items: Item[] = [
    {
      key: 'exercise',
      title: exercise.title,
      desc: exercise.kind === 'run' ? '出门走走跑跑，风在等你' : '慢慢发力，感受身体的变化',
      icon: exercise.kind,
    },
    {
      key: 'snackFree',
      title: '不吃零食',
      desc: '只允许无糖酸奶和黄瓜，嘴巴寂寞时喝点温水',
      icon: 'salad',
    },
    {
      key: 'weighed',
      title: '早晨称重',
      desc: hasWeight
        ? isToday
          ? '今天的数字已经记下啦'
          : '这一天的数字已经记下啦'
        : '站上去看一眼就好，数字只是记录',
      icon: 'scale',
    },
  ]

  const doneCount = items.filter((it) => day[it.key]).length
  const allDone = doneCount === items.length
  const [celebrated, setCelebrated] = useState(false)
  const [praise, setPraise] = useState<Record<string, string>>({})

  useEffect(() => {
    if (allDone && isToday && !celebrated) setCelebrated(true)
    if (!allDone || !isToday) setCelebrated(false)
  }, [allDone, isToday, celebrated])

  const handleToggle = (item: Item) => {
    const nowChecked = onToggle(selectedKey, item.key)
    if (nowChecked) {
      setPraise((prev) => ({ ...prev, [item.key]: randomPraise() }))
      window.setTimeout(() => {
        setPraise((prev) => {
          const next = { ...prev }
          delete next[item.key]
          return next
        })
      }, 3500)
    } else {
      setPraise((prev) => {
        const next = { ...prev }
        delete next[item.key]
        return next
      })
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-3xl px-5 py-6"
    >
      <AnimatePresence>{celebrated && <PetalCelebration key="petals" />}</AnimatePresence>

      <div className="mb-5">
        <h2 className="font-serif-sc text-2xl font-bold text-[#F5F5F5]">
          {isToday ? '今日打卡' : '补打卡'}
        </h2>
        <p className="mt-1 text-sm text-[#A3A3A3]">
          {Number(selectedKey.slice(5, 7))}月{Number(selectedKey.slice(8, 10))}日 {weekdayCN(selectedDate)} · {exercise.title}日 · 已完成 {doneCount}/3
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="date"
            min={dateKey(PLAN_START)}
            max={todayKey}
            value={selectedKey}
            onChange={(e) => {
              if (e.target.value) setSelectedKey(e.target.value)
            }}
            className="rounded-2xl border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#F5F5F5]"
          />
          {isToday ? (
            <span className="text-xs text-[#6E6E6E]">忘了打卡？选个以前的日期补上就好</span>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedKey(todayKey)}
              className="inline-flex items-center gap-1 text-xs text-[#A3A3A3] hover:text-[#F5F5F5]"
            >
              <Undo2 className="h-3.5 w-3.5" />
              回到今天
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {allDone && isToday && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center gap-3 rounded-2xl border border-[#262626] bg-[#1C1C1C] px-5 py-4 text-[#A3A3A3]"
          >
            <PartyPopper className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              今天全完成啦，去好好奖励自己一杯无糖酸奶吧。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => {
          const checked = day[item.key]
          const Icon = ICONS[item.icon]
          return (
            <motion.button
              key={item.key}
              type="button"
              onClick={() => handleToggle(item)}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'shadow-softer relative flex flex-col rounded-3xl border px-5 py-5 text-left transition-colors duration-300',
                checked
                  ? 'border-[#3A3A3A] bg-[#1C1C1C]'
                  : 'border-[#262626] bg-[#141414] hover:border-[#3A3A3A]',
              )}
            >
              <div className="flex w-full items-start justify-between">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-300',
                    checked ? 'bg-[#F5F5F5] text-[#0A0A0A]' : 'bg-[#1C1C1C] text-[#6E6E6E]',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-300',
                    checked ? 'border-[#F5F5F5] bg-[#F5F5F5]' : 'border-[#3A3A3A] bg-[#141414]',
                  )}
                >
                  <AnimatePresence>
                    {checked && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Check className="h-4 w-4 text-[#0A0A0A]" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </div>
              <p
                className={cn(
                  'mt-3 font-medium transition-colors duration-300',
                  checked ? 'text-[#F5F5F5]' : 'text-[#A3A3A3]',
                )}
              >
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#A3A3A3]">{item.desc}</p>
              <AnimatePresence>
                {praise[item.key] && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 text-xs font-medium text-[#F5F5F5]"
                  >
                    {praise[item.key]}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}
