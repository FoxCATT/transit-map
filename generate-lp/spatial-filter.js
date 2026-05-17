'use strict'

// Build a grid-based spatial index to filter edge pairs for occlusion constraints.
// Instead of O(n^2) all-pairs, only edges with overlapping bounding boxes are considered.

const buildSpatialIndex = (graph, gridCount = null) => {
    // find coordinate bounds from node metadata
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of graph.nodes) {
        const m = node.metadata
        if (m.x < minX) minX = m.x
        if (m.x > maxX) maxX = m.x
        if (m.y < minY) minY = m.y
        if (m.y > maxY) maxY = m.y
    }

    const xRange = maxX - minX + 0.001
    const yRange = maxY - minY + 0.001

    // auto grid count: finer grid for larger graphs to reduce occlusion pairs
    if (!gridCount) {
        gridCount = Math.max(5, Math.min(25, Math.ceil(Math.sqrt(graph.edges.length) * 0.7)))
    }
    const cellW = xRange / gridCount
    const cellH = yRange / gridCount

    // assign each edge to grid cells its bbox overlaps
    const cells = new Map()
    for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i]
        const s = graph.nodes.find(n => n.id === edge.source).metadata
        const t = graph.nodes.find(n => n.id === edge.target).metadata
        const exMin = Math.min(s.x, t.x)
        const exMax = Math.max(s.x, t.x)
        const eyMin = Math.min(s.y, t.y)
        const eyMax = Math.max(s.y, t.y)

        const gx0 = Math.max(0, Math.floor((exMin - minX) / cellW))
        const gy0 = Math.max(0, Math.floor((eyMin - minY) / cellH))
        const gx1 = Math.min(gridCount - 1, Math.floor((exMax - minX) / cellW))
        const gy1 = Math.min(gridCount - 1, Math.floor((eyMax - minY) / cellH))

        for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
                const key = gx + ',' + gy
                if (!cells.has(key)) cells.set(key, [])
                cells.get(key).push(i)
            }
        }
    }

    return { cells, gridCount, minX, minY, cellW, cellH }
}

// Build a Set of adjacent edge pairs (sharing at least one node)
const getAdjacentPairs = (graph) => {
    const nodeEdges = new Map()
    for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i]
        for (const nid of [edge.source, edge.target]) {
            if (!nodeEdges.has(nid)) nodeEdges.set(nid, [])
            nodeEdges.get(nid).push(i)
        }
    }

    const pairs = new Set()
    for (const edgeIndices of nodeEdges.values()) {
        for (let a = 0; a < edgeIndices.length; a++) {
            for (let b = a + 1; b < edgeIndices.length; b++) {
                const x = edgeIndices[a], y = edgeIndices[b]
                pairs.add(x < y ? x + ',' + y : y + ',' + x)
            }
        }
    }
    return pairs
}

// Get non-adjacent candidate pairs from spatial index
// Returns array of [edgeIdx1, edgeIdx2] for edges whose bboxes overlap or are in neighbor cells
const getCandidatePairs = (graph, spatialIndex) => {
    const { cells, gridCount } = spatialIndex
    const adjacentSet = getAdjacentPairs(graph)
    const candidateSet = new Set()

    for (const [key, edgeIndices] of cells) {
        const [gx, gy] = key.split(',').map(Number)

        // collect all edges in this cell + 8 neighbor cells
        const neighborEdges = new Set()
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nKey = (gx + dx) + ',' + (gy + dy)
                const cellEdges = cells.get(nKey)
                if (cellEdges) {
                    for (const ei of cellEdges) neighborEdges.add(ei)
                }
            }
        }

        // generate pairs between this cell's edges and all neighbor edges
        for (let a = 0; a < edgeIndices.length; a++) {
            const ea = edgeIndices[a]
            for (const eb of neighborEdges) {
                if (eb <= ea) continue // only process each pair once
                const pairKey = ea + ',' + eb
                if (adjacentSet.has(pairKey) || candidateSet.has(pairKey)) continue
                candidateSet.add(pairKey)
            }
        }
    }

    // fallback: if spatial filter produced no candidates but there are non-adjacent pairs,
    // scan all pairs (handles edge case of very small grids)
    if (candidateSet.size === 0 && graph.edges.length > 0) {
        for (let o = 0; o < graph.edges.length; o++) {
            for (let i = o + 1; i < graph.edges.length; i++) {
                const pairKey = o + ',' + i
                if (!adjacentSet.has(pairKey)) candidateSet.add(pairKey)
            }
        }
    }

    return [...candidateSet].map(k => k.split(',').map(Number))
}

module.exports = {
    buildSpatialIndex,
    getAdjacentPairs,
    getCandidatePairs
}
