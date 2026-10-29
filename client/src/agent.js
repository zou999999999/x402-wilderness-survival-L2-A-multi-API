import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

import { getPayerPrivateKey, getPayerAddress, getExpectedPayToAddress } from './config/wallet.js';
import { exportReportToDocx } from './lib/docx_exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '../reports');

// 加载环境变量 (优先 client/.env)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Base Sepolia USDC 合约
const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }
];

/**
 * 客观中立的 11 个微服务标准工具集 (Tool Reference Catalog)
 * 绝对不含任何“必需调用 / 必须拒买 / 噪音”的主观标签
 */
const NEUTRAL_TOOLSET_CATALOG = [
  { id: 'earthquake', path: '/api/survival/earthquake', name: '近场地震与地质活动监测', category: 'geology', price: '$0.001', requiresLocation: true, description: '基于 USGS FDSN Event API，监测 500km 半径内过去 7 天 M2.5+ 地震烈度与震源深度' },
  { id: 'storm', path: '/api/survival/storm', name: '极端风暴与温温雨雪气象监测', category: 'meteorology', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo 高清数值预报，监测实况风速/阵风/气温/降水及未来 24h 极端风暴' },
  { id: 'flood', path: '/api/survival/flood', name: '流域水文与径流漫滩监测', category: 'hydrology', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo GloFAS 全球水文洪水系统，预测未来 7 天河道径流比率与洪峰到达日' },
  { id: 'terrain', path: '/api/survival/terrain', name: '数字高程与局部坡度勘察', category: 'topography', price: '$0.001', requiresLocation: true, description: '基于 Copernicus DEM 90m 高程模型，采样十字邻点计算局部最大坡度与绝对高程' },
  { id: 'dust', path: '/api/survival/dust', name: '沙尘暴与大气颗粒物浓度监测', category: 'air_quality', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo Air Quality，监测沙尘浓度、PM10/PM2.5 与光学厚度' },
  { id: 'sunlight', path: '/api/survival/sunlight', name: '昼夜天光与日光有效窗口', category: 'astronomy', price: '$0.001', requiresLocation: true, description: '基于 Sunrise-Sunset API，计算日出日落、民用晨昏蒙影与有效日照时长' },
  { id: 'geomagnetic', path: '/api/survival/geomagnetic', name: '空间天气与地磁暴监测', category: 'space_weather', price: '$0.001', requiresLocation: false, description: '基于 NOAA SWPC 全球行星 K 指数，提供实时地磁指数及地磁暴影响' },
  { id: 'forex', path: '/api/market/forex', name: '国际外汇法定货币汇率牌价', category: 'foreign_exchange', price: '$0.001', requiresLocation: false, description: '基于 Frankfurter 汇率数据，提供美元兑主要法定货币（CNY/EUR/JPY/GBP）实时外汇牌价' },
  { id: 'catfact', path: '/api/info/catfact', name: '猫科动物科普与生物事实', category: 'zoology_facts', price: '$0.001', requiresLocation: false, description: '基于 Cat Facts Ninja API，提供猫科动物生物学解剖特征与生理生活习性科学知识' },
  { id: 'crypto', path: '/api/market/crypto', name: '加密数字货币现货行情走势', category: 'cryptocurrency', price: '$0.001', requiresLocation: false, description: '基于 CoinGecko API，提供主流加密数字资产（BTC/ETH 等）在公开交易所的实时现货价格' },
  { id: 'iss', path: '/api/orbit/iss', name: '国际空间站轨道天顶轨迹监测', category: 'orbital_space', price: '$0.001', requiresLocation: false, description: '基于 WhereTheISS.at API，提供国际空间站 (ISS) 实时星下点地表经纬度与近地轨道时速' }
];

/**
 * 读取本地中立 Skill 技能规范文档 (若存在)
 */
function loadLocalSkillSpec() {
  const candidatePaths = [
    path.resolve(__dirname, '../../.agents/skills/x402-level2-survival-recon/SKILL.md'),
    path.resolve(__dirname, '../../../.agents/skills/x402-level2-survival-recon/SKILL.md')
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch {}
  }
  return null;
}

/**
 * Agent 认知推理与按需选路阶段
 * 若未配置 API Key 或用户指定全量模式，则直接购买全部 11 个 API
 */
async function selectApis(mission, catalog, forceAll = false) {
  if (forceAll) {
    console.log(`\n📦 【全量采购模式】用户指定购买全部可用微服务 API (共 ${catalog.length} 项)`);
    return {
      approved: catalog.map(c => ({ ...c, reason: '用户全量采购模式' })),
      rejected: [],
      engine: 'Direct All-Inclusive',
      rationaleSummary: '用户指定全量采购模式，直接购买全部 11 个微服务'
    };
  }

  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  // 1. 若配置了大模型 API Key，驱动 Agent 进行任务驱动的自主意图理解与按需选路
  if (apiKey) {
    console.log(`\n🤖 正在调用智能体 (${model}) 结合 Skill 规范，根据任务剖面自主评估选路...`);
    const skillSpec = loadLocalSkillSpec() || JSON.stringify(catalog, null, 2);

    const systemPrompt = `你是一个具备高度自主选路决策能力的行动智能体 (Recon Agent)。
你当前受命准备执行以下具体任务：
- 任务名称: ${mission.name}
- 任务性质: ${mission.profile}
- 目标坐标: 纬度 ${mission.lat}, 经度 ${mission.lon}

【外部可用的微服务工具集规范 (Skill Toolset Catalog)】:
${skillSpec}

【Agent 自主选路要求】:
1. 请根据任务的地理区位、环境地貌与行动性质，客观评估上述微服务。
2. 每个端点调用都需要消耗 0.001 USDC 链上微支付。你必须只挑选对“完成当前任务目标”有实质帮助的端口；排除对当前任务缺乏现实关联的无关端口（例如野外探险无需外汇/代币，而离岸商业无需地质）。
3. 严格返回有效 JSON 格式：
   - "approvedApiIds": ["入选的API_ID", ...],
   - "rejectedApiIds": ["排除的API_ID", ...],
   - "reasoning": { "<API_ID>": "<入选或排除理由>" },
   - "rationaleSummary": "<整体选路策略简述>"`;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an autonomous API purchasing agent. Always reply in strict JSON.' },
            { role: 'user', content: systemPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const cleaned = content.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed.approvedApiIds) && parsed.approvedApiIds.length > 0) {
          const approved = [];
          const rejected = [];

          for (const api of catalog) {
            if (parsed.approvedApiIds.includes(api.id)) {
              approved.push({
                ...api,
                reason: parsed.reasoning?.[api.id] || '经任务剖面分析确认为当前行动所需'
              });
            } else {
              rejected.push({
                ...api,
                reason: parsed.reasoning?.[api.id] || '与当前任务性质缺乏直接因果关联，排除以节省预算'
              });
            }
          }

          console.log(`✨ [智能体自主选路完成] 精准入选: ${approved.length} 个，自主排除: ${rejected.length} 个`);
          console.log(`📝 选路依据: ${parsed.rationaleSummary || '完成按需选路'}\n`);
          return {
            approved,
            rejected,
            engine: `DeepSeek (${model})`,
            rationaleSummary: parsed.rationaleSummary
          };
        }
      }
    } catch (err) {
      console.warn(`⚠️ 智能体选路网络提示: ${err.message}，自动切换至直接全量采购模式`);
    }
  }

  // 2. 无大模型介入时的简化规范：直接购买全部 11 项，不做主观伪裁决
  console.log(`ℹ️ [直接采购模式] 未配置大模型 API Key 或网络离线，直接全量采购全部 11 项微服务并返回数据`);
  return {
    approved: catalog.map(c => ({ ...c, reason: '直接采购全部微服务' })),
    rejected: [],
    engine: 'Direct Full Catalog',
    rationaleSummary: '直接全量采购全部可用外部微服务'
  };
}

