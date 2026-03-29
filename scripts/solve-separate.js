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

function mergeSolutions(lineSolutions) {
  const nodeMap = new Map();
  const allEdges = [];
  
  lineSolutions.forEach(ls => {
    ls.solution.nodes.forEach(n => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, n);
      } else {
        const existing = nodeMap.get(n.id);
        if (n.metadata && existing.metadata) {
          existing.metadata.x = (existing.metadata.x + n.metadata.x) / 2;
          existing.metadata.y = (existing.metadata.y + n.metadata.y) / 2;
        }
      }
    });
    allEdges.push(...ls.solution.edges);
  });
  
  return { nodes: [...nodeMap.values()], edges: allEdges };
}

async function solveSeparate(d, cityName, workDir) {
  const lines = new Set();
  d.edges.forEach(e => e.metadata.lines.forEach(l => lines.add(l)));
  
  console.log('City: ' + cityName + ' has ' + lines.size + ' lines');
  
  const solvedLines = [];
  
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
    }
  }
  
  if (solvedLines.length === 0) {
    throw new Error('No lines solved');
  }
  
  // Merge solutions using average position for transfer nodes
  const merged = mergeSolutions(solvedLines);
  
  // Generate SVG from merged solution
  const graphToSVG = require('../write-svg/index');
  const svgToString = require('virtual-dom-stringify');
  const svg = graphToSVG(merged, true);
  return svgToString(svg);
}

module.exports = { solveSeparate, extractLine, mergeSolutions };
