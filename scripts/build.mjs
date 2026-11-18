import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT_DIR || join(ROOT, 'site');
const ORIGIN = process.env.LAUNCHPAD_DIR || '';
const APP = 'https://launchpad.hugoxk.online';
const GH = 'https://github.com/HugoXK/LaunchPad';
const DOCS_GH = 'https://github.com/HugoXK/launchpad-docs';
const UPSTREAM = 'https://github.com/agent-CI-Infra/bot';
const SLUGS = ['index', 'architecture', 'modules', 'lifecycle', 'github', 'security', 'deployment', 'analysis', 'deep-dive', 'deepwiki', 'snapshot'];
const LABELS = {
  zh: { index: '概览', architecture: '架构', modules: '代码地图', lifecycle: '生命周期', github: 'GitHub 集成', security: '安全模型', deployment: '部署与运维', analysis: '独立分析', 'deep-dive': '深入实现', deepwiki: '问 DeepWiki', snapshot: '源快照' },
  en: { index: 'Overview', architecture: 'Architecture', modules: 'Code map', lifecycle: 'Lifecycle', github: 'GitHub integration', security: 'Security', deployment: 'Deployment', analysis: 'Analysis', 'deep-dive': 'Deep dive', deepwiki: 'Ask DeepWiki', snapshot: 'Source snapshot' },
};
const GROUPS = [
  { en: 'Overview', zh: '概览', slugs: ['index'] },
  { en: 'Understand', zh: '理解', slugs: ['architecture', 'modules', 'lifecycle', 'github'] },
  { en: 'Operate', zh: '运维', slugs: ['security', 'deployment'] },
  { en: 'Internals', zh: '内部实现', slugs: ['deep-dive'] },
  { en: 'Analysis', zh: '分析', slugs: ['analysis', 'deepwiki', 'snapshot'] },
];
const HOME_START = [
  ['index', 'What LaunchPad is, in one page.', '一页看懂 LaunchPad。'],
  ['lifecycle', 'How an event becomes a task and a delivery.', '事件如何变成任务与交付。'],
  ['architecture', 'Dispatch, the project manager, the runtime.', '派发、项目 Manager 与运行时。'],
  ['security', 'Roles, credentials, containers and authority.', '角色、凭据、容器与权限。'],
  ['deployment', 'The host, the compose stack and the ports.', '宿主、compose 与端口。'],
  ['deep-dive', 'The DeepWiki map in one page.', '一页看懂 DeepWiki 地图。'],
  ['deepwiki', 'Ask the upstream codebase.', '向上游代码库提问。'],
];
const T = {
  zh: { home: '文档首页', docs: '文档', upstream: 'Origin 文档', other: 'EN', app: '打开 LaunchPad', source: '源仓库', edit: '在 GitHub 上编辑', mirrored: '镜像自', generated: '本页在构建时生成', updated: '每日自动更新' },
  en: { home: 'Docs home', docs: 'Docs', upstream: 'Origin docs', other: '中文', app: 'Open LaunchPad', source: 'Source', edit: 'Edit on GitHub', mirrored: 'Mirrored from', generated: 'Generated at build time', updated: 'Updated daily' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (p) => readFileSync(p, 'utf8');
const titleOf = (md, fallback) => (md.match(/^#\s+(.+)$/m)?.[1] || fallback).replace(/[*_`]/g, '').trim();
const git = (args) => { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return ''; } };

function urls(lang, slug) {
  if (lang === 'zh') return slug === 'index' ? '/' : `/docs/${slug}/`;
  return slug === 'index' ? '/en/' : `/en/docs/${slug}/`;
}

function rewriteDocLinks(html, lang) {
  return html.replace(/href="(?:\.\/)?(?:docs\/)?([a-z0-9-]+)\.md(#[^"]*)?"/g, (_, slug, hash = '') => {
    if (!SLUGS.includes(slug)) return `href="${GH}/blob/main/docs/${slug}.md${hash}"`;
    return `href="${urls(lang, slug)}${hash}"`;
  });
}

