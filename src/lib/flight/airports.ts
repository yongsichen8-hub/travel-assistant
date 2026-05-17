/**
 * 城市 ↔ IATA 机场代码 双向映射表
 * 覆盖 50+ 中国主要城市 + 国际热门城市
 */

/** 机场条目 */
interface AirportEntry {
  iata: string;
  airportName: string; // 中文机场名
  city: string;        // 所属城市名
}

/** 完整机场列表 */
const AIRPORTS: AirportEntry[] = [
  // ─── 中国主要城市 ───
  // 北京
  { iata: 'PEK', airportName: '北京首都国际机场', city: '北京' },
  { iata: 'PKX', airportName: '北京大兴国际机场', city: '北京' },
  // 上海
  { iata: 'PVG', airportName: '上海浦东国际机场', city: '上海' },
  { iata: 'SHA', airportName: '上海虹桥国际机场', city: '上海' },
  // 广州
  { iata: 'CAN', airportName: '广州白云国际机场', city: '广州' },
  // 深圳
  { iata: 'SZX', airportName: '深圳宝安国际机场', city: '深圳' },
  // 成都
  { iata: 'CTU', airportName: '成都双流国际机场', city: '成都' },
  { iata: 'TFU', airportName: '成都天府国际机场', city: '成都' },
  // 杭州
  { iata: 'HGH', airportName: '杭州萧山国际机场', city: '杭州' },
  // 武汉
  { iata: 'WUH', airportName: '武汉天河国际机场', city: '武汉' },
  // 西安
  { iata: 'XIY', airportName: '西安咸阳国际机场', city: '西安' },
  // 重庆
  { iata: 'CKG', airportName: '重庆江北国际机场', city: '重庆' },
  // 南京
  { iata: 'NKG', airportName: '南京禄口国际机场', city: '南京' },
  // 天津
  { iata: 'TSN', airportName: '天津滨海国际机场', city: '天津' },
  // 长沙
  { iata: 'CSX', airportName: '长沙黄花国际机场', city: '长沙' },
  // 青岛
  { iata: 'TAO', airportName: '青岛胶东国际机场', city: '青岛' },
  // 大连
  { iata: 'DLC', airportName: '大连周水子国际机场', city: '大连' },
  // 厦门
  { iata: 'XMN', airportName: '厦门高崎国际机场', city: '厦门' },
  // 昆明
  { iata: 'KMG', airportName: '昆明长水国际机场', city: '昆明' },
  // 三亚
  { iata: 'SYX', airportName: '三亚凤凰国际机场', city: '三亚' },
  // 海口
  { iata: 'HAK', airportName: '海口美兰国际机场', city: '海口' },
  // 贵阳
  { iata: 'KWE', airportName: '贵阳龙洞堡国际机场', city: '贵阳' },
  // 南宁
  { iata: 'NNG', airportName: '南宁吴圩国际机场', city: '南宁' },
  // 福州
  { iata: 'FOC', airportName: '福州长乐国际机场', city: '福州' },
  // 合肥
  { iata: 'HFE', airportName: '合肥新桥国际机场', city: '合肥' },
  // 济南
  { iata: 'TNA', airportName: '济南遥墙国际机场', city: '济南' },
  // 郑州
  { iata: 'CGO', airportName: '郑州新郑国际机场', city: '郑州' },
  // 沈阳
  { iata: 'SHE', airportName: '沈阳桃仙国际机场', city: '沈阳' },
  // 哈尔滨
  { iata: 'HRB', airportName: '哈尔滨太平国际机场', city: '哈尔滨' },
  // 长春
  { iata: 'CGQ', airportName: '长春龙嘉国际机场', city: '长春' },
  // 乌鲁木齐
  { iata: 'URC', airportName: '乌鲁木齐地窝堡国际机场', city: '乌鲁木齐' },
  // 兰州
  { iata: 'LHW', airportName: '兰州中川国际机场', city: '兰州' },
  // 太原
  { iata: 'TYN', airportName: '太原武宿国际机场', city: '太原' },
  // 呼和浩特
  { iata: 'HET', airportName: '呼和浩特白塔国际机场', city: '呼和浩特' },
  // 银川
  { iata: 'INC', airportName: '银川河东国际机场', city: '银川' },
  // 西宁
  { iata: 'XNN', airportName: '西宁曹家堡国际机场', city: '西宁' },
  // 拉萨
  { iata: 'LXA', airportName: '拉萨贡嘎国际机场', city: '拉萨' },
  // 石家庄
  { iata: 'SJW', airportName: '石家庄正定国际机场', city: '石家庄' },
  // 南昌
  { iata: 'KHN', airportName: '南昌昌北国际机场', city: '南昌' },
  // 珠海
  { iata: 'ZUH', airportName: '珠海金湾国际机场', city: '珠海' },
  // 温州
  { iata: 'WNZ', airportName: '温州龙湾国际机场', city: '温州' },
  // 宁波
  { iata: 'NGB', airportName: '宁波栎社国际机场', city: '宁波' },
  // 无锡
  { iata: 'WUX', airportName: '无锡苏南硕放国际机场', city: '无锡' },
  // 烟台
  { iata: 'YNT', airportName: '烟台蓬莱国际机场', city: '烟台' },
  // 桂林
  { iata: 'KWL', airportName: '桂林两江国际机场', city: '桂林' },
  // 丽江
  { iata: 'LJG', airportName: '丽江三义国际机场', city: '丽江' },
  // 张家界
  { iata: 'DYG', airportName: '张家界荷花国际机场', city: '张家界' },

  // ─── 国际热门城市 ───
  // 东京
  { iata: 'NRT', airportName: '东京成田国际机场', city: '东京' },
  { iata: 'HND', airportName: '东京羽田国际机场', city: '东京' },
  // 首尔
  { iata: 'ICN', airportName: '首尔仁川国际机场', city: '首尔' },
  // 新加坡
  { iata: 'SIN', airportName: '新加坡樟宜国际机场', city: '新加坡' },
  // 曼谷
  { iata: 'BKK', airportName: '曼谷素万那普国际机场', city: '曼谷' },
  { iata: 'DMK', airportName: '曼谷廊曼国际机场', city: '曼谷' },
  // 香港
  { iata: 'HKG', airportName: '香港国际机场', city: '香港' },
  // 澳门
  { iata: 'MFM', airportName: '澳门国际机场', city: '澳门' },
  // 台北
  { iata: 'TPE', airportName: '台北桃园国际机场', city: '台北' },
  // 洛杉矶
  { iata: 'LAX', airportName: '洛杉矶国际机场', city: '洛杉矶' },
  // 纽约
  { iata: 'JFK', airportName: '纽约约翰·肯尼迪国际机场', city: '纽约' },
  { iata: 'EWR', airportName: '纽约纽瓦克自由国际机场', city: '纽约' },
  // 伦敦
  { iata: 'LHR', airportName: '伦敦希思罗国际机场', city: '伦敦' },
  { iata: 'LGW', airportName: '伦敦盖特威克国际机场', city: '伦敦' },
  // 巴黎
  { iata: 'CDG', airportName: '巴黎戴高乐国际机场', city: '巴黎' },
  // 悉尼
  { iata: 'SYD', airportName: '悉尼金斯福德·史密斯国际机场', city: '悉尼' },
];

