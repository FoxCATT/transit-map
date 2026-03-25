'use strict'

const h = require('virtual-dom/virtual-hyperscript/svg')
const uniq = require('lodash/uniq')
const uniqBy = require('lodash/uniqBy')

const normalize = require('./normalize')
const parallelise = require('./parallelise')

const f = (n) => Math.round(n * 1000) / 1000

const findEdgesAt = (graph, node) => graph.edges.filter(e => [e.source, e.target].includes(node.id))

const lineGroup = (lines, lineId) => (lines.find(l => l.id === lineId) || {}).group || lineId

const getBezierPath = (graph, lineId, sourceId, targetId) => {
    const sourceNode = graph.nodes.find(n => n.id === sourceId)
    const targetNode = graph.nodes.find(n => n.id === targetId)
    if (!sourceNode || !targetNode) return null
    
    const sourceIsVirtual = sourceNode.metadata && sourceNode.metadata.virtual
    const targetIsVirtual = targetNode.metadata && targetNode.metadata.virtual
    
    if (!sourceIsVirtual && !targetIsVirtual) return null
    
    const lineEdges = graph.edges.filter(e => e.metadata.lines.includes(lineId))
    
    let stationNode = null
    let inCtrl = null
    let outCtrl = null
    
    if (sourceIsVirtual && targetIsVirtual) {
        for (const edge of lineEdges) {
            const other = edge.source === sourceId ? edge.target : (edge.target === sourceId ? edge.source : null)
            if (other) {
                const otherNode = graph.nodes.find(n => n.id === other)
                if (otherNode && otherNode.metadata && !otherNode.metadata.virtual) {
                    stationNode = otherNode
                    inCtrl = sourceNode.metadata
                    outCtrl = targetNode.metadata
                    break
                }
            }
        }
    }
    
    if (stationNode && inCtrl && outCtrl) {
        const s = stationNode.metadata
        return `M ${f(s.x)} ${f(s.y)} L ${f(inCtrl.x)} ${f(inCtrl.y)} C ${f(inCtrl.x)} ${f(inCtrl.y)} ${f(outCtrl.x)} ${f(outCtrl.y)} ${f(outCtrl.x)} ${f(outCtrl.y)} L ${f(s.x)} ${f(s.y)}`
    }
    
    return null
}

const renderEdges = (graph, lines, reportBbox) => (simpleEdge) => {
    const lineId = simpleEdge.line
    const lineColor = (lines.find(l => l.id === lineId) || { color: '#777' }).color

    const top = Math.min(simpleEdge.start[1], simpleEdge.end[1])
    const left = Math.min(simpleEdge.start[0], simpleEdge.end[0])
    const bottom = Math.max(simpleEdge.start[1], simpleEdge.end[1])
    const right = Math.max(simpleEdge.start[0], simpleEdge.end[0])
    reportBbox(top, left, bottom, right)

    const bezierPath = getBezierPath(graph, lineId, simpleEdge.source, simpleEdge.target)
    const d = bezierPath || ('M' + simpleEdge.start.map(f).join(' ') + 'L' + simpleEdge.end.map(f).join(' '))

    return h('path', {
        class: 'line ' + lineId,
        style: { stroke: lineColor },
        d: d,
    })
}

const renderStations = (graph, reportBbox) => (station) => {
    const edgesAt = findEdgesAt(graph, station)

    if (edgesAt.length === 0) throw new Error(`Station ${station.id} must have degree > 0.`)
    const isTransitNode = edgesAt.length > 2 || uniq(edgesAt.flatMap(e => e.metadata.lines)).length > 1

    const maxDirectionDegree = Math.max(...edgesAt.map(e => e.metadata.lines.length))

    let color = '#333'
    if (!isTransitNode) {
        const lineId = edgesAt[0].metadata.lines[0]
        const lineColor = ((graph.lines || []).find(l => l.id === lineId) || { color: '#777' }).color
        color = lineColor
    }

    let radius
    if (station.dummy) radius = 0
    else if (isTransitNode) radius = 0.13 + (0.055 * (maxDirectionDegree - 1))
    else radius = 0.1

    const c = station.metadata
    const cx = f(c.x)
    const cy = f(c.y)
    reportBbox(c.y - radius, c.x - radius, c.y + radius, c.x + radius)
    
    const cxNum = c.x
    const cyNum = c.y
    reportBbox(cyNum - radius - 1.5, cxNum - radius, cyNum + radius, cxNum + radius + 10)
    
    return h('g', {
        class: 'station-group',
    }, [
        h('circle', {
            class: isTransitNode ? 'station transit' : 'station',
            'data-id': station.id,
            'data-label': station.label,
            cx: cx,
            cy: cy,
            r: radius + '',
            fill: color,
        }),
        h('text', {
            x: cx + radius + 0.3,
            y: cy,
            class: 'station-label',
            'text-anchor': 'start',
            'dominant-baseline': 'middle'
        }, station.label)
    ])
}

const generate = (graph, invertY) => {
    graph = normalize(graph, invertY)

    const lines = graph.lines || []

    let top = Infinity; let left = Infinity; let bottom = -Infinity; let right = -Infinity
    const reportBbox = (t, l, b, r) => {
        if (t < top) top = t
        if (l < left) left = l
        if (b > bottom) bottom = b
        if (r > right) right = r
    }

    graph.edges = graph.edges.map(edge => {
        edge.metadata.lines = uniqBy(edge.metadata.lines, l => lineGroup(lines, l))
        return edge
    })

    const items = [].concat(
        parallelise(graph).map(renderEdges(graph, lines, reportBbox)),
        graph.nodes.filter(n => !n.dummy && !(n.metadata && n.metadata.virtual)).map(renderStations(graph, reportBbox)),
    )

    left = f(left)
    top = f(top)
    const width = f(right - left)
    const height = f(bottom - top)
    const bbox = Object.assign([left, top, width, height], { left, top, width, height })

    return { items, bbox }
}

module.exports = generate
