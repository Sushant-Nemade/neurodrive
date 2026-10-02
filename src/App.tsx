import { useRef, useState } from 'react'
import { Overlay } from '@/components/Overlay'
import { Sidebar } from '@/components/Sidebar'
import { useSimulation } from '@/game/useSim'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { hud, actions } = useSimulation(canvasRef, containerRef)
  const [entered, setEntered] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#050810] font-mono text-[#c7d3e8]">
      {/* header */}
      <header className="flex items-center justify-between border-b border-[#1a2540] bg-[#0c1220] px-4 py-2">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-extrabold tracking-tight text-[#e2e8f0]">
            NEURO<span className="text-[#22d3ee]">DRIVE</span>
          </span>
          <span className="hidden text-[9px] tracking-[0.25em] text-[#4b5b7a] sm:inline">
            SELF-DRIVING NEUROEVOLUTION ARENA
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] tracking-[0.18em]">
          <span className="hidden tabular-nums text-[#8b9cc0] md:inline">
            GEN {String(hud.generation).padStart(3, '0')} · ALIVE {hud.alive}/{hud.population} ·{' '}
            {hud.speed}×
          </span>
          <span className="flex items-center gap-1.5 text-[#34d399]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#34d399]" />
            LIVE
          </span>
          <a
            href="https://github.com/Sushant-Nemade/neurodrive"
            target="_blank"
            rel="noreferrer"
            className="text-[#4b5b7a] transition-colors hover:text-[#22d3ee]"
          >
            GITHUB ↗
          </a>
        </div>
      </header>

      {/* main */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={containerRef} className="relative min-h-[46vh] flex-1">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* in-world status chip */}
          <div className="pointer-events-none absolute left-3 top-3 border border-[#1a2540] bg-[#050810]/80 px-2.5 py-1.5 text-[9px] tracking-[0.2em] text-[#8b9cc0] backdrop-blur-sm">
            {hud.mode === 'training' && (
              <>
                MODE <span className="text-[#22d3ee]">TRAINING</span> — POPULATION EVOLVING
              </>
            )}
            {hud.mode === 'manual' && (
              <>
                MODE <span className="text-[#34d399]">MANUAL</span> — AI TRAINS IN BACKGROUND
              </>
            )}
            {hud.mode === 'autopilot' && (
              <>
                MODE <span className="text-[#fbbf24]">AUTOPILOT</span> — CHAMPION POLICY DRIVING
              </>
            )}
          </div>

          {/* wrecked banner */}
          {hud.mode !== 'training' && hud.carDamaged && (
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 border border-[#f87171] bg-[#050810]/90 px-6 py-3 text-center backdrop-blur-sm">
              <div className="text-sm font-bold tracking-[0.25em] text-[#f87171]">VEHICLE WRECKED</div>
              <button
                onClick={actions.respawnCar}
                className="mt-2 border border-[#f87171]/50 px-4 py-1 text-[10px] tracking-[0.2em] text-[#f87171] hover:bg-[#f87171] hover:text-[#050810]"
              >
                PRESS R / CLICK TO RESPAWN
              </button>
            </div>
          )}

          {!entered && <Overlay onEnter={() => setEntered(true)} />}
        </div>

        <Sidebar hud={hud} actions={actions} />
      </div>
    </div>
  )
}
