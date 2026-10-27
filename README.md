# x402 Level 2: 全球极端环境与野外探险生存决策系统

本项目为 **x402 协议拓展项目（Level 2）**，将单接口天气服务拓展为由 **11 个异构 API 组成的高阶野外生存智能决策系统**。
系统实现了 **端到端物理架构解耦**、**认知推理与噪音智能过滤**、**x402 协议自动化链上微支付（0.001 USDC/次）** 以及 **多源灾害数据决策裁决**。

---

## 一、 系统架构与物理解耦设计

严格遵循 `AGENTS.md` 铁律与生产级安全标准：

```
Level 2/
├── server/                          # [服务端 / 数据提供者]
│   ├── api/index.js                 # Vercel Serverless 与 Express 路由入口 (挂载 x402 中间件)
│   ├── server.js                    # 本地调试 Express 监听入口
│   ├── package.json                 # 服务端独立依赖 (@x402/core, @x402/evm, express 等)
│   ├── vercel.json                  # 云端 Serverless 路由重写规则
│   ├── .env.example                 # 仅包含公开 PAY_TO 与端口，绝对无私钥！
│   └── src/
│       ├── config/                  # 链网络配置 (network.js)、收款地址 (payee.js)、目录 (catalog.js)
│       ├── lib/                     # 上游 HTTP 容错、球面测距 (haversine) 与地理编码
│       └── providers/               # 11 个真实上游数据源驱动（7 生存核心 + 4 噪音干扰）
│
├── client/                          # [客户端 / 生存决策 Agent 消费端]
│   ├── package.json                 # 客户端独立依赖 (@x402/fetch, @x402/evm, viem 等)
│   ├── .env.example                 # 客户端独立管理付款私钥 PAYER_PRIVATE_KEY
│   ├── reports/                     # 每次探险任务的结构化裁决与链上审计报告 (JSON)
│   └── src/
│       ├── config/wallet.js         # 付款钱包安全加载器
│       ├── agent.js                 # 核心：认知推理 + 噪音过滤 + x402 购买 + 生存决策裁决
│       └── reconcile.js             # 链上 USDC 交易哈希与余额自动化审计工具
│
├── .agents/skills/                  # Level 2 官方技能描述文件 (SKILL.md)
├── 启动服务端.bat                   # Windows 一键启动服务端
├── 运行探险决策Agent.bat            # Windows 一键执行探险决策 Agent
├── 运行链上对账.bat                 # Windows 一键运行链上审计对账
└── 项目交接与全流程上下文总结.md    # 核心交接档案
```

---

## 二、 11 个 API 目录全景定义

所有接口均已进行真实公网可用性探测验证（100% 连通率，HTTP 200 OK）：

### 1. 核心生存决策 API（7 个，经 Agent 推理入选购买）
1. **近场地震监测** (`GET /api/survival/earthquake`): USGS FDSN Event API，排查 500km 半径内过去 7 天 M2.5+ 地震与余震滑坡。
2. **极端风暴失温** (`GET /api/survival/storm`): Open-Meteo 高清数值预报，监测极大阵风、雨雪累计与极寒失温。
3. **流域洪涝水文** (`GET /api/survival/flood`): Open-Meteo GloFAS 全球水文洪水系统，计算河道流量中位数比率防山洪。
4. **地形高程坡度** (`GET /api/survival/terrain`): Copernicus DEM 90m 高程模型，十字邻点测算最大坡度与海拔防高反。
5. **沙尘与颗粒物** (`GET /api/survival/dust`): Open-Meteo Air Quality API，监测沙尘浓度、PM10/PM2.5 与光学厚度。
6. **日光生存窗口** (`GET /api/survival/sunlight`): Sunrise-Sunset.org API，民用天黑时刻倒计时，强制日落前90分钟扎营。
7. **地磁暴与生命线** (`GET /api/survival/geomagnetic`): NOAA SWPC 行星 K 指数，预警地磁暴对 GPS 漂移与卫星通信影响。

### 2. 干扰噪音 API（4 个，经 Agent 认知推理识别并主动拦截）
1. **国际法币汇率** (`GET /api/noise/forex`): 宏观外汇行情，荒野求生零价值 ➔ 🚫 **拦截拒买**。
2. **趣味猫咪科普** (`GET /api/noise/catfact`): 宠物趣味冷知识，野外避险零相关 ➔ 🚫 **拦截拒买**。
3. **加密资产价格** (`GET /api/noise/crypto`): BTC/ETH 币价，无法指导地质气象防御 ➔ 🚫 **拦截拒买**。
4. **国际空间站轨道** (`GET /api/noise/iss`): ISS 轨道高度 420km，地表探险零干预能力 ➔ 🚫 **拦截拒买**。

---

## 三、 快速启动与本地全链路测试

### 1. 启动服务端
双击运行 `启动服务端.bat` 或在终端执行：
```bash
cd server
npm start
```
服务将在 `http://localhost:3000` 启动，暴露以下核心端点：
- 💚 **服务健康检查**：`http://localhost:3000/health`
- 📋 **全量 11 API 服务目录与定价**：`http://localhost:3000/api/catalog`
- ⚡ **7 大核心野外生存微服务**：`http://localhost:3000/api/survival/[earthquake|storm|flood|terrain|dust|sunlight|geomagnetic]`（每次 $0.001）
- 🚫 **4 大干扰噪音微服务**：`http://localhost:3000/api/noise/[forex|catfact|crypto|iss]`（每次 $0.001）

### 2. 运行生存决策 Agent
双击运行 `运行探险决策Agent.bat` 或执行：
```bash
cd client
node src/agent.js 38.0 88.5 "阿尔金山无人区"
```
Agent 将输出：
- 🧠 认知推理与噪音过滤决策日志（采纳 7 个核心，拦截 4 个噪音，节约 0.004 USDC 预算）
- ⚡ 依次发起 x402 探测 ➔ 获取 402 账单 ➔ 签名支付 ➔ 链上结算 ➔ 获取数据
- 🛡️ 生成多源灾害融合的生存风险等级（LOW / MODERATE / HIGH / EXTREME）与行动禁忌指令
- 💾 将报告落盘至 `client/reports/survival_recon_<timestamp>.json`

### 3. 执行链上对账核验
双击运行 `运行链上对账.bat` 或执行：
```bash
cd client
node src/reconcile.js
```
自动比对链上 USDC 余额变动、交易状态与 Facilitator 清算凭据。

---

## 四、 🌐 官方在线云端服务 (Vercel Live Endpoints)

本项目服务端已正式部署上线至 Vercel，全球任意客户端无需在本地运行任何服务端代码，即可直接跨网调用：

- 🚀 **官方生产基准地址**：`https://x402-survival-l2a-server.vercel.app`
- 💚 **在线健康检查**：[`https://x402-survival-l2a-server.vercel.app/health`](https://x402-survival-l2a-server.vercel.app/health)
- 📋 **全量 API 在线目录与定价**：[`https://x402-survival-l2a-server.vercel.app/api/catalog`](https://x402-survival-l2a-server.vercel.app/api/catalog)
- ⚡ **7 大核心生存微服务入口**：`https://x402-survival-l2a-server.vercel.app/api/survival/...`
- 🚫 **4 大干扰噪音微服务入口**：`https://x402-survival-l2a-server.vercel.app/api/noise/...`

> **直接使用方式**：使用者只需在客户端 `client/.env` 中配置：
> ```ini
> TARGET_URL=https://x402-survival-l2a-server.vercel.app
> ```
> 双击 `运行探险决策Agent.bat` 即可直接向云端发起链上微支付调用！
