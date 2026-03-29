const pptxgen = require('pptxgenjs');

async function main() {
  const pptx = new pptxgen();
  
  pptx.author = '地铁线路图生成器';
  pptx.title = '中国城市地铁线路图自动化生成方案';
  
  const BLUE = '2563eb';
  const DARK = '1a1a2e';
  const RED = 'dc2626';
  const GREEN = '16a34a';
  const GRAY = '666666';
  
  // Slide 1: 封面
  let s1 = pptx.addSlide();
  s1.background = { color: DARK };
  s1.addText('中国城市地铁线路图', { x: 0.5, y: 1.5, w: 9, h: 1.2, fontSize: 44, color: 'ffffff', bold: true, align: 'center' });
  s1.addText('自动化生成方案', { x: 0.5, y: 2.7, w: 9, h: 1, fontSize: 36, color: '4ade80', bold: true, align: 'center' });
  s1.addText('基于整数线性规划的地铁图绘制系统', { x: 0.5, y: 4, w: 9, h: 0.6, fontSize: 16, color: 'aaaaaa', align: 'center' });
  
  // Slide 2: 项目背景
  let s2 = pptx.addSlide();
  s2.addText('项目背景', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  s2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 4, h: 3.5, fill: { color: 'fef2f2' }, rectRadius: 0.1 });
  s2.addText('面临的问题', { x: 0.7, y: 1.6, w: 3.6, h: 0.5, fontSize: 18, color: RED, bold: true });
  s2.addText('手动绘制地铁图费时费力，不同城市布局差异大，缺乏统一标准', { x: 0.7, y: 2.2, w: 3.6, h: 2.5, fontSize: 14, color: GRAY, lineSpacingMultiple: 1.5 });
  s2.addShape(pptx.ShapeType.rect, { x: 5, y: 1.5, w: 4.5, h: 3.5, fill: { color: 'f0fdf4' }, rectRadius: 0.1 });
  s2.addText('我们的目标', { x: 5.2, y: 1.6, w: 4.1, h: 0.5, fontSize: 18, color: GREEN, bold: true });
  s2.addText('从高德地铁数据自动生成标准化、可读性强的SVG地铁线路图，覆盖全国47个已开通地铁的城市', { x: 5.2, y: 2.2, w: 4.1, h: 2.5, fontSize: 14, color: GRAY, lineSpacingMultiple: 1.5 });
  
  // Slide 3: 技术方案
  let s3 = pptx.addSlide();
  s3.addText('技术方案', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  const steps = [
    { title: '数据采集', desc: '从高德API获取地铁线路数据', x: 0.3 },
    { title: '图构建', desc: '站点和线路转换为图形结构', x: 2.1 },
    { title: 'ILP求解', desc: 'SCIP整数线性规划求解器', x: 3.9 },
    { title: '八方向约束', desc: '确保线路符合地铁图标准', x: 5.7 },
    { title: '贝塞尔曲线', desc: '平滑处理生成最终SVG', x: 7.5 }
  ];
  steps.forEach((step, i) => {
    s3.addShape(pptx.ShapeType.rect, { x: step.x, y: 1.5, w: 1.6, h: 2.5, fill: { color: BLUE }, rectRadius: 0.1 });
    s3.addText((i+1).toString(), { x: step.x, y: 1.6, w: 1.6, h: 0.6, fontSize: 28, color: 'ffffff', bold: true, align: 'center' });
    s3.addText(step.title, { x: step.x, y: 2.2, w: 1.6, h: 0.5, fontSize: 14, color: 'ffffff', bold: true, align: 'center' });
    s3.addText(step.desc, { x: step.x, y: 2.7, w: 1.6, h: 1, fontSize: 11, color: 'ffffff', align: 'center' });
    if (i < 4) s3.addText('>', { x: step.x + 1.6, y: 2.3, w: 0.4, h: 0.5, fontSize: 24, color: BLUE, align: 'center' });
  });

  // Slide 4: 系统架构
  let s4 = pptx.addSlide();
  s4.addText('系统架构', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s4.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  const modules = [
    { name: '高德地铁数据 (JSON)', y: 1.5, color: '6366f1' },
    { name: 'prepare-graph 图预处理', y: 2.3, color: BLUE },
    { name: 'generate-lp LP文件生成', y: 3.1, color: BLUE },
    { name: 'SCIP求解器 整数线性规划', y: 3.9, color: 'f59e0b' },
    { name: 'smooth-bezier 贝塞尔平滑', y: 4.7, color: GREEN },
    { name: 'SVG输出 地铁线路图', y: 5.5, color: '10b981' }
  ];
  modules.forEach((m, i) => {
    s4.addShape(pptx.ShapeType.rect, { x: 2, y: m.y, w: 5.5, h: 0.6, fill: { color: m.color }, rectRadius: 0.1 });
    s4.addText(m.name, { x: 2, y: m.y, w: 5.5, h: 0.6, fontSize: 14, color: 'ffffff', bold: true, align: 'center', valign: 'middle' });
    if (i < modules.length - 1) s4.addText('v', { x: 4.3, y: m.y + 0.55, w: 1, h: 0.3, fontSize: 12, color: GRAY, align: 'center' });
  });
  
  // Slide 5: 约束条件
  let s5 = pptx.addSlide();
  s5.addText('ILP约束条件', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s5.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  s5.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'eff6ff' }, rectRadius: 0.1 });
  s5.addText('八方向约束', { x: 0.5, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: BLUE, bold: true, align: 'center' });
  s5.addText('每条边只能沿8个方向:\n0 45 90 135\n180 225 270 315\n\n使用二进制变量(a,b,c,d)编码方向', { x: 0.7, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.4 });
  s5.addShape(pptx.ShapeType.rect, { x: 3.6, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'fef3c7' }, rectRadius: 0.1 });
  s5.addText('避障约束', { x: 3.6, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: 'd97706', bold: true, align: 'center' });
  s5.addText('确保线路之间保持最小距离\n\n防止线路交叉重叠\n\n默认最小距离: 0', { x: 3.8, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.4 });
  s5.addShape(pptx.ShapeType.rect, { x: 6.7, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'f0fdf4' }, rectRadius: 0.1 });
  s5.addText('边长约束', { x: 6.7, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: GREEN, bold: true, align: 'center' });
  s5.addText('控制线路段长度\n\n最小边长: 1 单位\n最大边长: 8 单位\n\n优化站点间距', { x: 6.9, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.4 });

  // Slide 6: 成果展示
  let s6 = pptx.addSlide();
  s6.addText('生成成果', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s6.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  s6.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 4, h: 2, fill: { color: BLUE }, rectRadius: 0.15 });
  s6.addText('43', { x: 0.5, y: 1.6, w: 4, h: 1, fontSize: 64, color: 'ffffff', bold: true, align: 'center' });
  s6.addText('个城市已成功生成', { x: 0.5, y: 2.6, w: 4, h: 0.6, fontSize: 16, color: 'ffffff', align: 'center' });
  s6.addText('已覆盖主要城市:', { x: 5, y: 1.5, w: 4.5, h: 0.5, fontSize: 16, color: DARK, bold: true });
  s6.addText('北京 (411站, 27线)\n上海 (418站, 24线)\n广州 (334站, 23线)\n深圳 (355站, 17线)\n成都 (365站, 18线)\n杭州 (298站, 16线)\n武汉、重庆、南京、天津等', { x: 5, y: 2.1, w: 4.5, h: 3, fontSize: 13, color: GRAY, lineSpacingMultiple: 1.4 });
  
  // Slide 7: 质量评估
  let s7 = pptx.addSlide();
  s7.addText('质量评估', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  s7.addText('评估指标说明:', { x: 0.5, y: 1.4, w: 9, h: 0.5, fontSize: 16, color: DARK, bold: true });
  s7.addText('- 锐角比例: 线路弯曲角度<90的比例 (越低越好)\n- 站间距变异系数: 站点间距的均匀程度 (越低越好)\n- 平均最小距离: 线路间的平均最小距离 (越高越好)', { x: 0.5, y: 1.9, w: 9, h: 1.2, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.4 });
  const tableData = [
    [
      { text: '城市', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: DARK } } },
      { text: '质量分', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: DARK } } },
      { text: '锐角比例', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: DARK } } },
      { text: '站间距CV', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: DARK } } },
      { text: '评价', options: { bold: true, fontSize: 12, color: 'ffffff', fill: { color: DARK } } }
    ],
    [
      { text: '乌鲁木齐', options: { fontSize: 11 } },
      { text: '97分', options: { fontSize: 11, color: GREEN, bold: true } },
      { text: '0%', options: { fontSize: 11, color: GREEN } },
      { text: '0.000', options: { fontSize: 11, color: GREEN } },
      { text: '优秀', options: { fontSize: 11, color: GREEN, bold: true } }
    ],
    [
      { text: '杭州', options: { fontSize: 11 } },
      { text: '35分', options: { fontSize: 11, color: RED } },
      { text: '58%', options: { fontSize: 11, color: RED } },
      { text: '2.351', options: { fontSize: 11, color: RED } },
      { text: '需优化', options: { fontSize: 11, color: RED } }
    ],
    [
      { text: '上海', options: { fontSize: 11 } },
      { text: '29分', options: { fontSize: 11, color: RED } },
      { text: '58%', options: { fontSize: 11, color: RED } },
      { text: '1.824', options: { fontSize: 11, color: RED } },
      { text: '需优化', options: { fontSize: 11, color: RED } }
    ],
    [
      { text: '北京', options: { fontSize: 11 } },
      { text: '24分', options: { fontSize: 11, color: RED } },
      { text: '65%', options: { fontSize: 11, color: RED } },
      { text: '0.985', options: { fontSize: 11, color: RED } },
      { text: '需优化', options: { fontSize: 11, color: RED } }
    ]
  ];
  s7.addTable(tableData, { x: 0.5, y: 3.2, w: 9, colW: [1.8, 1.5, 1.8, 1.9, 2], rowH: 0.35, border: { type: 'solid', pt: 1, color: 'cccccc' } });

  // Slide 8: 问题分析
  let s8 = pptx.addSlide();
  s8.addText('发现的问题', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: RED } });
  s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 9, h: 1.2, fill: { color: 'fef2f2' }, rectRadius: 0.1 });
  s8.addText('1. 锐角比例过高', { x: 0.7, y: 1.5, w: 8.6, h: 0.4, fontSize: 16, color: RED, bold: true });
  s8.addText('大型城市50-70%的弯曲角度小于90度，导致线路看起来凌乱、不清晰，严重影响可读性', { x: 0.7, y: 1.9, w: 8.6, h: 0.6, fontSize: 13, color: GRAY });
  s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.9, w: 9, h: 1.2, fill: { color: 'fef2f2' }, rectRadius: 0.1 });
  s8.addText('2. 站点间距不均匀', { x: 0.7, y: 2.9, w: 8.6, h: 0.4, fontSize: 16, color: RED, bold: true });
  s8.addText('站间距变异系数高达0.8-2.4，部分站点过于密集，部分过于稀疏，影响地图整体美观', { x: 0.7, y: 3.3, w: 8.6, h: 0.6, fontSize: 13, color: GRAY });
  s8.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.3, w: 9, h: 1.2, fill: { color: 'fef2f2' }, rectRadius: 0.1 });
  s8.addText('3. 线路间距离过近', { x: 0.7, y: 4.3, w: 8.6, h: 0.4, fontSize: 16, color: RED, bold: true });
  s8.addText('线路之间平均最小距离仅1-4单位，导致线路视觉上过于接近，难以区分不同线路', { x: 0.7, y: 4.7, w: 8.6, h: 0.6, fontSize: 13, color: GRAY });
  
  // Slide 9: 优化方案
  let s9 = pptx.addSlide();
  s9.addText('优化方案', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s9.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  s9.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'fef3c7' }, rectRadius: 0.1 });
  s9.addText('短期优化', { x: 0.5, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: 'd97706', bold: true, align: 'center' });
  s9.addText('- 调整贝塞尔曲线参数\n- 增加最小避障距离\n- 优化八方向约束\n- 只对低度数节点应用方向约束', { x: 0.7, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.5 });
  s9.addShape(pptx.ShapeType.rect, { x: 3.6, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'dbeafe' }, rectRadius: 0.1 });
  s9.addText('中期优化', { x: 3.6, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: BLUE, bold: true, align: 'center' });
  s9.addText('- 改进分组求解策略\n- 更智能的初始方向计算\n- 考虑线路实际走向\n- 优化换乘站处理', { x: 3.8, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.5 });
  s9.addShape(pptx.ShapeType.rect, { x: 6.7, y: 1.5, w: 2.8, h: 3.5, fill: { color: 'dcfce7' }, rectRadius: 0.1 });
  s9.addText('长期优化', { x: 6.7, y: 1.6, w: 2.8, h: 0.5, fontSize: 16, color: GREEN, bold: true, align: 'center' });
  s9.addText('- 研究力导向算法\n- 机器学习优化布局\n- 交互式编辑工具\n- 自动美学评估', { x: 6.9, y: 2.2, w: 2.4, h: 2.5, fontSize: 12, color: GRAY, lineSpacingMultiple: 1.5 });

  // Slide 10: 下一步计划
  let s10 = pptx.addSlide();
  s10.addText('下一步计划', { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 32, color: DARK, bold: true });
  s10.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 9, h: 0.05, fill: { color: BLUE } });
  const plans = [
    { num: '1', title: '完善质量评估指标', desc: '添加更多可读性指标，建立自动化测试流程' },
    { num: '2', title: '优化生成参数', desc: '根据质量评估调整参数，针对不同城市类型优化' },
    { num: '3', title: '改进分组求解', desc: '更好地处理换乘站，考虑线路的实际走向' },
    { num: '4', title: '生成最终报告', desc: '包含所有43个城市的SVG，提供使用文档' }
  ];
  plans.forEach((p, i) => {
    const y = 1.5 + i * 1.1;
    s10.addShape(pptx.ShapeType.ellipse, { x: 0.5, y: y, w: 0.6, h: 0.6, fill: { color: BLUE } });
    s10.addText(p.num, { x: 0.5, y: y, w: 0.6, h: 0.6, fontSize: 20, color: 'ffffff', bold: true, align: 'center', valign: 'middle' });
    s10.addText(p.title, { x: 1.3, y: y, w: 8, h: 0.3, fontSize: 16, color: DARK, bold: true });
    s10.addText(p.desc, { x: 1.3, y: y + 0.3, w: 8, h: 0.3, fontSize: 13, color: GRAY });
  });
  
  // Slide 11: 谢谢
  let s11 = pptx.addSlide();
  s11.background = { color: DARK };
  s11.addText('谢谢', { x: 0.5, y: 2, w: 9, h: 1.5, fontSize: 56, color: 'ffffff', bold: true, align: 'center' });
  s11.addText('地铁线路图自动化生成系统', { x: 0.5, y: 3.5, w: 9, h: 0.8, fontSize: 20, color: 'aaaaaa', align: 'center' });
  
  console.log('总页数:', pptx.slides.length);
  
  const outputPath = 'output/地铁线路图生成方案.pptx';
  await pptx.writeFile({ fileName: outputPath });
  
  console.log('PPT已保存至:', outputPath);
}

main().catch(console.error);
