import 'dotenv/config';
import app from './api/index.js';
import { getPayToAddress } from './src/config/payee.js';
import { API_CATALOG } from './src/config/catalog.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`=================================================================`);
  console.log(`🧭 [Server] 全球极端环境与野外探险生存决策系统 (Level 2) 已启动`);
  console.log(`📡 运行端口: http://localhost:${PORT}`);
  console.log(`💚 健康检查: http://localhost:${PORT}/health`);
  console.log(`📋 服务目录: http://localhost:${PORT}/api/catalog`);
  console.log(`💰 收款地址: ${getPayToAddress()}`);
  console.log(`🧩 总挂载接口: ${API_CATALOG.length} 个（核心生存 7 个 + 噪音干扰 4 个）`);
  console.log(`=================================================================`);
});

export default server;