// ─── 构建索引 ───

/** 城市名 → IATA 代码数组 */
const cityToIATAMap = new Map<string, string[]>();
/** IATA 代码 → 城市名 */
const iataToCityMap = new Map<string, string>();
/** IATA 代码 → 中文机场名 */
const iataToAirportNameMap = new Map<string, string>();

for (const entry of AIRPORTS) {
  // city → iata[]
  const existing = cityToIATAMap.get(entry.city);
  if (existing) {
    existing.push(entry.iata);
  } else {
    cityToIATAMap.set(entry.city, [entry.iata]);
  }
  // iata → city
  iataToCityMap.set(entry.iata, entry.city);
  // iata → airportName
  iataToAirportNameMap.set(entry.iata, entry.airportName);
}

/**
 * 城市名转 IATA 代码数组
 * 多机场城市返回所有机场代码，未知城市返回空数组
 */
export function cityToIATA(cityName: string): string[] {
  return cityToIATAMap.get(cityName) ?? [];
}

/**
 * IATA 代码转城市名
 * 未知代码返回原始 IATA 字符串
 */
export function iataToCity(code: string): string {
  return iataToCityMap.get(code) ?? code;
}

/**
 * IATA 代码转中文机场名
 * 未知代码返回原始 IATA 字符串
 */
export function iataToAirportName(code: string): string {
  return iataToAirportNameMap.get(code) ?? code;
}
