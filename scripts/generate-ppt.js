const pptxgen = require('pptxgenjs');

function createPresentation() {
  const pptx = new pptxgen();
  
  pptx.author = 'Transit Map Generator';
  pptx.title = 'Chinese Metro Map Generation Solution';
  
  // Slide 1: Title
  const slide1 = pptx.addSlide();
  slide1.background = { color: '1a1a2e' };
  slide1.addText('Chinese Metro Map Generation Solution', {
    x: 1, y: 2, w: 8, h: 2,
    fontSize: 36,
    color: 'ffffff',
    bold: true,
    align: 'center'
  });
  slide1.addText('Automated Transit Map Generator v1.0', {
    x: 1, y: 4, w: 8, h: 0.8,
    fontSize: 18,
    color: 'aaaaaa',
    align: 'center'
  });
  
  // Slide 2: Background
  const slide2 = pptx.addSlide();
  slide2.addText('Project Background', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28,
    color: '1a1a2e',
    bold: true
  });
  slide2.addText([
    { text: '• Manual drawing of metro maps is time-consuming', options: { fontSize: 16, bullet: true, breakLine: true } },
    { text: '• Different cities have different layouts', options: { fontSize: 16, bullet: true, breakLine: true } },
    { text: '• Need automated tool for standardized maps', options: { fontSize: 16, bullet: true, breakLine: true } },
    { text: '• Goal: Generate readable SVG maps from Amap data', options: { fontSize: 16, bullet: true, breakLine: true } }
  ], { x: 0.5, y: 1.5, w: 9, h: 4 });
  
  // Slide 3: Technical Solution
  const slide3 = pptx.addSlide();
  slide3.addText('Technical Solution', {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 28,
    color: '1a1a2e',
    bold: true
  });
  slide3.addText([
    { text: '1. Data Collection: Amap API for metro data', options: { fontSize: 16, breakLine: true } },
    { text: '2. Graph Construction: Stations and lines to graph', options: { fontSize: 16, breakLine: true } },
    { text: '3. ILP Solving: SCIP integer linear programming', options: { fontSize: 16, breakLine: true } },
    { text: '4. Octolinearity: 8-direction constraints for metro maps', options: { fontSize: 16, breakLine: true } },
    { text: '5. Bezier Smoothing: Curve smoothing for final SVG', options: { fontSize: 16, breakLine: true } }
  ], { x: 0.5, y: 1.5, w: 9, h: 4 });
  
  return pptx;
}

async function generatePPT() {
  console.log('Generating presentation...');
  
  const pptx = createPresentation();
  
  const outputPath = 'output/Metro_Map_Generation_Solution.pptx';
  await pptx.writeFile({ fileName: outputPath });
  
  console.log('Presentation saved to: ' + outputPath);
}

generatePPT().catch(console.error);
