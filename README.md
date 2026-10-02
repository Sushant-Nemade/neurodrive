# NeuroDrive — Self-Driving Neuroevolution Arena

A browser game where **a population of neural networks learns to drive a race car — live, in front of you**. No servers, no ML frameworks, no build-time magic: a hand-written policy network and genetic algorithm running entirely in TypeScript on a `<canvas>`.

**Play it:** open the deployed demo, click *INITIALIZE SIMULATION*, and watch 180 agents wreck, learn, and eventually carve clean racing lines through live traffic. Then switch to **DRIVE** and race against the machine — it keeps training in the background while you drive.

![mode: training](https://img.shields.io/badge/mode-neuroevolution-22d3ee) ![stack: typescript](https://img.shields.io/badge/stack-TypeScript%20%2B%20React%20%2B%20Canvas-3178c6) ![deps: zero ml frameworks](https://img.shields.io/badge/ML%20frameworks-0-34d399)

---

## How it works

```
        ┌─────────────────────────── one agent ───────────────────────────┐
        │                                                                 │
 7 ray-cast sensors ──▶  ┌───────────────┐    ┌──────────┐    steer  ─────┼──▶ car physics
        + speed     ──▶  │ input  8      │ ─▶ │ hidden   │ ─▶ throttle    │    (bicycle-ish model,
                         │               │    │ 12 tanh  │                │     drag, collision)
                         └───────────────┘    └──────────┘                │
                          policy network (156 parameters)                  │
        └─────────────────────────────────────────────────────────────────┘

 fitness = track progress + distance bonus
                │
                ▼
 ┌───────────────────────── genetic algorithm ─────────────────────────┐
 │ elitism (top 4) · tournament selection (k=4) · uniform crossover    │
 │ gaussian mutation (rate 0.12) · anti-idle culling · 45s gen cap     │
 └─────────────────────────────────────────────────────────────────────┘
```

### Perception
Each car casts **7 rays** at fixed angles relative to its heading. Every ray returns `1 − d/d_max` against track walls and traffic vehicles — closer obstacles read higher. Combined with normalized speed, this 8-dimensional vector is the entire world the policy ever sees.

### Policy network
A tiny feedforward network (`8 → 12 tanh → 2`) implemented from scratch in [`src/game/nn.ts`](src/game/nn.ts) — forward pass, Xavier-style init, uniform crossover, gaussian mutation, JSON serialization. The output layer produces **steering** (`tanh`, −1…1) and **throttle** (`sigmoid`, 0…1).

### Evolution
The population (default 180 agents) races the same procedurally-defined circuit. When every car is wrecked or the generation cap expires:

1. Rank by fitness (furthest unwrapped centerline progress + small distance bonus)
2. Top 4 pass through as elites (the champion untouched)
3. The rest are bred by tournament selection + uniform crossover + gaussian mutation
4. Cars that stop making progress for 4 simulated seconds are culled mid-generation

The all-time best policy is **checkpointed to `localStorage`** and can be exported/imported as JSON — share your champion brain with a friend and their population reseeds from it.

### Background training
The genetic algorithm never stops — switch to manual **DRIVE** mode and the population keeps evolving behind you. When you're ready, **AUTOPILOT** hands your car to the champion policy so you can watch its sensor rays and live network activations while it drives.

## Game modes

| Mode | You | The AI |
|---|---|---|
| `TRAINING` `[1]` | Watch the full-track arena | Population evolves in fast-forward (1×–8×) |
| `DRIVE` `[2]` | Drive with `↑↓←→` / `WASD` | Keeps training in the background |
| `AUTOPILOT` `[3]` | Spectate your own car | The champion policy drives it |

## Controls

- `↑ / W` throttle · `↓ / S` brake/reverse · `← → / A D` steer
- `R` respawn · `1 / 2 / 3` switch mode
- Sidebar: simulation speed, mutation rate, population size, traffic density, champion export/import

## Tech stack

- **TypeScript + React + Vite + Tailwind** — UI shell
- **HTML5 Canvas** — renderer (overview + rotating chase camera)
- **Zero ML dependencies** — the network, the GA, the physics and the ray-caster are all hand-written in [`src/game/`](src/game)

```
src/game/
├── types.ts   # vector math, ray/segment + polygon intersection
├── track.ts   # Catmull-Rom circuit generation, wall geometry
├── nn.ts      # policy network: forward pass, crossover, mutation, serialization
├── sim.ts     # car physics, ray-cast sensors, traffic, collision, progress
├── ga.ts      # evolution loop: selection, elitism, breeding, checkpointing
├── render.ts  # canvas renderer + camera
└── useSim.ts  # game loop, input, React bridge
```

## Run locally

```bash
npm install
npm run dev      # dev server
npm run build    # production build → dist/
```

## Deploy

The repo ships with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys to **GitHub Pages** on every push to `main`. Enable it once via *Settings → Pages → Source: GitHub Actions*.

---

Built by [Sushant Nemade](https://github.com/Sushant-Nemade) — because the best way to show you understand how agents learn is to let people watch them learn.
