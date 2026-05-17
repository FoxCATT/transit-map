'use strict'

const l = require('lodash')
const pify = require('pify')
const tmp = require('tmp')
const path = require('path')
const spawn = require('child-process-promise').spawn
const fs = require('fs')

const prepareGraph = require('./prepare-graph')
const createGenerateLP = require('./generate-lp')
const { createFixedDirectionsLP } = require('./generate-lp/fixed-directions')
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
    returnGraph: false,
    timeLimit: 300,
    mode: 'auto',
    snap: false
}

const Solver = (networkGraph) => {
    const graph = prepareGraph(networkGraph)
    const generateLP = createGenerateLP(graph, settings)
    const reviseSolution = createReviseSolution(graph, settings)

    return ({generateLP, reviseSolution})
}

const runSolver = (cwd, solverPath, timeLimit, verbose=false) => {
    const problemPath = path.resolve(cwd, 'problem.lp')
    const solutionPath = path.resolve(cwd, 'solution.sol')

    const solverPromise = spawn(solverPath, [
        '-c', `read ${problemPath}`,
        '-c', `set limits time ${timeLimit}`,
        '-c', 'set heuristics emphasis aggressive',
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

    // Fixed mode: use geographic directions, pure continuous LP, solves instantly
    if (options.mode === 'fixed') {
        const graph = prepareGraph(networkGraph)
        const generateLP = createFixedDirectionsLP(graph, settings)
        const reviseSolution = createReviseSolution(graph, settings)

        const lpStream = fs.createWriteStream(path.resolve(options.workDir, 'problem.lp'))
        await generateLP(lpStream)

        try {
            await runSolver(options.workDir, options.scipPath, options.timeLimit || 60, options.verbose)
        } catch (e) {
            throw new Error('SCIP solver error: ' + e.message)
        }

        const solutionContent = fs.readFileSync(path.resolve(options.workDir, 'solution.sol'), 'utf8')
        if (solutionContent.includes('infeasible') || solutionContent.includes('no feasible solution')) {
            throw new Error('SCIP solver: fixed-direction LP is infeasible')
        }

        const solStream = fs.createReadStream(path.resolve(options.workDir, 'solution.sol'))
        const solution = await reviseSolution(solStream)

        if (options.snap) {
            const octiSnap = require('./scripts/octi-snap')
            const snapped = octiSnap.snapToOctilinear(solution)
            const smoothed = smoothBezier.smoothTransitMap(snapped, null, options.smooth)
            if (options.returnGraph) return smoothed
            const svg = graphToSVG(smoothed, options.invertY)
            return svgToString(svg)
        }

        const smoothed = smoothBezier.smoothTransitMap(solution, null, options.smooth)
        if (options.returnGraph) return smoothed
        const svg = graphToSVG(smoothed, options.invertY)
        return svgToString(svg)
    }

    const solver = Solver(networkGraph)

    // Determine relaxation levels based on mode
    const relaxationLevels = []
    if (options.mode === 'exact') {
        relaxationLevels.push({ name: 'exact', relaxCollinearity: false, relaxOctilinearity: false, skipOcclusion: false })
    } else if (options.mode === 'relaxed' || options.mode === 'two-phase') {
        relaxationLevels.push({ name: 'soft-octi', relaxCollinearity: true, relaxOctilinearity: true, skipOcclusion: false })
    } else if (options.mode === 'no-occlusion') {
        relaxationLevels.push({ name: 'no-occlusion', relaxCollinearity: true, relaxOctilinearity: true, skipOcclusion: true })
    } else { // 'auto' (default) — try fastest levels first
        relaxationLevels.push(
            { name: 'fixed', useFixed: true },                                         // ~1s, always feasible
            { name: 'exact', relaxCollinearity: false, relaxOctilinearity: false, skipOcclusion: false },
            { name: 'relax-collinearity', relaxCollinearity: true, relaxOctilinearity: false, skipOcclusion: false },
            { name: 'soft-octi', relaxCollinearity: true, relaxOctilinearity: true, skipOcclusion: false },
            { name: 'no-occlusion', relaxCollinearity: true, relaxOctilinearity: true, skipOcclusion: true }
        )
    }

    let solution = null
    let lastError = null

    for (const level of relaxationLevels) {
        if (options.verbose) {
            console.error(`Trying relaxation level: ${level.name}...`)
        }

        // Generate the LP for this relaxation level
        const lpStream = fs.createWriteStream(path.resolve(options.workDir, 'problem.lp'))
        if (level.useFixed) {
            const graph = prepareGraph(networkGraph)
            const fixedLP = createFixedDirectionsLP(graph, settings)
            await fixedLP(lpStream)
        } else {
            await solver.generateLP(lpStream, level)
        }

        try {
            const tl = level.useFixed ? (options.timeLimit || 60) : options.timeLimit
            await (runSolver(options.workDir, options.scipPath, tl, options.verbose).catch(e => {
                throw new Error('SCIP solver error: ' + e.message)
            }))
        } catch (e) {
            lastError = e
            if (options.verbose) console.error(`Level ${level.name} failed: ${e.message}`)
            continue
        }

        const solutionContent = fs.readFileSync(path.resolve(options.workDir, 'solution.sol'), 'utf8')
        if (solutionContent.includes('infeasible') || solutionContent.includes('no feasible solution')) {
            lastError = new Error(`SCIP solver: problem is infeasible at level ${level.name}`)
            if (options.verbose) console.error(`Level ${level.name}: infeasible`)
            continue
        }

        // Parse the solution — use appropriate revise function
        const solStream = fs.createReadStream(path.resolve(options.workDir, 'solution.sol'))
        if (level.useFixed) {
            const graph = prepareGraph(networkGraph)
            const reviseSolution = createReviseSolution(graph, settings)
            solution = await reviseSolution(solStream)
        } else {
            solution = await solver.reviseSolution(solStream)
        }
        break
    }

    if (!solution) {
        throw lastError || new Error('All relaxation levels failed')
    }

    // Apply octilinear snapping if requested (for relaxed/two-phase modes)
    if (options.snap) {
        const octiSnap = require('./scripts/octi-snap')
        solution = octiSnap.snapToOctilinear(solution)
    }

    const smoothed = smoothBezier.smoothTransitMap(solution, null, options.smooth)

    if (options.returnGraph) {
        return smoothed
    }

    const svg = graphToSVG(smoothed, options.invertY)
    return svgToString(svg)
}

module.exports = transitMap
module.exports.Solver = Solver
