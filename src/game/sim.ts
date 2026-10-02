import { NeuralNet } from './nn'
import { pointAt, type Track } from './track'
import { polygonsIntersect, raySegment, segmentsIntersect, type Vec } from './types'

/** Vehicle dynamics constants (world units / seconds). */
export const CAR = {
  length: 26,
  width: 13,
  maxSpeed: 200,
  maxReverse: 55,
  accel: 150,
  brake: 260,
  drag: 0.55,
  steerRate: 3.4,
  sensorLength: 240,
}

/** Ray angles relative to heading — the car's "eyes". */
export const SENSOR_ANGLES = [-1.35, -0.8, -0.4, 0, 0.4, 0.8, 1.35]

export interface Controls {
  /** -1 (full left) .. 1 (full right) */
  steer: number
  /** 0 .. 1 */
  throttle: number
  /** 0 .. 1 */
  brake: number
}

export interface CarState {
  pos: Vec
  angle: number
  speed: number
  alive: boolean
  brain: NeuralNet | null
  sensors: number[]
  sensorHits: Vec[]
  /** Unwrapped progress measured in centerline samples. */
  progress: number
  lap: number
  lastIdx: number
  bestProgress: number
  idleTime: number
  fitness: number
  distanceDriven: number
}

export interface TrafficCar {
  /** Fractional position along the centerline (sample units). */
  s: number
  lane: number
  speed: number
  pos: Vec
  angle: number
  poly: Vec[]
}

export function carPolygon(pos: Vec, angle: number): Vec[] {
  const hl = CAR.length / 2
  const hw = CAR.width / 2
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const pts = [
    { x: hl, y: hw },
    { x: hl, y: -hw },
    { x: -hl, y: -hw },
    { x: -hl, y: hw },
  ]
  return pts.map((p) => ({ x: pos.x + p.x * c - p.y * s, y: pos.y + p.x * s + p.y * c }))
}

export class World {
  track: Track
  traffic: TrafficCar[] = []

  constructor(track: Track, trafficCount = 12) {
    this.track = track
    this.setTrafficCount(trafficCount)
  }

  setTrafficCount(count: number): void {
    const n = this.track.center.length
    this.traffic = []
    for (let i = 0; i < count; i++) {
      const s = (i / count) * n
      const lane = (i % 2 === 0 ? 1 : -1) * (14 + (i % 3) * 8)
      const speed = 55 + ((i * 37) % 45)
      const t = this.trafficPose(s, lane)
      this.traffic.push({ s, lane, speed, pos: t.pos, angle: t.angle, poly: t.poly })
    }
  }

  private trafficPose(s: number, lane: number) {
    const p = pointAt(this.track, s)
    const pos = {
      x: p.pos.x + p.normal.x * lane,
      y: p.pos.y + p.normal.y * lane,
    }
    return { pos, angle: p.angle, poly: carPolygon(pos, p.angle) }
  }

  stepTraffic(dt: number): void {
    for (const car of this.traffic) {
      car.s += (car.speed * dt) / this.track.sampleSpacing
      const t = this.trafficPose(car.s, car.lane)
      car.pos = t.pos
      car.angle = t.angle
      car.poly = t.poly
    }
  }

  createCar(brain: NeuralNet | null): CarState {
    const car: CarState = {
      pos: { x: 0, y: 0 },
      angle: 0,
      speed: 0,
      alive: true,
      brain,
      sensors: new Array(SENSOR_ANGLES.length).fill(0),
      sensorHits: [],
      progress: 0,
      lap: 0,
      lastIdx: 0,
      bestProgress: 0,
      idleTime: 0,
      fitness: 0,
      distanceDriven: 0,
    }
    this.placeCar(car, 0, 0)
    return car
  }

  /** Place a car at a slot behind the start line (slot 0 = on the line). */
  placeCar(car: CarState, slotIndex: number, laneOffset: number): void {
    const back = -slotIndex * 2.2 - 4
    const p = pointAt(this.track, back)
    car.pos = {
      x: p.pos.x + p.normal.x * laneOffset,
      y: p.pos.y + p.normal.y * laneOffset,
    }
    car.angle = p.angle
    car.speed = 0
    car.alive = true
    car.sensors.fill(0)
    car.progress = back
    car.lap = back < 0 ? -1 : 0
    car.lastIdx = ((Math.round(back) % this.track.center.length) + this.track.center.length) % this.track.center.length
    car.bestProgress = back
    car.idleTime = 0
    car.fitness = 0
    car.distanceDriven = 0
  }

