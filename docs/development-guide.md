# PPP 平台开发与部署指南

本文档说明如何在本地编译、启动前后端服务，以及如何通过 Docker 进行生产部署。

---

## 目录

- [系统要求](#系统要求)
- [项目结构](#项目结构)
- [环境变量配置](#环境变量配置)
- [本地开发（前后端分别启动）](#本地开发)
- [Docker 生产部署](#docker-生产部署)
- [常用命令速查](#常用命令速查)

---

## 系统要求

| 组件 | 版本要求 |
|------|----------|
| Node.js | 22.x |
| Python | 3.11+ |
| PostgreSQL | 15+ (或 Supabase) |
| npm | 10+ (随 Node.js 22 自带) |
| pip / uv | 最新版 |
| Docker (可选) | 24+ |
| Docker Compose (可选) | v2+ |

---

## 项目结构

```
ppp_pi_new/
├── src/                    # 后端 TypeScript 源码（数据处理、报告生成引擎）
├── web/                    # Next.js 14 前端应用
├── presenton-api/          # Presenton FastAPI 服务（AI PPT 生成）
├── prisma/                 # Prisma ORM schema 和 migrations
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile              # 多阶段构建 Dockerfile
├── docker-entrypoint.sh    # 容器入口脚本
├── package.json            # 根项目配置（后端 TS 编译）
└── .env                    # 环境变量（不提交到 Git）
```

---

## 环境变量配置

复制 `.env.example` 为 `.env` 并填写实际值：

```bash
cp .env.example .env
```

必填变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `LLM_PROVIDER` | LLM 提供商：`openai` 或 `qwen` |
| `LLM_BASE_URL` | OpenAI 兼容接口地址 |
| `LLM_API_KEY` | LLM API Key |
| `LLM_MODEL` | 使用的模型名称 |
| `ENCRYPTION_KEY` | 加密密钥（至少 32 字符） |

Presenton 相关（本地开发时可选）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PRESENTON_INTERNAL_URL` | Presenton API 地址 | `http://localhost:8000` |

---

## 本地开发

本地开发需要分别启动三个服务：

### 1. 安装依赖

```bash
# 根目录（后端 TS + Prisma）
cd ppp_pi_new
npm install

# 前端 Next.js
cd web
npm install
cd ..

# Presenton FastAPI（Python）
cd presenton-api
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. 数据库初始化

```bash
# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移（首次或 schema 变更后）
npx prisma migrate dev

# （可选）填充种子数据
npx tsx prisma/seed.ts
```

### 3. 编译后端 TypeScript

```bash
# 在根目录执行
npm run build
```

编译产物输出到 `dist/` 目录。

### 4. 启动 Presenton FastAPI 服务

```bash
cd presenton-api

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# 启动开发服务器（带热重载）
python server.py --port 8000 --reload true
```

服务启动后监听 `http://127.0.0.1:8000`。

验证服务可用：
```bash
curl http://localhost:8000/api/v1/health
# 应返回: {"status": "ok"}
```

### 5. 启动 Next.js 前端（开发模式）

```bash
cd web
npm run dev
```

前端启动后访问 `http://localhost:3000`。

### 6. 启动顺序总结

| 顺序 | 服务 | 命令 | 端口 |
|------|------|------|------|
| 1 | PostgreSQL | 外部服务（Supabase 或本地） | 5432 |
| 2 | Presenton FastAPI | `python server.py --port 8000 --reload true` | 8000 |
| 3 | Next.js 前端 | `cd web && npm run dev` | 3000 |

> 注意：Presenton 服务绑定在 `127.0.0.1`，仅本地可访问。前端通过 API Proxy（`/api/ppt/*`）转发请求到 Presenton，无需直接访问 8000 端口。

---

## Docker 生产部署

### 一键构建并启动

```bash
docker compose up --build -d
```

这会：
1. 多阶段构建镜像（Node.js + Python + Supervisor）
2. 安装所有依赖并编译
3. 启动容器，自动执行数据库迁移
4. 通过 Supervisor 同时运行 Next.js (3000) 和 Presenton (8000)

### 仅暴露端口

- **3000** — Next.js 前端 + API Proxy（对外唯一入口）
- 8000 — Presenton FastAPI（容器内部，不对外暴露）

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看 Supervisor 管理的各服务日志（进入容器）
docker compose exec app cat /var/log/nextjs.out.log
docker compose exec app cat /var/log/presenton.out.log
docker compose exec app cat /var/log/presenton.err.log
```

### 停止服务

```bash
docker compose down
```

### 重新构建（代码变更后）

```bash
docker compose up --build -d
```

### 共享数据卷

`/app_data/` 卷用于存储 Presenton 生成的 PPTX 文件和图片资源。数据在容器重启后保留。

---

## 常用命令速查

### 开发

| 命令 | 说明 | 目录 |
|------|------|------|
| `npm install` | 安装根项目依赖 | `ppp_pi_new/` |
| `cd web && npm install` | 安装前端依赖 | `ppp_pi_new/web/` |
| `npm run build` | 编译后端 TypeScript | `ppp_pi_new/` |
| `cd web && npm run dev` | 启动前端开发服务器 | `ppp_pi_new/web/` |
| `cd web && npm run build` | 构建前端生产版本 | `ppp_pi_new/web/` |
| `python server.py --port 8000 --reload true` | 启动 Presenton 开发服务器 | `ppp_pi_new/presenton-api/` |

### 数据库

| 命令 | 说明 |
|------|------|
| `npx prisma generate` | 生成 Prisma Client |
| `npx prisma migrate dev` | 开发环境迁移 |
| `npx prisma migrate deploy` | 生产环境迁移 |
| `npx prisma studio` | 打开数据库可视化工具 |
| `npx tsx prisma/seed.ts` | 填充种子数据 |

### 测试

| 命令 | 说明 | 目录 |
|------|------|------|
| `npm test` | 运行所有测试（根项目） | `ppp_pi_new/` |
| `npx vitest run` | 运行前端测试 | `ppp_pi_new/web/` |
| `npx vitest run src/tests/properties/` | 仅运行属性测试 | `ppp_pi_new/web/` |

### Docker

| 命令 | 说明 |
|------|------|
| `docker compose up --build -d` | 构建并启动 |
| `docker compose down` | 停止并移除容器 |
| `docker compose logs -f` | 实时查看日志 |
| `docker compose exec app bash` | 进入容器 Shell |

---

## 架构说明

```
浏览器 ──→ Next.js (port 3000) ──→ API Proxy (/api/ppt/*) ──→ Presenton FastAPI (port 8000)
                                 ──→ Prisma ORM ──→ PostgreSQL
```

- **认证**：PPP JWT（httpOnly cookie）为唯一鉴权层
- **API Proxy**：Next.js API Routes 验证 JWT 后转发请求到 Presenton，不传递认证 headers
- **Presenton**：内部服务，无独立认证，仅接受 localhost 连接
- **Supervisor**：在 Docker 容器内同时管理 Next.js 和 Presenton 两个进程
