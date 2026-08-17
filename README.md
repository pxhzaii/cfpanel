
# CF Panel

Cloudflare 管理面板 -浏览器端  部署在cloudflare的pages上

用浏览器（尤其手机）就能管理：

- **DNS**：域名列表、DNS 记录增删改查、一键切换橙云代理
- **Workers**：脚本列表与代码查看、新建/删除、机密变量管理、绑定管理（KV/R2/D1/明文）
- **Pages**：项目列表、部署记录、环境变量管理、绑定管理、新建项目支持 GitHub 仓库连接
- **存储**：KV 命名空间与键值管理、R2 存储桶列表与文件浏览/上传/下载、D1 数据库 SQL 执行与表浏览

## 安全设计

- 面板采用**账户+密码**认证（`PANEL_USERS`），每个 API 请求都会校验，凭据只存在浏览器 localStorage
- **Cloudflare API Token**（`CF_API_TOKEN`）只存在服务端环境变量，经 `/api/proxy/` 转发调用 Cloudflare API，**绝不下发到浏览器**
- 页面无任何 Token 输入框，Token 泄露面小
- 密码校验使用恒定时间比较，防时序侧信道攻击

## 环境变量

在 Cloudflare Pages 项目 **设置 → 环境变量** 中配置（生产环境建议同时配置到 Production 与 Preview）：

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `PANEL_USERS` | 是 | 面板用户列表，JSON 数组格式 |
| `CF_API_TOKEN` | 是 | Cloudflare API Token，权限见下表 |

### `PANEL_USERS` 怎么填

就是一个 JSON 数组，最外层 `[ ]`，里面每个用户一个 `{ }`。

**单用户（直接复制下面这行，把密码改成你自己的）：**

```
[{"username":"admin","password":"你的密码"}]
```

**两个用户（用逗号分隔）：**

```
[{"username":"admin","password":"你的密码"},{"username":"friend","password":"朋友的密码"}]
```

> 注意：双引号必须是英文双引号 `"`，不能是中文引号。

## API Token 权限

在 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens) 创建 Token，推荐按需勾选（至少勾选你要用到的功能）：

| 权限组 | 权限 | 范围 |
| --- | --- | --- |
| Zone | Zone → Read | All zones 或指定域名 |
| Zone | DNS → Edit | All zones 或指定域名 |
| Account | Workers Scripts → Read | All accounts |
| Account | Workers KV Storage → Edit | All accounts |
| Account | Workers R2 Storage → Read | All accounts |
| Account | D1 → Edit | All accounts |
| Account | Pages → Read | All accounts |
| Account | Cloudflare Pages → Edit | All accounts |

> 只想要 DNS 的话，最小权限就是 Zone Zone/DNS Edit；要玩 KV 就加 Workers KV Storage Edit；R2 只读、D1 只读/执行按需。

## 本地开发

```bash
npm install
npm run dev        # 前端热更新（Vite，默认 5173）
```

本地联调 Pages Functions：

```bash
# 终端里先设置环境变量（PowerShell 示例）
$env:PANEL_USERS='[{"username":"admin","password":"test123"}]'
$env:CF_API_TOKEN="你的token"

npm run build
npx wrangler pages dev dist
```

打开输出的本地地址即可，用配置的用户名和密码登录。

## 部署到 Cloudflare Pages

方式一：**Wrangler CLI**（本机执行）

```bash
npm run build
npx wrangler pages deploy dist --project-name cfpanel
```

方式二：**Git 集成**（推荐）

1. Fork 本项目到你的 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接 Git 仓库
3. 构建配置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - Node 版本：20 或以上
4. 在 **设置 → 环境变量** 添加 `PANEL_USERS` 和 `CF_API_TOKEN`
5. 保存后触发首次部署

部署完成后用手机浏览器打开 Pages 域名（如 `cfpanel.pages.dev`），输入用户名和密码即可使用。建议顺手在 Cloudflare 控制台把 Pages 项目绑定你的自定义域名。

## 技术栈

- Vue 3 + Vite + TypeScript（Vue Router）
- Cloudflare Pages Functions（API 代理）
- 移动端优先布局，底部导航，适配手机浏览器

## 说明

- API Token 泄漏风险由 Token 本身权限决定，建议按最小权限创建
- 面板仅提供浏览器端管理，不做 OAuth 登录（保持简单、无第三方依赖）
- 手机上也可以把面板网址"添加到主屏幕"当作 App 使用

> AI生成
