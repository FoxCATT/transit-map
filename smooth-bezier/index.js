'use strict'

/**
 * Subtract two 2-D vectors.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {{x:number,y:number}}
 */
function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y }
}

/**
 * Add two 2-D vectors.
 */
function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y }
}

/**
 * Scale a 2-D vector.
 */
function vecScale(v, s) {
  return { x: v.x * s, y: v.y * s }
}

/**
 * Euclidean length of a 2-D vector.
 */
function vecLen(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

/**
 * Normalise a 2-D vector to unit length (returns zero-vector if input is zero).
 */
function vecNorm(v) {
  const l = vecLen(v)
  if (l < 1e-10) return { x: 0, y: 0 }
  return { x: v.x / l, y: v.y / l }
}

/**
 * Dot product of two 2-D vectors.
 */
function vecDot(a, b) {
  return a.x * b.x + a.y * b.y
}

/**
 * Angle (degrees) between two direction vectors.
 */
function angleBetween(d1, d2) {
  const cos = Math.max(-1, Math.min(1, vecDot(vecNorm(d1), vecNorm(d2))))
  return (Math.acos(cos) * 180) / Math.PI
}



/**
 * Evaluate a cubic Bézier at parameter t ∈ [0,1].
 * P(t) = (1-t)³ P0 + 3(1-t)²t P1 + 3(1-t)t² P2 + t³ P3
 *
 * @param {{x,y}} p0 start
 * @param {{x,y}} p1 control 1
 * @param {{x,y}} p2 control 2
 * @param {{x,y}} p3 end
 * @param {number} t  parameter 0–1
 * @returns {{x,y}}
 */
function cubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  }
}

/**
 * Find the parameter t on the cubic Bézier curve that is closest to point `q`
 * using golden-section search.
 *
 * @param {{x,y}} p0..p3  control points
 * @param {{x,y}} q       query point
 * @returns {number}  t ∈ [0,1]
 */
function closestTOnBezier(p0, p1, p2, p3, q) {
  const ITERATIONS = 50
  const PHI = (Math.sqrt(5) - 1) / 2

  function dist2(t) {
    const pt = cubicBezier(p0, p1, p2, p3, t)
    const dx = pt.x - q.x
    const dy = pt.y - q.y
    return dx * dx + dy * dy
  }

  let lo = 0
  let hi = 1

  for (let i = 0; i < ITERATIONS; i++) {
    const m1 = hi - PHI * (hi - lo)
    const m2 = lo + PHI * (hi - lo)
    if (dist2(m1) < dist2(m2)) {
      hi = m2
    } else {
      lo = m1
    }
  }

  return (lo + hi) / 2
}



/**
 * Build an ordered Map<lineId, string[][]> from a JSON-Graph-Format graph.
 *
 * Each line may consist of MULTIPLE disconnected segments (e.g. a metro line
 * with a gap in the middle, or a line whose graph was split by preprocessing).
 * The returned value for each lineId is an **array of chains**, where each
 * chain is an ordered array of nodeIds.
 *
 * Special cases:
 *   • Loop lines (every node has degree 2): returned as a single closed chain
 *     [A, B, C, …, A] where first === last.
 *   • Branching lines (a node with degree > 2 within a single line): each
 *     branch is returned as a separate chain.
 *
 * Metadata attached to the returned Map:
 *   result.loopSet  — Map<lineId, boolean>  true when the line's FIRST segment
 *                     is a loop (used by the renderer for Z-close).
 *
 * @param {{ nodes: Array, edges: Array }} graph
 * @returns {Map<string, string[][]>}  lineId → array of ordered chains
 *   Additionally: .loopSet  Map<lineId, boolean>
 */
