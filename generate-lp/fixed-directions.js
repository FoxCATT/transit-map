'use strict'

const u = require('./util')
const l = require('lodash')

// Direction mapping: direction index → {a, b, c, d} → displacement component multipliers
// The displacement vector is: dx = (a-b), dy = (c-d)
const dirToABCD = [
    { a: 0, b: 1, c: 0, d: 0 }, // 0: west  → dx=-1, dy= 0
    { a: 0, b: 1, c: 0, d: 1 }, // 1: sw    → dx=-1, dy=-1
    { a: 0, b: 0, c: 0, d: 1 }, // 2: south → dx= 0, dy=-1
    { a: 1, b: 0, c: 0, d: 1 }, // 3: se    → dx= 1, dy=-1
    { a: 1, b: 0, c: 0, d: 0 }, // 4: east  → dx= 1, dy= 0
    { a: 1, b: 0, c: 1, d: 0 }, // 5: ne    → dx= 1, dy= 1
    { a: 0, b: 0, c: 1, d: 0 }, // 6: north → dx= 0, dy= 1
    { a: 0, b: 1, c: 1, d: 0 }, // 7: nw    → dx=-1, dy= 1
]

// Build adjacency for a graph: nodeId → [edge indices incident to that node]
const buildIncidence = (graph) => {
    const inc = new Map()
    graph.edges.forEach((e, i) => {
        for (const nid of [e.source, e.target]) {
            if (!inc.has(nid)) inc.set(nid, [])
            inc.get(nid).push(i)
        }
    })
    return inc
}

// Find cycles in the graph using transit-line paths.
// Returns array of arrays: each inner array is [edgeIdx, direction] tuples for a cycle.
const findCycles = (graph, incidence) => {
    const cycles = []

    // Group edges by transit line
    const lineEdges = new Map()
    graph.edges.forEach((e, i) => {
        for (const lineId of e.metadata.lines) {
            if (!lineEdges.has(lineId)) lineEdges.set(lineId, [])
            lineEdges.get(lineId).push(i)
        }
    })

    // For each line, check if it forms a cycle (loop line)
    for (const [lineId, edgeIndices] of lineEdges) {
        if (edgeIndices.length < 3) continue

        // Build node-degree for this line's subgraph
        const nodeDeg = new Map()
        edgeIndices.forEach(i => {
            const e = graph.edges[i]
            nodeDeg.set(e.source, (nodeDeg.get(e.source) || 0) + 1)
            nodeDeg.set(e.target, (nodeDeg.get(e.target) || 0) + 1)
        })

        // If all nodes in the subgraph have degree 2, it's a cycle (or set of cycles)
        const allDeg2 = [...nodeDeg.values()].every(d => d === 2)
        if (!allDeg2) continue

        // Collect the cycle edges
        const cycle = edgeIndices.map(i => {
            const e = graph.edges[i]
            return {
                edgeIdx: i,
                source: e.source,
                target: e.target,
                sourceDirections: e.sourceDirections
            }
        })
        cycles.push({ lineId, edges: cycle })
    }

    return cycles
}

// Compute the net direction sum for a cycle given direction assignments.
// Returns { dx, dy } net displacement (should be 0 for a consistent cycle).
const cycleNetDisplacement = (cycleEdges, assignments, edgeLengths = null) => {
    let dx = 0, dy = 0
    for (const ce of cycleEdges) {
        const dir = assignments.get(ce.edgeIdx)
        const abcd = dirToABCD[dir]
        const ddx = (abcd.a || 0) - (abcd.b || 0)
        const ddy = (abcd.c || 0) - (abcd.d || 0)
        // Determine if edge direction should be flipped based on cycle orientation
        dx += ddx
        dy += ddy
    }
    return { dx, dy }
}

