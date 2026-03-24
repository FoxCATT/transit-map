const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data/amap-subway');
const examplesDir = path.join(__dirname, '../examples');

function convertAmapToInput(amapData, cityName) {
  const nodesMap = new Map();
  const lines = [];

  for (let lineIdx = 0; lineIdx < amapData.l.length; lineIdx++) {
    const line = amapData.l[lineIdx];
    
    lines.push({
      id: String(lineIdx),
      name: line.ln,
      color: '#' + line.cl
    });
    
    const stations = line.st;
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];
      if (!station.sl) continue;
      
      const [x, y] = station.sl.split(',').map(Number);
      if (isNaN(x) || isNaN(y)) continue;
      
      if (!nodesMap.has(station.sid)) {
        nodesMap.set(station.sid, {
          id: station.sid,
          label: station.n,
          metadata: { x, y }
        });
      }
    }
  }

  const edgesSet = new Set();
  for (let lineIdx = 0; lineIdx < amapData.l.length; lineIdx++) {
    const line = amapData.l[lineIdx];
    const stations = line.st.filter(s => s.sl);
    
    for (let i = 0; i < stations.length - 1; i++) {
      const curr = stations[i];
      const next = stations[i + 1];
      if (!curr.sl || !next.sl) continue;
      
      const edgeKey = [curr.sid, next.sid].sort().join('-');
      if (!edgesSet.has(edgeKey)) {
        edgesSet.add(edgeKey);
      }
    }
  }

  const edges = Array.from(edgesSet).map(key => {
    const [source, target] = key.split('-');
    
    const lineIds = [];
    for (let lineIdx = 0; lineIdx < amapData.l.length; lineIdx++) {
      const line = amapData.l[lineIdx];
      const stationIds = line.st.filter(s => s.sl).map(s => s.sid);
      if (stationIds.includes(source) && stationIds.includes(target)) {
        lineIds.push(String(lineIdx));
      }
    }
    
    return {
      source,
      target,
      metadata: { lines: lineIds }
    };
  });

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
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
    fs.writeFileSync(inputPath, JSON.stringify(result, null, 2, 'utf8'));
    
    console.log(`${cityName}: ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.lines.length} lines`);
  }
}

processAllCities();
