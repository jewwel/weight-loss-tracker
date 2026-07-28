import { memo } from 'react'
import { motion } from 'framer-motion'
import { Sprout, Quote } from 'lucide-react'
import { daysLeft, todaySlogan, weekdayCN, PLAN_END } from '@/lib/plan'
import { format } from 'date-fns'

/** 漂浮装饰：隔离的 memo 组件，避免父级重渲染重置动画 */
const FloatingLeaf = memo(function FloatingLeaf({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      aria-hidden
      className={className}
      animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <path
          d="M36 8C50 18 58 32 54 48C50 62 38 66 36 66C34 66 22 62 18 48C14 32 22 18 36 8Z"
          fill="#F6CFC7"
          opacity="0.55"
        />
        <path
          d="M36 14C44 22 49 32 46 44"
          stroke="#E8967A"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </motion.div>
  )
})

const FloatingFlower = memo(function FloatingFlower({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      aria-hidden
      className={className}
      animate={{ y: [0, 8, 0], rotate: [0, -6, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse
            key={deg}
            cx="44"
            cy="26"
            rx="10"
            ry="18"
            fill="#F5D9BC"
            opacity="0.5"
            transform={`rotate(${deg} 44 44)`}
          />
        ))}
        <circle cx="44" cy="44" r="9" fill="#EFC49F" opacity="0.7" />
      </svg>
    </motion.div>
  )
})

export default function Hero({ today }: { today: Date }) {
  const left = daysLeft(today)
  const ended = left === 0
  const slogan = todaySlogan(today)

  return (
    <section className="relative overflow-hidden px-5 pt-14 pb-10 sm:pt-20">
      <FloatingLeaf className="absolute top-8 right-4 sm:right-16" />
      <FloatingFlower className="absolute bottom-4 left-2 sm:left-12" delay={1.2} />

      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F0F4EC] px-4 py-1.5 text-sm text-[#7C9473]">
            <Sprout className="h-4 w-4" />
            温柔地，走向更好的自己
          </div>
          <h1 className="font-serif-sc text-4xl font-bold tracking-wide text-[#5C544B] sm:text-5xl">
            轻盈计划
          </h1>
          <p className="mt-3 text-sm text-[#9B9084]">
            今天是 {format(today, 'yyyy年M月d日')} · {weekdayCN(today)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          {ended ? (
            <p className="font-serif-sc text-2xl font-semibold text-[#5C544B] sm:text-3xl">
              计划日已到，回头看看，
              <br className="sm:hidden" />
              你已经走了很远。
            </p>
          ) : (
            <p className="font-serif-sc text-[#5C544B]">
              <span className="text-xl sm:text-2xl">
                距离 {format(PLAN_END, 'M月d日')} 还有
              </span>
              <span className="mx-2 align-baseline text-6xl font-black text-[#E8967A] sm:text-7xl">
                {left}
              </span>
              <span className="text-xl sm:text-2xl">天</span>
            </p>
          )}
        </motion.div>

        <motion.div
          key={slogan}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="shadow-soft mx-auto mt-10 max-w-xl rounded-3xl border border-[#EFE6DA] bg-[#FFFDF9] px-7 py-6 text-left"
        >
          <div className="flex items-start gap-3">
            <Quote className="mt-1 h-6 w-6 shrink-0 rotate-180 text-[#F2B8A0]" />
            <div>
              <p className="text-xs tracking-widest text-[#9B9084]">今日想说给你听</p>
              <p className="font-serif-sc mt-2 text-2xl font-semibold leading-relaxed text-[#5C544B] sm:text-[1.7rem]">
                {slogan}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