function buildLineMap(graph) {
  // Build per-line adjacency: lineId → Map<nodeId, Set<neighbourId>>
  const adj = new Map()

  for (const edge of graph.edges) {
    const lines = (edge.metadata && edge.metadata.lines) || []
    for (const line of lines) {
      if (!adj.has(line)) adj.set(line, new Map())
      const lineAdj = adj.get(line)
      if (!lineAdj.has(edge.source)) lineAdj.set(edge.source, new Set())
      if (!lineAdj.has(edge.target)) lineAdj.set(edge.target, new Set())
      lineAdj.get(edge.source).add(edge.target)
      lineAdj.get(edge.target).add(edge.source)
    }
  }

  const result = new Map()
  const loopSet = new Map()   // lineId → boolean (first segment is a loop)

  for (const [lineId, lineAdj] of adj) {
    // ── find all connected components in this line's subgraph ─────────────
    const allNodes = new Set(lineAdj.keys())
    const globalVisited = new Set()
    const segments = []   // array of chains (each chain = nodeId[])
    let firstIsLoop = false

    while (globalVisited.size < allNodes.size) {
      // Pick an unvisited node. Prefer degree-1 nodes (termini) as start
      // so the chain reads naturally from one end to the other.
      let start = null
      for (const [nId, nbrs] of lineAdj) {
        if (!globalVisited.has(nId) && nbrs.size === 1) { start = nId; break }
      }
      if (!start) {
        // No terminus found in this component → it's a loop or isolated node
        for (const nId of allNodes) {
          if (!globalVisited.has(nId)) { start = nId; break }
        }
      }

      // Determine if this component is a loop (all degrees == 2, no terminus)
      // by checking whether start has degree 1.
      const isLoop = lineAdj.get(start).size !== 1

      // Walk the chain
      const chain = [start]
      const visited = new Set([start])
      globalVisited.add(start)
      let current = start

      while (true) {
        let next = null
        for (const n of lineAdj.get(current)) {
          if (!visited.has(n)) { next = n; break }
        }
        if (!next) break
        chain.push(next)
        visited.add(next)
        globalVisited.add(next)
        current = next
      }

      // Close loop chains so first === last
      if (isLoop) chain.push(start)

      if (segments.length === 0) firstIsLoop = isLoop
      segments.push(chain)
    }

    result.set(lineId, segments)
    loopSet.set(lineId, firstIsLoop)
  }

  result.loopSet = loopSet
  return result
}



/**
 * Detect whether a closed chain of nodes approximates a convex polygon
 * and measure the "corner sharpness" at each vertex.
 *
 * @param {string[]}          chain      closed chain (first === last)
 * @param {Map<string,object>} nodeById
 * @returns {Array<{id, angle, isCorner}>}  per-vertex info
 */
function analyzeLoopCorners(chain, nodeById) {
  // chain is [A, B, C, ..., A]; vertices are chain[0..n-2]
  const n = chain.length - 1   // number of unique vertices
  const result = []

  for (let i = 0; i < n; i++) {
    const prev = chain[(i - 1 + n) % n]
    const curr = chain[i]
    const next = chain[(i + 1) % n]

    const pNode = nodeById.get(prev)
    const cNode = nodeById.get(curr)
    const nNode = nodeById.get(next)

    if (!pNode || !cNode || !nNode) {
      result.push({ id: curr, angle: 180, isCorner: false })
      continue
    }

    const p = pNode.metadata, c = cNode.metadata, nx = nNode.metadata

    // Vectors: incoming (prev→curr) and outgoing (curr→next)
    const inVec  = { x: c.x - p.x,  y: c.y - p.y }
    const outVec = { x: nx.x - c.x, y: nx.y - c.y }

    const inLen  = Math.sqrt(inVec.x ** 2 + inVec.y ** 2)  || 1
    const outLen = Math.sqrt(outVec.x ** 2 + outVec.y ** 2) || 1

    const dot = (inVec.x / inLen) * (outVec.x / outLen) +
                (inVec.y / inLen) * (outVec.y / outLen)
    const clampedDot = Math.max(-1, Math.min(1, dot))
    const angleDeg = Math.acos(clampedDot) * (180 / Math.PI)

    // A "corner" in the polygon sense: angle deviation from straight (180°)
    // More than ~30° deviation → it's a real corner
    const deviation = Math.abs(180 - angleDeg)
    result.push({ id: curr, angle: angleDeg, deviation, isCorner: deviation > 30 })
  }

  return result
}

