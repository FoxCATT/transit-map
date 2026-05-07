const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data/amap-subway');
const examplesDir = path.join(__dirname, '../examples');

function convertAmapToInput(amapData, cityName) {
  const nodesMap = new Map();
  const sidToNodeId = new Map();
  const edgesMap = new Map();
  const lines = [];

  const stationKey = station => `${station.n}|${station.sl}`;

  const getNodeId = station => {
    if (sidToNodeId.has(station.sid)) return sidToNodeId.get(station.sid);

    const [x, y] = station.sl.split(',').map(Number);
    if (isNaN(x) || isNaN(y)) return null;

    const key = stationKey(station);
    if (!nodesMap.has(key)) {
      nodesMap.set(key, {
        id: station.sid,
        label: station.n,
        metadata: { x, y }
      });
    }

    const nodeId = nodesMap.get(key).id;
    sidToNodeId.set(station.sid, nodeId);
    return nodeId;
  };

  for (let lineIdx = 0; lineIdx < amapData.l.length; lineIdx++) {
    const line = amapData.l[lineIdx];
    
    lines.push({
      id: String(lineIdx),
      name: line.ln,
      color: '#' + line.cl
    });
    
    const stations = line.st.filter(s => s.sl);
    for (const station of stations) {
      getNodeId(station);
    }
    
    for (let i = 0; i < stations.length - 1; i++) {
      const curr = stations[i];
      const next = stations[i + 1];
      if (!curr.sl || !next.sl) continue;

      const source = getNodeId(curr);
      const target = getNodeId(next);
      if (!source || !target || source === target) continue;

      const edgeKey = [source, target].sort().join('-');
      if (!edgesMap.has(edgeKey)) {
        edgesMap.set(edgeKey, {
          source,
          target,
          metadata: { lines: [] }
        });
      }

      const edgeLines = edgesMap.get(edgeKey).metadata.lines;
      const lineId = String(lineIdx);
      if (!edgeLines.includes(lineId)) {
        edgeLines.push(lineId);
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    lines
  };
}

function processAllCities() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  
  console.log(`Found ${files.length} city files\n`);
  
  for (const file of files) {
    const cityName = path.basename(file, '.json');
    const inputPath = path.join(examplesDir, `${cityName}.input.json`);
    
    const amapData = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    
    if (!amapData.s) {
      console.log(`Skipping ${cityName}: No subway data`);
      continue;
    }
    
    const result = convertAmapToInput(amapData, cityName);
    fs.writeFileSync(inputPath, JSON.stringify(result, null, 2), 'utf8');
    
    console.log(`${cityName}: ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.lines.length} lines`);
  }
}

if (require.main === module) {
  processAllCities();
}

module.exports = convertAmapToInput;
