/**
 * A tiny feedforward neural network implemented from scratch.
 * No ML framework — the whole point of the project is that the
 * policy network, the forward pass and the evolutionary operators
 * are readable in a single file.
 */

export interface BrainJSON {
  sizes: number[]
  weights: number[][][] // [layer][out][in]
  biases: number[][] // [layer][out]
}

/** Box-Muller gaussian sample, mean 0, std 1. */
function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function tanh(x: number): number {
  return Math.tanh(x)
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

export class NeuralNet {
  readonly sizes: number[]
  /** weights[l] is an (out x in) row-major matrix for layer l. */
  weights: Float32Array[]
  biases: Float32Array[]
  /** Activations from the last forward pass (input + hidden + output). */
  lastActivations: number[][] = []

  constructor(sizes: number[]) {
    this.sizes = sizes
    this.weights = []
    this.biases = []
    for (let l = 1; l < sizes.length; l++) {
      const inN = sizes[l - 1]
      const outN = sizes[l]
      // Xavier-ish init keeps early generations from saturating tanh.
      const scale = Math.sqrt(2 / (inN + outN))
      const w = new Float32Array(outN * inN)
      for (let i = 0; i < w.length; i++) w[i] = gauss() * scale
      this.weights.push(w)
      this.biases.push(new Float32Array(outN))
    }
  }

  /**
   * Forward pass. Hidden layers use tanh; the final layer uses tanh for
   * every output except the last one (throttle), which uses a sigmoid so
   * it lands in [0, 1].
   */
  forward(input: number[]): number[] {
    let prev = input
    const acts: number[][] = [input]
    for (let l = 0; l < this.weights.length; l++) {
      const outN = this.sizes[l + 1]
      const inN = this.sizes[l]
      const w = this.weights[l]
      const b = this.biases[l]
      const isOutput = l === this.weights.length - 1
      const out = new Array<number>(outN)
      for (let o = 0; o < outN; o++) {
        let sum = b[o]
        const row = o * inN
        for (let i = 0; i < inN; i++) sum += w[row + i] * prev[i]
        out[o] = isOutput && o === outN - 1 ? sigmoid(sum) : tanh(sum)
      }
      acts.push(out)
      prev = out
    }
    this.lastActivations = acts
    return prev
  }

  clone(): NeuralNet {
    const net = new NeuralNet(this.sizes)
    for (let l = 0; l < this.weights.length; l++) {
      net.weights[l].set(this.weights[l])
      net.biases[l].set(this.biases[l])
    }
    return net
  }

  /** Uniform crossover: each weight comes from parent A or B with p=0.5. */
  static crossover(a: NeuralNet, b: NeuralNet): NeuralNet {
    const child = a.clone()
    for (let l = 0; l < child.weights.length; l++) {
      const cw = child.weights[l]
      const bw = b.weights[l]
      for (let i = 0; i < cw.length; i++) {
        if (Math.random() < 0.5) cw[i] = bw[i]
      }
      const cb = child.biases[l]
      const bb = b.biases[l]
      for (let i = 0; i < cb.length; i++) {
        if (Math.random() < 0.5) cb[i] = bb[i]
      }
    }
    return child
  }

  /**
   * Gaussian mutation: each parameter has `rate` probability of receiving
   * additive noise scaled by `strength`.
   */
  mutate(rate: number, strength: number): void {
    for (let l = 0; l < this.weights.length; l++) {
      const w = this.weights[l]
      for (let i = 0; i < w.length; i++) {
        if (Math.random() < rate) w[i] += gauss() * strength
      }
      const b = this.biases[l]
      for (let i = 0; i < b.length; i++) {
        if (Math.random() < rate) b[i] += gauss() * strength
      }
    }
  }

  serialize(): BrainJSON {
    return {
      sizes: [...this.sizes],
      weights: this.weights.map((w, l) => {
        const inN = this.sizes[l]
        const rows: number[][] = []
        for (let o = 0; o < this.sizes[l + 1]; o++) {
          rows.push(Array.from(w.slice(o * inN, (o + 1) * inN)))
        }
        return rows
      }),
      biases: this.biases.map((b) => Array.from(b)),
    }
  }

  static deserialize(json: BrainJSON): NeuralNet {
    const net = new NeuralNet(json.sizes)
    for (let l = 0; l < net.weights.length; l++) {
      const inN = json.sizes[l]
      json.weights[l].forEach((row, o) => {
        net.weights[l].set(row, o * inN)
      })
      net.biases[l].set(json.biases[l])
    }
    return net
  }
}
