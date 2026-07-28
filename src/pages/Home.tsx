import { useMemo } from 'react'
import { Download, HeartHandshake } from 'lucide-react'
import { usePlanData } from '@/hooks/usePlanData'
import { dateKey } from '@/lib/plan'
import Hero from '@/components/Hero'
import TodayCheckin from '@/components/TodayCheckin'
import WeightSection from '@/components/WeightSection'
import Footprint from '@/components/Footprint'

export default function Home() {
  const today = useMemo(() => new Date(), [])
  const todayKey = dateKey(today)
  const {
    data,
    setStartWeight,
    setWeight,
    removeWeight,
    toggleCheck,
    exportJSON,
  } = usePlanData()

  return (
    <div className="min-h-[100dvh] bg-[#FBF7EF] pb-16">
      <Hero today={today} />

      <main className="space-y-4">
        <TodayCheckin
          today={today}
          todayKey={todayKey}
          checkins={data.checkins}
          onToggle={toggleCheck}
          hasWeightToday={data.weights[todayKey] != null}
        />

        <WeightSection
          today={today}
          data={data}
          setStartWeight={setStartWeight}
          setWeight={setWeight}
          removeWeight={removeWeight}
        />

        <Footprint today={today} data={data} />
      </main>

      <footer className="mx-auto mt-8 max-w-3xl px-5">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-6 py-6 text-center shadow-softer">
          <button
            type="button"
            onClick={exportJSON}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#E4D8C8] bg-white px-5 py-2.5 text-sm text-[#8A7F72] transition-colors hover:border-[#E8967A] hover:text-[#E8967A]"
          >
            <Download className="h-4 w-4" />
            导出数据（JSON）
          </button>
          <p className="flex items-center gap-1.5 text-xs text-[#B4ABA0]">
            <HeartHandshake className="h-3.5 w-3.5" />
            数据只属于你，安安静静地存在这台设备里。
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-[#C9BFB2]">
          轻盈计划 · 2026-07-28 → 2026-09-15 · 慢慢来，今天也很好
        </p>
      </footer>
    </div>
  )
}