function nav(lang, current) {
  const t = T[lang];
  const other = current === 'index' ? urls(lang === 'zh' ? 'en' : 'zh', 'index') : urls(lang === 'zh' ? 'en' : 'zh', current);
  const sections = GROUPS.map(({ en, zh, slugs }) => {
    const items = slugs.filter((slug) => SLUGS.includes(slug)).map((slug) => {
      const on = slug === current ? ' class="on"' : '';
      return `<a${on} href="${urls(lang, slug)}">${esc(LABELS[lang][slug])}</a>`;
    }).join('');
    return items ? `<h2>${lang === 'zh' ? zh : en}</h2>${items}` : '';
  }).join('');
  return { other, html: `${sections}<h2>${esc(t.upstream)}</h2><a href="/origin/">${esc(t.upstream)} ↗</a>` };
}

function deepwikiSection(lang) {
  const zh = lang === 'zh';
  const guide = urls(lang, 'deepwiki');
  return `<section class="ask-dw" id="ask">
<span class="ask-dw-label">${zh ? '向代码库提问' : 'ASK THE CODEBASE'} <span>· DEEPWIKI</span></span>
<h2>${zh ? '有问题？<em>问 DeepWiki。</em>' : 'Questions?<br><em>Ask DeepWiki.</em>'}</h2>
<p>${zh ? 'DeepWiki 索引 LaunchPad 背后的上游，回答时给出源码链接。用右下角的 <strong>问 DeepWiki</strong> 按钮在这里对话，或打开页面浏览。同一个 MCP 服务器也能接进 Claude Code、Codex、OpenCode 或 DeepSeek Harness。' : 'DeepWiki indexes the upstream behind LaunchPad and answers with links to the source. Use the <strong>Ask DeepWiki</strong> button in the bottom-right corner to chat here, or open the page to browse. The same MCP server works inside Claude Code, Codex, OpenCode or DeepSeek Harness.'}</p>
<div class="ask-dw-actions">
<a class="btn primary" href="https://deepwiki.com/agent-CI-Infra/bot" target="_blank" rel="noopener" data-deepwiki-open>${zh ? '问 DeepWiki' : 'Ask DeepWiki'} <span>↗</span></a>
<code>claude mcp add -s user -t http deepwiki https://mcp.deepwiki.com/mcp</code>
<small>${zh ? '接入说明' : 'Setup guide'}: <a href="${guide}">${zh ? 'DeepWiki 指南' : 'the DeepWiki guide'} ↗</a></small>
</div>
</section>`;
}

function homeHero(lang, lead) {
  const zh = lang === 'zh';
  return `<section class="home-hero">
  <div class="home-hero-copy">
    <div class="home-eyebrow"><span class="home-dot"></span>${zh ? 'AGENT-CI-INFRA / LAUNCHPAD' : 'AGENT-CI-INFRA / LAUNCHPAD'}</div>
    <h1>${zh ? '一个仓库。<br><em>一台虚拟电脑。</em>' : 'One repo.<br><em>One virtual computer.</em>'}</h1>
    <p>${marked.parseInline(lead)}</p>
    <div class="home-ctas"><a class="btn primary" href="${urls(lang, 'lifecycle')}">${zh ? '跟一个任务' : 'Follow a task'} <span>↗</span></a><a class="btn ghost" href="${urls(lang, 'architecture')}">${zh ? '看架构' : 'See the architecture'} <span>↓</span></a></div>
    <div class="home-command"><span>→</span><code>${APP}/</code><a href="${APP}/" target="_blank" rel="noopener">${zh ? '打开' : 'Open'} ↗</a></div>
  </div>
  <div class="home-orbit" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="orbit-center">L</div><div class="orbit-note note-one">${zh ? '派发' : 'dispatch'} <b>01</b></div><div class="orbit-note note-two">${zh ? '角色运行' : 'role run'} <b>02</b></div><div class="orbit-note note-three">${zh ? '发布' : 'publish'} <b>03</b></div></div>
</section>`;
}

function homeProof(lang) {
  const zh = lang === 'zh';
  const items = zh
    ? [['01', '每个仓库一台项目电脑'], ['02', '角色池与不可变快照'], ['03', '独立的管理平面']]
    : [['01', 'One project computer per repository'], ['02', 'A role pool with immutable snapshots'], ['03', 'A separate management plane']];
  return `<section class="home-proof"><span>${zh ? 'LAUNCHPAD 一览' : 'LAUNCHPAD AT A GLANCE'}</span>${items.map(([n, text]) => `<div><b>${n}</b>${esc(text)}</div>`).join('')}</section>`;
}