/**
 * Compute a per-vertex tension override for loop lines.
 *
 * Strategy: "polygon-preserving tension"
 *   • At genuine corners (large angle deviation): use LOW tension (0.15–0.20)
 *     so the bend stays tight and the polygon shape is preserved.
 *   • On straight runs between corners: use NORMAL tension (as configured)
 *     so intermediate stations get smoothly blended.
 *   • Tension scales continuously with deviation so there's no abrupt step.
 *
 * @param {Array<{id,deviation,isCorner}>} cornerInfo
 * @param {number}                          baseTension   from options
 * @returns {Map<string, number>}  nodeId → tension override
 */
function computeLoopTensions(cornerInfo, baseTension) {
  const overrides = new Map()
  for (const { id, deviation } of cornerInfo) {
    // Map deviation [0°, 90°] → tension [baseTension, 0.12]
    // At 0° deviation (straight): use baseTension
    // At 90° deviation (right-angle corner): use 0.12 (very tight)
    const t = Math.min(deviation / 90, 1)
    const tension = baseTension * (1 - t) + 0.12 * t
    overrides.set(id, tension)
  }
  return overrides
}



/**
 * Smooth the transit map graph using cubic Bézier curves at bends.
 *
 * @param {{ nodes: Array, edges: Array }} graph   JSON Graph Format
 * @param {Map<string,string[]>}           lineMap  optional pre-built line map
 * @param {object}                         opts     options (see module header)
 * @returns {{ nodes: Array, edges: Array }}  new graph with virtual nodes
 */
