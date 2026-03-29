const fs = require('fs');

function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 180;
  
  const cosTheta = dot / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosTheta));
  return Math.acos(clampedCos) * 180 / Math.PI;
}

function extractPathPoints(pathData) {
  const points = [];
  const commands = pathData.match(/[MLCQZ][^MLCQZ]*/gi) || [];
  
  commands.forEach(cmd => {
    const type = cmd[0].toUpperCase();
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    
    if (type === 'M' || type === 'L') {
      points.push({ x: coords[0], y: coords[1] });
    } else if (type === 'C') {
      points.push({ x: coords[4], y: coords[5] });
    } else if (type === 'Q') {
      points.push({ x: coords[2], y: coords[3] });
    }
  });
  
  return points;
}

function parseSVG(svgContent) {
  const paths = [];
  const pathRegex = /<path[^>]*class="line[^"]*"[^>]*d="([^"]*)"[^>]*>/g;
  let match;
  
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const pathData = match[1];
    const points = extractPathPoints(pathData);
    if (points.length >= 2) {
      paths.push({ pathData, points });
    }
  }
  
  return paths;
}

// Count sharp angles (indicates messy lines)
function evaluateSharpAngles(paths) {
  let sharpAngles = 0;
  let totalAngles = 0;
  
  paths.forEach(path => {
    const points = path.points;
    for (let i = 1; i < points.length - 1; i++) {
      const angle = calculateAngle(points[i - 1], points[i], points[i + 1]);
      if (angle < 90) {
        sharpAngles++;
      }
      totalAngles++;
    }
  });
  
  const sharpRatio = totalAngles > 0 ? sharpAngles / totalAngles : 0;
  return {
    score: Math.max(0, 100 - sharpRatio * 300),
    sharpAngles,
    totalAngles,
    sharpRatio
  };
}

// Evaluate station spacing uniformity
function evaluateSpacingUniformity(paths) {
  const distances = [];
  
  paths.forEach(path => {
    const points = path.points;
    for (let i = 0; i < points.length - 1; i++) {
      const d = distance(points[i], points[i + 1]);
      if (d > 0.01) distances.push(d);
    }
  });
  
  if (distances.length === 0) return { score: 0, mean: 0, stdDev: 0, cv: 0 };
  
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  return {
    score: Math.max(0, 100 - cv * 200),
    mean,
    stdDev,
    cv
  };
}

// Evaluate line density (check if lines are too close together)
function evaluateLineDensity(paths) {
  if (paths.length < 2) return { score: 100, avgMinDistance: 0 };
  
  let totalMinDist = 0;
  let pairCount = 0;
  
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const points1 = paths[i].points;
      const points2 = paths[j].points;
      
      let minDist = Infinity;
      for (const p1 of points1) {
        for (const p2 of points2) {
          const d = distance(p1, p2);
          minDist = Math.min(minDist, d);
        }
      }
      
      if (minDist < Infinity) {
        totalMinDist += minDist;
        pairCount++;
      }
    }
  }
  
  const avgMinDistance = pairCount > 0 ? totalMinDist / pairCount : 0;
  const score = Math.min(100, avgMinDistance * 20);
  
  return {
    score,
    avgMinDistance
  };
}

// Evaluate compactness
function evaluateCompactness(paths) {
  if (paths.length === 0) return { score: 0, aspectRatio: 0 };
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  paths.forEach(path => {
    path.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });
  
  const width = maxX - minX;
  const height = maxY - minY;
  const aspectRatio = height > 0 ? width / height : 0;
  
  // Prefer aspect ratio close to 1.5 (standard metro map proportions)
  const idealRatio = 1.5;
  const ratioScore = Math.max(0, 100 - Math.abs(aspectRatio - idealRatio) * 40);
  
  return {
    score: ratioScore,
    aspectRatio,
    width,
    height
  };
}

// Main evaluation function
function evaluateQuality(svgContent) {
  const paths = parseSVG(svgContent);
  
  if (paths.length === 0) {
    return {
      overallScore: 0,
      error: 'No valid paths found',
      details: {}
    };
  }
  
  const sharpAngles = evaluateSharpAngles(paths);
  const spacingUniformity = evaluateSpacingUniformity(paths);
  const lineDensity = evaluateLineDensity(paths);
  const compactness = evaluateCompactness(paths);
  
  const overallScore = (
    sharpAngles.score * 0.35 +
    spacingUniformity.score * 0.25 +
    lineDensity.score * 0.25 +
    compactness.score * 0.15
  );
  
  return {
    overallScore: Math.round(overallScore * 100) / 100,
    sharpAngles: {
      score: Math.round(sharpAngles.score * 100) / 100,
      count: sharpAngles.sharpAngles,
      total: sharpAngles.totalAngles,
      ratio: Math.round(sharpAngles.sharpRatio * 1000) / 1000
    },
    spacingUniformity: {
      score: Math.round(spacingUniformity.score * 100) / 100,
      mean: Math.round(spacingUniformity.mean * 100) / 100,
      cv: Math.round(spacingUniformity.cv * 1000) / 1000
    },
    lineDensity: {
      score: Math.round(lineDensity.score * 100) / 100,
      avgMinDistance: Math.round(lineDensity.avgMinDistance * 100) / 100
    },
    compactness: {
      score: Math.round(compactness.score * 100) / 100,
      aspectRatio: Math.round(compactness.aspectRatio * 100) / 100,
      width: Math.round(compactness.width * 10) / 10,
      height: Math.round(compactness.height * 10) / 10
    },
    pathsCount: paths.length
  };
}

module.exports = { evaluateQuality, parseSVG };