function homeHow(lang) {
  const zh = lang === 'zh';
  const steps = zh
    ? [['01', '派发', '事件被过滤并记录。'], ['02', '决定', 'Manager 创建、继续或忽略。'], ['03', '运行', '角色在项目电脑里运行。'], ['04', '验证', '独立 QA 检查候选。'], ['05', '发布', '现有 publisher 交付。'], ['06', '治理', '管理平面使用自己的授权。']]
    : [['01', 'Dispatch', 'An event is filtered and recorded.'], ['02', 'Decide', 'The Manager creates, continues or ignores.'], ['03', 'Run', 'A role runs in the project computer.'], ['04', 'Prove', 'Independent QA inspects the candidate.'], ['05', 'Publish', 'The existing publisher opens the delivery.'], ['06', 'Govern', 'The management plane uses its own authority.']];
  return `<section class="home-section"><div class="section-label">${zh ? '它怎么工作' : 'HOW IT WORKS'} <span>01 / 03</span></div><h2>${zh ? '从一个事件<br><em>到一次交付。</em>' : 'From one event<br><em>to one delivery.</em>'}</h2><p>${zh ? '控制平面过滤事件、让 Manager 做决定，任务引擎在项目电脑里运行角色，独立 QA 验证候选，然后进入既有发布路径。' : 'The control plane filters events and lets the Manager decide; the task engine runs roles in the project computer; independent QA verifies the candidate before the existing publisher path.'}</p><div class="home-process">${steps.map(([n, title, text]) => `<div><span>${n}</span><strong>${esc(title)}</strong><small>${esc(text)}</small></div>`).join('')}</div></section>`;
}

function homeStart(lang) {
  const zh = lang === 'zh';
  const cards = HOME_START.map(([slug, en, zhText]) => {
    const title = LABELS[lang][slug];
    return `<a class="home-card" href="${urls(lang, slug)}"><b>${esc(title)}</b><span>${esc(zh ? zhText : en)}</span><em>${zh ? '阅读' : 'Read'} ↗</em></a>`;
  }).join('');
  return `<section class="home-section"><div class="section-label">${zh ? '从这里开始' : 'START HERE'} <span>02 / 03</span></div><h2>${zh ? '选一条<br><em>进入系统的路径。</em>' : 'Pick a path<br><em>into the system.</em>'}</h2><div class="home-cards">${cards}</div></section>`;
}

function homeCta(lang) {
  const zh = lang === 'zh';
  return `<section class="home-cta"><div><span class="section-label">${zh ? '准备好了就开始' : 'READY WHEN YOU ARE'}</span><h2>${zh ? '从一个任务开始。' : 'Start with a task.'}</h2><p>${zh ? '跟着一个事件，看它如何变成任务、候选和交付。' : 'Follow one event as it becomes a task, a candidate and a delivery.'}</p></div><a class="btn primary" href="${urls(lang, 'lifecycle')}">${zh ? '看任务生命周期' : 'Follow the lifecycle'} <span>↗</span></a></section>`;
}

