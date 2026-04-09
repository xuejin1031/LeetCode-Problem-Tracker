# LeetCode Problem Tracker

這是一個前後端分離的 LeetCode 題目追蹤系統，提供題目管理、筆記整理、條件篩選與統計分析功能。前端使用 Vue 3 + Vite，後端使用 Express + TypeScript，資料儲存在 MySQL。

## 專案功能

- 題目 CRUD：新增、編輯、刪除 LeetCode 題目
- 解題狀態管理：可切換已解 / 未解
- 題目資訊欄位：題號、標題、難度、標籤、筆記
- 題目列表篩選：可依關鍵字、難度、狀態、標籤過濾
- 快速檢視：在列表中開啟題目詳細資訊
- 統計頁：總題數、已解數、未解數、解題率、難度分布、熱門標籤、最近更新
- 多語系：支援繁中與英文，路由為 `/zh/*`、`/en/*`
- 響應式介面：桌機與手機皆可使用

## 技術棧

### Frontend

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Vue I18n
- Element Plus
- Axios

### Backend

- Node.js
- Express
- TypeScript
- MySQL 8+
- mysql2
- dotenv

## 專案結構

```text
leetcode/
├─ backend/                # Express API 與 MySQL 存取
│  └─ src/index.ts
├─ frontend/               # Vue 3 + Vite 前端
│  └─ src/
│     ├─ pages/
│     ├─ router/
│     ├─ services/
│     └─ stores/
├─ start-dev.ps1           # 一鍵同時啟動前後端並開啟 App
└─ package.json            # 根目錄快捷指令
```

## 環境需求

- Node.js 18 以上
- npm
- MySQL

## 後端設定

後端會讀取 `backend/.env`，目前程式使用的欄位如下：

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=leetcode_db
PORT=3001
NODE_ENV=development
```

請先建立資料庫：

```sql
CREATE DATABASE IF NOT EXISTS leetcode_db;
```

後端啟動後會自動建立 `problems` 資料表。

## 安裝方式

第一次使用請先安裝前後端依賴：

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

## 啟動方式

### 方式一：一鍵啟動前後端

在根目錄執行：

```bash
npm run dev
```

這個指令會：

- 開兩個 PowerShell 視窗
- 分別執行 `backend` 與 `frontend` 的開發伺服器
- 等待前端就緒後自動開啟 `http://localhost:5173/zh/list`

### 方式二：手動分開啟動

後端：

```bash
cd backend
npm run dev
```

前端：

```bash
cd frontend
npm run dev
```

前端預設網址：

- `http://localhost:5173/zh/list`
- `http://localhost:5173/en/list`

後端預設網址：

- `http://localhost:3001`

健康檢查 API：

- `http://localhost:3001/api/health`

## 前端頁面

- `/zh/list`、`/en/list`：題目列表、搜尋、篩選、編輯、刪除、快速檢視
- `/zh/add`、`/en/add`：新增或編輯題目
- `/zh/stats`、`/en/stats`：統計分析頁

## 後端 API

### Problems

- `GET /api/problems`：取得題目列表
- `GET /api/problems/:id`：取得單一題目
- `POST /api/problems`：新增題目
- `PUT /api/problems/:id`：更新題目
- `DELETE /api/problems/:id`：刪除題目

支援查詢參數：

- `q`：搜尋標題、筆記、標籤
- `difficulty`：`Easy` / `Medium` / `Hard`
- `status`：`solved` / `unsolved`
- `tag`：依標籤篩選

### Statistics

- `GET /api/statistics`：取得整體統計、熱門標籤、最近更新

## Build

前端建置：

```bash
cd frontend
npm run build
```

後端建置：

```bash
cd backend
npm run build
```

## 常見問題

- 前端無法載入資料：請先確認後端是否成功啟動於 `3001`
- 後端無法啟動：請確認 MySQL 服務、資料庫名稱與 `backend/.env`
- 題號新增失敗：後端限制 `number` 唯一，不可重複
- 若 `5173` 被占用：Vite 可能改用其他埠，請以前端終端輸出為準