// Assign directions to edges, ensuring cycle consistency.
// Uses a constraint-propagation approach: for each cycle, ensure net displacement = 0.
const assignDirections = (graph) => {
    const assignments = new Map()

    // First pass: assign main geographic direction to all edges
    for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i]
        const mainDir = edge.sourceDirections[0] !== undefined ? edge.sourceDirections[0] : 0
        assignments.set(i, mainDir)
    }

    // Second pass: detect cycles and fix direction consistency
    const incidence = buildIncidence(graph)
    const cycles = findCycles(graph, incidence)

    for (const cycle of cycles) {
        // For a cycle to be LP-feasible with fixed directions,
        // the net displacement around the cycle must be zero along both axes.
        // But each edge's displacement is l * (dx, dy) where l > 0.
        // So we need: there exists a traversal order where edges alternate direction.

        // Simpler check: treat the cycle edges as carrying a signed direction.
        // Traverse the cycle and compute the net direction along each axis.
        // For edges that go "against" the traversal direction, flip the dx,dy sign.

        // Build adjacency for this cycle
        const adj = new Map() // nodeId → [{edgeIdx, otherNode}]
        for (const ce of cycle.edges) {
            if (!adj.has(ce.source)) adj.set(ce.source, [])
            if (!adj.has(ce.target)) adj.set(ce.target, [])
            adj.get(ce.source).push({ edgeIdx: ce.edgeIdx, other: ce.target })
            adj.get(ce.target).push({ edgeIdx: ce.edgeIdx, other: ce.source })
        }

        // Traverse the cycle in order
        if (cycle.edges.length === 0) continue
        const startNode = cycle.edges[0].source
        let curNode = startNode
        const visitedEdges = new Set()
        const orderedEdges = []

        while (visitedEdges.size < cycle.edges.length) {
            const neighbors = adj.get(curNode) || []
            let found = false
            for (const { edgeIdx, other } of neighbors) {
                if (!visitedEdges.has(edgeIdx)) {
                    visitedEdges.add(edgeIdx)
                    const edge = graph.edges[edgeIdx]
                    // Determine if this edge goes FROM curNode TO other (positive)
                    // or FROM other TO curNode (negative/flipped)
                    const isForward = (edge.source === curNode && edge.target === other)
                    orderedEdges.push({
                        edgeIdx,
                        forward: isForward,
                        from: curNode,
                        to: other
                    })
                    curNode = other
                    found = true
                    break
                }
            }
            if (!found) break // shouldn't happen for a cycle
        }

        // Compute net displacement along the traversal
        let netDx = 0, netDy = 0
        for (const { edgeIdx, forward } of orderedEdges) {
            const dir = assignments.get(edgeIdx)
            const abcd = dirToABCD[dir]
            let ddx = (abcd.a || 0) - (abcd.b || 0)
            let ddy = (abcd.c || 0) - (abcd.d || 0)
            if (!forward) {
                ddx = -ddx
                ddy = -ddy
            }
            netDx += ddx
            netDy += ddy
        }

        // If the net displacement is non-zero, fix it by flipping directions
        // of edges with the most flexible direction preferences
        if (netDx !== 0 || netDy !== 0) {
            // Try to fix each axis independently
            for (const { edgeIdx, forward } of orderedEdges) {
                if (netDx === 0 && netDy === 0) break

                const edge = graph.edges[edgeIdx]
                const curDir = assignments.get(edgeIdx)
                const abcd = dirToABCD[curDir]
                let ddx = (abcd.a || 0) - (abcd.b || 0)
                let ddy = (abcd.c || 0) - (abcd.d || 0)
                if (!forward) { ddx = -ddx; ddy = -ddy }

                // Check if flipping this edge's direction helps
                if ((netDx > 0 && ddx > 0) || (netDx < 0 && ddx < 0) ||
                    (netDy > 0 && ddy > 0) || (netDy < 0 && ddy < 0)) {

                    // Try opposite direction
                    const oppDir = (curDir + 4) % 8
                    const oppAbcd = dirToABCD[oppDir]
                    let oddx = (oppAbcd.a || 0) - (oppAbcd.b || 0)
                    let oddy = (oppAbcd.c || 0) - (oppAbcd.d || 0)
                    if (!forward) { oddx = -oddx; oddy = -oddy }

                    // Check if the opposite direction is in the edge's allowed directions
                    // (the targetDirections are the opposite of sourceDirections)
                    const allowedDirs = forward ? edge.sourceDirections : edge.targetDirections
                    if (allowedDirs && allowedDirs.includes(oppDir)) {
                        assignments.set(edgeIdx, oppDir)
                        netDx = netDx - ddx + oddx
                        netDy = netDy - ddy + oddy
                    }
                }
            }
        }
    }

    // Third pass: resolve directional conflicts at high-degree nodes
    const nodeIncident = {}
    graph.edges.forEach((edge, i) => {
        for (const nid of [edge.source, edge.target]) {
            if (!nodeIncident[nid]) nodeIncident[nid] = []
            nodeIncident[nid].push(i)
        }
    })

    for (const [nid, edgeIndices] of Object.entries(nodeIncident)) {
        if (edgeIndices.length <= 2) continue

        // Count how many edges point in each direction from this node
        const dirCounts = {}
        edgeIndices.forEach(i => {
            const edge = graph.edges[i]
            let dir = assignments.get(i)
            // Normalize direction relative to this node
            if (edge.target === nid) {
                // Edge points TO this node, flip direction
                dir = (dir + 4) % 8
            }
            dirCounts[dir] = (dirCounts[dir] || 0) + 1
        })

        // If more than 2 edges want the same direction from this node,
        // try to redirect some to secondary directions
        for (const [dirStr, count] of Object.entries(dirCounts)) {
            const dir = parseInt(dirStr)
            if (count <= 2) continue

            let redirected = 0
            for (const i of edgeIndices) {
                if (redirected >= count - 2) break
                const edge = graph.edges[i]
                let curDir = assignments.get(i)
                if (edge.target === nid) curDir = (curDir + 4) % 8
                if (curDir !== dir) continue

                // Try secondary direction
                const prefs = edge.target === nid ? edge.targetDirections : edge.sourceDirections
                if (prefs && prefs.length > 1) {
                    let altDir = prefs[1]
                    if (edge.target === nid) altDir = (altDir + 4) % 8
                    if (altDir !== dir) {
                        assignments.set(i, edge.target === nid ? (altDir + 4) % 8 : altDir)
                        redirected++
                    }
                }
            }
        }
    }

    return assignments
}