function page({ lang, current, title, body, upstream = false }) {
  const t = T[lang];
  const n = nav(lang, current);
  if (upstream) n.other = lang === 'zh' ? '/en/' : '/';
  const brandHome = lang === 'zh' ? '/' : '/en/';
  const themeLabel = lang === 'zh' ? '切换主题' : 'Switch theme';
  const guide = urls(lang, 'deepwiki');
  const upstreamNav = upstream ? `<div class="docs-note">${esc(t.mirrored)} <a href="${GH}">HugoXK/LaunchPad</a> · <a href="${UPSTREAM}">upstream</a></div>` : '';
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — LaunchPad Docs</title>
<meta name="description" content="LaunchPad documentation and independent analysis of agent-CI-Infra/bot.">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#070b14" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f5f7fb" media="(prefers-color-scheme: light)">
<link rel="icon" href="/assets/images/logo.svg">
<script>try{var t=localStorage.getItem('launchpad-docs-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
<script>window.LAUNCHPAD_DOCS={lang:"${lang === 'zh' ? 'zh' : 'en'}",guide:"${guide}"};</script>
<link rel="stylesheet" href="/assets/docs.css">
<link rel="stylesheet" href="/assets/extra.css">
<link rel="stylesheet" href="/assets/deepwiki.css">
<script defer src="/assets/docs.js"></script>
<script defer src="/assets/deepwiki.js"></script>
</head>
<body${current === 'index' ? ' class="docs-home"' : ''}>
<a class="skip-link" href="#main">${lang === 'zh' ? '跳到正文' : 'Skip to main content'}</a>
<header class="site-header">
  <a class="brand" href="${brandHome}"><span class="brand-mark">L</span><span>LaunchPad <small>Docs</small></span></a>
  <div class="header-actions">
    <nav class="nav" aria-label="${lang === 'zh' ? '文档导航' : 'Docs navigation'}">
      <a href="${brandHome}">${esc(t.home)}</a>
      <a href="${n.other}">${esc(t.other)}</a>
      <a href="/origin/">${esc(t.upstream)}</a>
      <a href="${APP}">${esc(t.app)} ↗</a>
      <a class="nav-ask" href="https://deepwiki.com/agent-CI-Infra/bot" target="_blank" rel="noopener">DeepWiki ↗</a>
      <a href="${GH}">GitHub ↗</a>
    </nav>
    <button class="theme-toggle" type="button" data-docs-theme aria-label="${themeLabel}" title="${themeLabel}">
      <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 15.2A8.4 8.4 0 0 1 8.8 4a8.4 8.4 0 1 0 11.2 11.2Z"/></svg>
      <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
  </div>
</header>
<div class="docs-shell">
  <aside class="docs-nav" aria-label="${lang === 'zh' ? 'LaunchPad 文档' : 'LaunchPad documentation'}"><h2>LaunchPad</h2>${n.html}<div class="app"><a href="${APP}">${esc(t.app)} ↗</a><a href="${GH}">${esc(t.source)} ↗</a><a href="https://deepwiki.com/agent-CI-Infra/bot" target="_blank" rel="noopener">DeepWiki ↗</a></div></aside>
  <main class="docs-main" id="main">${upstreamNav}${body}</main>
</div>
<footer class="docs-footer"><span>© 2026 HUGOXK // LAB · LAUNCHPAD DOCS</span><div><a href="${brandHome}">${esc(t.home)}</a><a href="${APP}">${esc(t.app)}</a><a href="${GH}">GitHub</a><a href="${UPSTREAM}">Upstream</a><a href="https://deepwiki.com/agent-CI-Infra/bot" target="_blank" rel="noopener">DeepWiki</a></div></footer>
</body></html>`;
}

function snapshotMarkdown(lang) {
  const zh = lang === 'zh';
  if (!ORIGIN || !existsSync(join(ORIGIN, '.git'))) {
    return `# ${zh ? '源快照' : 'Source snapshot'}\n\n${zh ? '构建时没有找到 origin 检出（`LAUNCHPAD_DIR`）。' : 'No origin checkout (`LAUNCHPAD_DIR`) was found at build time.'}\n`;
  }
  const sha = git(['-C', ORIGIN, 'rev-parse', '--short', 'HEAD']) || 'unknown';
  const full = git(['-C', ORIGIN, 'rev-parse', 'HEAD']) || 'unknown';
  const date = git(['-C', ORIGIN, 'log', '-1', '--format=%cI']) || 'unknown';
  const behind = git(['-C', ORIGIN, 'rev-list', '--count', 'HEAD..upstream/main']) || 'n/a';
  const remote = git(['-C', ORIGIN, 'remote', 'get-url', 'origin']) || '';
  let files = 0, lines = 0;
  try {
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) { files++; lines += read(p).split('\n').length; }
      }
    };
    walk(join(ORIGIN, 'src'));
  } catch {}
  let deps = 0, node = '';
  try {
    const pkg = JSON.parse(read(join(ORIGIN, 'package.json')));
    deps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
    node = pkg.engines?.node || '';
  } catch {}
  let services = [];
  try {
    const compose = read(join(ORIGIN, 'compose.yaml'));
    const block = compose.split(/^services:\s*$/m)[1]?.split(/^[a-z]+:\s*$/m)[0] || '';
    services = [...block.matchAll(/^  ([a-z0-9-]+):\s*$/gm)].map((m) => m[1]);
  } catch {}
  const docs = existsSync(join(ORIGIN, 'docs')) ? readdirSync(join(ORIGIN, 'docs')).filter((f) => f.endsWith('.md')).sort() : [];
  if (zh) {
    return `# 源快照

**构建时读取的 origin**：\`HugoXK/LaunchPad@${sha}\`（${date}）。
- origin remote：\`${esc(remote)}\`
- upstream：\`agent-CI-Infra/bot\`；origin 落后 upstream \`${behind}\` 个提交（构建时）
- 源码：\`src/\` 下 ${files} 个 TypeScript 文件，约 ${lines.toLocaleString()} 行
- 依赖：${deps} 个（package.json）；Node ${esc(node)}
- Compose 服务：${services.map((s) => `\`${s}\``).join('、') || '未读取到'}
- origin 文档：${docs.length} 篇

