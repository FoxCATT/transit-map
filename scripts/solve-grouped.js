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

function extractLines(d, lineIds) {
  const edges = d.edges.filter(e => 
    lineIds.some(l => e.metadata.lines.includes(l))
  );
  const nodeIds = new Set();
  edges.forEach(e => {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  });
  const nodes = d.nodes.filter(n => nodeIds.has(n.id));
  return { nodes, edges };
}

function findLineConflicts(d) {
  const nodeLines = {};
  
  d.edges.forEach(e => {
    e.metadata.lines.forEach(l => {
      if (!nodeLines[e.source]) nodeLines[e.source] = new Set();
      if (!nodeLines[e.target]) nodeLines[e.target] = new Set();
      nodeLines[e.source].add(l);
      nodeLines[e.target].add(l);
    });
  });
  
  const lineTransfers = {};
  const lines = new Set();
  d.edges.forEach(e => e.metadata.lines.forEach(l => lines.add(l)));
  
  lines.forEach(l => lineTransfers[l] = 0);
  
  Object.values(nodeLines).forEach(nodeLines => {
    if (nodeLines.size >= 2) {
      nodeLines.forEach(l => lineTransfers[l]++);
    }
  });
  
  return { lineTransfers, nodeLines };
}

function groupLines(d, maxTransfers = 10) {
  const { lineTransfers, nodeLines } = findLineConflicts(d);
  
  const lowTransferLines = [];
  const highTransferLines = [];
  
  Object.entries(lineTransfers).forEach(([line, count]) => {
    if (count <= maxTransfers) {
      lowTransferLines.push(line);
    } else {
      highTransferLines.push(line);
    }
  });
  
  const groups = [];
  
  if (lowTransferLines.length > 0) {
    groups.push({
      lines: lowTransferLines,
      type: 'low_transfer',
      description: 'Lines with <= ' + maxTransfers + ' transfer stations'
    });
  }
  
  highTransferLines.forEach(line => {
    groups.push({
      lines: [line],
      type: 'high_transfer',
      description: 'Line ' + line + ' with ' + lineTransfers[line] + ' transfer stations'
    });
  });
  
  return groups;
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

async function solveGrouped(d, cityName, workDir, maxTransfers = 10) {
  const groups = groupLines(d, maxTransfers);
  
  console.log('City: ' + cityName + ' has ' + groups.length + ' groups');
  groups.forEach((group, i) => {
    console.log('  Group ' + (i + 1) + ': ' + group.description + ' (' + group.lines.length + ' lines)');
  });
  
  const solvedGroups = [];
  const failedGroups = [];
  
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupData = extractLines(d, group.lines);
    const groupDir = workDir + '/group_' + i;
    if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });
    
    console.log('Solving group ' + (i + 1) + ' (' + groupData.nodes.length + ' nodes, ' + groupData.edges.length + ' edges)...');
    
    try {
      const result = await transitMap(groupData, { 
        workDir: groupDir, 
        invertY: true, 
        returnGraph: true 
      });
      
      solvedGroups.push({ groupId: i, lines: group.lines, solution: result });
      console.log('Group ' + (i + 1) + ': OK');
    } catch (e) {
      console.log('Group ' + (i + 1) + ': FAIL - ' + e.message.substring(0, 40));
      failedGroups.push({ groupId: i, lines: group.lines });
    }
  }
  
  console.log('Solved: ' + solvedGroups.length + ' groups, Failed: ' + failedGroups.length + ' groups');
  
  if (solvedGroups.length === 0) {
    throw new Error('No groups solved');
  }
  
  const merged = mergeSolutions(solvedGroups, d.nodes, d.edges);
  
  const graphToSVG = require('../write-svg/index');
  const svgToString = require('virtual-dom-stringify');
  const svg = graphToSVG(merged, true);
  return svgToString(svg);
}

module.exports = { 
  solveGrouped, 
  extractLine, 
  extractLines, 
  findLineConflicts, 
  groupLines, 
  mergeSolutions 
};
