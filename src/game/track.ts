import type { Segment, Vec } from './types'

export interface Track {
  /** Sampled centerline points forming a closed loop. */
  center: Vec[]
  /** Outward unit normal at each centerline sample. */
  normals: Vec[]
  /** Tangent angle (radians) at each centerline sample. */
  angles: number[]
  /** Wall segments, indexed to match centerline samples. */
  leftWall: Segment[]
  rightWall: Segment[]
  /** All wall segments (for broad-phase queries). */
  walls: Segment[]
  /** Track width in world units. */
  width: number
  /** World-space bounds of the whole track (for camera fit). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  /** Approximate world-unit distance between consecutive samples. */
  sampleSpacing: number
  /** Total lap length in world units. */
  lapLength: number
  startPos: Vec
  startAngle: number
}

/** Catmull-Rom spline interpolation between p1 and p2. */
function catmullRom(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

/**
 * Hand-designed circuit control points (world units).
 * A mix of fast sweepers, a hairpin and an S-curve section so the
 * evolved policy has to learn genuinely different driving skills.
 */
const CONTROL_POINTS: Vec[] = [
  { x: 420, y: 980 },
  { x: 430, y: 620 },
  { x: 700, y: 380 },
  { x: 1120, y: 300 },
  { x: 1520, y: 340 },
  { x: 1830, y: 520 },
  { x: 1980, y: 820 },
  { x: 1880, y: 1140 },
  { x: 1560, y: 1300 },
  { x: 1240, y: 1180 },
  { x: 1060, y: 940 },
  { x: 860, y: 1120 },
  { x: 640, y: 1260 },
]

const SAMPLES_PER_SEGMENT = 32
const TRACK_WIDTH = 120

export function buildTrack(): Track {
  const cp = CONTROL_POINTS
  const n = cp.length
  const center: Vec[] = []

  for (let i = 0; i < n; i++) {
    const p0 = cp[(i - 1 + n) % n]
    const p1 = cp[i]
    const p2 = cp[(i + 1) % n]
    const p3 = cp[(i + 2) % n]
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      center.push(catmullRom(p0, p1, p2, p3, s / SAMPLES_PER_SEGMENT))
    }
  }

  const count = center.length
  const normals: Vec[] = []
  const angles: number[] = []
  let lapLength = 0

  for (let i = 0; i < count; i++) {
    const prev = center[(i - 1 + count) % count]
    const next = center[(i + 1) % count]
    const tx = next.x - prev.x
    const ty = next.y - prev.y
    const tl = Math.hypot(tx, ty) || 1
    angles.push(Math.atan2(ty, tx))
    // Left-hand normal of the tangent.
    normals.push({ x: -ty / tl, y: tx / tl })
    lapLength += Math.hypot(
      center[(i + 1) % count].x - center[i].x,
      center[(i + 1) % count].y - center[i].y,
    )
  }

  const half = TRACK_WIDTH / 2
  const leftWall: Segment[] = []
  const rightWall: Segment[] = []
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    const li = { x: center[i].x + normals[i].x * half, y: center[i].y + normals[i].y * half }
    const lj = { x: center[j].x + normals[j].x * half, y: center[j].y + normals[j].y * half }
    const ri = { x: center[i].x - normals[i].x * half, y: center[i].y - normals[i].y * half }
    const rj = { x: center[j].x - normals[j].x * half, y: center[j].y - normals[j].y * half }
    leftWall.push({ a: li, b: lj })
    rightWall.push({ a: ri, b: rj })
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const seg of [...leftWall, ...rightWall]) {
    for (const p of [seg.a, seg.b]) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }

  return {
    center,
    normals,
    angles,
    leftWall,
    rightWall,
    walls: [...leftWall, ...rightWall],
    width: TRACK_WIDTH,
    bounds: { minX, minY, maxX, maxY },
    sampleSpacing: lapLength / count,
    lapLength,
    startPos: center[0],
    startAngle: angles[0],
  }
}

/** Centerline point + normal interpolated at a fractional sample index. */
export function pointAt(track: Track, s: number): { pos: Vec; normal: Vec; angle: number } {
  const count = track.center.length
  const wrapped = ((s % count) + count) % count
  const i = Math.floor(wrapped)
  const j = (i + 1) % count
  const f = wrapped - i
  const a = track.center[i]
  const b = track.center[j]
  const pos = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
  const na = track.normals[i]
  const nb = track.normals[j]
  const nx = na.x + (nb.x - na.x) * f
  const ny = na.y + (nb.y - na.y) * f
  const nl = Math.hypot(nx, ny) || 1
  return { pos, normal: { x: nx / nl, y: ny / nl }, angle: track.angles[i] }
}
