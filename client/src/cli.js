import { spawn, exec } from 'node:child_process';
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

async function isServerAlive(target = 'http://localhost:3000') {
  try {
    const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startLocalServer(openWindow = false) {
  const target = process.env.TARGET_URL || 'http://localhost:3000';
  if (!target.includes('localhost') && !target.includes('127.0.0.1')) {
    return true;
  }

  if (await isServerAlive(target)) {
    console.log(`✅ 本地微服务服务端已在运行中 (监听: ${target})`);
    return true;
  }

  console.log(`📡 正在为任务拉起本地微服务数据集市服务端 (PORT: 3000)...`);
  const serverDir = path.resolve(__dirname, '../../server');
  const serverScript = path.resolve(serverDir, 'server.js');

  if (process.platform === 'win32' && openWindow) {
    exec(`start "x402 Level 2-A Local Server (PORT: 3000)" "${process.execPath}" "${serverScript}"`, { cwd: serverDir });
  } else {
    const p = spawn(process.execPath, [serverScript], {
      detached: true,
      stdio: 'ignore',
      cwd: serverDir
    });
    p.unref();
  }

  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await isServerAlive(target)) {
      console.log(`✅ 本地微服务数据集市已成功就绪 (端点: ${target})！\n`);
      return true;
    }
  }

  console.warn(`⚠️ 本地服务端启动响应稍慢，将尝试继续执行...\n`);
  return false;
}

async function main() {
  const target = process.env.TARGET_URL || 'http://localhost:3000';
  const isCloud = !target.includes('localhost') && !target.includes('127.0.0.1');
  const alive = await isServerAlive(target);
  const statusBadge = isCloud
    ? (alive ? '🌐 云端在线' : '⚠️ 云端未响应')
    : (alive ? '🟢 本地运行中' : '⚪ 本地待启动 (执行时自动就绪)');

  console.log('======================================================================');
  console.log('🤖 x402 Level 2-A: 全球极端环境与野外探险多源数据采购 Agent (Skill Marketplace)');
  console.log(`📡 集市服务状态: ${statusBadge} | 目标端点: ${target}`);
  console.log('======================================================================\n');
  console.log('请选择探险目标、全量购买、审计对账或启动服务端:');
  console.log('  [1] 阿尔金山无人区 (38.0, 88.5) - 高海拔荒漠戈壁徒步穿越 (默认)');
  console.log('  [2] 珠穆朗玛峰大本营 (27.9881, 86.9250) - 极高海拔极寒雪山攀登');
  console.log('  [3] 塔克拉玛干沙漠腹地 (39.0, 83.5) - 极端沙尘高温流动沙丘穿越');
  console.log('  [4] 罗布泊大海道 (41.5, 90.3) - 强风蚀雅丹地貌与极度干旱穿越');
  console.log('  [5] 香港中环商业区 (22.3, 114.1) - 跨国离岸商贸与多币种外汇清算');
  console.log('  [6] 自定义输入 (100% 自由设定地名、经度、纬度与任务剖面)');
  console.log('  [7] 直接全量采购模式 (不经大模型筛选，直接购买全部 11 项微服务)');
  console.log('  [8] 运行链上对账与审计 (自动核对最新链上交易状态与钱包余额)');
  console.log('  [9] 重新生成 Word (.docx) 报告 (从最新 JSON 重新排版导出 Word)');
  console.log('  [0] 独立启动本地微服务服务端 (在独立窗口中监听 3000 端口并实时显示网络日志)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let choice = await askQuestion(rl, '请输入选项编号 [直接回车默认 1]: ');
  if (!choice) choice = '1';

  try {
    switch (choice) {
      case '0': {
        rl.close();
        console.log('\n[正在启动本地微服务服务端...]');
        await startLocalServer(true);
        break;
      }
      case '1':
        rl.close();
        await startLocalServer(false);
        await runSubprocess('agent.js', ['38.0', '88.5', '阿尔金山无人区', '高海拔荒漠重装徒步穿越', 'auto']);
        break;
      case '2':
        rl.close();
        await startLocalServer(false);
        await runSubprocess('agent.js', ['27.9881', '86.9250', '珠穆朗玛峰大本营', '极高海拔极寒雪山冲顶', 'auto']);
        break;
      case '3':
        rl.close();
        await startLocalServer(false);
        await runSubprocess('agent.js', ['39.0', '83.5', '塔克拉玛干沙漠腹地', '极端沙尘高温流动沙丘穿越', 'auto']);
        break;
      case '4':
        rl.close();
        await startLocalServer(false);
        await runSubprocess('agent.js', ['41.5', '90.3', '罗布泊大海道', '强风蚀雅丹地貌与极度干旱穿越', 'auto']);
        break;
      case '5':
        rl.close();
        await startLocalServer(false);
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

        let customApis = await askQuestion(rl, '请输入指定采购的 API 列表 (逗号分隔，如 earthquake,storm,terrain；直接回车则由 SKILL 规范自动匹配): ');

        rl.close();
        console.log(`\n📍 已设定任务参数 -> 目标地: <${customName}> | 经度: <${customLon}> | 纬度: <${customLat}> | 任务性质: <${customProfile}>`);
        if (customApis) {
          console.log(`🎯 指定采购端点: ${customApis}\n`);
          await startLocalServer(false);
          await runSubprocess('agent.js', [customLat, customLon, customName, customProfile, 'custom', customApis]);
        } else {
          console.log(`📜 由 SKILL.md 技能规范根据任务剖面按需匹配\n`);
          await startLocalServer(false);
          await runSubprocess('agent.js', [customLat, customLon, customName, customProfile, 'auto']);
        }
        break;
      }
      case '7':
        rl.close();
        console.log('\n[全量直接采购模式: 购买全部 11 项微服务]');
        await startLocalServer(false);
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
        await startLocalServer(false);
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
