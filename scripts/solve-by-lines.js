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

function mergeGraphs(graphs) {
  const nodeMap = new Map();
  const allEdges = [];
  
  graphs.forEach(g => {
    g.nodes.forEach(n => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, n);
      }
    });
    g.edges.forEach(e => {
      allEdges.push(e);
    });
  });
  
  return { nodes: [...nodeMap.values()], edges: allEdges };
}

async function solveByLines(d, cityName, workDir) {
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
      const svg = await transitMap(lineData, { workDir: lineDir, invertY: true });
      solvedLines.push({ lineId, data: lineData, svg });
      console.log('Line ' + lineId + ': OK');
    } catch (e) {
      console.log('Line ' + lineId + ': FAIL - ' + e.message.substring(0, 30));
    }
  }
  
  if (solvedLines.length === 0) {
    throw new Error('No lines solved');
  }
  
  // Merge all line data into one graph
  const merged = mergeGraphs(solvedLines.map(s => s.data));
  
  // Solve the merged graph
  const mergedDir = workDir + '/merged';
  if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir, { recursive: true });
  
  console.log('Solving merged network...');
  const mergedSvg = await transitMap(merged, { workDir: mergedDir, invertY: true });
  
  return mergedSvg;
}

module.exports = { solveByLines, extractLine, mergeGraphs };
