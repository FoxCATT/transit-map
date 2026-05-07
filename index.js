'use strict'

const l = require('lodash')
const pify = require('pify')
const tmp = require('tmp')
const path = require('path')
const spawn = require('child-process-promise').spawn
const fs = require('fs')

const prepareGraph = require('./prepare-graph')
const createGenerateLP = require('./generate-lp')
const createReviseSolution = require('./revise-solution')
const smoothBezier = require('./smooth-bezier')

tmp.setGracefulCleanup() // clean up even on errors
const pTmpDir = pify(tmp.dir)

// solver settings
const settings = {
    offset: 10000,
    maxWidth: 300,
    maxHeight: 300,
    minEdgeLength: 1,
    maxEdgeLength: 8,
    occlusionDistanceMultiplier: Infinity,
    nodeSeparationDistanceMultiplier: 0,
    adjacentAngleConstraints: true,
    solverTimeLimit: 300, // seconds
    solverGapLimit: 0.1 // 10%
}

const scaleSettings = (graph) => {
    const nEdges = graph.edges.length
    if (nEdges > 200) {
        const scale = Math.ceil(Math.sqrt(nEdges / 100))
        return {
            maxWidth: 300 * scale,
            maxHeight: 300 * scale,
            maxEdgeLength: 8 * Math.min(scale, 3),
            occlusionDistanceMultiplier: 2,
            nodeSeparationDistanceMultiplier: 4,
            adjacentAngleConstraints: false,
            solverTimeLimit: 180,
            solverGapLimit: 0.2
        }
    }
    return {}
}

// script default options
const defaults = {
    scipPath: 'scip',
    smooth: { tension: 0.5, minBendDeg: 15, remapStations: true },
    workDir: null,
    verbose: false
}

const Solver = (networkGraph) => {
    const scaled = scaleSettings(networkGraph)
    const effectiveSettings = Object.assign({}, settings, scaled)
    const graph = prepareGraph(networkGraph)
    const generateLP = createGenerateLP(graph, effectiveSettings)
    const reviseSolution = createReviseSolution(graph, effectiveSettings)

    return ({generateLP, reviseSolution, effectiveSettings})
}

const runSolver = (cwd, solverPath, solverSettings, verbose=false) => {
    const problemPath = path.resolve(cwd, 'problem.lp')
    const solutionPath = path.resolve(cwd, 'solution.sol')

    const timeLimit = solverSettings.solverTimeLimit || 300
    const gapLimit = solverSettings.solverGapLimit || 0.1

    const solverPromise = spawn(solverPath, [
        '-c', `set limits time ${timeLimit}`,
        '-c', `set limits gap ${gapLimit}`,
        '-c', `read ${problemPath}`,
        '-c', 'optimize',
        '-c', `write solution ${solutionPath}`,
        '-c', 'quit'
    ], {cwd})

    if (verbose) solverPromise.childProcess.stdout.pipe(process.stderr)
    solverPromise.childProcess.stderr.on('data', e => {throw new Error(e)})
    return solverPromise
}

const transitMap = async (networkGraph, opt) => {
    // prepare
    const options = l.merge({}, defaults, opt)
    if (!options.workDir) options.workDir = await pTmpDir({prefix: 'transit-map-'})

    const solver = Solver(networkGraph)

    // write problem file
    const lpStream = fs.createWriteStream(path.resolve(options.workDir, 'problem.lp'))
    await solver.generateLP(lpStream)

    // run solver
    await (runSolver(options.workDir, options.scipPath, solver.effectiveSettings, options.verbose).catch(e => {
        console.error('SCIP solver error')
        throw new Error(e)
    }))
    // read solution file
    const solutionContent = fs.readFileSync(path.resolve(options.workDir, 'solution.sol'), 'utf8')
    if (solutionContent.includes('infeasible')) {
        throw new Error('SCIP solver: problem is infeasible')
    }
    const solStream = fs.createReadStream(path.resolve(options.workDir, 'solution.sol'))
    const solution = await solver.reviseSolution(solStream)

    const smoothed = smoothBezier.smoothTransitMap(solution, null, options.smooth)
    return smoothed
}

module.exports = transitMap
module.exports.Solver = Solver
