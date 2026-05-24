# Presenton + PPP_PI_NEW 集成清单

## ✅ 已完成的任务

### 1. 认证系统集成
- [x] 创建JWT认证模块 (`/servers/fastapi/utils/jwt_auth.py`)
  - 支持从Cookie或Authorization header中提取JWT
  - 验证JWT令牌（使用HS256算法）
  - 从JWT payload提取用户信息

- [x] 修改SessionAuthMiddleware (`/servers/fastapi/api/middlewares.py`)
  - 优先检查JWT认证（来自ppp_pi_new）
  - 回退到原有的session认证机制
  - 维持向后兼容性

- [x] 共享JWT_SECRET环境变量
  - ppp_pi_new: 通过middleware.ts中的JWT_SECRET读取
  - presenton FastAPI: 通过utils/jwt_auth.py中的get_jwt_secret()读取
  - docker-compose: 两个服务都接收相同的${JWT_SECRET}环境变量

### 2. 前端集成
- [x] 复制presenton前端编辑器组件到ppp_pi_new
  - 路径: `/ppp_pi_new/web/src/app/presenton_editor/`
  - 包含所有子目录和服务文件

- [x] 更新所有API端点URL
  - 替换: `/api/v1/ppt/` → `/api/ppt/`
  - 影响文件: 6个服务文件，31个端点替换

- [x] 修复导入路径
  - dashboard.ts: 移除`@/app/(presentation-generator)`前缀
  - 使用相对路径`./header`替代

### 3. API代理路由
- [x] 创建Next.js代理路由 (`/ppp_pi_new/web/src/app/api/ppt/[...path]/route.ts`)
  - 支持GET, POST, PUT, DELETE方法
  - 转发请求到presenton后端
  - 转发认证信息（Cookie和Authorization header）
  - 支持查询参数和多级路径

### 4. 环境配置
- [x] 更新docker-compose.yml
  - presenton-backend: 添加JWT_SECRET和FASTAPI_HOST环境变量
  - frontend: 添加PRESENTON_BASE_URL和JWT_SECRET
  
- [x] 更新.env.example
  - 文档化JWT_SECRET和PRESENTON_BASE_URL
  - 说明Docker与开发环境的差异

### 5. FastAPI跨容器通信支持
- [x] 修改presenton server.py
  - 添加FASTAPI_HOST环境变量支持
  - Docker环境绑定0.0.0.0
  - 开发环境保持127.0.0.1

### 6. 测试和验证
- [x] 创建集成测试脚本 (`/integration-test.sh`)
  - 检查服务连接性
  - 测试API代理路由
  - 验证JWT认证流程
  - 检查前端组件集成
  - 验证环境配置

## 📋 架构设计

### 认证流程
1. 用户在ppp_pi_new登录 → 生成JWT token → 存储在ppp_token Cookie
2. 用户访问presenton_editor → JWT已包含在Cookie中
3. presenton_editor API调用 → 通过Next.js代理路由(/api/ppt/*)
4. 代理路由转发请求到presenton FastAPI → 传递ppp_token Cookie
5. presenton FastAPI middleware验证JWT → 允许访问

### 数据流
```
ppp_pi_new Frontend (presenton_editor)
    ↓
    /api/ppt/* (Next.js proxy route)
    ↓
presenton FastAPI (/api/v1/ppt/*)
```

### 服务通信
```
Docker Compose:
- frontend (3000) ← nginx ← 用户浏览器
- ppp-backend (4000) ← nginx ← 用户请求
- presenton-backend (8000)
  - 内部通信: frontend可通过localhost:8000访问(开发)
  - Docker通信: frontend使用presenton-backend:8000(DNS)
```

## 🔧 环境变量配置表

| 变量名 | presenton | ppp_pi_new | 值 | 说明 |
|--------|-----------|-----------|-----|------|
| JWT_SECRET | ✅ | ✅ | ${JWT_SECRET} | 共享密钥 |
| PRESENTON_BASE_URL | - | ✅ | http://presenton-backend:8000 | 代理目标 |
| FASTAPI_HOST | ✅ | - | 0.0.0.0 | Docker中的绑定地址 |
| LLM | ✅ | - | openai | 语言模型 |
| OPENAI_API_KEY | ✅ | - | ${OPENAI_API_KEY} | API密钥 |

## 🚀 启动指南

### Docker启动
```bash
# 1. 设置.env文件
cp .env.example .env
# 编辑.env，设置JWT_SECRET、LLM_PROVIDER等

# 2. 构建和启动
docker-compose up -d

# 3. 验证
bash integration-test.sh
```

### 开发启动
```bash
# Terminal 1: presenton后端
cd presenton_new
node start.js

# Terminal 2: ppp_pi_new前端+后端
cd ppp_pi_new
npm run dev
```

## 🧪 测试清单

- [ ] JWT token生成和验证
- [ ] API代理路由正常工作
- [ ] presenton_editor组件加载
- [ ] 创建演示文稿功能
- [ ] 生成幻灯片功能
- [ ] 编辑和导出功能
- [ ] 跨容器通信（Docker）
- [ ] 主题和模板管理
- [ ] 图片和资源上传

## 📝 已知限制

1. presenton的原始认证系统（简单认证/基本认证）被禁用但保留向后兼容
2. presenton UI中的登录页面仍存在但被JWT认证跳过
3. 需要手动同步JWT_SECRET在所有配置文件中
4. 本地开发需要在三个端口运行: 3000 (frontend), 4000 (ppp-backend), 5000/8000 (presenton-backend)

## 🔒 安全注意事项

1. 生产环境必须更改JWT_SECRET的默认值
2. 使用HTTPS传输JWT tokens
3. 定期轮换JWT_SECRET
4. 在Docker中使用独立的.env文件，不要提交到版本控制

## 📞 故障排查

### JWT认证失败
- 检查JWT_SECRET是否在两个系统中一致
- 验证cookie name是否为"ppp_token"
- 检查JWT过期时间

### API代理失败
- 验证PRESENTON_BASE_URL是否正确
- 检查presenton FastAPI是否运行
- 查看浏览器Network标签中的请求

### 跨容器通信失败
- 检查docker-compose中的service名称
- 验证FASTAPI_HOST=0.0.0.0在Docker中设置
- 检查防火墙规则