  /**
   * Advance one car by dt seconds. When a brain is attached the controls
   * come from the policy network; otherwise they are passed in.
   */
  stepCar(car: CarState, dt: number, controls?: Controls): void {
    if (!car.alive) return

    let ctl = controls
    if (!ctl) {
      this.computeSensors(car)
      const out = car.brain!.forward([...car.sensors, car.speed / CAR.maxSpeed])
      ctl = { steer: out[0], throttle: out[out.length - 1], brake: 0 }
    }

    // Longitudinal dynamics
    car.speed += ctl.throttle * CAR.accel * dt
    car.speed -= ctl.brake * CAR.brake * dt
    car.speed -= car.speed * CAR.drag * dt
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed))

    // Steering authority scales with speed (no turning while parked).
    const grip = Math.min(1, Math.abs(car.speed) / (CAR.maxSpeed * 0.35))
    car.angle += ctl.steer * CAR.steerRate * grip * dt * (car.speed >= 0 ? 1 : -1)

    car.pos.x += Math.cos(car.angle) * car.speed * dt
    car.pos.y += Math.sin(car.angle) * car.speed * dt
    car.distanceDriven += Math.abs(car.speed) * dt

    this.updateProgress(car, dt, car.brain !== null)

    // Fitness: how far along the lap the car has ever been, plus a small
    // bonus for total distance so "keep moving" beats "park safely".
    car.fitness = car.bestProgress + car.distanceDriven * 0.002

    if (this.collides(car)) {
      car.alive = false
    }
  }

  /**
   * Track progress as an unwrapped centerline index. We only search a
   * local window around the last known index — cars move continuously,
   * so this is O(window) instead of O(track) per car per step.
   */
  private updateProgress(car: CarState, dt: number, killOnIdle: boolean): void {
    const n = this.track.center.length
    const win = 16
    let bestIdx = car.lastIdx
    let bestD = Infinity
    for (let k = -win; k <= win; k++) {
      const i = (((car.lastIdx + k) % n) + n) % n
      const p = this.track.center[i]
      const d = (p.x - car.pos.x) ** 2 + (p.y - car.pos.y) ** 2
      if (d < bestD) {
        bestD = d
        bestIdx = i
      }
    }
    let delta = bestIdx - car.lastIdx
    if (delta > n / 2) delta -= n
    if (delta < -n / 2) delta += n
    car.lastIdx = bestIdx
    car.progress += delta
    car.lap = Math.floor(car.progress / n)

    // Anti-idle guard: kill cars that stop making progress. This is what
    // lets a generation end early instead of waiting for the timeout.
    if (car.progress > car.bestProgress + 0.5) {
      car.bestProgress = car.progress
      car.idleTime = 0
    } else {
      car.idleTime += dt
      if (killOnIdle && car.idleTime > 4) car.alive = false
    }
  }

  /** Collision test against nearby wall segments and every traffic car. */
  private collides(car: CarState): boolean {
    const poly = carPolygon(car.pos, car.angle)
    const n = this.track.center.length
    const win = 12
    for (let k = -win; k <= win; k++) {
      const i = (((car.lastIdx + k) % n) + n) % n
      const lw = this.track.leftWall[i]
      const rw = this.track.rightWall[i]
      for (const seg of [lw, rw]) {
        // Cheap AABB reject before the exact test.
        const minX = Math.min(seg.a.x, seg.b.x) - CAR.length
        const maxX = Math.max(seg.a.x, seg.b.x) + CAR.length
        const minY = Math.min(seg.a.y, seg.b.y) - CAR.length
        const maxY = Math.max(seg.a.y, seg.b.y) + CAR.length
        if (car.pos.x < minX || car.pos.x > maxX || car.pos.y < minY || car.pos.y > maxY) continue
        for (let e = 0; e < 4; e++) {
          if (segmentsIntersect(poly[e], poly[(e + 1) % 4], seg.a, seg.b)) return true
        }
      }
    }
    for (const t of this.traffic) {
      const dx = t.pos.x - car.pos.x
      const dy = t.pos.y - car.pos.y
      if (dx * dx + dy * dy > (CAR.length * 2.2) ** 2) continue
      if (polygonsIntersect(poly, t.poly)) return true
    }
    return false
  }

  /**
   * Ray-cast the sensor suite. Each ray returns a value in (0, 1]:
   * 1 = obstacle touching the car, 0 = nothing within range.
   */
  computeSensors(car: CarState): void {
    car.sensorHits = []
    for (let r = 0; r < SENSOR_ANGLES.length; r++) {
      const a = car.angle + SENSOR_ANGLES[r]
      const dir = { x: Math.cos(a), y: Math.sin(a) }
      let minT = CAR.sensorLength

      const n = this.track.center.length
      const win = 40
      for (let k = -win; k <= win; k++) {
        const i = (((car.lastIdx + k) % n) + n) % n
        for (const seg of [this.track.leftWall[i], this.track.rightWall[i]]) {
          const t = raySegment(car.pos, dir, seg.a, seg.b)
          if (t !== null && t < minT) minT = t
        }
      }
      for (const tc of this.traffic) {
        for (let e = 0; e < 4; e++) {
          const t = raySegment(car.pos, dir, tc.poly[e], tc.poly[(e + 1) % 4])
          if (t !== null && t < minT) minT = t
        }
      }

      car.sensors[r] = minT >= CAR.sensorLength ? 0 : 1 - minT / CAR.sensorLength
      car.sensorHits.push({
        x: car.pos.x + dir.x * minT,
        y: car.pos.y + dir.y * minT,
      })
    }
  }
}
