const INPUT_LABELS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'SPD']
const OUTPUT_LABELS = ['STEER', 'THRTL']

function nodeColor(v: number): string {
  // Negative activations glow red, positive glow mint; near-zero stays dark.
  if (v >= 0) {
    const a = 0.12 + 0.88 * Math.min(1, v)
    return `rgba(52, 211, 153, ${a.toFixed(2)})`
  }
  const a = 0.12 + 0.88 * Math.min(1, -v)
  return `rgba(248, 113, 113, ${a.toFixed(2)})`
}

/**
 * Live policy-network visualization. Node brightness = activation of the
 * focus car's brain on the latest forward pass; edge opacity = magnitude
 * of the signal leaving the source node.
 */
export function BrainViz({ activations }: { activations: number[][] }) {
  const W = 340
  const H = 216
  const layers = activations.length >= 3 ? activations : [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0]]
  const counts = layers.map((l) => l.length)
  const xPad = 34
  const xs = layers.map((_, l) => xPad + (l * (W - 2 * xPad)) / (layers.length - 1))

  const yFor = (l: number, i: number) => {
    const n = counts[l]
    const gap = Math.min(24, (H - 30) / n)
    const top = H / 2 - ((n - 1) * gap) / 2
    return top + i * gap
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* edges */}
      {layers.slice(0, -1).map((src, l) =>
        src.map((sv, i) =>
          layers[l + 1].map((_dv, j) => {
            const mag = Math.min(1, Math.abs(sv))
            return (
              <line
                key={`${l}-${i}-${j}`}
                x1={xs[l]}
                y1={yFor(l, i)}
                x2={xs[l + 1]}
                y2={yFor(l + 1, j)}
                stroke={sv >= 0 ? '#34d399' : '#f87171'}
                strokeOpacity={0.04 + mag * 0.3}
                strokeWidth={1}
              />
            )
          }),
        ),
      )}
      {/* nodes */}
      {layers.map((layer, l) =>
        layer.map((v, i) => (
          <g key={`n-${l}-${i}`}>
            <circle cx={xs[l]} cy={yFor(l, i)} r={l === 2 ? 8 : 5.5} fill={nodeColor(v)} stroke="#1a2540" strokeWidth={1} />
            {l === 0 && (
              <text x={xs[l] - 11} y={yFor(l, i) + 3} textAnchor="end" fontSize={7} fill="#4b5b7a">
                {INPUT_LABELS[i]}
              </text>
            )}
            {l === 2 && (
              <text x={xs[l] + 14} y={yFor(l, i) + 3} fontSize={7} fill="#4b5b7a">
                {OUTPUT_LABELS[i]}
              </text>
            )}
          </g>
        )),
      )}
      <text x={xs[0]} y={12} textAnchor="middle" fontSize={7} fill="#4b5b7a" letterSpacing={1}>
        SENSORS
      </text>
      <text x={xs[1]} y={12} textAnchor="middle" fontSize={7} fill="#4b5b7a" letterSpacing={1}>
        HIDDEN ×12
      </text>
      <text x={xs[2]} y={12} textAnchor="middle" fontSize={7} fill="#4b5b7a" letterSpacing={1}>
        POLICY
      </text>
    </svg>
  )
}