/**
 * 主执行入口
 */
async function run() {
  const targetHost = (process.env.TARGET_URL || 'https://x402-survival-l2a-server.vercel.app').replace(/\/+$/, '');
  
  // 终端命令行参数解析
  const lat = parseFloat(process.argv[2] || process.env.EXPEDITION_LAT || '38.0');
  const lon = parseFloat(process.argv[3] || process.env.EXPEDITION_LON || '88.5');
  const placeName = process.argv[4] || process.env.EXPEDITION_LOCATION || '阿尔金山无人区';
  const profile = process.argv[5] || process.env.EXPEDITION_PROFILE || '极端荒野重装徒步穿越';
  const mode = (process.argv[6] || process.env.EXPEDITION_MODE || 'auto').toLowerCase();
  const isForceAll = mode === 'all';

  // 若环境配置了代理通道，自动应用
  if (targetHost.startsWith('https://')) {
    try {
      const { ProxyAgent, setGlobalDispatcher } = await import('undici');
      const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:7897';
      setGlobalDispatcher(new ProxyAgent(proxyUrl));
    } catch {}
  }

  const mission = {
    name: placeName,
    lat,
    lon,
    profile
  };

  console.log(`\n=================================================================`);
  console.log(`🧭 [x402 Level 2-A] 多源数据服务采购与交付 Agent`);
  console.log(`📍 【探险任务参数】目标地: <${mission.name}> | 经度: <${mission.lon}> | 纬度: <${mission.lat}> | 任务性质: <${mission.profile}>`);
  console.log(`🎯 服务中介节点: ${targetHost}`);
  console.log(`=================================================================\n`);

  // 1. 验证客户端付款钱包私钥
  const payerPrivateKey = getPayerPrivateKey();
  if (!payerPrivateKey) {
    console.error('❌ 未找到付款钱包私钥！请在 client/.env 中配置 PAYER_PRIVATE_KEY。');
    process.exit(1);
  }

  const account = privateKeyToAccount(payerPrivateKey);
  console.log(`👛 付款方钱包地址: ${account.address}`);

  // 2. 检查链上余额
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(undefined, { timeout: 15000, retryCount: 1 })
  });

  try {
    const [ethBal, usdcBal] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: USDC_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
      })
    ]);

    console.log(`⛽ 链上 Gas (ETH):   ${formatUnits(ethBal, 18)} ETH`);
    console.log(`💵 链上余额 (USDC): ${formatUnits(usdcBal, 6)} USDC\n`);
  } catch (err) {
    console.warn(`⚠️ 查询链上余额提示: ${err.message}（继续推进执行）\n`);
  }

  // 3. 服务发现：同步云端微服务目录
  let catalog = NEUTRAL_TOOLSET_CATALOG;
  try {
    const catRes = await fetch(`${targetHost}/api/catalog`, { signal: AbortSignal.timeout(6000) });
    if (catRes.ok) {
      const catJson = await catRes.json();
      if (Array.isArray(catJson.catalog)) {
        catalog = catJson.catalog;
        console.log(`📡 成功从云端中介同步最新可用 API 目录（共 ${catalog.length} 个端点）`);
      }
    }
  } catch {
    console.log(`ℹ️ 使用本地标准中立 API 工具集（共 ${catalog.length} 个端点）`);
  }

  // 4. 选路评估（Agent 自主评估 或 全量采购）
  const { approved, rejected, engine, rationaleSummary } = await selectApis(mission, catalog, isForceAll);

  console.log(`📋 采购计划: 准备真实购买 ${approved.length} 项微服务 | 预估总额: ${(approved.length * 0.001).toFixed(3)} USDC`);
  approved.forEach((a, i) => console.log(`   [${i + 1}] ${a.name} (${a.path})`));
  if (rejected.length > 0) {
    console.log(`   (主动排除 ${rejected.length} 项无关端点，节省 ${(rejected.length * 0.001).toFixed(3)} USDC)`);
  }

  // 5. 初始化 x402 客户端付款执行器
  const paymentFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: 'eip155:84532',
        client: new ExactEvmScheme(account)
      }
    ]
  });

  // 6. 执行真实 x402 链上微支付购买与数据采集
  console.log(`\n⚡ ================ [开始执行 x402 真实微支付采购] ================`);
  const collectedData = {};
  const purchaseAudit = [];

  for (let i = 0; i < approved.length; i++) {
    const api = approved[i];
    const queryParams = new URLSearchParams();
    if (api.requiresLocation) {
      queryParams.set('lat', mission.lat);
      queryParams.set('lon', mission.lon);
      queryParams.set('place', mission.name);
    }
    const fullUrl = `${targetHost}${api.path}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    console.log(`\n[${i + 1}/${approved.length}] 🛒 正在购买: ${api.name} (${api.path})`);

    const t0 = Date.now();
    try {
      // 1. 发起探测请求
      const probeRes = await fetch(fullUrl, { signal: AbortSignal.timeout(8000) });
      if (probeRes.status === 402) {
        const paymentReqHeader = probeRes.headers.get('payment-required') || probeRes.headers.get('x-payment-required');
        let billInfo = 'HTTP 402 Payment Required';
        if (paymentReqHeader) {
          try {
            const bill = JSON.parse(Buffer.from(paymentReqHeader, 'base64').toString('utf8'));
            const accept = bill.accepts?.[0] || {};
            billInfo = `账单金额: ${accept.price || '0.001 USDC'} | 收款方: ${accept.payTo}`;
          } catch {}
        }
        console.log(`   📋 账单回执: ${billInfo}`);
      }

      // 2. 执行真实 EIP-3009 授权签名并完成结算
      let paidRes = await paymentFetch(fullUrl);
      if (!paidRes.ok && paidRes.status === 402) {
        await new Promise(r => setTimeout(r, 1000));
        paidRes = await paymentFetch(fullUrl);
      }
      const latencyMs = Date.now() - t0;

      if (!paidRes.ok) {
        throw new Error(`HTTP ${paidRes.status} ${paidRes.statusText}`);
      }

      // 提取真实链上交易哈希（Tx Hash）—— 绝对不伪造假哈希！
      const paymentResHeader = paidRes.headers.get('payment-response') || paidRes.headers.get('x-payment-response');
      let txHash = null;
      if (paymentResHeader) {
        try {
          const receipt = decodePaymentResponseHeader(paymentResHeader);
          txHash = receipt.transaction || receipt.transactionHash || receipt.txHash || receipt.hash || null;
        } catch (err) {
          console.warn('   ⚠️ payment-response 头解析警告:', err.message);
        }
      }

      const body = await paidRes.json();
      collectedData[api.id] = body;

      const summaryText = body.summary || body.assessment?.summary || '数据已成功采集';

      purchaseAudit.push({
        id: api.id,
        name: api.name,
        path: api.path,
        price: api.price || '$0.001',
        status: 'SUCCESS',
        latencyMs,
        txHash,
        summary: summaryText
      });

      console.log(`   ✨ 购买成功! 状态: 200 OK | 耗时: ${latencyMs}ms`);
      console.log(`   ⛓️ 真实结算凭证 (Tx): ${txHash ? txHash : '链上批处理暂未立即返回哈希'}`);
      console.log(`   📑 遥测内容: ${summaryText}`);

    } catch (err) {
      console.error(`   ❌ 购买失败: ${err.message}`);
      purchaseAudit.push({
        id: api.id,
        name: api.name,
        path: api.path,
        price: api.price || '$0.001',
        status: 'FAILED',
        txHash: null,
        error: err.message
      });
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // 7. 购买结果汇总与数据交付（纯粹反馈，不做主观总结裁决）
  console.log(`\n=================================================================`);
  console.log(`📦 [数据交付汇总] 探险任务: ${mission.name} (${mission.lon}°E, ${mission.lat}°N)`);
  console.log(`📊 采购统计: 计划购买 ${approved.length} 项 | 成功交付 ${purchaseAudit.filter(p => p.status === 'SUCCESS').length} 项`);
  console.log(`💰 实际支出: ${(purchaseAudit.filter(p => p.status === 'SUCCESS').length * 0.001).toFixed(3)} USDC`);
  console.log(`=================================================================`);

  console.log(`\n【各微服务真实遥测数据反馈清单】:`);
  purchaseAudit.forEach((item, i) => {
    if (item.status === 'SUCCESS') {
      console.log(` ${i + 1}. ✅ [${item.name}] (${item.path})`);
      console.log(`    • 交易哈希: ${item.txHash || '已结算'}`);
      console.log(`    • 数据摘要: ${item.summary}`);
    } else {
      console.log(` ${i + 1}. ❌ [${item.name}] 购买失败 (${item.error || '未响应'})`);
    }
  });

  // 8. 归档结构化报告 (JSON 与 Word .docx 报告)
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.resolve(reportsDir, `survival_recon_${timestamp}.json`);
  const docxPath = path.resolve(reportsDir, `survival_recon_${timestamp}.docx`);

  const reportData = {
    expedition: mission,
    timestamp: new Date().toISOString(),
    payerAddress: account.address,
    selectionEngine: engine,
    rationaleSummary,
    purchaseCount: approved.length,
    successCount: purchaseAudit.filter(p => p.status === 'SUCCESS').length,
    purchaseAudit,
    collectedData
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  console.log(`\n💾 结构化审计 JSON 数据已归档: ${reportPath}`);

  // 自动生成专业排版的 Word (.docx) 交付报告
  try {
    await exportReportToDocx({
      mission,
      purchaseAudit,
      collectedData,
      payerAddress: account.address,
      selectionEngine: engine,
      rationaleSummary,
      timestamp: new Date().toISOString(),
      outputPath: docxPath
    });
    console.log(`📄 专业 Word 交付报告已生成:   ${docxPath}`);
    console.log(`💡 您可直接双击上述 .docx 文件，用 Microsoft Word 或 WPS Office 阅读！`);
  } catch (err) {
    console.warn(`⚠️ 导出 Word 报告异常: ${err.message}`);
  }

  console.log(`=================================================================\n`);
}

run().catch(err => {
  console.error('Agent 运行致命异常:', err);
  process.exit(1);
});
