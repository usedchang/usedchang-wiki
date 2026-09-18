# usedchang-wiki

XCPC 题解博客，记录算法学习与刷题历程。

## 在线访问

**网站**: https://www.usedchang.cn/

## 技术栈

- **前端框架**: Vue 3
- **构建工具**: Vite
- **部署平台**: Vercel

## 本地开发

```bash
# 进入项目目录
cd vue-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 生产部署

生产环境请先在 Supabase 执行 [`supabase-migration.sql`](./supabase-migration.sql)，再配置 `vue-app/.env.local` 中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。文章、评论、用户资料和图片会保存到 Supabase；未配置时仅作为本地写作降级，不能用于多设备发布。

上线前还需在 Supabase Auth 中启用邮箱密码登录，并将正式域名下的 `/auth/callback` 与 `/reset-password` 加入回调白名单。管理员角色只能通过可信的数据库管理端设置；密码只由 Supabase Auth 保存，不要给 `profiles` 增加密码字段，也不要把 `service_role` key 放入任何 `VITE_*` 变量。

## 项目结构

```
vue-app/
├── src/
│   ├── views/      # 页面组件
│   ├── router/     # 路由配置
│   ├── utils/     # 工具函数
│   └── assets/    # 静态资源
└── public/         # 公共资源
```

## 功能特性

- 主页展示最新题解
- 公开题解归档（搜索、标签筛选）与沉浸式阅读页（目录、进度、相邻文章）
- 学习计划页面
- Codeforces 统计
- 题解/游记编辑与发布（实时 Markdown 预览、.md 导入导出、图片上传）
- Supabase 邮箱 + 自设密码登录、找回密码、普通用户/管理员分权
- 嵌套评论与 Realtime 实时同步
- 多主题切换（Academic / Modern / 深色 / 护眼）

## 许可证

MIT
