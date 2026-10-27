import { NETWORK } from './network.js';
import { getPayToAddress } from './payee.js';

/**
 * Level 2 全球极端环境与野外探险生存决策系统 —— 11 个 API 全量服务目录
 * 包含 7 个核心野外生存与极端气候监测 API + 4 个干扰噪音 API
 * 每个 API 定价 0.001 USDC (1000 micro-units on Base Sepolia)
 */
export const PRICE_USDC = '$0.001';

export const API_CATALOG = [
  // ================= 7 个核心野外生存 API =================
  {
    id: 'earthquake',
    path: '/api/survival/earthquake',
    name: '近场地震与余震危险监测',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 USGS FDSN Event API，监测 500km 半径内过去 7 天 M2.5+ 地震，评估山体滑坡与崩塌风险',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'storm',
    path: '/api/survival/storm',
    name: '极端风暴与失温气象监测',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 Open-Meteo 高清数值预报，监测实况风速/阵风/气温/降水及未来 24h 暴雪极寒失温预警',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'flood',
    path: '/api/survival/flood',
    name: '流域洪涝与暴涨漫滩监测',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 Open-Meteo GloFAS 全球水文洪水系统，预测未来 7 天河道径流比率，规避沟谷扎营洪水',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'terrain',
    path: '/api/survival/terrain',
    name: '地形高程与局部坡度勘察',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 Copernicus DEM 90m 高程模型，采样十字邻点计算局部最大坡度与海拔，预警高反与崩滑',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'dust',
    path: '/api/survival/dust',
    name: '沙尘暴与颗粒物浓度监测',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 Open-Meteo Air Quality，监测沙尘浓度、PM10/PM2.5 与光学厚度，预警黑风暴与失散',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'sunlight',
    path: '/api/survival/sunlight',
    name: '昼夜天光与日光生存窗口',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: true,
    description: '基于 Sunrise-Sunset API，计算日出日落、民用晨昏蒙影与有效日照，避免摸黑扎营致命事故',
    sampleParams: { lat: 38.0, lon: 88.5 }
  },
  {
    id: 'geomagnetic',
    path: '/api/survival/geomagnetic',
    name: '空间天气与地磁暴监测',
    category: 'survival_core',
    isNoise: false,
    price: PRICE_USDC,
    requiresLocation: false,
    description: '基于 NOAA SWPC 全球行星 K 指数，预警 G1~G5 级地磁暴对 GPS 导航漂移与卫星通信中断影响',
    sampleParams: {}
  },

  // ================= 4 个噪音干扰 API =================
  {
    id: 'forex',
    path: '/api/noise/forex',
    name: '国际外汇法定货币汇率',
    category: 'noise_finance',
    isNoise: true,
    price: PRICE_USDC,
    requiresLocation: false,
    description: '基于 Frankfurter 汇率数据，提供美元兑主要法币行情（对野外求生零价值的金融噪音）',
    sampleParams: {}
  },
  {
    id: 'catfact',
    path: '/api/noise/catfact',
    name: '随机趣味猫咪科普事实',
    category: 'noise_trivia',
    isNoise: true,
    price: PRICE_USDC,
    requiresLocation: false,
    description: '基于 Cat Facts Ninja API，提供宠物猫科普知识（对野外求生零价值的趣味噪音）',
    sampleParams: {}
  },
  {
    id: 'crypto',
    path: '/api/noise/crypto',
    name: '加密货币现货行情走势',
    category: 'noise_crypto',
    isNoise: true,
    price: PRICE_USDC,
    requiresLocation: false,
    description: '基于 CoinGecko API，提供 BTC/ETH 实时美元行情（对野外求生零价值的代币噪音）',
    sampleParams: {}
  },
  {
    id: 'iss',
    path: '/api/noise/iss',
    name: '国际空间站轨道天顶监测',
    category: 'noise_space',
    isNoise: true,
    price: PRICE_USDC,
    requiresLocation: false,
    description: '基于 WhereTheISS.at API，提供 ISS 空间站实时经纬度与时速（对野外求生零价值的航天噪音）',
    sampleParams: {}
  }
];

/**
 * 构造用于 x402 paymentMiddleware 的 routesConfig 字典
 */
export function buildX402RoutesConfig() {
  const payTo = getPayToAddress();
  const routesConfig = {};

  for (const item of API_CATALOG) {
    routesConfig[item.path] = {
      accepts: {
        scheme: 'exact',
        payTo,
        price: item.price,
        network: NETWORK
      },
      description: `${item.name} (${item.price} USDC on Base Sepolia)`
    };
  }

  return routesConfig;
}
