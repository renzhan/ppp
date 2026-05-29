# 派盘盘 (PPP) - 小红书营销复盘报告自动生成系统

小红书种草/传播项目的复盘报告自动生成平台。通过数据采集、计算引擎和 LLM 智能生成，将项目投放数据转化为结构化的复盘报告。

## 核心功能

- **项目管理**：创建项目、上传笔记底表（业务 Excel）、自动解析入库
- **数据采集**：对接蒲公英、聚光、灵犀等平台 API，自动拉取投放数据
- **计算引擎**：自动计算 KPI 完成率、大盘对比、达人层级聚合、爆文率等指标
- **报告生成**：LLM 逐章节生成 HTML 复盘报告（10 章），支持流式输出
- **审校台**：在线编辑生成的报告，AI 助手辅助润色优化
- **复盘配置**：大盘基准、KPI 目标、达人层级、投放阶段等可配置
- **导出**：支持 PDF / Word 导出

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + React 18 + TailwindCSS |
| 后端 | Next.js API Routes + TypeScript |
| 数据库 | PostgreSQL (Prisma ORM) |
| AI | OpenAI 兼容接口 / 通义千问 DashScope |
| 部署 | Docker (单容器) |

## 项目结构

```
├── src/                    # 后端 TypeScript（数据处理、计算引擎、报告生成）
│   ├── calculation/        # 计算引擎（KPI、CPE、爆文率等）
│   ├── ingestion/          # 数据采集（API 对接、Excel 解析）
│   ├── pipeline/           # 报告生成管线（loaders + prompts）
│   ├── prompts/chapters/   # 各章节提示词模板
│   └── report/             # LLM 客户端、报告组装
├── web/                    # Next.js 前端应用
│   └── src/app/            # 页面和 API 路由
├── prisma/                 # 数据库 Schema 和迁移
├── docs/                   # 业务文档（模版分析、字段映射）
├── Dockerfile              # 生产镜像构建
└── docker-compose.yml      # Docker Compose 配置
```

## 本地开发

### 前置条件

- Node.js 22+
- PostgreSQL 数据库
- LLM API（OpenAI 兼容接口或通义千问）

### 1. 安装依赖

```bash
# 根目录
npm install

# 前端
cd web && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填写实际值
```

必填变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `LLM_BASE_URL` | LLM API 地址（OpenAI 兼容） |
| `LLM_API_KEY` | LLM API Key |
| `LLM_MODEL` | 模型名称（如 gpt-5.1） |
| `ENCRYPTION_KEY` | 加密密钥（至少 32 字符） |

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. 编译后端

```bash
npm run build
```

### 5. 启动开发服务器

```bash
cd web
npm run dev
```

访问 http://localhost:3000

## Docker 部署

### 一键构建启动

```bash
docker compose up --build -d
```

### 环境变量

通过 `.env` 文件或 `docker-compose.yml` 的 `environment` 配置。

### 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止
docker compose down

# 重新构建（代码变更后）
docker compose up --build -d

# 进入容器
docker compose exec app bash
```

### 暴露端口

- **3000** — Web 应用（唯一对外端口）

## 报告生成流程

```
用户创建项目 → 上传笔记底表 → 配置复盘参数
                    ↓
         计算引擎自动计算指标
                    ↓
    进入审校台 → 触发逐章节 LLM 生成
                    ↓
  每章独立：加载数据(loader) → 填充模板(prompt) → 调用 LLM → 输出 HTML
                    ↓
       审校台实时展示 → 在线编辑 → 导出 PDF/Word
```

## 开发指南

详细开发文档见 [docs/development-guide.md](docs/development-guide.md)

## License

Private - Internal Use Only
