import { useEffect, useRef, useState, type RefObject } from 'react'
import { Evolution, type GenerationRecord } from './ga'
import { NeuralNet, type BrainJSON } from './nn'
import { render, type Camera } from './render'
import { World, type CarState, type Controls } from './sim'
import { buildTrack } from './track'

export type Mode = 'training' | 'manual' | 'autopilot'

export interface Hud {
  generation: number
  alive: number
  population: number
  genTime: number
  bestFitness: number
  allTimeBest: number
  history: GenerationRecord[]
  activations: number[][]
  mode: Mode
  speed: number
  mutationRate: number
  trafficCount: number
  championAvailable: boolean
  carSpeed: number
  carDamaged: boolean
}

export interface SimActions {
  setMode: (m: Mode) => void
  setSpeed: (s: number) => void
  setMutationRate: (r: number) => void
  setPopulation: (n: number) => void
  setTraffic: (n: number) => void
  resetEvolution: () => void
  reseedFromChampion: () => void
  exportChampion: () => void
  importChampion: (file: File) => Promise<void>
  respawnCar: () => void
}

const DT = 1 / 60

class Sim {
  world: World
  evo: Evolution
  manualCar: CarState
  camera: Camera = { x: 0, y: 0, scale: 1, rot: 0, initialized: false }
  mode: Mode = 'training'
  speed = 1
  keys = new Set<string>()
  autopilotBrain: NeuralNet | null = null
  autopilotBest = -1

  constructor() {
    this.world = new World(buildTrack(), 12)
    this.evo = new Evolution(this.world)
    this.manualCar = this.world.createCar(null)
    this.manualCar.alive = false
  }

  setMode(mode: Mode): void {
    this.mode = mode
    if (mode !== 'training') {
      this.respawnCar()
    }
  }

  respawnCar(): void {
    this.world.placeCar(this.manualCar, 0, 0)
    this.autopilotBest = -1
    this.autopilotBrain = null
    this.camera.initialized = false
  }

  manualControls(): Controls {
    const k = this.keys
    return {
      steer: (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0),
      throttle: k.has('arrowup') || k.has('w') ? 1 : 0,
      brake: k.has('arrowdown') || k.has('s') ? 1 : 0,
    }
  }

  step(): void {
    for (let i = 0; i < this.speed; i++) {
      // The population keeps evolving in the background in every mode —
      // including while the human is driving.
      this.evo.step(DT)

      if (this.mode === 'manual') {
        if (this.manualCar.alive) {
          this.world.computeSensors(this.manualCar)
          this.world.stepCar(this.manualCar, DT, this.manualControls())
        }
      } else if (this.mode === 'autopilot') {
        // Hand the wheel to the strongest policy we have.
        if (this.evo.allTimeBest > this.autopilotBest && this.evo.champion) {
          this.autopilotBrain = NeuralNet.deserialize(this.evo.champion)
          this.autopilotBest = this.evo.allTimeBest
        }
        if (!this.autopilotBrain && this.evo.bestCar.brain) {
          this.autopilotBrain = this.evo.bestCar.brain
        }
        if (this.autopilotBrain) {
          this.manualCar.brain = this.autopilotBrain
          if (!this.manualCar.alive) this.respawnCar()
          this.world.stepCar(this.manualCar, DT)
        }
      }
    }
  }

  focusCar(): CarState | null {
    if (this.mode === 'training') {
      const best = this.evo.bestCar
      return best && best.alive ? best : null
    }
    return this.manualCar
  }

  focusActivations(): number[][] {
    if (this.mode !== 'training' && this.manualCar.brain?.lastActivations.length) {
      return this.manualCar.brain.lastActivations
    }
    const best = this.evo.bestCar
    return best?.brain?.lastActivations ?? []
  }
}

export function useSimulation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
): { hud: Hud; actions: SimActions } {
  const simRef = useRef<Sim | null>(null)
  const [hud, setHud] = useState<Hud>(() => ({
    generation: 1,
    alive: 0,
    population: 180,
    genTime: 0,
    bestFitness: 0,
    allTimeBest: 0,
    history: [],
    activations: [],
    mode: 'training',
    speed: 1,
    mutationRate: 0.12,
    trafficCount: 12,
    championAvailable: false,
    carSpeed: 0,
    carDamaged: false,
  }))

  useEffect(() => {
    const sim = new Sim()
    simRef.current = sim

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault()
      }
      if (down) {
        sim.keys.add(key)
        if (key === 'r' && sim.mode !== 'training') sim.respawnCar()
        if (key === '1') setMode('training')
        if (key === '2') setMode('manual')
        if (key === '3') setMode('autopilot')
      } else {
        sim.keys.delete(key)
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    let raf = 0
    let lastHud = 0
    const loop = (t: number) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const w = container.clientWidth
        const h = container.clientHeight
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr
          canvas.height = h * dpr
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          sim.step()
          const focus = sim.focusCar()
          render(
            ctx,
            sim.world,
            sim.evo,
            focus,
            sim.mode === 'training' ? 'overview' : 'follow',
            sim.camera,
            w,
            h,
          )
        }
      }
      if (t - lastHud > 120) {
        lastHud = t
        const focus = sim.focusCar()
        setHud({
          generation: sim.evo.generation,
          alive: sim.evo.aliveCount,
          population: sim.evo.config.population,
          genTime: sim.evo.genTime,
          bestFitness: sim.evo.bestCar?.fitness ?? 0,
          allTimeBest: sim.evo.allTimeBest,
          history: [...sim.evo.history],
          activations: sim.focusActivations(),
          mode: sim.mode,
          speed: sim.speed,
          mutationRate: sim.evo.config.mutationRate,
          trafficCount: sim.world.traffic.length,
          championAvailable: sim.evo.champion !== null,
          carSpeed: focus ? Math.abs(focus.speed) : 0,
          carDamaged: focus ? !focus.alive : false,
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setMode = (m: Mode) => {
    simRef.current?.setMode(m)
    setHud((h) => ({ ...h, mode: m }))
  }

  const actions: SimActions = {
    setMode,
    setSpeed: (s) => {
      if (simRef.current) simRef.current.speed = s
      setHud((h) => ({ ...h, speed: s }))
    },
    setMutationRate: (r) => {
      if (simRef.current) simRef.current.evo.config.mutationRate = r
      setHud((h) => ({ ...h, mutationRate: r }))
    },
    setPopulation: (n) => simRef.current?.evo.setPopulation(n),
    setTraffic: (n) => {
      simRef.current?.world.setTrafficCount(n)
      setHud((h) => ({ ...h, trafficCount: n }))
    },
    resetEvolution: () => simRef.current?.evo.reset(),
    reseedFromChampion: () => {
      const sim = simRef.current
      if (sim?.evo.champion) sim.evo.reseedFromChampion(sim.evo.champion)
    },
    exportChampion: () => {
      const champion = simRef.current?.evo.champion
      if (!champion) return
      const blob = new Blob([JSON.stringify(champion)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'neurodrive-champion.json'
      a.click()
      URL.revokeObjectURL(url)
    },
    importChampion: async (file: File) => {
      const text = await file.text()
      const brain = JSON.parse(text) as BrainJSON
      if (!brain.sizes || !brain.weights || !brain.biases) throw new Error('Invalid brain file')
      simRef.current?.evo.reseedFromChampion(brain)
    },
    respawnCar: () => simRef.current?.respawnCar(),
  }

  return { hud, actions }
}
