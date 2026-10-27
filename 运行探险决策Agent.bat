@echo off
chcp 65001 >nul
title Level 2 探险生存决策 Agent (认知推理+噪音过滤+x402)
echo ========================================================
echo 🤖 正在启动 Level 2 探险决策 Agent...
echo 模式: 认知推理 - 噪音过滤 - x402 协议购买 - 生存决策裁决
echo ========================================================
cd /d "%~dp0client"
node src/agent.js
pause
