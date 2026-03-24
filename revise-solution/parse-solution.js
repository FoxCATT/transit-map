'use strict'

const splitLines = require('split')
const skipChunks = require('skip-stream')
const shortenWhiteSpace = require('condense-whitespace')
const map = require('through2-map').obj
const filter = require('through2-filter').obj
const csv = require('csv-string')
const toArray = require('get-stream').array

const parseSolution = async (stream) => {
    const reader = stream
        .pipe(splitLines())
        .pipe(skipChunks(1))
        .pipe(map(e => shortenWhiteSpace(e.toString())))
        .pipe(filter(e => !!e && !e.startsWith('solution') && !e.startsWith('objective')))

    const rows = await toArray(reader)
    const solution = {}
    for (let row of rows) {
        const parts = row.split(' ')
        if (parts.length >= 2) {
            const varName = parts[0]
            const varValue = parseFloat(parts[1])
            solution[varName] = varValue
        }
    }

    return solution
}

module.exports = parseSolution