// Generate LP with fixed edge directions plus directional slack variables.
// Slacks allow minor deviation from octilinear when geometry demands it,
// with a heavy penalty to keep most edges strictly octilinear.
// Result: always feasible, pure continuous LP.
const createFixedDirectionsLP = (graph, settings) => (outputStream, options = {}) => {
    const { createWrite, createWriteTab, nodeIndex } = u
    const w = createWrite(outputStream)
    const wt = createWriteTab(outputStream)

    const edgeDirs = assignDirections(graph)
    const numEdges = graph.edges.length
    const slackPenalty = 500 // per-unit penalty for directional slack

    const constraints = []

    // For each edge, add coordinate constraints with fixed direction + slacks
    for (let e = 0; e < numEdges; e++) {
        const edge = graph.edges[e]
        const dir = edgeDirs.get(e)
        const abcd = dirToABCD[dir]
        const s = nodeIndex(graph, edge.source)
        const t = nodeIndex(graph, edge.target)

        const dxCoef = (abcd.a || 0) - (abcd.b || 0)
        const dyCoef = (abcd.c || 0) - (abcd.d || 0)

        // vx_t - vx_s = dxCoef * l_e + (sx_pos_e - sx_neg_e)
        if (dxCoef !== 0) {
            constraints.push(`vx${t} - vx${s} - ${dxCoef} l${e} - sx_pos${e} + sx_neg${e} = 0`)
        } else {
            constraints.push(`vx${t} - vx${s} - sx_pos${e} + sx_neg${e} = 0`)
        }

        if (dyCoef !== 0) {
            constraints.push(`vy${t} - vy${s} - ${dyCoef} l${e} - sy_pos${e} + sy_neg${e} = 0`)
        } else {
            constraints.push(`vy${t} - vy${s} - sy_pos${e} + sy_neg${e} = 0`)
        }
    }

    // Write LP
    w('Minimize')
    wt('obj:')
    // Edge length minimization
    const lengthTerms = graph.edges.map((_, i) => `3 l${i}`).join(' + ')
    // Slack penalties
    const slackXVars = graph.edges.map((_, i) => `${slackPenalty} sx_pos${i} + ${slackPenalty} sx_neg${i}`).join(' + ')
    const slackYVars = graph.edges.map((_, i) => `${slackPenalty} sy_pos${i} + ${slackPenalty} sy_neg${i}`).join(' + ')
    wt(`${lengthTerms} + ${slackXVars} + ${slackYVars}`)

    w('Subject To')
    // Anchor first node
    wt(`vx0 = ${settings.offset}`)
    wt(`vy0 = ${settings.offset}`)

    constraints.forEach(c => wt(c))

    w('Bounds')
    // Edge length bounds
    graph.edges.forEach((_, i) => {
        wt(`${settings.minEdgeLength} <= l${i} <= ${settings.maxEdgeLength}`)
    })
    // Node coordinate bounds
    graph.nodes.forEach((_, i) => {
        wt(`${settings.offset - settings.maxWidth / 2} <= vx${i} <= ${settings.offset + settings.maxWidth / 2}`)
        wt(`${settings.offset - settings.maxHeight / 2} <= vy${i} <= ${settings.offset + settings.maxHeight / 2}`)
    })
    // Slack variable bounds (allow up to 2 units of deviation)
    graph.edges.forEach((_, i) => {
        wt(`0 <= sx_pos${i} <= 2`)
        wt(`0 <= sx_neg${i} <= 2`)
        wt(`0 <= sy_pos${i} <= 2`)
        wt(`0 <= sy_neg${i} <= 2`)
    })

    w('End')
    outputStream.end()

    return require('stream-to-promise')(outputStream)
}

module.exports = { createFixedDirectionsLP, assignDirections, dirToABCD }
