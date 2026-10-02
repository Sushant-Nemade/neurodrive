export interface Vec {
  x: number
  y: number
}

export interface Segment {
  a: Vec
  b: Vec
}

/** 2D cross product of two vectors (z-component). */
export function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function len(v: Vec): number {
  return Math.hypot(v.x, v.y)
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Ray vs segment intersection.
 * Ray: origin + t * dir (dir must be normalized, t >= 0)
 * Segment: a + u * (b - a), u in [0, 1]
 * Returns t (distance along the ray) or null.
 */
export function raySegment(origin: Vec, dir: Vec, a: Vec, b: Vec): number | null {
  const s = sub(b, a)
  const denom = cross(dir, s)
  if (Math.abs(denom) < 1e-9) return null
  const ap = sub(a, origin)
  const t = cross(ap, s) / denom
  const u = cross(ap, dir) / denom
  if (t >= 0 && u >= 0 && u <= 1) return t
  return null
}

/** Segment vs segment intersection test (boolean only). */
export function segmentsIntersect(p1: Vec, p2: Vec, p3: Vec, p4: Vec): boolean {
  const d1 = cross(sub(p4, p3), sub(p1, p3))
  const d2 = cross(sub(p4, p3), sub(p2, p3))
  const d3 = cross(sub(p2, p1), sub(p3, p1))
  const d4 = cross(sub(p2, p1), sub(p4, p1))
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** Convex polygon (list of vertices) vs segment intersection test. */
export function polygonHitsSegment(poly: Vec[], a: Vec, b: Vec): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    if (segmentsIntersect(p1, p2, a, b)) return true
  }
  return false
}

/** Convex polygon vs convex polygon intersection test (edge crossing). */
export function polygonsIntersect(p1: Vec[], p2: Vec[]): boolean {
  for (let i = 0; i < p1.length; i++) {
    const a = p1[i]
    const b = p1[(i + 1) % p1.length]
    if (polygonHitsSegment(p2, a, b)) return true
  }
  return false
}
