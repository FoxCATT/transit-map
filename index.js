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
const graphToSVG = require('./write-svg/index')
const svgToString = require('virtual-dom-stringify')

tmp.setGracefulCleanup()
const pTmpDir = pify(tmp.dir)

const settings = {
    offset: 10000,
    maxWidth: 300,
    maxHeight: 300,
    minEdgeLength: 1,
    maxEdgeLength: 8
}

const defaults = {
    scipPath: 'D:/Program Files/SCIPOptSuite 10.0.1/bin/scip.exe',
    smooth: { tension: 0.5, minBendDeg: 15, remapStations: true },
    workDir: null,
    verbose: false,
    invertY: false,
    returnGraph: false
}

const Solver = (networkGraph) => {
    const graph = prepareGraph(networkGraph)
    const generateLP = createGenerateLP(graph, settings)
    const reviseSolution = createReviseSolution(graph, settings)

    return ({generateLP, reviseSolution})
}

const runSolver = (cwd, solverPath, verbose=false) => {
    const problemPath = path.resolve(cwd, 'problem.lp')
    const solutionPath = path.resolve(cwd, 'solution.sol')

    const solverPromise = spawn(solverPath, [
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
    const options = l.merge({}, defaults, opt)
    if (!options.workDir) options.workDir = await pTmpDir({prefix: 'transit-map-'})

    const solver = Solver(networkGraph)

    const lpStream = fs.createWriteStream(path.resolve(options.workDir, 'problem.lp'))
    await solver.generateLP(lpStream)

    await (runSolver(options.workDir, options.scipPath, options.verbose).catch(e => {
        console.error('SCIP solver error')
        throw new Error(e)
    }))

    const solutionContent = fs.readFileSync(path.resolve(options.workDir, 'solution.sol'), 'utf8')
    if (solutionContent.includes('infeasible')) {
        throw new Error('SCIP solver: problem is infeasible')
    }
    const solStream = fs.createReadStream(path.resolve(options.workDir, 'solution.sol'))
    const solution = await solver.reviseSolution(solStream)

    const smoothed = smoothBezier.smoothTransitMap(solution, null, options.smooth)

    if (options.returnGraph) {
        return smoothed
    }

    const svg = graphToSVG(smoothed, options.invertY)
    return svgToString(svg)
}

module.exports = transitMap
module.exports.Solver = Solver
