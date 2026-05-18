'use strict'

const l = require('lodash')
const u = require('./util')

// sets a new variable as a product of a continuous and a binary
const createSetProduct = (settings) => (product, continuous, binary) => {
    const upperBound = settings.maxEdgeLength + 1
    return [
        `${product} - ${upperBound} ${binary} <= 0`,
        `${product} - ${continuous} <= 0`,
        `${product} - ${continuous} - ${upperBound} ${binary} >= -${upperBound}`
    ]
}

const createOctolinearityConstraints = (settings) => (graph, edge, options = {}) => {
    const setProduct = createSetProduct(settings)
    const { relaxCollinearity = false, relaxOctilinearity = false } = options

    const [mainDirection, secondaryDirection] = edge.sourceDirections
    const s = u.nodeIndex(graph, edge.source)
    const t = u.nodeIndex(graph, edge.target)
    const e = u.edgeIndex(graph, edge)

    const constraints = []

    // set helper variables
    constraints.push(...setProduct(`pa${e}`, `l${e}`, `a${e}`))
    constraints.push(...setProduct(`pb${e}`, `l${e}`, `b${e}`))
    constraints.push(...setProduct(`pc${e}`, `l${e}`, `c${e}`))
    constraints.push(...setProduct(`pd${e}`, `l${e}`, `d${e}`))

    constraints.push(`vx${t} - vx${s} - pa${e} + pb${e} = 0`)
    constraints.push(`vy${t} - vy${s} - pc${e} + pd${e} = 0`)

    constraints.push(`a${e} + b${e} <= 1`)
    constraints.push(`c${e} + d${e} <= 1`)

    if (relaxOctilinearity) {
        // At least one direction component must be active
        constraints.push(`a${e} + b${e} + c${e} + d${e} >= 1`)
    } else {
        // Fix binary values to enforce preferred geographic direction
        switch (mainDirection) {
            case 0: {
                constraints.push(`a${e} = 0`)
                constraints.push(`b${e} = 1`)
                if (secondaryDirection === 7) constraints.push(`d${e} = 0`)
                if (secondaryDirection === 1) constraints.push(`c${e} = 0`)
                break
            }
            case 1: {
                constraints.push(`a${e} = 0`)
                constraints.push(`c${e} = 0`)
                if (secondaryDirection === 2) constraints.push(`d${e} = 1`)
                if (secondaryDirection === 0) constraints.push(`b${e} = 1`)
                break
            }
            case 2: {
                constraints.push(`c${e} = 0`)
                constraints.push(`d${e} = 1`)
                if (secondaryDirection === 3) constraints.push(`b${e} = 0`)
                if (secondaryDirection === 1) constraints.push(`a${e} = 0`)
                break
            }
            case 3: {
                constraints.push(`b${e} = 0`)
                constraints.push(`c${e} = 0`)
                if (secondaryDirection === 4) constraints.push(`a${e} = 1`)
                if (secondaryDirection === 2) constraints.push(`d${e} = 1`)
                break
            }
            case 4: {
                constraints.push(`a${e} = 1`)
                constraints.push(`b${e} = 0`)
                if (secondaryDirection === 5) constraints.push(`d${e} = 0`)
                if (secondaryDirection === 3) constraints.push(`c${e} = 0`)
                break
            }
            case 5: {
                constraints.push(`b${e} = 0`)
                constraints.push(`d${e} = 0`)
                if (secondaryDirection === 6) constraints.push(`c${e} = 1`)
                if (secondaryDirection === 4) constraints.push(`a${e} = 1`)
                break
            }
            case 6: {
                constraints.push(`c${e} = 1`)
                constraints.push(`d${e} = 0`)
                if (secondaryDirection === 7) constraints.push(`a${e} = 0`)
                if (secondaryDirection === 5) constraints.push(`b${e} = 0`)
                break
            }
            case 7: {
                constraints.push(`a${e} = 0`)
                constraints.push(`d${e} = 0`)
                if (secondaryDirection === 0) constraints.push(`b${e} = 1`)
                if (secondaryDirection === 6) constraints.push(`c${e} = 1`)
                break
            }
            default: {throw new Error('unknown direction')}
        }
    }

    // force angle to 180 for some pairs of adjacent edges
    const adjacentLineEdges = graph.edges.filter(e => l.intersection(e.metadata.lines, edge.metadata.lines).length > 0 && l.intersection([e.source, e.target], [edge.source, edge.target]).length === 1)
    for (let aEdge of adjacentLineEdges) {
        const degrees = [edge.source, edge.target, aEdge.source, aEdge.target].map(x => u.degree(graph, x))
        const middle = graph.nodes.find(n => n.id === l.intersection([edge.source, edge.target], [aEdge.source, aEdge.target])[0])
        const middleDegree = u.degree(graph, middle.id)

        // When relaxCollinearity is set, skip 180-degree force at non-dummy transfer stations
        if (relaxCollinearity && middleDegree > 2 && !middle.dummy) {
            continue
        }

        if(degrees.every(d => d === 2) || middle.dummy) {
            if (edge.target === aEdge.source || edge.source === aEdge.target) {
                if (l.isEqual(aEdge.sourceDirections, edge.sourceDirections)) {
                    constraints.push(`a${e} - a${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`b${e} - b${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`c${e} - c${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`d${e} - d${u.edgeIndex(graph, aEdge)} = 0`)
                }
            }
            else {
                if (l.isEqual(aEdge.sourceDirections, edge.targetDirections)) {
                    constraints.push(`a${e} - b${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`b${e} - a${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`c${e} - d${u.edgeIndex(graph, aEdge)} = 0`)
                    constraints.push(`d${e} - c${u.edgeIndex(graph, aEdge)} = 0`)
                }
            }
        }
    }

    return constraints
}

module.exports = createOctolinearityConstraints
