# CF Panel

Cloudflare 管理面板 — 部署在 Cloudflare Pages 上，用浏览器即可管理 Cloudflare 资源。

## 功能

- **DNS**：域名列表、DNS 记录增删改查、一键切换橙云代理
- **Workers/Pages**：项目列表、新建/删除项目、支持 GitHub 仓库连接、环境变量管理、机密变量管理、绑定管理（KV/R2/D1）、重新部署
- **存储**：KV 命名空间与键值管理、R2 存储桶列表与文件浏览/上传/下载/删除、R2 自定义域名管理、D1 数据库 SQL 执行与表浏览
- **API 令牌**：查看/创建/删除/轮换 CF API Token，396 项权限按服务分组展示并全面中文化，支持分类快捷筛选（DNS/Workers/数据库/自定义），权限组标注只读/读写级别，混合 scope 权限自动拆分为多个策略

![主页面](./1.jpg)



![新建pages项目](./2.jpg)




## 部署步骤

1. Fork 或克隆本仓库到你的 GitHub
2. 在 Cloudflare Dashboard 创建 Pages 项目，`注意是pages不是works`，连接该 GitHub 仓库
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 配置环境变量

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `PANEL_USERS` | 是 | 面板用户列表，下方有说明 |
| `CF_API_TOKEN` | 是 | Cloudflare API Token，权限见下表 |
| `GH_TOKEN` | 否 | GitHub Token（需 repo 权限），用于"重新部署"功能推空 commit 触发 GitHub webhook 部署 |

### `PANEL_USERS` 怎么填

就是一个 JSON 数组，最外层 `[ ]`，里面每个用户一个 `{ }`。

**单用户（直接复制下面这行，把账号/密码改成你的）：**

```
[{"username":"你的账号","password":"你的密码"}]
```

**两个用户（用逗号分隔）：**

```
[{"username":"你的账号","password":"你的密码"},{"username":"朋友的账号","password":"朋友的密码"}]
```

> 注意：双引号必须是英文双引号 `"`，不能是中文引号。








## API Token 权限

在 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens) 创建 Token，推荐按需勾选（至少勾选你要用到的功能）：

选择模板 **`编辑 Cloudflare Workers`**，按图增加所需权限
![权限](./3.jpg)





## cfpanel面板 重新部署说明（可以无视）

cfpanel面板的"重新部署"功能通过 **GitHub API 推送 commit** 来触发 Cloudflare Pages 的 GitHub webhook 自动部署。

**环境变量安全机制**：通过 API 设置的环境变量统一使用 `secret_text`（加密存储）类型。CF Pages 部署时会用部署记录中的环境变量快照覆盖项目级配置，实测发现 `plain_text` 类型变量在部署后会被清空，而 `secret_text` 类型能正确保留。面板在触发部署前会保存环境变量快照，部署完成后自动恢复（统一为 `secret_text` 类型），确保不丢失。

前提条件：
1. Pages 项目已连接 GitHub 仓库
2. 已配置 `GH_TOKEN` 环境变量（GitHub Token，需 repo 权限）

如果项目未连接 GitHub 仓库，将回退到 ad_hoc 部署方式，同样在部署完成后自动恢复环境变量配置。

