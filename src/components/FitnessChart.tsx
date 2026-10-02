import type { GenerationRecord } from '@/game/ga'

/** Fitness-over-generations learning curve (best + population average). */
export function FitnessChart({ history }: { history: GenerationRecord[] }) {
  const W = 340
  const H = 88
  if (history.length < 2) {
    return (
      <div className="flex h-[88px] items-center justify-center text-[10px] tracking-widest text-[#4b5b7a]">
        COLLECTING GENERATION DATA…
      </div>
    )
  }
  const max = Math.max(...history.map((r) => r.best), 1)
  const stepX = W / Math.max(history.length - 1, 1)
  const yOf = (v: number) => H - 6 - (v / max) * (H - 18)

  const bestPts = history.map((r, i) => `${(i * stepX).toFixed(1)},${yOf(r.best).toFixed(1)}`).join(' ')
  const avgPts = history.map((r, i) => `${(i * stepX).toFixed(1)},${yOf(r.avg).toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#1a2540" strokeWidth={0.5} />
        ))}
        <polyline points={avgPts} fill="none" stroke="#fbbf24" strokeOpacity={0.45} strokeWidth={1} />
        <polyline points={bestPts} fill="none" stroke="#22d3ee" strokeWidth={1.6} />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] tracking-widest text-[#4b5b7a]">
        <span className="text-[#22d3ee]">— BEST FITNESS</span>
        <span className="text-[#fbbf24]/70">— POPULATION AVG</span>
        <span>GEN {history[history.length - 1].generation}</span>
      </div>
    </div>
  )
}
