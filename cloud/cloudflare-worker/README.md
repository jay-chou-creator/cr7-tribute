# Cloudflare Worker：CR7 实时数据抓取 + API

数据源 `ronaldostats.app` 不提供公开 API，浏览器直连也会有 CORS 问题。
这个 Worker 做三件事：

1. **定时抓取**：Cloudflare Cron Triggers 每 6 小时抓一次数据源，解析 + 校验后写入 Workers KV；
2. **提供接口**：`GET /api/cr7-stats` 直接读 KV 返回 JSON（毫秒级，不依赖源站可用性）；
3. **失败可观测**：抓取失败不覆盖旧数据，只把错误写进 KV 的 `lastError`，健康检查里一眼看到。

```text
ronaldostats.app ──(cron 每 6h)──▶ Worker ──▶ Workers KV ──▶ /api/cr7-stats ──▶ 浏览器
                                                                    ▲
                         GitHub Actions（每天 1 次，兜底）──▶ data/live-stats.json
```

## 为什么把定时从 GitHub Actions 搬到这里

2026-09-05 起 GitHub 侧定时任务连续失败，原因是数据源改版了 JSON-LD 文案，
旧脚本里唯一那条正则匹配不上。两个隐患一起暴露：

- GitHub 会在仓库连续 60 天无活动后**自动停用 schedule 事件**；
- 旧脚本是「一条正则 + 硬失败」的设计，一失败就整体崩掉，数据停在旧值。

现在的对策：定时放在 Cloudflare（不会被停用），解析改成多策略 + 三重校验
（范围 / 交叉 / 单调），任何一处文案变化只影响一个字段；校验不过就保留上一次的好数据，
绝不把脏数据推上线。

## 目录

```text
src/parser.js            纯函数解析器（Node 里可直接测试）
src/worker.js            scheduled() 定时抓取 + fetch() 接口
test/parser.test.mjs     解析器离线测试（21 项）
test/worker.test.mjs     Worker 路由测试（19 项，mock fetch + KV）
wrangler.toml            Cron、KV 绑定、环境变量
```

## 本地测试

```bash
node test/parser.test.mjs
node test/worker.test.mjs
```

两个测试都不需要网络，也不需要 wrangler。

## 部署

```bash
cd cloud/cloudflare-worker
npm i -D wrangler

# 1. 登录
npx wrangler login

# 2. 创建 KV 命名空间，把返回的 id 填进 wrangler.toml 的 [[kv_namespaces]].id
npx wrangler kv namespace create STATS_KV

# 3. 设置手动刷新口令（不要写进配置文件）
npx wrangler secret put REFRESH_TOKEN

# 4. 部署（会同时注册 Cron Triggers）
npx wrangler deploy
```

部署完成后验证：

```bash
curl https://cr7-tribute-stats.<你的子域名>.workers.dev/api/cr7-stats
curl https://cr7-tribute-stats.<你的子域名>.workers.dev/api/cr7-stats/health
```

也可以在 Cloudflare 控制台手动运行一次：
**Workers & Pages → cr7-tribute-stats → 触发器 → Cron → 立即运行**。

## 接口

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/cr7-stats` | GET | 返回最新数据；KV 为空时按需抓一次；源站故障也不返回 5xx |
| `/api/cr7-stats` | POST | 强制刷新，需要 `x-refresh-token` 头或 `?token=`，口令来自 `REFRESH_TOKEN` secret |
| `/api/cr7-stats/health` | GET | 最近一次运行结果、最近一次错误、当前缓存的数据 |
| `/` | GET | 服务信息 |

## KV 键

| 键 | 内容 |
| --- | --- |
| `latest` | 最新一份通过校验的数据 |
| `lastRun` | 最近一次运行时间与结果 |
| `lastError` | 最近一次失败原因（成功时清空） |

## 数据契约

```json
{
  "goals": 978, "apps": 1334, "assists": 291, "trophies": 35,
  "clubGoals": 832, "clubApps": 1101, "ntGoals": 146, "ntApps": 233,
  "updatedAt": "2026-09-07",
  "fetchedAt": "2026-09-07T11:10:02Z",
  "source": "ronaldostats.app · 人工逐场核对 · ..."
}
```

`js/data.js` 里的 `LIVE_DATA.baseline` 需要和这份数据保持一致（离线兜底值）。

## 接入前端

站点部署在 Cloudflare Pages 时，`functions/api/cr7-stats.js` 就是同源的 `/api/cr7-stats`，
无需改任何前端代码。若站点仍托管在 GitHub Pages，可在 `js/data.js` 里把第一个端点
换成 Worker 的完整地址：

```js
const LIVE_DATA = {
  endpoints: [
    "https://cr7-tribute-stats.<你的子域名>.workers.dev/api/cr7-stats",
    "data/live-stats.json"
  ],
  ...
};
```