> 这一页每天构建时重新生成，所以 origin 的提交、源码规模和服务清单会随上游变化。
> 完整提交：\`${full}\`
`;
  }
  return `# Source snapshot

**Origin read at build time**: \`HugoXK/LaunchPad@${sha}\` (${date}).
- origin remote: \`${esc(remote)}\`
- upstream: \`agent-CI-Infra/bot\`; origin is \`${behind}\` commits behind upstream at build time
- source: ${files} TypeScript files under \`src/\`, about ${lines.toLocaleString()} lines
- dependencies: ${deps} in package.json; Node ${esc(node)}
- Compose services: ${services.map((s) => `\`${s}\``).join(', ') || 'not read'}
- origin docs: ${docs.length} pages

> This page is regenerated on every daily build, so the origin commit, source size and service list follow upstream.
> Full commit: \`${full}\`
`;
}

function writeDoc(lang, slug, md, title) {
  const url = urls(lang, slug);
  const outDir = slug === 'index'
    ? join(OUT, lang === 'zh' ? '' : 'en')
    : join(OUT, lang === 'zh' ? 'docs' : 'en/docs', slug);
  mkdirSync(outDir, { recursive: true });
  const edit = slug === 'snapshot' ? '' : `<p class="mut" style="margin-bottom:18px"><a href="${DOCS_GH}/blob/main/docs/${lang}/${slug}.md">${esc(T[lang].edit)} docs/${lang}/${slug}.md ↗</a></p>`;
  const rewritten = rewriteDocLinks(md, lang);
  if (slug === 'index') {
    const cut = rewritten.indexOf('\n## ');
    const intro = cut === -1 ? rewritten : rewritten.slice(0, cut);
    const rest = cut === -1 ? '' : rewritten.slice(cut + 1);
    const lead = intro.replace(/^#\s+[^\n]*\n+/, '').trim();
    const body = `<div class="home">${homeHero(lang, lead)}${homeProof(lang)}${homeHow(lang)}${homeStart(lang)}<section class="home-markdown">${edit}${marked.parse(rest)}</section>${deepwikiSection(lang)}${homeCta(lang)}</div>`;
    writeFileSync(join(outDir, 'index.html'), page({ lang, current: slug, title, body }));
  } else {
    const body = `${edit}${marked.parse(rewritten)}`;
    writeFileSync(join(outDir, 'index.html'), page({ lang, current: slug, title, body }));
  }
}

function upstreamSlug(path) {
  if (path === 'README.md') return '';
  return path.replace(/^docs\//, '').replace(/\.md$/, '').replace(/^README$/, '');
}
function upstreamUrl(path) {
  const slug = upstreamSlug(path);
  return slug ? `/origin/${slug}/` : '/origin/';
}

function buildUpstream() {
  if (!ORIGIN || !existsSync(join(ORIGIN, 'docs'))) return 0;
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.md')) files.push('docs/' + relative(join(ORIGIN, 'docs'), p).split(sep).join('/'));
    }
  };
  walk(join(ORIGIN, 'docs'));
  if (existsSync(join(ORIGIN, 'README.md'))) files.unshift('README.md');
  const map = new Map(files.map((p) => [p, upstreamUrl(p)]));
  const sha = git(['-C', ORIGIN, 'rev-parse', '--short', 'HEAD']) || 'unknown';
  const rewrite = (md, path) => md.replace(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (match, target, title = '') => {
    if (/^(https?:|mailto:|#)/.test(target)) return match;
    const at = target.indexOf('#'), hash = at === -1 ? '' : target.slice(at), raw = at === -1 ? target : target.slice(0, at);
    if (!raw) return match;
    let resolved = posix.normalize(posix.join(posix.dirname(path), raw)).replace(/^\.\//, '');
    if (/^(docs\/)?images\//.test(resolved)) return `](${resolved.replace(/^docs\//, '/assets/origin/')}${hash}${title})`;
    if (map.has(resolved)) return `](${map.get(resolved)}${hash}${title})`;
    return `](${GH}/blob/main/${resolved}${hash}${title})`;
  });
  for (const path of files) {
    const md = read(join(ORIGIN, path));
    const title = titleOf(md, path.split('/').pop().replace(/\.md$/, ''));
    const slug = upstreamSlug(path);
    const outDir = join(OUT, 'origin', slug);
    mkdirSync(outDir, { recursive: true });
    const body = `<p class="mut" style="margin-bottom:18px">${esc(T.zh.mirrored)} <a href="${GH}@${sha}">HugoXK/LaunchPad@${sha}</a> · <a href="${UPSTREAM}">upstream</a> · <a href="${GH}/blob/main/${path}">${esc(T.zh.edit)} ${esc(path)} ↗</a></p>${marked.parse(rewrite(md, path))}`;
    writeFileSync(join(outDir, 'index.html'), page({ lang: 'zh', current: 'upstream', title, body, upstream: true }));
  }
  // The upstream landing lists every mirrored page.
  const cards = files.map((path) => `<a class="docs-card" href="${upstreamUrl(path)}"><b>${esc(titleOf(read(join(ORIGIN, path)), path))}</b><span>${esc(path)}</span><em>READ ↗</em></a>`).join('');
  const body = `<span class="kicker">ORIGIN · ${esc(sha)}</span><h1>Origin 文档</h1>
<p class="lead">这些页面在每次构建时从 <a href="${GH}">HugoXK/LaunchPad</a>（<code>agent-CI-Infra/bot</code> 的 origin fork）的 <code>docs/</code> 复制并渲染；不在这里锁定版本。</p>
<div class="docs-cards">${cards}</div>
<p class="mut">${esc(T.zh.updated)} · ${files.length} 篇 · ${esc(T.zh.generated)}</p>`;
  writeFileSync(join(OUT, 'origin', 'index.html'), page({ lang: 'zh', current: 'upstream', title: 'Origin 文档', body, upstream: true }));
  if (existsSync(join(ORIGIN, 'docs/images'))) cpSync(join(ORIGIN, 'docs/images'), join(OUT, 'assets', 'origin'), { recursive: true });
  return files.length;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'images'), { recursive: true });
for (const lang of ['zh', 'en']) {
  for (const slug of SLUGS) {
    const md = slug === 'snapshot' ? snapshotMarkdown(lang) : (existsSync(join(ROOT, 'docs', lang, `${slug}.md`)) ? read(join(ROOT, 'docs', lang, `${slug}.md`)) : '');
    if (!md) continue;
    writeDoc(lang, slug, md, titleOf(md, LABELS[lang][slug]));
  }
}
cpSync(join(ROOT, 'assets', 'docs.css'), join(OUT, 'assets', 'docs.css'));
cpSync(join(ROOT, 'assets', 'docs.js'), join(OUT, 'assets', 'docs.js'));
cpSync(join(ROOT, 'assets', 'deepwiki.css'), join(OUT, 'assets', 'deepwiki.css'));
cpSync(join(ROOT, 'assets', 'deepwiki.js'), join(OUT, 'assets', 'deepwiki.js'));
cpSync(join(ROOT, 'assets', 'extra.css'), join(OUT, 'assets', 'extra.css'));
cpSync(join(ROOT, 'assets', 'images'), join(OUT, 'assets', 'images'), { recursive: true });
const upstreamCount = buildUpstream();
console.log(`built ${SLUGS.length * 2} independent pages + ${upstreamCount} origin pages into ${OUT}`);
