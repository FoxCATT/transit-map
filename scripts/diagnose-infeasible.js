#!/usr/bin/env node
'use strict'

const path = require('path')
const fs = require('fs')
const spawn = require('child-process-promise').spawn
const tmp = require('tmp')
const pify = require('pify')

const createGenerateLP = require('../generate-lp')
const prepareGraph = require('../prepare-graph')

tmp.setGracefulCleanup()

const settings = {
    offset: 10000,
    maxWidth: 300,
    maxHeight: 300,
    minEdgeLength: 1,
    maxEdgeLength: 8,
    occlusionDistanceMultiplier: 2
}

async function testFeasibility(graph, label, opts = {}) {
    const testSettings = { ...settings, ...opts }
    const prepared = prepareGraph(graph)
    const generateLP = createGenerateLP(prepared, testSettings)

    const dir = tmp.dirSync({ prefix: 'diagnose-' })
    const lpPath = path.join(dir.name, 'problem.lp')
    const solPath = path.join(dir.name, 'solution.sol')

    const lpStream = fs.createWriteStream(lpPath)
    await generateLP(lpStream)

    try {
        await spawn('scip', [
            '-c', `read ${lpPath}`,
            '-c', 'optimize',
            '-c', `write solution ${solPath}`,
            '-c', 'quit'
        ], { cwd: dir.name, capture: ['stdout', 'stderr'] })
    } catch (e) {
        // SCIP may exit with non-zero but still have a solution
    }

    const solContent = fs.readFileSync(solPath, 'utf8')
    const feasible = !solContent.includes('infeasible')

    const lpSize = fs.statSync(lpPath).size
    console.log(`  ${label}: ${feasible ? 'FEASIBLE' : 'INFEASIBLE'} (lp: ${(lpSize/1024).toFixed(0)}KB, nodes: ${graph.nodes.length}, edges: ${graph.edges.length})`)

    dir.removeCallback()
    return feasible
}

function subsetGraph(fullGraph, maxEdges, startIdx = 0) {
    const edges = fullGraph.edges.slice(startIdx, startIdx + maxEdges)
    const nodeIds = new Set()
    edges.forEach(e => { nodeIds.add(e.source); nodeIds.add(e.target) })
    const nodes = fullGraph.nodes.filter(n => nodeIds.has(n.id))
    const lineIds = new Set()
    edges.forEach(e => e.metadata.lines.forEach(l => lineIds.add(l)))
    const lines = fullGraph.lines.filter(l => lineIds.has(l.id))
    return { nodes, edges, lines }
}

async function main() {
    const fullGraph = JSON.parse(fs.readFileSync(
        path.join(__dirname, '../examples/shenzhen.input.json'), 'utf8'
    ))
    console.log(`Full graph: ${fullGraph.nodes.length} nodes, ${fullGraph.edges.length} edges, ${fullGraph.lines.length} lines\n`)

    // Test 1: increasing subsets
    console.log('=== Test 1: Increasing edge subsets ===')
    for (const n of [5, 10, 20, 30, 50, 80, 120, 200, 300, 410]) {
        const sub = subsetGraph(fullGraph, Math.min(n, fullGraph.edges.length))
        await testFeasibility(sub, `${n} edges`)
        if (sub.edges.length < n) break
    }

    // Test 2: wider bounds
    console.log('\n=== Test 2: Wider bounds (50 edges) ===')
    const sub50 = subsetGraph(fullGraph, 50)
    await testFeasibility(sub50, 'default bounds', {})
    await testFeasibility(sub50, 'width=600', { maxWidth: 600, maxHeight: 600 })
    await testFeasibility(sub50, 'width=1200', { maxWidth: 1200, maxHeight: 1200 })

    // Test 3: wider bounds on larger subset
    console.log('\n=== Test 3: Wider bounds (200 edges) ===')
    const sub200 = subsetGraph(fullGraph, 200)
    await testFeasibility(sub200, 'default bounds', {})
    await testFeasibility(sub200, 'width=600', { maxWidth: 600, maxHeight: 600 })
    await testFeasibility(sub200, 'width=1200', { maxWidth: 1200, maxHeight: 1200 })

    // Test 4: longer max edge length
    console.log('\n=== Test 4: Longer max edge length (200 edges) ===')
    await testFeasibility(sub200, 'maxLen=16', { maxEdgeLength: 16 })
    await testFeasibility(sub200, 'width=600, maxLen=16', { maxWidth: 600, maxHeight: 600, maxEdgeLength: 16 })

    // Test 5: full graph with relaxed settings
    console.log('\n=== Test 5: Full graph with relaxed settings ===')
    await testFeasibility(fullGraph, 'default', {})
    await testFeasibility(fullGraph, 'width=600, maxLen=16', { maxWidth: 600, maxHeight: 600, maxEdgeLength: 16 })
    await testFeasibility(fullGraph, 'width=1200, maxLen=24', { maxWidth: 1200, maxHeight: 1200, maxEdgeLength: 24 })
    await testFeasibility(fullGraph, 'width=2000, maxLen=32', { maxWidth: 2000, maxHeight: 2000, maxEdgeLength: 32 })
}

main().catch(console.error)
