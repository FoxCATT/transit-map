# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a fork of [juliuste/transit-map](https://github.com/juliuste/transit-map) that generates schematic octilinear "metro map" diagrams from a transit network graph using Mixed Integer Programming (MIP). The original used the commercial Gurobi solver; this fork uses the open-source **SCIP** solver.

## Commands

```sh
# Generate a metro map from a JSON graph
cat examples/bvg.input.json | node cli.js > output.svg

# Read from file, write to file, show solver log
node cli.js -i examples/shenzhen.input.json -o output.svg --log

# Generate input graph from Amap subway data
node scripts/convert-amap-subway.js

# Run tests
node test.js
```

## Architecture

The pipeline runs in 6 stages (defined in `index.js` → `transitMap()`):

1. **prepare-graph/** — `planarize.js` (currently disabled) inserts dummy nodes at edge crossings. `add-directions.js` assigns each edge a primary octilinear direction (0-7) by computing `atan2` on the input coordinates, finding the 3 closest directions, and taking the closest one.

2. **generate-lp/** — Writes a `.lp` MIP file. Key sub-modules:
   - `octolinearity.js` — Each edge gets 4 binary variables (`a,b,c,d`) encoding its octilinear direction. Node position differences are linked to edge length via `vx_target - vx_source = pa - pb` where `pa = l*a` (linearized via McCormick envelopes). Adjacent same-line edges through degree-2 nodes are forced collinear.
   - `occlusion.js` — Non-adjacent edge pairs are forced apart in one of 4 directions (W-E, S-N, SW-NE, NW-SE). Uses input geometry to choose the separation direction.
   - `index.js` — Assembles the full MIP: objective minimizes `4*coeff*q + 3*l` (angle penalty + squared edge length). Adjacent-edge angle constraints encode bend penalties.

3. **SCIP solver** — Spawned as subprocess (`scip -c read problem.lp -c optimize -c write solution solution.sol -c quit`).

4. **revise-solution/** — Parses SCIP `.sol` output, extracts `vx`/`vy` variables, subtracts the offset.

5. **smooth-bezier/** — Post-processes octilinear polylines into cubic Bezier curves. Traces each line, inserts virtual control points at bends, remaps station positions to the smoothed curve. Interchange stations (≥2 lines) are never smoothed.

6. **write-svg/** — Normalizes coordinates, offsets parallel shared-track lines, renders SVG.

## Solver settings (`index.js:19-26`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `offset` | 10000 | Anchor constant (node 0 fixed at 10000,10000; subtracted after solve) |
| `maxWidth` / `maxHeight` | 300 | Bounding box for node coordinates |
| `minEdgeLength` | 1 | Minimum length of each edge in output |
| `maxEdgeLength` | 8 | Maximum length of each edge in output |
| `occlusionDistanceMultiplier` | 2 | Max distance (in multiples of avg edge length) between edges for occlusion constraints |

## Input format

JSON Graph Format with `{ nodes, edges, lines }`. Nodes have `id`, `label`, `metadata.x/y` (geographic or projected coordinates). Edges have `source`, `target`, `metadata.lines: [lineId, …]`. Lines have `id`, `color` (hex), optional `label`.

## Data conversion

`scripts/convert-amap-subway.js` converts Amap (高德) JSON subway data from `data/amap-subway/` to the input format in `examples/`. Run it to regenerate input files after updating source data.

## Common issues with large networks

- Shenzhen (354 nodes, 410 edges) currently produces infeasible MIPs. The root cause is direction constraint conflicts in dense networks. Debug LP files at `/tmp/transit-debug/`.
- Occlusion constraints scale O(n²) — the `occlusionDistanceMultiplier` and `boundsGap` spatial filtering in `generate-lp/index.js` helps reduce them.
- Geographic coordinates (lng/lat ~114/~22) have very small dx/dy differences (~0.001-0.02), which works for direction assignment but may cause occlusion distance filtering to behave unexpectedly.
