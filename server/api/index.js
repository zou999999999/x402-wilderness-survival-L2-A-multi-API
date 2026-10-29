import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_FILE = path.resolve(__dirname, '../src/config/SKILL.md');

import express from 'express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { paymentMiddleware } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';

import { NETWORK, USDC_ASSET, FACILITATOR_URL } from '../src/config/network.js';
import { getPayToAddress } from '../src/config/payee.js';
import { API_CATALOG, buildX402RoutesConfig, PRICE_USDC } from '../src/config/catalog.js';
import { resolveLocation } from '../src/lib/location.js';
import * as providers from '../src/providers/index.js';

const app = express();
app.use(express.json());

// 兼容 Vercel rewrite：从 __path 还原原始路由与 query 参数
app.use((req, res, next) => {
  if (req.query && req.query.__path) {
    const originalPath = req.query.__path;
    delete req.query.__path;
    const remainingQuery = new URLSearchParams(req.query).toString();
    req.url = originalPath + (remainingQuery ? `?${remainingQuery}` : '');
  }
  next();
});

// 配置 x402 资源服务器与 Base Sepolia EVM 方案
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// ==================== 1. 免费状态与目录端点 (优先匹配，避免中间件影响) ====================

app.get('/health', (_req, res) => {
  try {
    let payTo = 'unknown';
    try { payTo = getPayToAddress(); } catch (e) { payTo = `error: ${e.message}`; }
    res.json({
      status: 'ok',
      service: 'x402-extreme-survival-recon',
      role: 'server',
      network: NETWORK,
      asset: USDC_ASSET,
      payTo,
      pricePerCall: PRICE_USDC,
      totalEndpoints: API_CATALOG.length,
      facilitator: FACILITATOR_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.get('/api/catalog', (_req, res) => {
  let payTo = 'unknown';
  try { payTo = getPayToAddress(); } catch (e) { payTo = `error: ${e.message}`; }
  res.json({
    service: '全球极端环境与野外探险生存决策系统 API 目录',
    pricing: `${PRICE_USDC} per call on ${NETWORK}`,
    payTo,
    catalog: API_CATALOG
  });
});

// 公开技能规范端点 (Agent-Readable Skill Marketplace Endpoint)
app.get(['/api/skill', '/skill', '/SKILL.md', '/skill.md'], (_req, res) => {
  try {
    if (fs.existsSync(SKILL_FILE)) {
      const content = fs.readFileSync(SKILL_FILE, 'utf8');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(content);
    }
  } catch {}
  res.status(404).send('# 技能规范未就绪\n请通过 /api/catalog 获取结构化目录。');
});

app.get('/', (_req, res) => {
  res.send('🌐 x402 Extreme Survival Recon Service is running! Visit /health, /api/catalog or /api/skill.');
});

// 构建 11 个 API 的 x402 付费规格路由表（每个 $0.001 USDC）
const routesConfig = buildX402RoutesConfig();

// 挂载 x402 中间件（自动拦截未付款请求返回 402，并在付款后验证链上结算）
app.use(paymentMiddleware(routesConfig, resourceServer));

// 辅助：封装统一 Provider 处理器
function handleProvider(fetcher, needsLoc = false) {
  return async (req, res) => {
    try {
      let loc = null;
      if (needsLoc) {
        loc = await resolveLocation(req.query);
      }
      const result = await fetcher(needsLoc ? loc : req.query);
      res.json({
        success: true,
        endpoint: req.path,
        location: loc,
        timestamp: new Date().toISOString(),
        ...result
      });
    } catch (err) {
      const status = err.status || 500;
      console.error(`[API Error] ${req.path} (${status}):`, err.message);
      res.status(status).json({
        success: false,
        endpoint: req.path,
        error: err.message
      });
    }
  };
}

// ==================== 2. 11 个外部微服务数据端点 (各付费 $0.001) ====================

// 自然环境与地质气象微服务
app.get('/api/survival/earthquake', handleProvider(providers.fetchEarthquake, true));
app.get('/api/survival/storm', handleProvider(providers.fetchStorm, true));
app.get('/api/survival/flood', handleProvider(providers.fetchFlood, true));
app.get('/api/survival/terrain', handleProvider(providers.fetchTerrain, true));
app.get('/api/survival/dust', handleProvider(providers.fetchDust, true));
app.get('/api/survival/sunlight', handleProvider(providers.fetchSunlight, true));
app.get('/api/survival/geomagnetic', handleProvider(providers.fetchGeomagnetic, false));

// 市场金融、知识科普与空间轨道微服务 (标准路径)
app.get('/api/market/forex', handleProvider(providers.fetchForex, false));
app.get('/api/info/catfact', handleProvider(providers.fetchCatFact, false));
app.get('/api/market/crypto', handleProvider(providers.fetchCrypto, false));
app.get('/api/orbit/iss', handleProvider(providers.fetchIss, false));

// 历史别名路由兼容
app.get('/api/noise/forex', handleProvider(providers.fetchForex, false));
app.get('/api/noise/catfact', handleProvider(providers.fetchCatFact, false));
app.get('/api/noise/crypto', handleProvider(providers.fetchCrypto, false));
app.get('/api/noise/iss', handleProvider(providers.fetchIss, false));

export default app;
