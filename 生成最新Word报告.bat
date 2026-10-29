@echo off
chcp 65001 >nul
title Level 2-A 生成最新 Word (.docx) 交付报告

echo ========================================================
echo 📄 正在将最新的 JSON 采购数据排版并导出为 Word (.docx)...
echo ========================================================
cd /d "%~dp0client"
node src/export_word.js
echo.
pause
