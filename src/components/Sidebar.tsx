import { useRef, type ReactNode } from 'react'
import type { Hud, Mode, SimActions } from '@/game/useSim'
import { BrainViz } from './BrainViz'
import { FitnessChart } from './FitnessChart'

function Module({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-[#1a2540] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.2em] text-[#4b5b7a]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.18em] text-[#4b5b7a]">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: accent ?? '#e2e8f0' }}>
        {value}
      </div>
    </div>
  )
}

function Btn({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border px-2 py-1.5 text-[10px] font-semibold tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? 'border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]'
          : 'border-[#1a2540] text-[#8b9cc0] hover:border-[#22d3ee]/50 hover:text-[#c7d3e8]'
      }`}
    >
      {children}
    </button>
  )
}

const MODES: { id: Mode; label: string; keyHint: string }[] = [
  { id: 'training', label: 'TRAINING', keyHint: '1' },
  { id: 'manual', label: 'DRIVE', keyHint: '2' },
  { id: 'autopilot', label: 'AUTOPILOT', keyHint: '3' },
]

export function Sidebar({ hud, actions }: { hud: Hud; actions: SimActions }) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <aside className="flex w-full flex-col overflow-y-auto border-t border-[#1a2540] bg-[#0c1220] lg:h-full lg:w-[380px] lg:border-l lg:border-t-0">
      <Module title="MODE">
        <div className="grid grid-cols-3 gap-1.5">
          {MODES.map((m) => (
            <Btn key={m.id} active={hud.mode === m.id} onClick={() => actions.setMode(m.id)}>
              {m.label} <span className="opacity-40">[{m.keyHint}]</span>
            </Btn>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#4b5b7a]">
          {hud.mode === 'training' && 'Watch the population evolve. The AI trains continuously.'}
          {hud.mode === 'manual' && 'You drive. The population keeps evolving in the background.'}
          {hud.mode === 'autopilot' && 'The all-time best neural network drives. Watch its sensors fire.'}
        </p>
      </Module>

      <Module title="TELEMETRY">
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          <Stat label="GENERATION" value={String(hud.generation).padStart(3, '0')} accent="#22d3ee" />
          <Stat label="ALIVE" value={`${hud.alive}/${hud.population}`} />
          <Stat label="GEN TIME" value={`${hud.genTime.toFixed(1)}s`} />
          <Stat label="BEST FITNESS" value={hud.bestFitness.toFixed(0)} accent="#22d3ee" />
          <Stat label="ALL-TIME BEST" value={hud.allTimeBest.toFixed(0)} accent="#34d399" />
          <Stat
            label="FOCUS SPEED"
            value={hud.mode === 'training' ? '—' : `${Math.round(hud.carSpeed * 1.8)} km/h`}
            accent={hud.carDamaged ? '#f87171' : undefined}
          />
        </div>
      </Module>

      <Module title="LEARNING CURVE">
        <FitnessChart history={hud.history} />
      </Module>

      <Module
        title="POLICY NETWORK — LIVE"
        right={<span className="text-[9px] tracking-widest text-[#34d399]">8 → 12 → 2</span>}
      >
        <BrainViz activations={hud.activations} />
      </Module>

      <Module title="EVOLUTION CONTROLS">
        <div className="mb-3">
          <div className="mb-1 text-[9px] tracking-[0.18em] text-[#4b5b7a]">SIMULATION SPEED</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 4, 8].map((s) => (
              <Btn key={s} active={hud.speed === s} onClick={() => actions.setSpeed(s)}>
                {s}×
              </Btn>
            ))}
          </div>
        </div>
        <label className="mb-3 block">
          <div className="mb-1 flex justify-between text-[9px] tracking-[0.18em] text-[#4b5b7a]">
            <span>MUTATION RATE</span>
            <span className="text-[#22d3ee]">{hud.mutationRate.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.4}
            step={0.01}
            value={hud.mutationRate}
            onChange={(e) => actions.setMutationRate(parseFloat(e.target.value))}
            className="nd-slider w-full"
          />
        </label>
        <div className="mb-3">
          <div className="mb-1 text-[9px] tracking-[0.18em] text-[#4b5b7a]">POPULATION (RESTARTS RUN)</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[60, 120, 180, 240].map((p) => (
              <Btn key={p} active={hud.population === p} onClick={() => actions.setPopulation(p)}>
                {p}
              </Btn>
            ))}
          </div>
        </div>
        <label className="block">
          <div className="mb-1 flex justify-between text-[9px] tracking-[0.18em] text-[#4b5b7a]">
            <span>TRAFFIC DENSITY</span>
            <span className="text-[#fbbf24]">{hud.trafficCount} CARS</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={hud.trafficCount}
            onChange={(e) => actions.setTraffic(parseInt(e.target.value))}
            className="nd-slider w-full"
          />
        </label>
      </Module>

      <Module
        title="CHAMPION BRAIN"
        right={
          hud.championAvailable ? (
            <span className="text-[9px] tracking-widest text-[#34d399]">● CHECKPOINTED</span>
          ) : (
            <span className="text-[9px] tracking-widest text-[#4b5b7a]">○ NONE YET</span>
          )
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Btn onClick={actions.exportChampion} disabled={!hud.championAvailable}>
            EXPORT JSON
          </Btn>
          <Btn onClick={() => fileRef.current?.click()}>IMPORT JSON</Btn>
          <Btn onClick={actions.reseedFromChampion} disabled={!hud.championAvailable}>
            RESEED RUN
          </Btn>
          <Btn onClick={actions.resetEvolution}>RESET ALL</Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) actions.importChampion(f).catch(() => alert('Invalid brain file'))
            e.target.value = ''
          }}
        />
        <p className="mt-2 text-[10px] leading-relaxed text-[#4b5b7a]">
          Best-ever policy auto-checkpoints to your browser. Export it, share it, or reseed a fresh
          population from it.
        </p>
      </Module>

      <Module title="CONTROLS">
        <div className="grid grid-cols-2 gap-y-1 text-[10px] text-[#8b9cc0]">
          <span>↑ / W</span>
          <span className="text-right text-[#4b5b7a]">THROTTLE</span>
          <span>↓ / S</span>
          <span className="text-right text-[#4b5b7a]">BRAKE / REVERSE</span>
          <span>← → / A D</span>
          <span className="text-right text-[#4b5b7a]">STEER</span>
          <span>R</span>
          <span className="text-right text-[#4b5b7a]">RESPAWN</span>
          <span>1 · 2 · 3</span>
          <span className="text-right text-[#4b5b7a]">SWITCH MODE</span>
        </div>
      </Module>

      <div className="px-4 py-3 text-[9px] tracking-[0.18em] text-[#4b5b7a]">
        NEURODRIVE v1.0 — NEUROEVOLUTION IN THE BROWSER
      </div>
    </aside>
  )
}
