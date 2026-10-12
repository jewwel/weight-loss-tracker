import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { WeightPhase } from '@/lib/phase'
import WeightSection from '@/components/WeightSection'
import PhaseHistory from '@/components/PhaseHistory'

/**
 * 这些断言只检查页面结构；recharts 在无 DOM 环境下不产出内容，
 * 这里用占位组件替代，避免把图表库的渲染细节耦合进测试。
 */
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: ReactNode }) => (
    <div data-chart="stub">{children}</div>
  )
  return {
    ResponsiveContainer: Stub,
    ComposedChart: Stub,
    LineChart: Stub,
    Area: Stub,
    Line: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    ReferenceLine: Stub,
    Tooltip: Stub,
  }
})

const TODAY = new Date(2026, 9, 12) // 2026-10-12

const activePhase: WeightPhase = {
  id: 1,
  name: '第 1 阶段',
  startDate: '2026-07-28',
  endDate: '2026-09-15',
  startWeight: 78,
  goalWeight: 65,
  status: 'active',
  summary: null,
  createdAt: '2026-07-28',
  archivedAt: null,
}

const weights = {
  '2026-07-28': 78,
  '2026-08-10': 76.4,
  '2026-09-15': 73.2,
  '2026-10-12': 74,
}
const checkins = {
  '2026-07-28': { exercise: true, snackFree: true, weighed: true },
  '2026-08-10': { exercise: true },
}

const data = { startWeight: 78, weights, checkins }

const noop = () => {}
const asyncNoop = async () => null

function renderWeightSection(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <WeightSection
      today={TODAY}
      data={data}
      phase={activePhase}
      phases={[activePhase]}
      archivedPhases={[]}
      needsNewPhase={false}
      needsPhaseSetup={false}
      setupHint=""
      phaseSaving={false}
      currentWeight={74}
      earliestDate="2026-07-28"
      setStartWeight={noop}
      setWeight={noop}
      removeWeight={noop}
      createPhase={asyncNoop}
      updateActivePhase={asyncNoop}
      {...overrides}
    />,
  )
}

describe('体重管理页面渲染', () => {
  it('正常阶段：显示阶段卡片、曲线说明与统计卡', () => {
    const html = renderWeightSection()
    expect(html).toContain('第 1 阶段')
    expect(html).toContain('已到期') // 2026-10-12 已过 2026-09-15
    expect(html).toContain('新建阶段')
    expect(html).toContain('编辑阶段')
    expect(html).toContain('归档并新建阶段')
    expect(html).toContain('体重记录')
    expect(html).toContain('曲线只画「第 1 阶段」的区间')
    expect(html).toContain('距目标 65kg')
    expect(html).toContain('78.0 kg')
  })

  it('阶段到期、且没点新建时，不会直接弹出表单', () => {
    expect(renderWeightSection()).not.toContain('新建体重目标阶段')
  })

  it('没有进行中的阶段：直接进入新建表单', () => {
    const draft: WeightPhase = {
      ...activePhase,
      id: 0,
      name: '第 2 阶段',
      startDate: '2026-10-12',
      endDate: '2026-12-06',
      startWeight: 74,
    }
    const html = renderWeightSection({
      phase: draft,
      phases: [activePhase],
      needsNewPhase: true,
      currentWeight: 74,
    })
    expect(html).toContain('新建体重目标阶段')
    expect(html).toContain('开始这个阶段')
    expect(html).toContain('定一个想去的方向')
  })

  it('云端还没升级：给出提示，但页面照常渲染不白屏', () => {
    const html = renderWeightSection({
      needsPhaseSetup: true,
      setupHint: '请先执行 supabase-phases.sql',
    })
    expect(html).toContain('新建阶段功能暂不可用')
    expect(html).toContain('请先执行 supabase-phases.sql')
    expect(html).toContain('体重记录')
  })

  it('没有任何体重记录时展示空状态而不是崩溃', () => {
    const html = renderWeightSection({
      data: { startWeight: null, weights: {}, checkins: {} },
      phase: { ...activePhase, startWeight: null },
      currentWeight: null,
    })
    expect(html).toContain('先告诉我这个阶段的起始体重吧')
    expect(html).toContain('目标曲线和体重曲线就会从这里开始生长')
  })
})

describe('历史阶段渲染', () => {
  const archived: WeightPhase = {
    ...activePhase,
    id: 9,
    status: 'archived',
    archivedAt: '2026-10-12T03:00:00.000Z',
    summary: {
      endWeight: 73.2,
      endWeightDate: '2026-09-15',
      lost: 4.8,
      goalReached: false,
      recordedDays: 3,
      checkinDays: 2,
      fullDays: 1,
      plannedDays: 50,
      actualDays: 50,
    },
  }

  it('默认收起，只露出入口和数量', () => {
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[archived]} weights={weights} checkins={checkins} />,
    )
    expect(html).toContain('历史阶段')
    expect(html).toContain('展开归档记录')
    expect(html).not.toContain('已归档')
  })

  it('展开后归档卡片显示冻结的快照数字', () => {
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[archived]} weights={weights} checkins={checkins} defaultOpen />,
    )
    expect(html).toContain('已归档')
    expect(html).toContain('减 4.8 kg')
    expect(html).toContain('73.2 kg')
    expect(html).toContain('3 / 2 天')
    expect(html).toContain('导出')
    expect(html).toContain('2026-07-28 → 2026-09-15')
  })

  it('达标阶段会带出「达标」标记', () => {
    const reached: WeightPhase = {
      ...archived,
      summary: { ...archived.summary!, goalReached: true },
    }
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[reached]} weights={weights} checkins={checkins} defaultOpen />,
    )
    expect(html).toContain('达标')
  })

  it('没有归档阶段时整段不渲染', () => {
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[]} weights={weights} checkins={checkins} />,
    )
    expect(html).toBe('')
  })

  it('老数据没有冻结快照时实时计算兜底', () => {
    const legacy: WeightPhase = { ...archived, summary: null, id: 8 }
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[legacy]} weights={weights} checkins={checkins} defaultOpen />,
    )
    expect(html).toContain('减 4.8 kg')
  })

  it('阶段内没有体重记录时展示空状态而不是崩溃', () => {
    const empty: WeightPhase = { ...archived, id: 7, summary: null }
    const html = renderToStaticMarkup(
      <PhaseHistory phases={[empty]} weights={{}} checkins={{}} defaultOpen />,
    )
    expect(html).toContain('暂无对比')
  })
})
