const fs = require('fs');
const path = require('path');
const transitMap = require('../index.js');

function extractLine(d, lineId) {
  const edges = d.edges.filter(e => e.metadata.lines.includes(lineId));
  const nodeIds = new Set();
  edges.forEach(e => {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  });
  const nodes = d.nodes.filter(n => nodeIds.has(n.id));
  return { nodes, edges };
}

function mergeSolutions(lineSolutions, originalNodes, originalEdges) {
  const nodeMap = new Map();
  const allEdges = [];
  const nodeSources = new Map();
  
  lineSolutions.forEach(ls => {
    ls.solution.nodes.forEach(n => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, n);
        nodeSources.set(n.id, [n]);
      } else {
        const existing = nodeMap.get(n.id);
        const sources = nodeSources.get(n.id);
        sources.push(n);
        if (n.metadata && existing.metadata) {
          let sumX = existing.metadata.x;
          let sumY = existing.metadata.y;
          sources.forEach(s => {
            sumX += s.metadata.x;
            sumY += s.metadata.y;
          });
          existing.metadata.x = sumX / sources.length;
          existing.metadata.y = sumY / sources.length;
        }
      }
    });
    allEdges.push(...ls.solution.edges);
  });
  
  const nodeWithEdges = new Set();
  allEdges.forEach(e => {
    nodeWithEdges.add(e.source);
    nodeWithEdges.add(e.target);
  });
  
  const mergedNodes = [...nodeMap.values()].filter(n => nodeWithEdges.has(n.id));
  const mergedNodeIds = new Set(mergedNodes.map(n => n.id));
  const filteredEdges = allEdges.filter(e => 
    mergedNodeIds.has(e.source) && mergedNodeIds.has(e.target)
  );
  
  return { nodes: mergedNodes, edges: filteredEdges };
}

async function solveSeparate(d, cityName, workDir) {
  const lines = new Set();
  d.edges.forEach(e => e.metadata.lines.forEach(l => lines.add(l)));
  
  console.log('City: ' + cityName + ' has ' + lines.size + ' lines');
  
  const solvedLines = [];
  const failedLines = [];
  
  for (const lineId of lines) {
    const lineData = extractLine(d, lineId);
    const lineDir = workDir + '/line_' + lineId;
    if (!fs.existsSync(lineDir)) fs.mkdirSync(lineDir, { recursive: true });
    
    try {
      console.log('Solving line ' + lineId + ' (' + lineData.nodes.length + ' nodes)...');
      const result = await transitMap(lineData, { 
        workDir: lineDir, 
        invertY: true, 
        returnGraph: true 
      });
      solvedLines.push({ lineId, solution: result });
      console.log('Line ' + lineId + ': OK');
    } catch (e) {
      console.log('Line ' + lineId + ': FAIL - ' + e.message.substring(0, 30));
      failedLines.push(lineId);
    }
  }
  
  console.log('Solved: ' + solvedLines.length + ' lines, Failed: ' + failedLines.length + ' lines');
  
  if (solvedLines.length === 0) {
    throw new Error('No lines solved');
  }
  
  const merged = mergeSolutions(solvedLines, d.nodes, d.edges);
  
  const graphToSVG = require('../write-svg/index');
  const svgToString = require('virtual-dom-stringify');
  const svg = graphToSVG(merged, true);
  return svgToString(svg);
}

module.exports = { solveSeparate, extractLine, mergeSolutions };
