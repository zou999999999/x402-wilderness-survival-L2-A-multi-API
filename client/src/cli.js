import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function runSubprocess(scriptName, args = [], cwd = path.resolve(__dirname, '..')) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, scriptName);
    const proc = spawn(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      cwd
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Subprocess exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function ensureServerRunning() {
  const target = process.env.TARGET_URL || 'http://localhost:3000';
  if (!target.includes('localhost') && !target.includes('127.0.0.1')) {
    return;
  }
  try {
    const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) return;
  } catch {}

  console.log('📡 检测到本地微服务数据集市 (PORT: 3000) 尚未运行，正在自动拉起...');
  const serverPath = path.resolve(__dirname, '../../server/server.js');
  const serverProc = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore',
    cwd: path.resolve(__dirname, '../../server')
  });
  serverProc.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        console.log('✅ 本地微服务数据集市已在后台成功启动 (http://localhost:3000)！\n');
        return;
      }
    } catch {}
  }
  console.warn('⚠️ 自动启动本地服务端超时，将尝试继续执行...\n');
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('======================================================================');
  console.log('🤖 x402 Level 2-A: 全球极端环境与野外探险多源数据采购 Agent');
  console.log('核心模式: 任务驱动自主选路 / 全量直接采购 + x402 真实微支付 + 原始遥测交付');
  console.log('======================================================================\n');
  console.log('请选择探险目标、全量购买、审计对账或服务端控制:');
  console.log('  [1] 阿尔金山无人区 (38.0, 88.5) - 高海拔荒漠戈壁徒步穿越 (默认)');
  console.log('  [2] 珠穆朗玛峰大本营 (27.9881, 86.9250) - 极高海拔极寒雪山攀登');
  console.log('  [3] 塔克拉玛干沙漠腹地 (39.0, 83.5) - 极端沙尘高温流动沙丘穿越');
  console.log('  [4] 罗布泊大海道 (41.5, 90.3) - 强风蚀雅丹地貌与极度干旱穿越');
  console.log('  [5] 香港中环商业区 (22.3, 114.1) - 跨国离岸商贸与多币种外汇清算');
  console.log('  [6] 自定义输入 (100% 自由设定地名、经度、纬度与任务剖面)');
  console.log('  [7] 直接全量采购模式 (不经大模型筛选，直接购买全部 11 项微服务)');
  console.log('  [8] 运行链上对账与审计 (自动核对最新链上交易状态与钱包余额)');
  console.log('  [9] 重新生成 Word (.docx) 报告 (从最新 JSON 重新排版导出 Word)');
  console.log('  [0] 查看/启动本地服务端 (健康状态检查与服务拉起)\n');

  let choice = await askQuestion(rl, '请输入选项编号 [直接回车默认 1]: ');
  if (!choice) choice = '1';

  try {
    switch (choice) {
      case '0': {
        rl.close();
        console.log('\n[正在检查本地微服务数据集市状态...]');
        const target = process.env.TARGET_URL || 'http://localhost:3000';
        try {
          const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(1500) });
          if (res.ok) {
            const data = await res.json();
            console.log(`✅ 本地服务端正健康运行中！`);
            console.log(`   端点: ${target} | 挂载微服务: ${data.totalEndpoints} 项 | 收款方: ${data.payTo}`);
            break;
          }
        } catch {}
        await ensureServerRunning();
        break;
      }
      case '1':
        rl.close();
        await ensureServerRunning();
        await runSubprocess('agent.js', ['38.0', '88.5', '阿尔金山无人区', '高海拔荒漠重装徒步穿越', 'auto']);
        break;
      case '2':
        rl.close();
        await ensureServerRunning();
        await runSubprocess('agent.js', ['27.9881', '86.9250', '珠穆朗玛峰大本营', '极高海拔极寒雪山冲顶', 'auto']);
        break;
      case '3':
        rl.close();
        await ensureServerRunning();
        await runSubprocess('agent.js', ['39.0', '83.5', '塔克拉玛干沙漠腹地', '极端沙尘高温流动沙丘穿越', 'auto']);
        break;
      case '4':
        rl.close();
        await ensureServerRunning();
        await runSubprocess('agent.js', ['41.5', '90.3', '罗布泊大海道', '强风蚀雅丹地貌与极度干旱穿越', 'auto']);
        break;
      case '5':
        rl.close();
        await ensureServerRunning();
        await runSubprocess('agent.js', ['22.3', '114.1', '香港中环商业区', '跨国离岸商贸与多币种外汇清算', 'auto']);
        break;
      case '6': {
        console.log('\n[自定义目标地理点设置]');
        let customName = await askQuestion(rl, '请输入探险目标地名 (例如: 库布齐沙漠): ');
        if (!customName) customName = '自定义探险区';

        let customLon = await askQuestion(rl, '请输入经度 Longitude (例如: 108.5): ');
        if (!customLon) customLon = '108.5';

        let customLat = await askQuestion(rl, '请输入纬度 Latitude (例如: 40.2): ');
        if (!customLat) customLat = '40.2';

        let customProfile = await askQuestion(rl, '请输入探险性质 (例如: 沙漠越野重装穿越): ');
        if (!customProfile) customProfile = '综合野外重装探险';

        rl.close();
        console.log(`\n📍 已设定任务参数 -> 目标地: <${customName}> | 经度: <${customLon}> | 纬度: <${customLat}> | 任务性质: <${customProfile}>\n`);
        await ensureServerRunning();
        await runSubprocess('agent.js', [customLat, customLon, customName, customProfile, 'auto']);
        break;
      }
      case '7':
        rl.close();
        console.log('\n[全量直接采购模式: 购买全部 11 项微服务]');
        await ensureServerRunning();
        await runSubprocess('agent.js', ['38.0', '88.5', '全域数据采购', '全量外部微服务综合数据采购', 'all']);
        break;
      case '8':
        rl.close();
        console.log('\n[正在执行链上对账核验...]');
        await runSubprocess('reconcile.js');
        break;
      case '9':
        rl.close();
        console.log('\n[正在重新导出 Word 报告...]');
        await runSubprocess('export_word.js');
        break;
      default:
        rl.close();
        console.log('\n输入未识别，使用默认配置执行 [1]...');
        await ensureServerRunning();
        await runSubprocess('agent.js', ['38.0', '88.5', '阿尔金山无人区', '高海拔荒漠重装徒步穿越', 'auto']);
        break;
    }
  } catch (err) {
    console.error('\n❌ 任务执行异常:', err.message);
  } finally {
    try { rl.close(); } catch {}
  }
}

main();
