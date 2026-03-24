const https = require('https');
const fs = require('fs');
const path = require('path');

const cities = [
  {name: '北京', code: '1100', pinyin: 'beijing'},
  {name: '上海', code: '3100', pinyin: 'shanghai'},
  {name: '广州', code: '4401', pinyin: 'guangzhou'},
  {name: '深圳', code: '4403', pinyin: 'shenzhen'},
  {name: '南京', code: '3201', pinyin: 'nanjing'},
  {name: '武汉', code: '4201', pinyin: 'wuhan'},
  {name: '天津', code: '1200', pinyin: 'tianjin'},
  {name: '成都', code: '5101', pinyin: 'chengdu'},
  {name: '重庆', code: '5000', pinyin: 'chongqing'},
  {name: '杭州', code: '3301', pinyin: 'hangzhou'},
  {name: '西安', code: '6101', pinyin: 'xian'},
  {name: '苏州', code: '3205', pinyin: 'suzhou'},
  {name: '郑州', code: '4101', pinyin: 'zhengzhou'},
  {name: '长沙', code: '4301', pinyin: 'changsha'},
  {name: '沈阳', code: '2101', pinyin: 'shenyang'},
  {name: '大连', code: '2102', pinyin: 'dalian'},
  {name: '青岛', code: '3702', pinyin: 'qingdao'},
  {name: '南昌', code: '3601', pinyin: 'nanchang'},
  {name: '福州', code: '3501', pinyin: 'fuzhou'},
  {name: '厦门', code: '3502', pinyin: 'xiamen'},
  {name: '昆明', code: '5301', pinyin: 'kunming'},
  {name: '合肥', code: '3401', pinyin: 'hefei'},
  {name: '宁波', code: '3302', pinyin: 'ningbo'},
  {name: '无锡', code: '3202', pinyin: 'wuxi'},
  {name: '南宁', code: '4501', pinyin: 'nanning'},
  {name: '石家庄', code: '1301', pinyin: 'shijiazhuang'},
  {name: '贵阳', code: '5201', pinyin: 'guiyang'},
  {name: '哈尔滨', code: '2301', pinyin: 'haerbin'},
  {name: '东莞', code: '4419', pinyin: 'dongguan'},
  {name: '佛山', code: '4406', pinyin: 'foshan'},
  {name: '温州', code: '3303', pinyin: 'wenzhou'},
  {name: '济南', code: '3701', pinyin: 'jinan'},
  {name: '常州', code: '3204', pinyin: 'changzhou'},
  {name: '徐州', code: '3203', pinyin: 'xuzhou'},
  {name: '太原', code: '1401', pinyin: 'taiyuan'},
  {name: '呼和浩特', code: '1501', pinyin: 'huhehaote'},
  {name: '乌鲁木齐', code: '6501', pinyin: 'wulumuqi'},
  {name: '兰州', code: '6201', pinyin: 'lanzhou'},
  {name: '洛阳', code: '4103', pinyin: 'luoyang'},
  {name: '长春', code: '2201', pinyin: 'changchun'},
];

const dataDir = path.join(__dirname, '../data/amap-subway');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {recursive: true});
}

function downloadCity(city) {
  return new Promise((resolve, reject) => {
    const url = `https://map.amap.com/service/subway?_t=123&srhdata=${city.code}_drw_${city.pinyin}.json`;
    const filePath = path.join(dataDir, `${city.pinyin}.json`);
    
    console.log(`Downloading ${city.name}...`);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.s) {
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
            const lineCount = json.l ? json.l.length : 0;
            console.log(`  ${city.name}: ${lineCount} lines, saved to ${filePath}`);
            resolve({city: city.name, lines: lineCount, success: true});
          } else {
            console.log(`  ${city.name}: No subway data`);
            resolve({city: city.name, lines: 0, success: false, error: 'No data'});
          }
        } catch (e) {
          console.log(`  ${city.name}: Error - ${e.message}`);
          resolve({city: city.name, lines: 0, success: false, error: e.message});
        }
      });
    }).on('error', (e) => {
      console.log(`  ${city.name}: Network error - ${e.message}`);
      resolve({city: city.name, lines: 0, success: false, error: e.message});
    });
  });
}

async function downloadAll() {
  console.log(`Total cities to download: ${cities.length}\n`);
  
  const results = [];
  for (const city of cities) {
    const result = await downloadCity(city);
    results.push(result);
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }
  
  console.log('\n=== Summary ===');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  
  if (failCount > 0) {
    console.log('\nFailed cities:');
    results.filter(r => !r.success).forEach(r => console.log(`  - ${r.city}: ${r.error}`));
  }
}

downloadAll();