function smoothTransitMap(graph, lineMap, opts) {
  const options = Object.assign(
    {
      tension: 0.35,
      minBendDeg: 15,
      remapStations: true,
    },
    opts || {}
  )

  if (!lineMap) {
    lineMap = buildLineMap(graph)
  }

  // Index nodes by id for fast lookup
  const nodeById = new Map()
  for (const n of graph.nodes) {
    nodeById.set(n.id, n)
  }

  // We will collect new (virtual) nodes and replacement edges here
  const newNodes = []      // virtual waypoint nodes added
  const adjustedCoords = new Map()  // nodeId → {x, y}  remapped station coords
  const virtualEdges = []  // replacement edges for each line

  // ── pre-compute interchange stations ────────────────────────────────────
  //
  // A station is an interchange if ≥2 distinct lines pass through it.
  // These stations must NOT be smoothed: they act as fixed anchor points
  // where passengers transfer, so their position must remain exact and
  // visually prominent (no remapping onto a curve).

  /** @type {Map<string, Set<string>>}  nodeId → Set of line IDs */
  const nodeLineCount = new Map()
  for (const [lineId, segments] of lineMap) {
    for (const chain of segments) {
      for (const nodeId of chain) {
        if (!nodeLineCount.has(nodeId)) nodeLineCount.set(nodeId, new Set())
        nodeLineCount.get(nodeId).add(lineId)
      }
    }
  }

  /** @type {Set<string>}  node IDs that are interchange stations */
  const interchangeNodes = new Set()
  for (const [nodeId, lines] of nodeLineCount) {
    if (lines.size >= 2) interchangeNodes.add(nodeId)
  }

  // ── per-line processing ──────────────────────────────────────────────────

  let virtualIdCounter = 0
  function makeVirtualId() {
    return `__virt_${virtualIdCounter++}__`
  }

  // loopSet is attached to lineMap by buildLineMap()
  const loopSet = lineMap.loopSet || new Map()

  // Track which (source,target) pairs on which line have been processed
  // to avoid duplicate edges.
  const processedEdgeKey = new Set()

  // Helper: process one chain (segment) of a line and emit path + edges
  function processChain(lineId, chain, isLoop) {
    if (chain.length < 2) return

    // coords helper — uses remapped coords when available
    function coord(id) {
      const base = adjustedCoords.has(id)
        ? adjustedCoords.get(id)
        : (nodeById.get(id) || {}).metadata || { x: 0, y: 0 }
      return { x: base.x, y: base.y }
    }

    // Per-vertex tension overrides for loop/polygon lines
    let tensionOverride = null
    if (isLoop && chain.length >= 4) {
      const cornerInfo = analyzeLoopCorners(chain, nodeById)
      tensionOverride = computeLoopTensions(cornerInfo, options.tension)
    }

    function tensionFor(nodeId) {
      if (tensionOverride && tensionOverride.has(nodeId)) {
        return tensionOverride.get(nodeId)
      }
      return options.tension
    }

    // Segment vectors
    const segs = []
    for (let i = 0; i < chain.length - 1; i++) {
      segs.push(vecSub(coord(chain[i + 1]), coord(chain[i])))
    }

    // Build the smoothed path
    const path = []
    const uniqueLen = isLoop ? chain.length - 1 : chain.length

    for (let i = 0; i < uniqueLen; i++) {
      const stationId = chain[i]
      const pos = coord(stationId)

      // Terminus nodes of open lines are not smoothed
      const isTerminus = !isLoop && (i === 0 || i === chain.length - 1)
      if (isTerminus) {
        path.push({ id: stationId, x: pos.x, y: pos.y, virtual: false })
        continue
      }

      // Interchange stations are kept at exact grid coordinates
      if (interchangeNodes.has(stationId)) {
        path.push({ id: stationId, x: pos.x, y: pos.y, virtual: false })
        continue
      }

      const prevIdx = isLoop ? (i - 1 + uniqueLen) % uniqueLen : i - 1
      const segIn  = isLoop ? vecSub(coord(chain[i]), coord(chain[prevIdx])) : segs[i - 1]
      const segOut = segs[i]

      const bend = angleBetween(segIn, segOut)
      if (bend < options.minBendDeg) {
        path.push({ id: stationId, x: pos.x, y: pos.y, virtual: false })
        continue
      }

      const nodeTension = tensionFor(stationId)
      const inLen  = vecLen(segIn),  outLen = vecLen(segOut)
      const inDir  = vecNorm(segIn), outDir = vecNorm(segOut)

      const inOffset  = Math.min(inLen  * nodeTension, inLen  * 0.48)
      const outOffset = Math.min(outLen * nodeTension, outLen * 0.48)

      const inCtrlPos  = vecAdd(pos, vecScale(vecNorm(vecScale(inDir, -1)), inOffset))
      const outCtrlPos = vecAdd(pos, vecScale(outDir, outOffset))

      const inCtrlId  = makeVirtualId()
      const outCtrlId = makeVirtualId()

      newNodes.push({ id: inCtrlId,  metadata: { x: inCtrlPos.x,  y: inCtrlPos.y,  virtual: true, label: null } })
      newNodes.push({ id: outCtrlId, metadata: { x: outCtrlPos.x, y: outCtrlPos.y, virtual: true, label: null } })

      if (options.remapStations) {
        const t = closestTOnBezier(inCtrlPos, pos, pos, outCtrlPos, pos)
        const remapped = cubicBezier(inCtrlPos, pos, pos, outCtrlPos, t)
        adjustedCoords.set(stationId, remapped)
      }

      path.push({ id: inCtrlId,   x: inCtrlPos.x,  y: inCtrlPos.y,  virtual: true })
      path.push({
        id: stationId,
        x: adjustedCoords.get(stationId)?.x ?? pos.x,
        y: adjustedCoords.get(stationId)?.y ?? pos.y,
        virtual: false,
      })
      path.push({ id: outCtrlId, x: outCtrlPos.x, y: outCtrlPos.y, virtual: true })
    }

    // Close loop path
    if (isLoop && path.length > 0) {
      const firstEntry = path[0]
      path.push({ id: firstEntry.id, x: firstEntry.x, y: firstEntry.y, virtual: firstEntry.virtual })
    }

    // Convert path to edges
    for (let i = 0; i < path.length - 1; i++) {
      const key = [path[i].id, path[i + 1].id, lineId].join('|')
      if (!processedEdgeKey.has(key)) {
        processedEdgeKey.add(key)
        virtualEdges.push({
          source: path[i].id,
          target: path[i + 1].id,
          metadata: {
            lines: [lineId],
            virtual: path[i].virtual || path[i + 1].virtual,
          },
        })
      }
    }
  }

  // Iterate all lines and all their segments
  for (const [lineId, segments] of lineMap) {
    // loopSet marks whether the first segment of this line is a loop.
    // For a line that has multiple segments, only the first segment can be a
    // loop (subsequent segments are always open chains from a different
    // connected component). In practice multi-segment loop lines are rare,
    // but we handle it correctly per-segment by checking degree.
    const baseIsLoop = loopSet.get(lineId) === true

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const chain = segments[segIdx]
      // A segment is a loop if it is closed (first === last)
      const isLoop = chain.length > 1 && chain[0] === chain[chain.length - 1]
      processChain(lineId, chain, isLoop)
    }
  }

  // ── assemble output graph ────────────────────────────────────────────────

  // Update real node coordinates that were remapped
  const outNodes = graph.nodes.map((n) => {
    if (adjustedCoords.has(n.id)) {
      const { x, y } = adjustedCoords.get(n.id)
      return Object.assign({}, n, {
        metadata: Object.assign({}, n.metadata, { x, y }),
      })
    }
    return n
  })

  // Merge virtual nodes
  const allNodes = outNodes.concat(newNodes)

  // Merge edges: keep original non-line edges (e.g. transfers), add virtual
  // line edges.  Remove original line edges that have been replaced.
  const lineEdgeKeys = new Set()
  for (const e of virtualEdges) {
    lineEdgeKeys.add(e.source + '|' + e.target)
    lineEdgeKeys.add(e.target + '|' + e.source)
  }

  // Filter out edges whose source/target pair exists in virtualEdges
  // but also whose lines are *only* handled lines.  We keep edges that
  // carry lines *not* in lineMap to avoid accidentally removing data.
  const handledLines = new Set(lineMap.keys())

  const remainingEdges = graph.edges.filter((e) => {
    const lines = (e.metadata && e.metadata.lines) || []
    const allHandled = lines.every((l) => handledLines.has(l))
    if (!allHandled) return true // keep edges with unhandled lines
    return false // drop; replaced by virtualEdges
  })

  const allEdges = remainingEdges.concat(virtualEdges)

  return { nodes: allNodes, edges: allEdges, lines: graph.lines }
}



