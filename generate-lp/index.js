'use strict'

const l = require('lodash')
const u = require('./util')
const streamToPromise = require('stream-to-promise')

const createOcclusionConstraints = require('./occlusion')
const createOctolinearityConstraints = require('./octolinearity')
const { buildSpatialIndex, getAdjacentPairs, getCandidatePairs } = require('./spatial-filter')

// sets left !== right using a boolean variable
const createNotEqual = (settings) => (left, negativeRight, boolean) => {
    const upperBound = settings.maxEdgeLength + 1
    return [
        `${left} ${negativeRight} - ${upperBound} ${boolean} <= -0.5`,
        `${left} ${negativeRight} - ${upperBound} ${boolean} >= ${0.5 - upperBound}`
    ]
}

const createGenerateLP = (graph, settings) => (outputStream, options = {}) => {
    const {
        relaxCollinearity = false,
        relaxOctilinearity = false,
        skipOcclusion = false
    } = options
    const resultStream = streamToPromise(outputStream)

    const w = u.createWrite(outputStream)
    const wt = u.createWriteTab(outputStream)

    const occlusionConstraints = createOcclusionConstraints(settings)
    const octolinearityConstraints = createOctolinearityConstraints(settings)
    const notEqual = createNotEqual(settings)

    // prepare variables
    const coefficients = {
        q: []
    }
    const continuous = {
        vx: graph.nodes.map(n => `vx${u.nodeIndex(graph, n.id)}`),
        vy: graph.nodes.map(n => `vy${u.nodeIndex(graph, n.id)}`),
        l: graph.edges.map(e => `l${u.edgeIndex(graph, e)}`),
        pa: graph.edges.map(e => `pa${u.edgeIndex(graph, e)}`),
        pb: graph.edges.map(e => `pb${u.edgeIndex(graph, e)}`),
        pc: graph.edges.map(e => `pc${u.edgeIndex(graph, e)}`),
        pd: graph.edges.map(e => `pd${u.edgeIndex(graph, e)}`)
    }
    const integer = {
        q: []
    }
    const binary = {
        a: graph.edges.map(e => `a${u.edgeIndex(graph, e)}`),
        b: graph.edges.map(e => `b${u.edgeIndex(graph, e)}`),
        c: graph.edges.map(e => `c${u.edgeIndex(graph, e)}`),
        d: graph.edges.map(e => `d${u.edgeIndex(graph, e)}`),
        h: [],
        oa: [],
        ob: [],
        oc: [],
        od: [],
        ua: [],
        ub: [],
        uc: [],
        ud: []
    }

    // prepare constraints
    const constraints = []
    const lazyConstraints = []

    // generate model
    // octolinearity and edge length
    const octiOptions = { relaxCollinearity, relaxOctilinearity }
    graph.edges.forEach(e => constraints.push(...octolinearityConstraints(graph, e, octiOptions)))

    // edge occlusion
    let numAdjacentEdgeConstraints = 0

    // Use spatial index to filter non-adjacent edge pairs
    const adjacentSet = getAdjacentPairs(graph)

    const handleAdjacentPair = (o, i) => {
        const outer = graph.edges[o]
        const inner = graph.edges[i]

        // add variables
        binary.h.push(`h${numAdjacentEdgeConstraints}`)
        binary.oa.push(`oa${numAdjacentEdgeConstraints}`)
        binary.ob.push(`ob${numAdjacentEdgeConstraints}`)
        binary.oc.push(`oc${numAdjacentEdgeConstraints}`)
        binary.od.push(`od${numAdjacentEdgeConstraints}`)
        binary.ua.push(`ua${numAdjacentEdgeConstraints}`)
        binary.ub.push(`ub${numAdjacentEdgeConstraints}`)
        binary.uc.push(`uc${numAdjacentEdgeConstraints}`)
        binary.ud.push(`ud${numAdjacentEdgeConstraints}`)
        integer.q.push(`q${numAdjacentEdgeConstraints}`)

        // adjacent edges of the same line
        if (l.intersection(outer.metadata.lines, inner.metadata.lines).length > 0) {
            coefficients.q.push(1)
            constraints.push(`q${numAdjacentEdgeConstraints} <= 2`)
        } else {
            coefficients.q.push(.25)
        }

        constraints.push(`q${numAdjacentEdgeConstraints} - oa${numAdjacentEdgeConstraints} - ob${numAdjacentEdgeConstraints} - oc${numAdjacentEdgeConstraints} - od${numAdjacentEdgeConstraints} = 0`)

        if (outer.target === inner.source || outer.source === inner.target) {
            lazyConstraints.push(...notEqual(`3 a${o} - 3 b${o} + c${o} - d${o}`, `+ 3 a${i} - 3 b${i} + c${i} - d${i}`, `h${numAdjacentEdgeConstraints}`))
            constraints.push(`a${o} + a${i} - 2 ua${numAdjacentEdgeConstraints} - oa${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`b${o} + b${i} - 2 ub${numAdjacentEdgeConstraints} - ob${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`c${o} + c${i} - 2 uc${numAdjacentEdgeConstraints} - oc${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`d${o} + d${i} - 2 ud${numAdjacentEdgeConstraints} - od${numAdjacentEdgeConstraints} = 0`)
        } else {
            lazyConstraints.push(...notEqual(`3 a${o} - 3 b${o} + c${o} - d${o}`, `- 3 a${i} + 3 b${i} - c${i} + d${i}`, `h${numAdjacentEdgeConstraints}`))
            constraints.push(`a${o} + b${i} - 2 ua${numAdjacentEdgeConstraints} - oa${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`b${o} + a${i} - 2 ub${numAdjacentEdgeConstraints} - ob${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`c${o} + d${i} - 2 uc${numAdjacentEdgeConstraints} - oc${numAdjacentEdgeConstraints} = 0`)
            constraints.push(`d${o} + c${i} - 2 ud${numAdjacentEdgeConstraints} - od${numAdjacentEdgeConstraints} = 0`)
        }
        numAdjacentEdgeConstraints++
    }

    // Process all adjacent pairs (unconditionally)
    for (const pairKey of adjacentSet) {
        const [o, i] = pairKey.split(',').map(Number)
        handleAdjacentPair(o, i)
    }

    // Process non-adjacent pairs with spatial filtering
    if (!skipOcclusion) {
        const spatialIndex = buildSpatialIndex(graph)
        const candidatePairs = getCandidatePairs(graph, spatialIndex)

        for (const [o, i] of candidatePairs) {
            constraints.push(...occlusionConstraints(graph, graph.edges[o], graph.edges[i]))
        }
    }

    // write model
    // 1. objective function
    w('Minimize')
        wt('obj:')
        const lengths = continuous.l.map(l => `3 ${l}` ).join(' + ')
        const angles = integer.q.map((q, index) => `${4 * coefficients.q[index]} ${q}`).join(' + ')
        wt(`${angles} + ${lengths}`)

    // 2. constraints
    w('Subject To')
        wt(`vx0 = ${settings.offset}`)
        wt(`vy0 = ${settings.offset}`)

        constraints.forEach(c => wt(c))

    // 3. lazy constraints
    w('Lazy Constraints')
        lazyConstraints.forEach(l => wt(l))

    // 4. bounds
    w('Bounds')
        continuous.l.forEach(l => wt(`${settings.minEdgeLength} <= ${l} <= ${settings.maxEdgeLength}`))
        continuous.vx.forEach(vx => wt(`${settings.offset - settings.maxWidth/2} <= ${vx} <= ${settings.offset + settings.maxWidth/2}`))
        continuous.vy.forEach(vy => wt(`${settings.offset - settings.maxHeight/2} <= ${vy} <= ${settings.offset + settings.maxHeight/2}`))
        continuous.pa.forEach(pa => wt(`0 <= ${pa}`))
        continuous.pb.forEach(pb => wt(`0 <= ${pb}`))
        continuous.pc.forEach(pc => wt(`0 <= ${pc}`))
        continuous.pd.forEach(pd => wt(`0 <= ${pd}`))
        integer.q.forEach(q => wt(`0 <= ${q} <= 3`))

    // 5. integer variables
    w('General')
        integer.q.forEach(q => wt(q))

    // 6. binary variables
    w('Binary')
        binary.a.forEach(a => wt(a))
        binary.b.forEach(b => wt(b))
        binary.c.forEach(c => wt(c))
        binary.d.forEach(d => wt(d))
        binary.h.forEach(h => wt(h))
        binary.oa.forEach(oa => wt(oa))
        binary.ob.forEach(ob => wt(ob))
        binary.oc.forEach(oc => wt(oc))
        binary.od.forEach(od => wt(od))
        binary.ua.forEach(ua => wt(ua))
        binary.ub.forEach(ub => wt(ub))
        binary.uc.forEach(uc => wt(uc))
        binary.ud.forEach(ud => wt(ud))

    // 7. end
    w('End')

    outputStream.end()

    return resultStream
}

module.exports = createGenerateLP
