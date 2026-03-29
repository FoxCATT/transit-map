const pptxgen = require('pptxgenjs');

async function main() {
  const pptx = new pptxgen();
  
  pptx.author = 'Transit Map Generator';
  pptx.title = 'Chinese Metro Map Generation Solution';
  
  // Slide 1: Title
  let s1 = pptx.addSlide();
  s1.background = { color: '1a1a2e' };
  s1.addText('Chinese Metro Map Generation Solution', { x: 0.5, y: 2, w: 9, h: 2, fontSize: 36, color: 'ffffff', bold: true, align: 'center' });
  s1.addText('Automated Transit Map Generator v1.0', { x: 0.5, y: 4, w: 9, h: 0.8, fontSize: 18, color: 'aaaaaa', align: 'center' });
  
  // Slide 2: Background
  let s2 = pptx.addSlide();
  s2.addText('Project Background', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s2.addText('Manual drawing is time-consuming. Different cities have different layouts. Need automated tool for standardized maps. Goal: Generate readable SVG from Amap data.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 3: Technical Solution
  let s3 = pptx.addSlide();
  s3.addText('Technical Solution', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s3.addText('1. Data Collection: Amap API for metro data. 2. Graph Construction: Stations and lines to graph. 3. ILP Solving: SCIP integer linear programming. 4. Octolinearity: 8-direction constraints. 5. Bezier Smoothing: Curve smoothing for SVG.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 4: Architecture
  let s4 = pptx.addSlide();
  s4.addText('System Architecture', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s4.addText('Amap Metro Data (JSON) -> prepare-graph -> generate-lp -> SCIP Solver -> smooth-bezier -> SVG Output', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 5: Constraints
  let s5 = pptx.addSlide();
  s5.addText('ILP Constraints', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s5.addText('Octolinearity: 8 directions (0, 45, 90, 135, 180, 225, 270, 315 deg). Occlusion: Maintain minimum distance between lines. Edge Length: Min 1, Max 8 units.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 6: Results
  let s6 = pptx.addSlide();
  s6.addText('Achievements', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s6.addText('Cities Generated: 43/47. Successfully Covered: Beijing (411 stations, 27 lines), Shanghai (418 stations, 24 lines), Guangzhou (334 stations, 23 lines), Shenzhen (355 stations, 17 lines), Chengdu (365 stations, 18 lines), Hangzhou (298 stations, 16 lines).', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 14 });
  
  // Slide 7: Quality Evaluation
  let s7 = pptx.addSlide();
  s7.addText('Quality Evaluation', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  
  const tableData = [
    [
      { text: 'City', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: '1a1a2e' } } },
      { text: 'Score', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: '1a1a2e' } } },
      { text: 'Sharp Angles', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: '1a1a2e' } } },
      { text: 'Spacing CV', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: '1a1a2e' } } },
      { text: 'Avg Distance', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: '1a1a2e' } } }
    ],
    [
      { text: 'Urumqi', options: { fontSize: 11 } },
      { text: '97', options: { fontSize: 11, color: '16a34a' } },
      { text: '0%', options: { fontSize: 11, color: '16a34a' } },
      { text: '0.000', options: { fontSize: 11, color: '16a34a' } },
      { text: '6.33', options: { fontSize: 11 } }
    ],
    [
      { text: 'Hangzhou', options: { fontSize: 11 } },
      { text: '35', options: { fontSize: 11, color: 'dc2626' } },
      { text: '58%', options: { fontSize: 11, color: 'dc2626' } },
      { text: '2.351', options: { fontSize: 11, color: 'dc2626' } },
      { text: '4.45', options: { fontSize: 11 } }
    ],
    [
      { text: 'Shanghai', options: { fontSize: 11 } },
      { text: '29', options: { fontSize: 11, color: 'dc2626' } },
      { text: '58%', options: { fontSize: 11, color: 'dc2626' } },
      { text: '1.824', options: { fontSize: 11, color: 'dc2626' } },
      { text: '3.31', options: { fontSize: 11 } }
    ],
    [
      { text: 'Beijing', options: { fontSize: 11 } },
      { text: '24', options: { fontSize: 11, color: 'dc2626' } },
      { text: '65%', options: { fontSize: 11, color: 'dc2626' } },
      { text: '0.985', options: { fontSize: 11, color: 'dc2626' } },
      { text: '1.88', options: { fontSize: 11 } }
    ]
  ];
  
  s7.addTable(tableData, { x: 0.5, y: 1.5, w: 9, colW: [1.8, 1.5, 1.8, 1.9, 2], rowH: 0.4, border: { type: 'solid', pt: 1, color: 'cccccc' } });
  
  // Slide 8: Problems
  let s8 = pptx.addSlide();
  s8.addText('Problems Found', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s8.addText('1. High Sharp Angle Ratio: 50-70% of bends < 90 deg in large cities, lines look messy. 2. Uneven Station Spacing: High CV (0.8-2.4). 3. Low Line Density: Avg min distance only 1-4 units.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 9: Optimization Plan
  let s9 = pptx.addSlide();
  s9.addText('Optimization Plan', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s9.addText('Short-term: Adjust Bezier parameters, increase occlusion distance. Medium-term: Improve grouped solving, smarter direction calculation. Long-term: Research force-directed algorithms, ML optimization.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 10: Next Steps
  let s10 = pptx.addSlide();
  s10.addText('Next Steps', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, color: '1a1a2e', bold: true });
  s10.addText('1. Improve Quality Metrics: Add readability indicators, automated testing. 2. Optimize Parameters: Adjust based on quality, optimize for city types. 3. Improve Grouped Solving: Better transfer station handling. 4. Generate Final Report: Include all SVGs, provide documentation.', { x: 0.5, y: 1.5, w: 9, h: 4, fontSize: 16 });
  
  // Slide 11: Thank you
  let s11 = pptx.addSlide();
  s11.background = { color: '1a1a2e' };
  s11.addText('Thank You', { x: 0.5, y: 2, w: 9, h: 2, fontSize: 48, color: 'ffffff', bold: true, align: 'center' });
  s11.addText('Transit Map Generator', { x: 0.5, y: 4, w: 9, h: 0.8, fontSize: 18, color: 'aaaaaa', align: 'center' });
  
  console.log('Total slides:', pptx.slides.length);
  
  const outputPath = 'output/Metro_Map_Generation_Solution.pptx';
  await pptx.writeFile({ fileName: outputPath });
  
  console.log('Presentation saved to:', outputPath);
}

main().catch(console.error);