/**
 * Convert a smoothed path (array of {x,y,virtual,bezierCtrl?}) to an SVG
 * path `d` attribute string that uses cubic Bézier commands (`C`) at bends
 * and lines (`L`) on straights.
 *
 * For loop lines pass `closed = true` to emit a `Z` at the end instead of
 * an `L` back to the start.
 *
 * @param {Array<{x:number,y:number,virtual:boolean}>} points
 * @param {boolean} [closed=false]
 * @returns {string}  SVG path `d` attribute
 */
function pathToSvgD(points, closed = false) {
  if (points.length === 0) return ''

  const parts = []
  let i = 0

  parts.push(`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`)
  i = 1

  // For closed paths the last point == first point (appended by smoothTransitMap).
  // Stop before it so we don't emit a redundant L back to start.
  const limit = closed ? points.length - 1 : points.length

  while (i < limit) {
    if (
      points[i]     && points[i].virtual &&
      points[i + 1] && !points[i + 1].virtual &&
      points[i + 2] && points[i + 2].virtual
    ) {
      const inCtrl  = points[i]
      const station = points[i + 1]
      const outCtrl = points[i + 2]
      parts.push(`L ${inCtrl.x.toFixed(2)} ${inCtrl.y.toFixed(2)}`)
      parts.push(`C ${station.x.toFixed(2)} ${station.y.toFixed(2)} ${station.x.toFixed(2)} ${station.y.toFixed(2)} ${outCtrl.x.toFixed(2)} ${outCtrl.y.toFixed(2)}`)
      i += 3
    } else {
      parts.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`)
      i++
    }
  }

  if (closed) parts.push('Z')

  return parts.join(' ')
}
module.exports = {
  smoothTransitMap,
  buildLineMap,
  pathToSvgD,
  analyzeLoopCorners,
  computeLoopTensions,
  cubicBezier,
  closestTOnBezier,
  vecSub,
  vecAdd,
  vecScale,
  vecNorm,
  vecLen,
  angleBetween,
}
