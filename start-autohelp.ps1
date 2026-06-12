# ============================================================
#  AutoHelp 4.0 啟動腳本
#  作用：開機登入時自動把「後端 + 前端」跑起來，不用再打指令。
#  重複執行很安全：已經在跑的服務會略過，不會開兩份。
# ============================================================

# ↓↓↓ 未來要改連哪一台後端，只改這一行就好（本機就保持預設） ↓↓↓
$BackendUrl = "http://localhost:3001"
# 例：公司內網 => "http://192.168.1.50:3001"

$root     = "C:\Users\leolu\Desktop\新增資料夾\專案資料夾\AutoHelp4.0"
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$logFile  = Join-Path $root "autohelp-start.log"

function Log($msg) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    [System.IO.File]::AppendAllText($logFile, $line + "`r`n", [System.Text.Encoding]::UTF8)
}

function Test-Listening($port) {
    try { $null = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop; return $true }
    catch { return $false }
}

Log "===== 啟動檢查開始 ====="

# --- 後端 (port 3001) ---
if (Test-Listening 3001) {
    Log "[OK] 後端已在執行 (port 3001)"
} else {
    Log "[..] 啟動後端 ..."
    Start-Process -FilePath "node" -ArgumentList "--env-file=.env", "server.js" `
        -WorkingDirectory $backend -WindowStyle Hidden
}

# --- 前端 (port 5173)，把後端網址傳給它當預設 ---
if (Test-Listening 5173) {
    Log "[OK] 前端已在執行 (port 5173)"
} else {
    Log "[..] 啟動前端 ... (後端指向 $BackendUrl)"
    $env:VITE_BACKEND_URL = $BackendUrl
    Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
        -WorkingDirectory $frontend -WindowStyle Hidden
}

Log "===== 啟動檢查結束（網頁： http://localhost:5173 ） ====="
