export function Overlay({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center bg-[#050810]/85 px-6 backdrop-blur-sm"
      onClick={onEnter}
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[0.3em] text-[#34d399]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#34d399]" />
        NEUROEVOLUTION SIMULATOR
      </div>
      <h1 className="text-center text-5xl font-extrabold tracking-tight text-[#e2e8f0] md:text-7xl">
        NEURO<span className="text-[#22d3ee]">DRIVE</span>
      </h1>
      <p className="mt-4 max-w-md text-center text-xs leading-relaxed text-[#8b9cc0] md:text-sm">
        A population of neural networks learns to drive — live, in your browser. No servers, no ML
        frameworks. Just sensors, a policy network, and a genetic algorithm.
      </p>

      <div className="mt-8 grid max-w-lg grid-cols-1 gap-px border border-[#1a2540] bg-[#1a2540] text-[10px] tracking-widest md:grid-cols-3">
        {[
          ['RAY-CAST PERCEPTION', '7 sensors feed the policy network'],
          ['GENETIC ALGORITHM', 'crossover + mutation over generations'],
          ['BACKGROUND TRAINING', 'the AI keeps learning while you drive'],
        ].map(([t, d]) => (
          <div key={t} className="bg-[#0c1220] p-4">
            <div className="text-[#22d3ee]">{t}</div>
            <div className="mt-1 normal-case tracking-normal text-[#4b5b7a]">{d}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onEnter}
        className="mt-10 border border-[#22d3ee] bg-[#22d3ee]/10 px-8 py-3 text-xs font-bold tracking-[0.3em] text-[#22d3ee] transition-colors hover:bg-[#22d3ee] hover:text-[#050810]"
      >
        INITIALIZE SIMULATION
      </button>
      <div className="mt-6 text-[9px] tracking-[0.25em] text-[#4b5b7a]">
        BUILT BY SUSHANT NEMADE · APPLIED AI
      </div>
    </div>
  )
}
