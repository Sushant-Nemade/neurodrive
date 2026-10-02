import type { Evolution } from './ga'
import { CAR, carPolygon, type CarState, type World } from './sim'

export type CameraMode = 'overview' | 'follow'

export interface Camera {
  x: number
  y: number
  scale: number
  rot: number
  initialized: boolean
}

export const PALETTE = {
  bg: '#050810',
  asphalt: '#0d1526',
  roadEdge: '#1a2540',
  centerline: 'rgba(34, 211, 238, 0.14)',
  grid: 'rgba(34, 211, 238, 0.05)',
  agent: 'rgba(34, 211, 238, 0.30)',
  agentElite: '#22d3ee',
  champion: '#34d399',
  traffic: '#fbbf24',
  trafficDark: '#92610e',
  damaged: 'rgba(248, 113, 113, 0.16)',
  sensor: 'rgba(52, 211, 153, 0.35)',
  start: '#fbbf24',
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return a + d * t
}

function drawCarBody(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  angle: number,
  fill: string,
  stroke?: string,
) {
  const poly = carPolygon(pos, angle)
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < 4; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  world: World,
  evo: Evolution,
  focus: CarState | null,
  mode: CameraMode,
  camera: Camera,
  w: number,
  h: number,
): void {
  const { track } = world

  // --- camera ---
  if (mode === 'overview') {
    const { minX, minY, maxX, maxY } = track.bounds
    const scale = Math.min(w / (maxX - minX + 120), h / (maxY - minY + 120))
    camera.x = (minX + maxX) / 2
    camera.y = (minY + maxY) / 2
    camera.scale = scale
    camera.rot = 0
    camera.initialized = true
  } else if (focus) {
    if (!camera.initialized) {
      camera.x = focus.pos.x
      camera.y = focus.pos.y
      camera.rot = -Math.PI / 2 - focus.angle
      camera.initialized = true
    }
    const targetRot = -Math.PI / 2 - focus.angle
    camera.x += (focus.pos.x - camera.x) * 0.12
    camera.y += (focus.pos.y - camera.y) * 0.12
    camera.rot = lerpAngle(camera.rot, targetRot, 0.1)
    camera.scale = Math.min(w, h) / 420
  }

  ctx.fillStyle = PALETTE.bg
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  if (mode === 'overview') {
    ctx.translate(w / 2, h / 2)
    ctx.scale(camera.scale, camera.scale)
    ctx.translate(-camera.x, -camera.y)
  } else {
    ctx.translate(w / 2, h * 0.62)
    ctx.scale(camera.scale, camera.scale)
    ctx.rotate(camera.rot)
    ctx.translate(-camera.x, -camera.y)
  }

  // --- engineering dot grid ---
  const b = track.bounds
  for (let gx = Math.floor(b.minX / 100) * 100; gx < b.maxX; gx += 100) {
    for (let gy = Math.floor(b.minY / 100) * 100; gy < b.maxY; gy += 100) {
      ctx.fillStyle = PALETTE.grid
      ctx.fillRect(gx - 1, gy - 1, 2, 2)
    }
  }

  // --- road ---
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(track.center[0].x, track.center[0].y)
  for (let i = 1; i < track.center.length; i++) ctx.lineTo(track.center[i].x, track.center[i].y)
  ctx.closePath()
  ctx.strokeStyle = PALETTE.roadEdge
  ctx.lineWidth = track.width + 16
  ctx.stroke()
  ctx.strokeStyle = PALETTE.asphalt
  ctx.lineWidth = track.width
  ctx.stroke()
  ctx.setLineDash([18, 26])
  ctx.strokeStyle = PALETTE.centerline
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])

  // --- start line ---
  const s0 = track.center[0]
  const n0 = track.normals[0]
  const half = track.width / 2
  ctx.beginPath()
  ctx.moveTo(s0.x + n0.x * half, s0.y + n0.y * half)
  ctx.lineTo(s0.x - n0.x * half, s0.y - n0.y * half)
  ctx.strokeStyle = PALETTE.start
  ctx.lineWidth = 4
  ctx.stroke()

  // --- traffic ---
  for (const t of world.traffic) {
    drawCarBody(ctx, t.pos, t.angle, PALETTE.traffic, PALETTE.trafficDark)
  }

  // --- evolving population ---
  const aliveRanked = evo.cars.filter((c) => c.alive).sort((x, y) => y.fitness - x.fitness)
  const eliteSet = new Set(aliveRanked.slice(0, 5))
  for (const car of evo.cars) {
    if (!car.alive) {
      drawCarBody(ctx, car.pos, car.angle, PALETTE.damaged)
    }
  }
  for (const car of evo.cars) {
    if (!car.alive) continue
    if (eliteSet.has(car)) {
      drawCarBody(ctx, car.pos, car.angle, PALETTE.agentElite, '#0e7490')
    } else {
      drawCarBody(ctx, car.pos, car.angle, PALETTE.agent)
    }
  }

  // --- focus car (manual / autopilot / training leader) ---
  if (focus && focus.alive) {
    if (focus.sensorHits.length > 0) {
      for (const hit of focus.sensorHits) {
        ctx.beginPath()
        ctx.moveTo(focus.pos.x, focus.pos.y)
        ctx.lineTo(hit.x, hit.y)
        ctx.strokeStyle = PALETTE.sensor
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(hit.x, hit.y, 2.4, 0, Math.PI * 2)
        ctx.fillStyle = PALETTE.champion
        ctx.fill()
      }
    }
    drawCarBody(ctx, focus.pos, focus.angle, PALETTE.champion, '#d1fae5')
    // heading tick
    ctx.beginPath()
    ctx.moveTo(focus.pos.x, focus.pos.y)
    ctx.lineTo(
      focus.pos.x + Math.cos(focus.angle) * CAR.length,
      focus.pos.y + Math.sin(focus.angle) * CAR.length,
    )
    ctx.strokeStyle = '#d1fae5'
    ctx.lineWidth = 2
    ctx.stroke()
  } else if (focus && !focus.alive) {
    drawCarBody(ctx, focus.pos, focus.angle, PALETTE.damaged, '#f87171')
  }

  ctx.restore()
}
