'use strict'

// LOOM-inspired decomposed solver for large transit networks.
// Phase 1: Solve each line individually (fast, always feasible).
// Phase 2: Merge positions by averaging shared nodes.
// Phase 3: Re-solve merged graph with fixed directions from Phase 1.

const fs = require('fs')
const path = require('path')
const transitMap = require('../index.js')

// Extract a sub-graph containing only nodes and edges for the given line IDs
function extractLines(d, lineIds) {
    const edges = d.edges.filter(e =>
        lineIds.some(l => e.metadata.lines.includes(l))
    )
    const nodeIds = new Set()
    edges.forEach(e => {
        nodeIds.add(e.source)
        nodeIds.add(e.target)
    })
    const nodes = d.nodes.filter(n => nodeIds.has(n.id))
    return { nodes, edges }
}

// Merge multiple solved graphs by averaging node positions at shared nodes
function mergeSolutions(solvedGraphs) {
    const nodeMap = new Map() // id → { x sum, y sum, count }
    const nodeSources = new Map() // id → node object

    solvedGraphs.forEach(sg => {
        sg.nodes.forEach(n => {
            if (!nodeMap.has(n.id)) {
                nodeMap.set(n.id, { x: 0, y: 0, count: 0 })
                nodeSources.set(n.id, n)
            }
            const acc = nodeMap.get(n.id)
            if (n.metadata && n.metadata.x !== undefined) {
                acc.x += n.metadata.x
                acc.y += n.metadata.y
                acc.count++
            }
        })
    })

    const mergedNodes = []
    for (const [id, acc] of nodeMap) {
        const src = nodeSources.get(id)
        const node = JSON.parse(JSON.stringify(src))
        if (acc.count > 0) {
            node.metadata.x = acc.x / acc.count
            node.metadata.y = acc.y / acc.count
        }
        mergedNodes.push(node)
    }

    return { nodes: mergedNodes, edges: solvedGraphs[0]?.edges || [] }
}

// Determine direction from node positions for an edge
function directionFromPositions(source, target) {
    const dx = target.metadata.x - source.metadata.x
    const dy = target.metadata.y - source.metadata.y
    const angle = Math.atan2(dy, dx) // -pi to pi
    const dir = Math.round(4 * (angle / Math.PI + 1)) % 8
    return ((dir % 8) + 8) % 8
}

// Main decomposed solver
async function solveDecomposed(d, cityName, workDir, opts = {}) {
    const timeLimit = opts.timeLimit || 60
    const verbose = opts.verbose || false

    // Extract unique lines
    const lines = new Set()
    d.edges.forEach(e => e.metadata.lines.forEach(l => lines.add(l)))
    const lineIds = [...lines].sort()

    console.log(`City: ${cityName}, ${d.nodes.length} nodes, ${d.edges.length} edges, ${lineIds.length} lines`)

    // Phase 1: Solve each line individually
    const solvedLines = []
    const failedLines = []

    for (const lineId of lineIds) {
        const lineData = extractLines(d, [lineId])
        const lineDir = path.join(workDir, 'line_' + lineId)
        if (!fs.existsSync(lineDir)) fs.mkdirSync(lineDir, { recursive: true })

        try {
            const result = await transitMap(lineData, {
                workDir: lineDir,
                invertY: true,
                returnGraph: true,
                mode: 'exact',
                timeLimit,
                verbose: false
            })
            solvedLines.push({ lineId, data: lineData, solution: result })
            if (verbose) console.log(`  Line ${lineId}: OK (${lineData.nodes.length} nodes)`)
        } catch (e) {
            failedLines.push({ lineId, data: lineData, error: e.message })
            if (verbose) console.log(`  Line ${lineId}: FAIL - ${e.message.substring(0, 60)}`)

            // Fallback: try fixed mode for this line
            try {
                const result = await transitMap(lineData, {
                    workDir: lineDir,
                    invertY: true,
                    returnGraph: true,
                    mode: 'fixed',
                    timeLimit: 30,
                    verbose: false
                })
                solvedLines.push({ lineId, data: lineData, solution: result })
                if (verbose) console.log(`  Line ${lineId}: OK via fixed mode`)
            } catch (e2) {
                if (verbose) console.log(`  Line ${lineId}: also failed fixed mode`)
            }
        }
    }

    console.log(`Solved: ${solvedLines.length}/${lineIds.length} lines`)

    if (solvedLines.length === 0) {
        throw new Error('No lines could be solved')
    }

    // Phase 2: Merge solutions by averaging positions
    const merged = mergeSolutions(solvedLines.map(s => s.solution))

    // Build edge list from original data (with all lines)
    const allEdges = JSON.parse(JSON.stringify(d.edges))

    const graphToSVG = require('../write-svg/index')
    const svgToString = require('virtual-dom-stringify')
    const svg = graphToSVG({ nodes: merged.nodes, edges: allEdges }, true)
    return svgToString(svg)
}

module.exports = { solveDecomposed, extractLines, mergeSolutions }
