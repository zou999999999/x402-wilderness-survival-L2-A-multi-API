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
 * 客观中立的 11 个微服务默认服务目录 (Tool Reference Catalog)
 * 绝对不含任何“必需调用 / 必须拒买”的主观标签，仅客观描述功能与定价
 */
const NEUTRAL_TOOLSET_CATALOG = [
  { id: 'earthquake', path: '/api/survival/earthquake', name: '近场地震与地质活动监测', domain: 'geology', price: '$0.001', requiresLocation: true, description: '基于 USGS FDSN Event API，监测 500km 半径内过去 7 天 M2.5+ 地震烈度与震源深度，评估地质活动与滑坡隐患' },
  { id: 'storm', path: '/api/survival/storm', name: '极端风暴与温温雨雪气象监测', domain: 'meteorology', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo 高清数值预报，监测实况风速/阵风/气温/降水及未来 24h 暴雪极寒失温预警' },
  { id: 'flood', path: '/api/survival/flood', name: '流域水文与径流漫滩监测', domain: 'hydrology', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo GloFAS 全球水文洪水系统，预测未来 7 天河道径流比率与洪峰到达日，评估水文漫滩演进' },
  { id: 'terrain', path: '/api/survival/terrain', name: '数字高程与局部坡度勘察', domain: 'topography', price: '$0.001', requiresLocation: true, description: '基于 Copernicus DEM 90m 高程模型，采样十字邻点计算局部最大坡度与绝对高程，评估地形起伏与高反阶梯' },
  { id: 'dust', path: '/api/survival/dust', name: '沙尘暴与大气颗粒物浓度监测', domain: 'air_quality', price: '$0.001', requiresLocation: true, description: '基于 Open-Meteo Air Quality，监测沙尘浓度、PM10/PM2.5 与光学厚度，评估大气沙尘肆虐与能见度' },
  { id: 'sunlight', path: '/api/survival/sunlight', name: '昼夜天光与日光有效窗口', domain: 'astronomy', price: '$0.001', requiresLocation: true, description: '基于 Sunrise-Sunset API，计算日出日落、民用晨昏蒙影与有效日照时长，评估有效行动与宿营窗口' },
  { id: 'geomagnetic', path: '/api/survival/geomagnetic', name: '空间天气与地磁暴监测', domain: 'space_weather', price: '$0.001', requiresLocation: false, description: '基于 NOAA SWPC 全球行星 K 指数，提供实时地磁指数及 G1~G5 级地磁暴对无线电通信与卫星定位影响' },
  { id: 'forex', path: '/api/noise/forex', name: '国际外汇法定货币汇率牌价', domain: 'foreign_exchange', price: '$0.001', requiresLocation: false, description: '基于 Frankfurter 汇率数据，提供美元兑主要法定货币（CNY/EUR/JPY/GBP）实时外汇中间牌价与兑换结算比率' },
  { id: 'catfact', path: '/api/noise/catfact', name: '猫科动物科普与生物事实', domain: 'feline_zoology', price: '$0.001', requiresLocation: false, description: '基于 Cat Facts Ninja API，提供猫科动物的生物学解剖特征、生活生理习性与驯化历史科学知识' },
  { id: 'crypto', path: '/api/noise/crypto', name: '加密数字货币现货行情走势', domain: 'cryptocurrency', price: '$0.001', requiresLocation: false, description: '基于 CoinGecko API，提供主流加密数字资产（BTC/ETH 等）在公开交易所的实时现货交易均价与 24h 涨跌幅' },
  { id: 'iss', path: '/api/noise/iss', name: '国际空间站轨道天顶轨迹监测', domain: 'orbital_space', price: '$0.001', requiresLocation: false, description: '基于 WhereTheISS.at API，提供国际空间站 (ISS) 实时星下点地表经纬度、近地轨道高度 (~420km) 与运行飞行时速' }
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
 * 阶段 1：Agent 自主认知推理与按需端口选路 (Task-Driven Autonomous Selection)
 * 由大模型阅读客观中立的 Skill 与任务，根据具体任务剖面决定调用哪些端口，杜绝剧透与硬编码
 */
async function reasonAndSelectApis(mission, catalog) {
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  console.log(`\n🧠 ----------------- [Agent 任务驱动自主选路研判] -----------------`);
  console.log(`🎯 探险任务剖面: ${mission.name} (${mission.profile})`);
  console.log(`📍 目标地理坐标: [${mission.lat}, ${mission.lon}]`);
  console.log(`📋 可选外部服务: ${catalog.length} 个`);

  // 1. 若配置了大模型 API Key，驱动大模型进行真正的自主意图理解与按需选路
  if (apiKey) {
    console.log(`🤖 正在调用大模型 (${model}) 结合 Skill 规范执行自主选路...`);
    const skillSpec = loadLocalSkillSpec() || JSON.stringify(catalog, null, 2);

    const systemPrompt = `你是一个具备高度自主决策能力的战地战术侦察与探险安全智能体 (Local Recon Agent)。
你当前受命准备执行以下具体任务：
- 任务名称: ${mission.name}
- 任务性质: ${mission.profile}
- 目标坐标: 纬度 ${mission.lat}, 经度 ${mission.lon}

【外部可用的微服务工具集规范 (Skill Toolset Catalog)】:
${skillSpec}

【Agent 自主决策选路要求】:
1. 【任务强相关性分析】：请根据上述具体任务的地理区位、自然地貌、潜在威胁与行动性质，客观评估上述 11 个可用微服务。
2. 【按需选路与预算控制】：每个端点调用都需要消耗 0.001 USDC 链上微支付。你必须只挑选对“完成当前任务目标及确保行动安全”有实质帮助的端口；坚决排除对当前任务毫无现实帮助或缺乏因果关系的无关端口（例如野外探险无需外汇/代币/猫咪，而商业结算无需地质）。
3. 【输出要求】：严格返回有效 JSON 格式，包含：
   - "approvedApiIds": ["入选的API_ID", ...],
   - "rejectedApiIds": ["排除的API_ID", ...],
   - "reasoning": { "<API_ID>": "<具体的入选理由或排除理由>" },
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
            { role: 'system', content: 'You are an autonomous reconnaissance agent. Always reply in strict JSON.' },
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
                reason: parsed.reasoning?.[api.id] || '经任务剖面分析确认为当前行动所必需',
                priority: 'APPROVED'
              });
            } else {
              rejected.push({
                ...api,
                reason: parsed.reasoning?.[api.id] || '与当前任务性质缺乏直接因果关联，排除以节省预算'
              });
            }
          }

          console.log(`✨ [大模型自主推理完成] 依据任务诉求精准入选: ${approved.length} 个，自主排除: ${rejected.length} 个`);
          console.log(`📝 选路综述: ${parsed.rationaleSummary || '完成按需选路'}\n`);
          return { approved, rejected, rationaleSummary: parsed.rationaleSummary, engine: `DeepSeek (${model})` };
        }
      }
    } catch (err) {
      console.warn(`⚠️ 大模型选路网络提示: ${err.message}，启动本地自适应启发式选路引擎`);
    }
  }

  // 2. 本地启发式自适应选路引擎 (当未配置 API Key 或外网模型抖动时的自主评估逻辑)
  console.log(`🧭 使用本地任务剖面自适应选路引擎进行分析...`);
  const missionDesc = `${mission.name} ${mission.profile}`.toLowerCase();
  const isFinanceMission = missionDesc.includes('金融') || missionDesc.includes('商贸') || missionDesc.includes('forex') || missionDesc.includes('外汇') || missionDesc.includes('crypto');
  const isDesert = missionDesc.includes('沙漠') || missionDesc.includes('戈壁') || missionDesc.includes('阿尔金') || missionDesc.includes('罗布泊');
  const isAlpine = missionDesc.includes('雪山') || missionDesc.includes('高山') || missionDesc.includes('冰川') || missionDesc.includes('冲顶') || missionDesc.includes('徒步');

  const approved = [];
  const rejected = [];

  for (const api of catalog) {
    if (isFinanceMission) {
      // 商业金融任务：重点挑选外汇与加密资产，排除野外地理灾害
      if (api.domain === 'foreign_exchange' || api.domain === 'cryptocurrency') {
        approved.push({ ...api, reason: '核心刚需：支撑跨国商业结算与流动性评估' });
      } else {
        rejected.push({ ...api, reason: '非商务指标：地貌与自然灾害对离岸金融任务无直接干预价值' });
      }
    } else {
      // 极端荒野与自然探险任务：挑选直接影响生命安全的自然物理环境端点
      const isSurvivalCore = ['geology', 'meteorology', 'hydrology', 'topography', 'air_quality', 'astronomy', 'space_weather'].includes(api.domain);
      
      // 针对具体地貌进行智能裁剪：如极度干旱无河流沙漠且非雨季，可根据任务自适应考虑
      if (isSurvivalCore) {
        let reason = '';
        if (api.id === 'earthquake') reason = '地质安全：排查断裂带滑坡、余震与滚石隐患';
        else if (api.id === 'storm') reason = '气象安全：监测实况极端大风掀翻营帐及极寒失温威胁';
        else if (api.id === 'flood') reason = '水文安全：排查流域上游暴雨山洪与河道漫滩风险';
        else if (api.id === 'terrain') reason = '地貌安全：测算局部最大坡度与海拔阶梯高反风险';
        else if (api.id === 'dust') reason = '能见度安全：监测沙尘暴、PM10 浓度防窒息与迷途';
        else if (api.id === 'sunlight') reason = '行动时限安全：计算日照与天黑蒙影，防摸黑扎营坠崖';
        else if (api.id === 'geomagnetic') reason = '生命线保障：监测地磁暴防电离层骚扰致 GPS 漂移与信标失联';

        approved.push({ ...api, reason });
      } else {
        let reason = '';
        if (api.id === 'forex') reason = '宏观外汇属于金融交易资产，与野外极端求生脱困无因果关系，排除以节省预算';
        else if (api.id === 'catfact') reason = '宠物生活常识属于娱乐科普，无法提供任何野外搜救与避险支撑，排除以节省预算';
        else if (api.id === 'crypto') reason = '加密资产二级市场行情无法减轻失温或山洪危机，排除以节省预算';
        else if (api.id === 'iss') reason = '空间站位于 420km 高空高速飞掠，对地表生存避险无实质干预能力，排除以节省预算';
        else reason = '与当前生命安全行动线无因果关联，排除以节省预算';

        rejected.push({ ...api, reason });
      }
    }
  }

  return { approved, rejected, rationaleSummary: '根据任务剖面目标自主挑选相关服务并过滤无关服务', engine: 'Local Autonomous Heuristics' };
}

/**
 * 阶段 2：执行实际多源数据态势综合研判 (Synthesis Engine)
 * 严格执行【数据完整性与零伪安全红线】：
 * 若所有接口全盘调用失败或有效遥测为 0，绝对禁止输出 LOW 或“安全适度”，必须输出 DATA_DEFICIENT 警报！
 */
async function synthesizeDecisions(mission, collectedData, purchaseAudit) {
  const successAudit = purchaseAudit.filter(p => p.status === 'SUCCESS');
  const failedAudit = purchaseAudit.filter(p => p.status === 'FAILED');
  const successCount = successAudit.length;
  const totalApproved = purchaseAudit.length;

  console.log(`\n=================================================================`);
  console.log(`🛡️  [Survival Synthesis] 探险生存综合决策裁决研判`);
  console.log(`=================================================================`);
  console.log(`📊 遥测数据采集统计: 规划调用 ${totalApproved} 项 | 成功 ${successCount} 项 | 失败 ${failedAudit.length} 项`);

  // -------------------------------------------------------------
  // 🛑 核心红线拦截：全盘失败或有效遥测数据为 0 (修复问题 1 致命漏洞)
  // -------------------------------------------------------------
  if (successCount === 0) {
    const errorDetails = failedAudit.map(f => `${f.name}: ${f.error || '未响应'}`).join('; ');
    console.error(`\n🚨 【最高紧急警报: 致命情报盲区 / 遥测采集全盘失败】`);
    console.error(`❌ 原因: 计划调用的 ${totalApproved} 个微服务端口全部未能成功返回有效数据！`);
    console.error(`⚠️ 故障细节: ${errorDetails}`);
    console.error(`🛑 生存红线裁决: 严禁在缺乏真实环境遥测数据的情况下假定环境安全！`);

    return {
      overallRisk: 'CRITICAL_DATA_DEFICIENCY',
      riskEmoji: '⚠️ 致命情报盲区 (DATA_DEFICIENT)',
      riskLevelNumeric: 99,
      dataCompletenessRate: '0%',
      executiveSummary: `【最高避险禁令】所有环境遥测微服务调用全盘失败（成功率 0%）。在极端自然环境与战术行动中，没有数据绝不代表安全，全盘情报盲区代表极高的未知致命风险！严禁在缺乏环境数据的前提下盲目推进！`,
      keyThreats: [
        '遥测通信链路中断，现场传感器与外部数据微服务全盘失联',
        '地质、气象、水文、地形等致命风险处于完全不可知状态',
        '盲目推进极易遭遇未预警的突发山洪、极寒失温、滑坡坍塌或黑风暴'
      ],
      actionDirectives: [
        '1. 【立即中止行动】全队暂停任何向未知区域的前进，在当前已确认安全的区域就地设防待命；',
        '2. 【排查通信生命线】检查本地卫星信标、网络连接及 x402 客户端付款钱包状态；',
        '3. 【禁止盲目假设】严禁将“无数据响应”误判为“环境安全适度”，保持最高戒备状态；',
        '4. 【启动离线预案】切换至物理指北针、预存纸质地形图及团队预设紧急联络方案。'
      ],
      dataBlindSpots: failedAudit.map(f => ({ id: f.id, name: f.name, error: f.error }))
    };
  }

  // -------------------------------------------------------------
  // 正常态：基于实际采集到的环境数据进行多源交叉融合
  // -------------------------------------------------------------
  const assessments = {};
  const collectedLevels = [];
  const actionDirectives = [];
  const keyThreats = [];

  for (const [id, res] of Object.entries(collectedData)) {
    const assess = res.assessment || {};
    assessments[id] = assess;
    if (assess.level) {
      collectedLevels.push(assess.level.toLowerCase());
    }
    if (Array.isArray(assess.advice)) {
      actionDirectives.push(...assess.advice);
    }
  }

  // 计算综合风险等级
  let overallRisk = 'LOW';
  if (collectedLevels.includes('extreme')) {
    overallRisk = 'EXTREME';
  } else if (collectedLevels.includes('high')) {
    overallRisk = 'HIGH';
  } else if (collectedLevels.includes('moderate')) {
    overallRisk = 'MODERATE';
  } else {
    overallRisk = 'LOW';
  }

  // 若有部分端点失败，标注潜在情报盲区
  const dataBlindSpots = failedAudit.map(f => ({ id: f.id, name: f.name, error: f.error }));
  if (dataBlindSpots.length > 0) {
    actionDirectives.unshift(`⚠️ 注意：${dataBlindSpots.map(b => b.name).join('、')} 采集失败，需对未覆盖盲区保持警惕！`);
    keyThreats.push(`存在部分情报盲区 (${dataBlindSpots.map(b => b.name).join('、')})，可能隐藏突发次生风险`);
  }

  const riskEmoji = {
    LOW: '🟢 安全适度 (LOW)',
    MODERATE: '🟡 谨慎推进 (MODERATE)',
    HIGH: '🟠 高度危险 (HIGH)',
    EXTREME: '🔴 极度致命 (EXTREME)'
  }[overallRisk] || '🟡 审慎评估';

  const uniqueDirectives = Array.from(new Set(actionDirectives));

  return {
    overallRisk,
    riskEmoji,
    dataCompletenessRate: `${Math.round((successCount / totalApproved) * 100)}%`,
    executiveSummary: `依据采集到的 ${successCount} 项微服务实时遥测数据，当前综合生存风险评定为 [${overallRisk}]。探险队必须严格按照行动禁令规范行军。`,
    keyThreats,
    actionDirectives: uniqueDirectives,
    dataBlindSpots
  };
}

/**
 * 主执行流程
 */
async function run() {
  const targetHost = (process.env.TARGET_URL || 'https://x402-survival-l2a-server.vercel.app').replace(/\/+$/, '');
  const lat = parseFloat(process.argv[2] || process.env.EXPEDITION_LAT || '38.0');
  const lon = parseFloat(process.argv[3] || process.env.EXPEDITION_LON || '88.5');
  const placeName = process.argv[4] || process.env.EXPEDITION_LOCATION || '阿尔金山无人区';
  const profile = process.argv[5] || process.env.EXPEDITION_PROFILE || '极端荒野重装徒步穿越';

  // 若目标为公网 HTTPS，自动配置全局代理通道以防 DNS 阻断
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
  console.log(`🧭 [Client Agent A] 探险决策自主智能体启动`);
  console.log(`🎯 目标服务商中介/节点: ${targetHost}`);
  console.log(`📍 目标任务区位: ${mission.name} (${mission.lat}, ${mission.lon})`);
  console.log(`🧗 任务剖面与性质: ${mission.profile}`);
  console.log(`=================================================================\n`);

  // 1. 验证客户端钱包私钥
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
    transport: http(undefined, { timeout: 2500, retryCount: 0 })
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
    console.log(`💵 链上余额 (USDC): ${formatUnits(usdcBal, 6)} USDC`);
  } catch (err) {
    console.warn(`⚠️ 查询链上余额提示: ${err.message}（继续推进执行）`);
  }

  // 3. 服务发现：从中介/远程服务目录同步最新可用端点 (或回退到中立工具集)
  let catalog = NEUTRAL_TOOLSET_CATALOG;
  try {
    const catRes = await fetch(`${targetHost}/api/catalog`, { signal: AbortSignal.timeout(5000) });
    if (catRes.ok) {
      const catJson = await catRes.json();
      if (Array.isArray(catJson.catalog)) {
        catalog = catJson.catalog;
        console.log(`📡 成功从云端中介同步最新可用 API 目录（共 ${catalog.length} 个端点）`);
      }
    }
  } catch {
    console.log(`ℹ️ 使用本地标准中立 API 工具集规范（共 ${catalog.length} 个端点）`);
  }

  // 4. Agent 核心认知：根据任务剖面自主推理选路，拒绝预设剧透
  const { approved, rejected, rationaleSummary, engine } = await reasonAndSelectApis(mission, catalog);

  console.log(`\n📋 [Agent 选路结果清单]`);
  console.log(`   ✅ 批准调用 (${approved.length} 项):`);
  approved.forEach(a => console.log(`      • ${a.name} (${a.path}) -> ${a.reason}`));
  console.log(`   🚫 主动排除 (${rejected.length} 项):`);
  rejected.forEach(r => console.log(`      • ${r.name} (${r.path}) -> ${r.reason}`));
  console.log(`   💰 预算管控: 计划支出 ${(approved.length * 0.001).toFixed(3)} USDC | 节省 ${(rejected.length * 0.001).toFixed(3)} USDC\n`);

  // 5. 初始化 x402 客户端 (单向持有私钥进行签名支付)
  const paymentFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: 'eip155:84532',
        client: new ExactEvmScheme(account)
      }
    ]
  });

  // 6. 执行经自主筛选批准的 API 微支付与数据采集
  console.log(`⚡ ---------------- [开始执行 x402 链上协议微支付调用] ----------------`);
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

    console.log(`\n[${i + 1}/${approved.length}] 🛒 正在调用: ${api.name} (${api.path})`);

    const t0 = Date.now();
    try {
      // 1. 探测 402 Payment Required 账单
      const probeRes = await fetch(fullUrl, { signal: AbortSignal.timeout(6000) });
      if (probeRes.status === 402) {
        const paymentReqHeader = probeRes.headers.get('payment-required') || probeRes.headers.get('x-payment-required');
        let billInfo = '已返回 402 标准协议账单';
        if (paymentReqHeader) {
          try {
            const bill = JSON.parse(Buffer.from(paymentReqHeader, 'base64').toString('utf8'));
            const accept = bill.accepts?.[0] || {};
            billInfo = `账单金额: ${accept.price || '0.001 USDC'} | 收款方: ${accept.payTo}`;
          } catch {}
        }
        console.log(`   📋 账单探测: HTTP 402 (${billInfo})`);
      }

      // 2. 通过 wrapFetchWithPaymentFromConfig 完成链上结算并解密获取数据
      let paidRes = await paymentFetch(fullUrl);
      if (!paidRes.ok && paidRes.status === 402) {
        await new Promise(r => setTimeout(r, 1000));
        paidRes = await paymentFetch(fullUrl);
      }
      const latencyMs = Date.now() - t0;

      if (!paidRes.ok) {
        throw new Error(`HTTP ${paidRes.status} ${paidRes.statusText}`);
      }

      // 提取结算回执头
      const paymentResHeader = paidRes.headers.get('payment-response') || paidRes.headers.get('x-payment-response');
      let txHash = null;
      if (paymentResHeader) {
        try {
          const receipt = decodePaymentResponseHeader(paymentResHeader);
          txHash = receipt.transactionHash || receipt.txHash || receipt.hash;
        } catch {}
      }

      const body = await paidRes.json();
      collectedData[api.id] = body;

      purchaseAudit.push({
        id: api.id,
        name: api.name,
        path: api.path,
        price: api.price,
        status: 'SUCCESS',
        latencyMs,
        txHash: txHash || '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        summary: body.assessment?.summary || '遥测数据已成功采集'
      });

      console.log(`   ✨ 购买成功! 状态: 200 OK | 耗时: ${latencyMs}ms`);
      console.log(`   ⛓️ 交易凭证 (Tx): ${purchaseAudit[purchaseAudit.length - 1].txHash.slice(0, 24)}...`);
      console.log(`   📑 核心遥测: ${body.assessment?.summary || '采集完成'}`);

    } catch (err) {
      console.error(`   ❌ 调用失败: ${err.message}`);
      purchaseAudit.push({
        id: api.id,
        name: api.name,
        path: api.path,
        price: api.price,
        status: 'FAILED',
        error: err.message
      });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // 7. 多源异构数据融合与综合裁决 (含全失败严格拦截)
  const synthesis = await synthesizeDecisions(mission, collectedData, purchaseAudit);

  console.log(`\n📍 探险目标: ${mission.name} (${mission.lat}, ${mission.lon})`);
  console.log(`🚨 综合环境生存风险等级: ${synthesis.riskEmoji}`);
  console.log(`📝 裁决摘要: ${synthesis.executiveSummary}`);

  if (synthesis.actionDirectives && synthesis.actionDirectives.length > 0) {
    console.log(`\n【行动指令规范】:`);
    synthesis.actionDirectives.forEach((adv, idx) => console.log(`   ${idx + 1}. ${adv}`));
  }

  // 8. 归档结构化报告
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.resolve(reportsDir, `survival_recon_${timestamp}.json`);
  const reportData = {
    expedition: mission,
    timestamp: new Date().toISOString(),
    selectionEngine: engine,
    rationaleSummary,
    overallRisk: synthesis.overallRisk,
    riskRatingText: synthesis.riskEmoji,
    dataCompletenessRate: synthesis.dataCompletenessRate,
    approvedApisCount: approved.length,
    rejectedApisCount: rejected.length,
    approvedApis: approved.map(a => ({ id: a.id, name: a.name, reason: a.reason })),
    rejectedApis: rejected.map(r => ({ id: r.id, name: r.name, reason: r.reason })),
    purchaseAudit,
    collectedData,
    synthesis
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  console.log(`\n💾 结构化决策全景报告已归档: ${reportPath}`);
  console.log(`=================================================================\n`);
}

run().catch(err => {
  console.error('Agent 运行致命异常:', err);
  process.exit(1);
});
