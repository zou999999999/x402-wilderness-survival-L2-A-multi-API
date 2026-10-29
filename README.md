# x402 Level 2-A: 全球极端环境与野外探险多源数据服务 (拓展微支付市场)

本项目为 **x402 协议拓展项目（Level 2-A）**。作为 Level 1 单一数据服务的架构拓展，基于 x402 开放微支付经济协议构建了一个**由任务驱动的本地自主采购智能体 (Client Agent)** 与 **云端微服务市场 (Server)**。

核心架构定位：
- **纯粹的微服务采购与数据交付**：在 Level 1 单接口（天气）的基础上拓展为多接口微服务集市。Agent / 用户通过 x402 协议进行微支付采购，并将购买到的多源遥测数据完整、清晰、客观地呈现给用户；
- **真正的端到端物理解耦**：本地仅保留中立的技能规范文档（Skill）与轻量 Agent，商户微服务独立部署于云端；
- **100% 用户自主选择与任务驱动**：支持终端与交互菜单自定义任意探险区位（目标地、经纬度、任务性质），支持 Agent 认知选路或直接全量采购模式；
- **零造假绝对真实链上结算**：每笔购买均生成真实的 EIP-3009 授权签名并通过 Facilitator 上链结算，严禁任何伪造哈希；
- **多格式交付（Word .docx + JSON）**：每次采购自动生成图文并茂、排版规范的专业战地 Word 报告（`.docx`）与机器审计 JSON 数据。

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
│       └── providers/               # 11 个真实外部数据微服务（地质/气象/水文/地形/沙尘/日照/空间天气/外汇/加密/科普/空间站）
│
├── client/                          # [客户端 / 本地自主决策 Agent 消费端]
│   ├── package.json                 # 客户端独立依赖 (@x402/fetch, @x402/evm, viem, docx 等)
│   ├── .env.example                 # 客户端独立管理付款私钥 PAYER_PRIVATE_KEY
│   ├── reports/                     # 自动归档 Word (.docx) 交付公文与 JSON 链上审计数据
│   └── src/
│       ├── config/wallet.js         # 付款钱包安全加载器
│       ├── lib/docx_exporter.js     # 专业战地 Word (.docx) 自动化排版导出引擎
│       ├── agent.js                 # 核心：自主选路 / 全量采购 + x402 协议微支付 + 数据交付打包
│       ├── export_word.js           # 独立 Word 报告导出工具
│       └── reconcile.js             # 链上 USDC 交易哈希与余额自动化审计工具
│
├── .agents/skills/                  # Level 2 官方客观中立微服务规范 (SKILL.md)
├── 运行探险决策Agent.bat            # Windows 唯一一体化全能控制台 (全自动拉起服务端/采购/选路/对账/导出Word)
├── 运行探险决策Agent.sh             # macOS / Linux 唯一一体化全能控制台 (全自动拉起服务端/全功能交互)
└── 项目交接与全流程上下文总结.md    # 核心交接档案
```

---

## 二、 11 个外部微服务能力清单 (API Toolset Catalog)

所有端点均经过真实公网探测与 x402 协议接入（单次统一定价 0.001 USDC on Base Sepolia）：

| 序号 | 接口 ID | 路由路径 | 数据源 | 坐标需求 | 定价 | 业务能力与监测指标 |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| 1 | **earthquake** | `/api/survival/earthquake` | USGS FDSN Event API | 需 lat, lon | $0.001 | 500km 半径近 7 天 M2.5+ 地震烈度与震源距，评估地质活动与滑坡隐患。 |
| 2 | **storm** | `/api/survival/storm` | Open-Meteo Forecast | 需 lat, lon | $0.001 | 监测实况/24h风速、极大阵风、雨雪累计与最低温，预警极寒失温。 |
| 3 | **flood** | `/api/survival/flood` | Open-Meteo GloFAS | 需 lat, lon | $0.001 | 全球水文河道流量 vs 历史中位数比率与洪峰日，防山洪与河漫滩漫淹。 |
| 4 | **terrain** | `/api/survival/terrain` | Copernicus DEM 90m | 需 lat, lon | $0.001 | 十字邻点高差估算局部最大坡度与海拔，预警高反与滑坠。 |
| 5 | **dust** | `/api/survival/dust` | Open-Meteo Air Quality | 需 lat, lon | $0.001 | 沙尘浓度、PM10/PM2.5、气溶胶厚度，防黑风暴肆虐与能见度骤降。 |
| 6 | **sunlight** | `/api/survival/sunlight` | Sunrise-Sunset.org | 需 lat, lon | $0.001 | 日出日落时刻与民用黄昏终点，锁定天黑前90分钟强制停步扎营红线。 |
| 7 | **geomagnetic**| `/api/survival/geomagnetic`| NOAA SWPC K-index | 全局数据 | $0.001 | 实时行星 K 指数 (0~9) 与地磁暴，排查 GPS 漂移与通信信标失锁。 |
| 8 | **forex** | `/api/market/forex` | Frankfurter API | 全局数据 | $0.001 | USD 兑主要法定货币（CNY/EUR/JPY/GBP）实时外汇中间牌价与兑换结算比率。 |
| 9 | **catfact** | `/api/info/catfact` | Cat Facts Ninja | 全局数据 | $0.001 | 猫科动物生物学特征、生理习性与驯化历史科学知识。 |
| 10 | **crypto** | `/api/market/crypto` | CoinGecko API | 全局数据 | $0.001 | BTC/ETH 等数字资产二级市场现货交易行情与 24h 涨跌幅。 |
| 11 | **iss** | `/api/orbit/iss` | WhereTheISS.at | 全局数据 | $0.001 | 国际空间站 (ISS) 实时星下点地表经纬度与近地轨道飞行时速。 |

---

## 三、 快速启动与跨平台操作指引

### 1. 运行一体化控制台 (跨平台双脚本支持)
- **Windows 用户**：双击工程根目录下的 **`运行探险决策Agent.bat`**；
- **macOS / Linux 用户**：在终端执行 **`./运行探险决策Agent.sh`** 或 `bash 运行探险决策Agent.sh`。

脚本均提供 100% 相同的一体化交互菜单：
- `[1]` 阿尔金山无人区 (38.0, 88.5)
- `[2]` 珠穆朗玛峰大本营 (27.9881, 86.9250)
- `[3]` 塔克拉玛干沙漠腹地 (39.0, 83.5)
- `[4]` 罗布泊大海道 (41.5, 90.3)
- `[5]` 香港中环商业区 (22.3, 114.1)
- `[6]` 自定义输入 (100% 自由输入地名、经度、纬度、任务剖面)
- `[7]` 直接全量采购模式 (直接购买全部 11 项微服务)
- `[8]` 运行链上对账与审计 (自动核对最新链上交易状态与钱包余额)
- `[9]` 重新生成 Word (.docx) 报告 (从最新 JSON 重新排版导出 Word)
- `[0]` 查看/启动本地服务端 (健康状态检查与服务拉起)

或在终端中直接运行：
```bash
cd client
# 格式: node src/agent.js <纬度> <经度> <地名> <任务描述> [模式: auto|all]
node src/agent.js 38.0 88.5 "阿尔金山无人区" "极端荒野重装徒步穿越" auto
```

### 2. 成果交付物
每次运行后，系统将自动在 `client/reports/` 目录下生成两份核心资产：
1. **`.docx` 交付报告**：标准 Word 公文，包含任务元数据表、微支付交易流水表、以及购买到的遥测数据全景矩阵，可直接用 Office / WPS 打开阅读。
2. **`.json` 审计数据**：包含付款方、真实 Tx Hash、原始 HTTP 响应报文与时间戳。

### 3. 执行链上对账核验
在控制台中选择 `[8]` 或在终端执行：
```bash
cd client
node src/reconcile.js
```
脚本将自动读取最新交付报告，向 Base Sepolia 逐笔发起链上核查，输出真实的交易状态、区块高度、Gas 代付详情与双方 USDC 余额。

---

## 四、 🌐 Agent Skill Marketplace 开放技能集市规范

本项目采用生产级 **Agent Skill Marketplace** 开放协议架构，实现“云端轻量集市 + 本地极简买手”的 To-C 终极体验：

### 1. 服务端暴露核心端点 (Server Marketplace)
- 🚀 **健康检查**：`GET /health`
- 📋 **机器易读结构化目录**：`GET /api/catalog`
- 📖 **面向 Agent 的公开技能规范**：`GET /api/skill`（或 `/skill`、`/SKILL.md`）
  - 输出 100% 客观中立、无剧透、无诱导的 Markdown 标准技能规范；
  - 供全世界任何 AI Agent 直接跨网络读取并理解货架上的所有 11 个微服务能力。
- ⚡ **11 个 x402 微支付数据端点**：单次统一定价 0.001 USDC on Base Sepolia。

### 2. 用户端轻量化运行 (Lightweight Client Agent)
- 用户电脑仅需保留轻量客户端与钱包私钥，**无需常驻繁重服务端**；
- 客户端 Agent 启动后，**跨网络动态拉取云端集市的最新技能规范 (`/api/skill`)**；
- 本地大模型阅读云端规范后，结合用户给定的任务目标自主选路；
- 调用本地私钥完成真实 EIP-3009 授权签名并结算，最终在本地自动产出 Word 战地公文与对账底稿！
