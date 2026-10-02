import { NeuralNet, type BrainJSON } from './nn'
import { World, type CarState } from './sim'

/** Policy network topology: 7 ray sensors + speed → 12 tanh → steer + throttle. */
export const BRAIN_SIZES = [8, 12, 2]

export interface EvoConfig {
  population: number
  mutationRate: number
  mutationStrength: number
  eliteCount: number
  /** Hard per-generation time cap in simulated seconds. */
  generationCap: number
}

export const DEFAULT_CONFIG: EvoConfig = {
  population: 180,
  mutationRate: 0.12,
  mutationStrength: 0.35,
  eliteCount: 4,
  generationCap: 45,
}

export interface GenerationRecord {
  generation: number
  best: number
  avg: number
}

const CHAMPION_KEY = 'neurodrive.champion.v1'

export class Evolution {
  world: World
  config: EvoConfig
  cars: CarState[] = []
  generation = 1
  genTime = 0
  history: GenerationRecord[] = []
  allTimeBest = 0
  champion: BrainJSON | null = null
  championSource: 'evolved' | 'loaded' | null = null

  constructor(world: World, config: EvoConfig = DEFAULT_CONFIG) {
    this.world = world
    this.config = config
    this.champion = this.loadStoredChampion()
    if (this.champion) this.championSource = 'loaded'
    this.spawnPopulation()
  }

  private spawnPopulation(seedBrain?: BrainJSON | null): void {
    this.cars = []
    for (let i = 0; i < this.config.population; i++) {
      let brain: NeuralNet
      if (seedBrain && i === 0) {
        brain = NeuralNet.deserialize(seedBrain)
      } else if (seedBrain && i < 12) {
        brain = NeuralNet.deserialize(seedBrain)
        brain.mutate(0.25, 0.4)
      } else {
        brain = new NeuralNet(BRAIN_SIZES)
      }
      const car = this.world.createCar(brain)
      // Grid start: 4 lanes abreast, rows staggered backwards.
      const lane = ((i % 4) - 1.5) * 24
      this.world.placeCar(car, Math.floor(i / 4), lane)
      this.cars.push(car)
    }
  }

  get aliveCount(): number {
    let n = 0
    for (const c of this.cars) if (c.alive) n++
    return n
  }

  get bestCar(): CarState {
    let best = this.cars[0]
    for (const c of this.cars) if (c.fitness > best.fitness) best = c
    return best
  }

  step(dt: number): void {
    this.genTime += dt
    this.world.stepTraffic(dt)
    for (const car of this.cars) {
      if (car.alive) this.world.stepCar(car, dt)
    }
    if (this.aliveCount === 0 || this.genTime >= this.config.generationCap) {
      this.nextGeneration()
    }
  }

  private nextGeneration(): void {
    const ranked = [...this.cars].sort((a, b) => b.fitness - a.fitness)
    const best = ranked[0]
    const avg = ranked.reduce((s, c) => s + c.fitness, 0) / ranked.length
    this.history.push({ generation: this.generation, best: best.fitness, avg })
    if (this.history.length > 120) this.history.shift()

    // Checkpoint the all-time best policy.
    if (best.fitness > this.allTimeBest && best.brain) {
      this.allTimeBest = best.fitness
      this.champion = best.brain.serialize()
      this.championSource = 'evolved'
      this.storeChampion(this.champion)
    }

    // Breed the next population: elitism + tournament selection +
    // uniform crossover + gaussian mutation.
    const eliteBrains = ranked.slice(0, this.config.eliteCount).map((c) => c.brain!)
    const nextBrains: NeuralNet[] = []
    nextBrains.push(eliteBrains[0].clone()) // champion passes through untouched
    for (let i = 1; i < this.config.eliteCount; i++) {
      const e = eliteBrains[i].clone()
      e.mutate(this.config.mutationRate * 0.5, this.config.mutationStrength * 0.5)
      nextBrains.push(e)
    }
    while (nextBrains.length < this.config.population) {
      const a = this.tournament(ranked)
      const b = this.tournament(ranked)
      const child = NeuralNet.crossover(a.brain!, b.brain!)
      child.mutate(this.config.mutationRate, this.config.mutationStrength)
      nextBrains.push(child)
    }

    this.generation++
    this.genTime = 0
    for (let i = 0; i < this.cars.length; i++) {
      this.cars[i].brain = nextBrains[i]
      const lane = ((i % 4) - 1.5) * 24
      this.world.placeCar(this.cars[i], Math.floor(i / 4), lane)
    }
  }

  private tournament(ranked: CarState[]): CarState {
    let winner = ranked[(Math.random() * ranked.length) | 0]
    for (let i = 0; i < 3; i++) {
      const c = ranked[(Math.random() * ranked.length) | 0]
      if (c.fitness > winner.fitness) winner = c
    }
    return winner
  }

  /** Restart evolution from scratch (fresh random population). */
  reset(): void {
    this.generation = 1
    this.genTime = 0
    this.history = []
    this.allTimeBest = 0
    this.champion = null
    this.championSource = null
    localStorage.removeItem(CHAMPION_KEY)
    this.spawnPopulation()
  }

  /** Restart evolution seeded from a champion brain. */
  reseedFromChampion(brain: BrainJSON): void {
    this.champion = brain
    this.championSource = 'loaded'
    this.generation = 1
    this.genTime = 0
    this.history = []
    this.allTimeBest = 0
    this.spawnPopulation(brain)
  }

  /** Swap population size (requires a population restart). */
  setPopulation(size: number): void {
    this.config.population = size
    this.generation = 1
    this.genTime = 0
    this.history = []
    this.spawnPopulation(this.champion)
  }

  private storeChampion(brain: BrainJSON): void {
    try {
      localStorage.setItem(CHAMPION_KEY, JSON.stringify(brain))
    } catch {
      // Storage full / unavailable — checkpointing is best-effort.
    }
  }

  private loadStoredChampion(): BrainJSON | null {
    try {
      const raw = localStorage.getItem(CHAMPION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as BrainJSON
      if (!Array.isArray(parsed.sizes) || parsed.sizes.join(',') !== BRAIN_SIZES.join(',')) return null
      return parsed
    } catch {
      return null
    }
  }
}
