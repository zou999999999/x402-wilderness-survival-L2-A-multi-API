# x402 Level 2-A: 全球极端环境与野外探险决策系统 (任务驱动自主选路 Agent)

本项目为 **x402 协议拓展项目（Level 2-A）**，基于 x402 开放微支付经济协议构建了一个**由任务驱动的本地自主侦察决策智能体 (Client Agent)** 与 **云端微服务市场 (Server)**。

系统实现了：
- **真正的端到端物理解耦**：本地仅保留中立的技能规范文档（Skill）与轻量 Agent，商户微服务独立部署于云端；
- **任务驱动的大模型自主选路 (On-Demand Selection)**：绝不预设“必需调用”或“必须拒买”，Agent 根据具体任务目标（如雪山攀登、戈壁沙漠穿越、或离岸商贸清算）自主决定挑选哪些端口；
- **预算控制与微支付经济性**：自动剔除与当前任务无关的端点，节省 x402 链上微支付预算（0.001 USDC/次）；
- **数据完整性与零伪安全红线 (Zero False-Safety Defense)**：若接口全盘失败或关键数据缺失，绝不误报“安全 (LOW)”，强制触发 `DATA_DEFICIENT` 致命情报盲区避险警报；
- **x402 协议自动化链上微支付与对账审计**：在 Base Sepolia 测试网闭环验证。

---

## 一、 系统架构与物理解耦设计

严格遵循 `AGENTS.md` 铁律与生产级安全标准：

```
Level 2-A/
├── server/                          # [服务端 / 商户微服务提供者]
│   ├── api/index.js                 # Vercel Serverless 与 Express 路由入口 (挂载 x402 中间件)
│   ├── server.js                    # 本地调试 Express 监听入口 (PORT: 3000)
│   ├── package.json                 # 服务端独立依赖 (@x402/core, @x402/evm, express 等)
│   ├── vercel.json                  # 云端 Serverless 路由重写规则
│   ├── .env.example                 # 仅包含公开 PAY_TO 与端口，绝对无私钥！
│   └── src/
│       ├── config/                  # 链网络配置 (network.js)、收款地址 (payee.js)、目录 (catalog.js)
│       ├── lib/                     # 上游 HTTP 容错、球面测距 (haversine) 与地理编码
│       └── providers/               # 11 个真实上游数据源驱动（地质/气象/水文/地形/沙尘/日照/空间天气等）
│
├── client/                          # [客户端 / 本地自主决策 Agent 消费端]
│   ├── package.json                 # 客户端独立依赖 (@x402/fetch, @x402/evm, viem 等)
│   ├── .env.example                 # 客户端独立管理付款私钥 PAYER_PRIVATE_KEY
│   ├── reports/                     # 每次任务的结构化裁决与链上审计报告 (JSON)
│   └── src/
│       ├── config/wallet.js         # 付款钱包安全加载器
│       ├── agent.js                 # 核心：大模型自主选路 + 任务驱动 + x402 微支付 + 零伪安全裁决
│       └── reconcile.js             # 链上 USDC 交易哈希与余额自动化审计工具
│
├── .agents/skills/                  # Level 2 官方客观中立技能描述文件 (SKILL.md)
├── 启动服务端.bat                   # Windows 一键启动服务端 (可选，云端已上线)
├── 运行探险决策Agent.bat            # Windows 一键执行本地 Agent
├── 运行链上对账.bat                 # Windows 一键运行链上审计对账
└── 项目交接与全流程上下文总结.md    # 核心交接档案
```

---

## 二、 11 个外部微服务能力清单 (API Toolset Catalog)

所有接口均已进行真实公网可用性探测验证（100% 连通率，HTTP 200 OK，单次统一定价 0.001 USDC on Base Sepolia）：

1. **近场地震监测** (`GET /api/survival/earthquake`): USGS FDSN Event API，排查 500km 半径内过去 7 天 M2.5+ 地震与余震滑坡。
2. **极端风暴气象** (`GET /api/survival/storm`): Open-Meteo 高清数值预报，监测极大阵风、雨雪累计与极寒失温。
3. **流域水文漫滩** (`GET /api/survival/flood`): Open-Meteo GloFAS 全球水文洪水系统，计算河道流量中位数比率防山洪。
4. **地形高程坡度** (`GET /api/survival/terrain`): Copernicus DEM 90m 高程模型，十字邻点测算最大坡度与海拔防高反。
5. **沙尘与颗粒物** (`GET /api/survival/dust`): Open-Meteo Air Quality API，监测沙尘浓度、PM10/PM2.5 与光学厚度。
6. **日光有效窗口** (`GET /api/survival/sunlight`): Sunrise-Sunset.org API，民用天黑时刻倒计时，强制日落前90分钟扎营。
7. **空间天气地磁** (`GET /api/survival/geomagnetic`): NOAA SWPC 行星 K 指数，预警地磁暴对 GPS 漂移与卫星通信影响。
8. **国际外汇牌价** (`GET /api/noise/forex`): Frankfurter API，提供 USD 兑主要法定货币（CNY/EUR/JPY/GBP）实时外汇中间价。
9. **动物科普事实** (`GET /api/noise/catfact`): Cat Facts Ninja API，提供猫科动物生物学解剖特征、生活习性与驯化历史。
10. **加密数字资产** (`GET /api/noise/crypto`): CoinGecko API，提供 BTC/ETH 等主流加密资产在公开二级市场的实时价格。
11. **空间站天顶轨迹** (`GET /api/noise/iss`): WhereTheISS.at API，提供国际空间站实时星下点地表经纬度与近地轨道时速。

---

## 三、 快速启动与测试

### 1. 运行本地自主 Agent（默认直连 Vercel 云端服务）
无需在本地开启服务端，直接在终端执行：
```bash
cd client
node src/agent.js
```
或传入自定义任务参数：
```bash
# 示例 1: 极端雪山高海拔攀登
node src/agent.js 29.5 101.8 "贡嘎山主峰" "高海拔冰雪冲顶与冰裂缝排查"

# 示例 2: 城市商业与离岸结算
node src/agent.js 22.3 114.1 "香港中环商业区" "跨国离岸商贸与多币种外汇清算"
```

Agent 将执行完整的自主决策流：
1. **任务驱动自主选路**：根据任务剖面，自主判断挑选哪些端点，排除无关端点；
2. **预算统计与微支付**：仅对入选端点发起 x402 探测与 Base Sepolia 链上结算（0.001 USDC/次）；
3. **数据完整性校验**：若调用全盘失败，触发 `DATA_DEFICIENT` 警报；若成功，融合遥测数据生成战地行动禁令；
4. **自动归档**：将结构化审计全景数据落盘至 `client/reports/survival_recon_<timestamp>.json`。

### 2. 执行链上对账核验
```bash
cd client
node src/reconcile.js
```
自动比对链上 USDC 余额变动、交易状态与 Facilitator 清算凭据。

---

## 四、 🌐 官方在线云端服务 (Vercel Live Endpoints)

本项目商户微服务已正式部署上线至 Vercel，全球客户端可直接跨网调用：

- 🚀 **官方生产基准地址**：`https://x402-survival-l2a-server.vercel.app`
- 💚 **在线健康检查**：[`https://x402-survival-l2a-server.vercel.app/health`](https://x402-survival-l2a-server.vercel.app/health)
- 📋 **全量 API 在线目录与定价**：[`https://x402-survival-l2a-server.vercel.app/api/catalog`](https://x402-survival-l2a-server.vercel.app/api/catalog)
