'use strict'

// Post-processing octilinear snapping inspired by LOOM's octi tool.
// After a relaxed solve (where edges are free to choose any octilinear direction),
// iteratively adjust node positions to better match preferred geographic directions.

const mod8 = (n) => (n + 16) % 8

// Compute the octilinear direction index (0-7) from a vector
const directionFromVector = (dx, dy) => {
    const angle = Math.atan2(dy, dx) // range [-pi, pi]
    // Map to direction 0-7 where 0=west, 2=south, 4=east, 6=north
    const dir = Math.round(4 * (angle / Math.PI + 1))
    return mod8(dir)
}

// Get direction name for debugging
const directionNames = ['W', 'SW', 'S', 'SE', 'E', 'NE', 'N', 'NW']

// The (dx, dy) unit vector components for each octilinear direction
const dirVectors = [
    [-1, 0],  // 0: west
    [-1, -1], // 1: southwest
    [0, -1],  // 2: south
    [1, -1],  // 3: southeast
    [1, 0],   // 4: east
    [1, 1],   // 5: northeast
    [0, 1],   // 6: north
    [-1, 1],  // 7: northwest
]

const snapToOctilinear = (solvedGraph) => {
    // Build node index
    const nodeIndex = new Map()
    solvedGraph.nodes.forEach((n, i) => nodeIndex.set(n.id, i))

    // For each edge, compute actual direction and compare with preferred
    const edgeInfo = []
    for (const edge of solvedGraph.edges) {
        const s = solvedGraph.nodes.find(n => n.id === edge.source)
        const t = solvedGraph.nodes.find(n => n.id === edge.target)
        if (!s || !t, !s.metadata || !t.metadata) continue

        const dx = t.metadata.x - s.metadata.x
        const dy = t.metadata.y - s.metadata.y
        const actualDir = directionFromVector(dx, dy)

        const preferredDirs = edge.sourceDirections || []
        const preferredDir = preferredDirs[0] !== undefined ? preferredDirs[0] : actualDir

        edgeInfo.push({
            edge,
            sourceId: edge.source,
            targetId: edge.target,
            dx, dy,
            actualDir,
            preferredDir,
            preferredDirs,
            len: Math.sqrt(dx * dx + dy * dy)
        })
    }

    // Iterative relaxation: move nodes so incident edges better match preferred directions
    const maxIter = 20
    const blendFactor = 0.3
    const adjustedPositions = new Map()
    solvedGraph.nodes.forEach(n => {
        adjustedPositions.set(n.id, { x: n.metadata.x, y: n.metadata.y, locked: false })
    })

    // Lock interchange stations (degree > 2) to maintain network consistency
    const degree = {}
    solvedGraph.edges.forEach(e => {
        degree[e.source] = (degree[e.source] || 0) + 1
        degree[e.target] = (degree[e.target] || 0) + 1
    })
    solvedGraph.nodes.forEach(n => {
        if (degree[n.id] > 2) {
            adjustedPositions.get(n.id).locked = true
        }
    })

    for (let iter = 0; iter < maxIter; iter++) {
        const nodeAdjustments = new Map()
        const nodeCounts = new Map()

        for (const info of edgeInfo) {
            if (info.len < 0.001) continue

            const sPos = adjustedPositions.get(info.sourceId)
            const tPos = adjustedPositions.get(info.targetId)
            const prefVec = dirVectors[info.preferredDir]

            // Compute target position for source that would make edge match preferred direction
            const targetLen = info.len
            const sxForT = tPos.x - prefVec[0] * targetLen
            const syForT = tPos.y - prefVec[1] * targetLen
            const txForS = sPos.x + prefVec[0] * targetLen
            const tyForS = sPos.y + prefVec[1] * targetLen

            if (!sPos.locked) {
                const key = info.sourceId
                if (!nodeAdjustments.has(key)) {
                    nodeAdjustments.set(key, { x: 0, y: 0 })
                    nodeCounts.set(key, 0)
                }
                nodeAdjustments.get(key).x += sxForT
                nodeAdjustments.get(key).y += syForT
                nodeCounts.set(key, nodeCounts.get(key) + 1)
            }

            if (!tPos.locked) {
                const key = info.targetId
                if (!nodeAdjustments.has(key)) {
                    nodeAdjustments.set(key, { x: 0, y: 0 })
                    nodeCounts.set(key, 0)
                }
                nodeAdjustments.get(key).x += txForS
                nodeAdjustments.get(key).y += tyForS
                nodeCounts.set(key, nodeCounts.get(key) + 1)
            }
        }

        // Apply adjustments with blend factor
        let maxShift = 0
        for (const [nodeId, adj] of nodeAdjustments) {
            const pos = adjustedPositions.get(nodeId)
            if (pos.locked) continue
            const count = nodeCounts.get(nodeId) || 1
            const targetX = adj.x / count
            const targetY = adj.y / count
            const newX = pos.x + blendFactor * (targetX - pos.x)
            const newY = pos.y + blendFactor * (targetY - pos.y)
            const shift = Math.sqrt((newX - pos.x) ** 2 + (newY - pos.y) ** 2)
            if (shift > maxShift) maxShift = shift
            pos.x = newX
            pos.y = newY
        }

        if (maxShift < 0.001) break // converged
    }

    // Apply final positions
    const result = JSON.parse(JSON.stringify(solvedGraph))
    result.nodes.forEach(n => {
        const pos = adjustedPositions.get(n.id)
        if (pos) {
            n.metadata.x = pos.x
            n.metadata.y = pos.y
        }
    })

    return result
}

module.exports = { snapToOctilinear, directionFromVector, dirVectors, directionNames }
