# Implementation Plan: Frontend Style Redesign

## Overview

将"派盘盘"平台前端从深色科技风格（slate-900/blue）迁移到橙黄色暖色调现代扁平化设计。按照设计文档的 6 阶段迁移策略，依次修改 CSS 变量、登录页、侧边栏、页面组件、通用组件、最后清理旧样式。所有改动仅涉及样式类名和 CSS，不改动业务逻辑和 API。

## Tasks

- [x] 1. Phase 1 — CSS 变量与 Tailwind 配置
  - [x] 1.1 更新 `web/src/app/globals.css` 中的 `:root` CSS 变量
    - 将 `--primary` 从 `222.2 47.4% 11.2%` 改为 `36 80% 55%`（橙黄色）
    - 将 `--primary-foreground` 改为 `0 0% 100%`（白色）
    - 更新 `--accent` 为 `36 80% 55%`，`--accent-foreground` 为 `0 0% 100%`
    - 更新 `--ring` 为 `36 80% 55%`
    - 添加 `--brand-success: 160 84% 39%`、`--brand-warning: 36 80% 55%`、`--brand-orange-light: 45 100% 94%`
    - 添加全局 transition 基础样式：`* { transition: color 200ms ease, background-color 200ms ease; }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 14.1_

  - [x] 1.2 更新 `web/tailwind.config.ts` 扩展配置
    - 添加 `brand` 色阶（50~900）和 `success` 颜色
    - 添加 `fontFamily.sans` 为中文无衬线字体栈（PingFang SC, Microsoft YaHei, Helvetica Neue, Arial, sans-serif）
    - 更新 `fontSize` 定义（xs: 12px, sm/base: 14px, lg: 16px, xl: 20px），统一 lineHeight 1.5
    - 更新 `borderRadius`（lg: 8px, md: 6px, sm: 4px）
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 更新 `web/src/app/layout.tsx` body 类名
    - 将 `bg-gray-50` 改为 `bg-background`，确保使用 CSS 变量驱动
    - 添加 `font-sans` 确保字体栈生效
    - _Requirements: 1.2, 2.1_

- [x] 2. Phase 2 — 登录页布局重构
  - [x] 2.1 重构 `web/src/app/login/page.tsx` 为左右分栏布局
    - 将外层容器从 `bg-gradient-to-br from-slate-900` 改为 `flex min-h-screen`
    - 创建左面板（55% 宽度）：渐变背景 `from-[#FFF8E1] to-[#FFECB3]`，居中显示品牌 Logo "派盘盘" + 副标题 "AI数字营销平台" + 装饰性 3D 方块图标
    - 创建右面板（45% 宽度）：白色背景，垂直居中表单区域
    - 移除旧的背景装饰元素（blur 圆形）和 backdrop-blur 卡片容器
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 更新登录表单样式
    - 表单标题改为 "欢迎登录"（`text-gray-900`），副标题 "你的小盘 盯着每一盘"
    - 输入框样式：`border-gray-300 bg-white text-gray-900 focus:border-brand focus:ring-2 focus:ring-brand/20`，高度 40px
    - 标签样式：`text-sm font-medium text-gray-700`
    - 复选框 "自动登录" 使用橙色 checked 状态
    - "修改密码" 链接改为 `text-brand hover:underline`
    - 登录按钮：`bg-brand text-white rounded-md w-full h-[44px]`，文字 "登 录"
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10, 6.1, 6.3, 6.7_

  - [x] 2.3 更新登录页 footer 和响应式布局
    - Footer 链接（帮助、隐私、条款）改为 `text-gray-500 hover:text-gray-700`
    - 版权文字改为 `text-gray-400`
    - 添加响应式断点：`md:flex-row flex-col`，小于 768px 时上下堆叠（表单在上）
    - _Requirements: 3.11, 3.12_

- [x] 3. Phase 3 — 侧边栏样式重构
  - [x] 3.1 更新 `web/src/components/layout/sidebar.tsx` 容器样式
    - 背景从深色改为 `bg-white border-r border-gray-200`
    - 宽度：展开 `w-[220px]`，折叠 `w-16`
    - 添加 `transition-all duration-200` 实现展开/折叠动画
    - _Requirements: 4.1, 4.7, 14.2_

  - [x] 3.2 更新侧边栏导航项样式
    - 品牌 Logo 区域：橙色图标 + `text-gray-900` 文字 "派盘盘"
    - 默认导航项：`text-gray-700 hover:bg-gray-50`，图标 20px，文字 14px
    - 激活导航项：`text-brand border-l-[3px] border-brand bg-brand-50`
    - 折叠状态：仅显示图标，隐藏文字标签
    - 底部退出图标样式更新
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.8_

  - [x] 3.3 更新 `web/src/components/layout/app-shell.tsx` 用户信息区域
    - 用户头像和用户名显示在主内容区右上角
    - 样式使用 `text-gray-700` 和适当间距
    - _Requirements: 4.5_

- [x] 4. Checkpoint — 核心布局验证
  - 运行 `next build` 确保无编译错误
  - 确保所有 TypeScript 类型检查通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 4 — 页面组件颜色类名批量替换
  - [x] 5.1 更新 `web/src/components/layout/page-header.tsx` 面包屑与标题样式
    - 面包屑：`text-sm text-gray-500`，分隔符 "/"，当前页 `text-gray-900` 无链接
    - 操作按钮区域右对齐
    - 分区标题：`text-lg font-semibold border-b border-gray-200 pb-2`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 5.2 更新 `web/src/app/review/page.tsx` 复盘列表页样式
    - 替换所有 `slate-*` / `blue-*` 颜色类为对应的 `gray-*` / `brand` 类
    - 操作链接改为 `text-brand hover:underline`
    - "+ 开始新的复盘" 按钮使用 primary 样式
    - _Requirements: 7.4, 11.3_

  - [x] 5.3 更新 `web/src/app/projects/` 项目相关页面样式
    - 项目列表页颜色类替换（slate→gray, blue→brand）
    - 项目详情页颜色类替换
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.4 更新 `web/src/app/planning/page.tsx` 和 `web/src/app/sentiment/page.tsx` 样式
    - 批量替换深色系颜色类为新设计系统颜色
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 5.5 更新 `web/src/app/admin/` 管理页面样式
    - 用户管理、Agent 管理、设置页面的颜色类替换
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 6. Phase 5 — 通用组件样式调整
  - [x] 6.1 创建/更新按钮组件样式
    - Primary 按钮：`bg-brand text-white rounded-md h-10 px-6 hover:bg-brand-600`
    - Secondary 按钮：`bg-white text-gray-700 border border-gray-300 rounded-md h-10 px-6`
    - Text-link 按钮：`text-brand hover:underline`
    - Success 按钮（新建）：`bg-success text-white rounded-md h-10 px-6`
    - Submit 按钮：高度 44px
    - Disabled 状态：`opacity-50 cursor-not-allowed`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.2 更新表单组件样式 (`web/src/components/form/` 及页面内联表单)
    - 输入框：`border border-gray-300 rounded-sm h-10 px-3 focus:border-brand focus:ring-2 focus:ring-brand/20`
    - Placeholder：`placeholder:text-gray-400`（默认 "请输入"）
    - 标签：`text-sm font-medium text-gray-700`
    - Select/Dropdown：与输入框同样式 + 下拉箭头
    - 日期选择器：与输入框同样式
    - Checkbox checked：橙色填充
    - Multi-select tags：橙色边框药丸 + 关闭图标
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 6.3 更新新建复盘表单页面 (`web/src/app/review/new/`) 布局样式
    - 分区标题：`text-base font-bold text-gray-900`
    - 多列网格布局（2-3 列）
    - 达人层级区域：名称输入 + 范围输入 + "+" 添加按钮
    - 报告模块：checkbox 列表 + 全选/取消全选
    - 投流周期：阶段名 + 日期范围 + "+" 添加按钮
    - 策划方案上传：虚线边框拖拽区域
    - 提交按钮 "开始复盘"：`bg-brand text-white rounded-md`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 6.4 更新数据表格样式
    - 表头：`bg-gray-50 text-sm font-medium text-gray-600 border-b`
    - 数据行：`bg-white text-sm text-gray-900 border-b hover:bg-gray-50`
    - 操作链接：`text-brand hover:underline`
    - 单元格 padding：`py-3 px-4`
    - 容器：`bg-white rounded-lg border border-gray-200`
    - 响应式：小屏幕水平滚动 `overflow-x-auto`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 13.4_

  - [x] 6.5 更新筛选栏样式
    - 水平排列 `flex flex-wrap gap-4`
    - 查询按钮：primary 样式
    - 重置按钮：secondary 样式
    - 标签：`text-xs text-gray-500` 位于控件上方
    - 响应式换行：`flex-wrap`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 13.5_

  - [x] 6.6 更新分页器样式
    - 页码按钮：`w-8 h-8 rounded-sm`
    - 激活态：`bg-brand text-white`
    - 非激活态：`bg-white border border-gray-300 text-gray-700`
    - 前后箭头：同尺寸
    - 信息文字：`text-sm text-gray-500` 左对齐
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 6.7 更新文件上传区域样式 (`web/src/components/form/note-base-uploader.tsx`)
    - 容器：`border-2 border-dashed border-gray-300 rounded-lg`
    - 拖拽悬停：`border-brand bg-[#FFF8E1]`
    - 进度条：`bg-brand`
    - 成功状态：绿色图标 + 文件名
    - 失败状态：红色图标 + 错误信息
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 7. Checkpoint — 组件样式验证
  - 运行 `next build` 确保无编译错误
  - 确认无 TypeScript 类型错误
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Phase 6 — 响应式适配与过渡动画
  - [x] 8.1 验证并补充响应式断点样式
    - ≥1280px：完整侧边栏 + 多列布局
    - 768px~1279px：侧边栏折叠为图标模式，表格列适当减少
    - <768px：侧边栏隐藏为汉堡菜单，表单字段垂直堆叠
    - 确保 `app-shell.tsx` 中的响应式逻辑与新宽度值匹配
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 8.2 添加全局交互过渡动画
    - 按钮/链接点击反馈：`active:scale-[0.98]` 或 `active:opacity-90`
    - 下拉菜单/Modal 出现：`animate-in fade-in duration-200`
    - 确保侧边栏展开/折叠有 `transition-all duration-200`
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 9. Phase 6 — 清理旧样式与最终验证
  - [x] 9.1 清理 `globals.css` 中的旧样式
    - 审查 `.report-editor-content` 样式块，将硬编码的 `#1e40af`（蓝色）替换为品牌色或中性色
    - 移除不再使用的旧 CSS 变量或样式规则
    - 确保 `report-editor-content` 中的表格、标题样式与新设计系统一致
    - _Requirements: 1.1, 7.1_

  - [x] 9.2 全局搜索并替换遗留的深色系类名
    - 搜索所有 `from-slate-900`、`bg-slate-*`、`text-blue-*`、`border-blue-*` 等旧类名
    - 替换为对应的新设计系统类名
    - 确保无遗漏的旧风格颜色引用
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 10. Final checkpoint — 构建验证与完成
  - 运行 `next build` 确保最终构建无错误
  - 运行 `next lint` 确保无 lint 错误
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 所有改动仅涉及 `web/` 目录下的前端文件，不触碰 `web/src/app/api/` 路由
- 不涉及 Property-Based Testing（纯 CSS/className 变更无可测属性）
- 视觉正确性需要人工对比设计稿验证
- 回滚方案简单：`git revert` 即可恢复所有样式
- Checkpoints 用于分阶段验证构建状态，避免累积错误
