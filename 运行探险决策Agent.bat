@echo off
chcp 65001 >nul
title Level 2-A 多源数据服务采购与交付 Agent

echo ======================================================================
echo 🤖 x402 Level 2-A: 全球极端环境与野外探险多源数据采购 Agent
echo 核心模式: 任务驱动自主选路 / 全量直接采购 + x402 真实微支付 + 原始遥测交付
echo ======================================================================
echo.
echo 请选择探险目标、全量购买或审计对账:
echo   [1] 阿尔金山无人区 (38.0, 88.5) - 高海拔荒漠戈壁徒步穿越 (默认)
echo   [2] 珠穆朗玛峰大本营 (27.9881, 86.9250) - 极高海拔极寒雪山攀登
echo   [3] 塔克拉玛干沙漠腹地 (39.0, 83.5) - 极端沙尘高温流动沙丘穿越
echo   [4] 罗布泊大海道 (41.5, 90.3) - 强风蚀雅丹地貌与极度干旱穿越
echo   [5] 香港中环商业区 (22.3, 114.1) - 跨国离岸商贸与多币种外汇清算
echo   [6] 自定义输入 (100%% 自由设定地名、经度、纬度与任务剖面)
echo   [7] 直接全量采购模式 (不经大模型筛选，直接购买全部 11 项微服务)
echo   [8] 运行链上对账与审计 (自动核对最新链上交易状态与钱包余额)
echo   [9] 重新生成 Word (.docx) 报告 (从最新 JSON 重新排版导出 Word)
echo.
set /p choice="请输入选项编号 [直接回车默认 1]: "

if "%choice%"=="" set choice=1

cd /d "%~dp0client"

if "%choice%"=="1" (
  node src/agent.js 38.0 88.5 "阿尔金山无人区" "高海拔荒漠重装徒步穿越" auto
  goto done
)
if "%choice%"=="2" (
  node src/agent.js 27.9881 86.9250 "珠穆朗玛峰大本营" "极高海拔极寒雪山冲顶" auto
  goto done
)
if "%choice%"=="3" (
  node src/agent.js 39.0 83.5 "塔克拉玛干沙漠腹地" "极端沙尘高温流动沙丘穿越" auto
  goto done
)
if "%choice%"=="4" (
  node src/agent.js 41.5 90.3 "罗布泊大海道" "强风蚀雅丹地貌与极度干旱穿越" auto
  goto done
)
if "%choice%"=="5" (
  node src/agent.js 22.3 114.1 "香港中环商业区" "跨国离岸商贸与多币种外汇清算" auto
  goto done
)
if "%choice%"=="6" (
  echo.
  echo [自定义目标地理点设置]
  set /p custom_name="请输入探险目标地名 (例如: 库布齐沙漠): "
  set /p custom_lon="请输入经度 Longitude (例如: 108.5): "
  set /p custom_lat="请输入纬度 Latitude (例如: 40.2): "
  set /p custom_profile="请输入探险性质 (例如: 沙漠越野重装穿越): "
  echo.
  node src/agent.js %custom_lat% %custom_lon% "%custom_name%" "%custom_profile%" auto
  goto done
)
if "%choice%"=="7" (
  echo.
  echo [全量直接采购模式: 购买全部 11 项微服务]
  node src/agent.js 38.0 88.5 "全域数据采购" "全量外部微服务综合数据采购" all
  goto done
)
if "%choice%"=="8" (
  echo.
  echo [正在执行链上对账核验...]
  node src/reconcile.js
  goto done
)
if "%choice%"=="9" (
  echo.
  echo [正在重新导出 Word 报告...]
  node src/export_word.js
  goto done
)

echo 无效选项，使用默认配置执行...
node src/agent.js 38.0 88.5 "阿尔金山无人区" "高海拔荒漠重装徒步穿越" auto

:done
echo.
echo ========================================================
echo ✅ 执行完毕！数据报告保存在 Level2_a\client\reports\
echo ========================================================
pause
