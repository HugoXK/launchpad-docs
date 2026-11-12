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
const SLUGS = ['index', 'architecture', 'modules', 'lifecycle', 'github', 'security', 'deployment', 'analysis', 'snapshot'];
const LABELS = {
  zh: { index: '概览', architecture: '架构', modules: '代码地图', lifecycle: '生命周期', github: 'GitHub 集成', security: '安全模型', deployment: '部署与运维', analysis: '独立分析', snapshot: '源快照' },
  en: { index: 'Overview', architecture: 'Architecture', modules: 'Code map', lifecycle: 'Lifecycle', github: 'GitHub integration', security: 'Security', deployment: 'Deployment', analysis: 'Analysis', snapshot: 'Source snapshot' },
};
const GROUPS = [
  ['Overview', ['index']],
  ['Understand', ['architecture', 'modules', 'lifecycle', 'github']],
  ['Operate', ['security', 'deployment']],
  ['Analysis', ['analysis', 'snapshot']],
];
const T = {
  zh: { home: '文档首页', docs: '文档', upstream: '上游文档', other: 'EN', app: '打开 LaunchPad', source: '源仓库', edit: '在 GitHub 上编辑', mirrored: '镜像自', generated: '本页在构建时生成', updated: '每日自动更新' },
  en: { home: 'Docs home', docs: 'Docs', upstream: 'Upstream docs', other: '中文', app: 'Open LaunchPad', source: 'Source', edit: 'Edit on GitHub', mirrored: 'Mirrored from', generated: 'Generated at build time', updated: 'Updated daily' },
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
  const sections = GROUPS.map(([group, slugs]) => {
    const items = slugs.filter((slug) => SLUGS.includes(slug)).map((slug) => {
      const on = slug === current ? ' class="on"' : '';
      return `<a${on} href="${urls(lang, slug)}">${esc(LABELS[lang][slug])}</a>`;
    }).join('');
    return items ? `<h2>${group}</h2>${items}` : '';
  }).join('');
  return { other, html: `${sections}<h2>${esc(t.upstream)}</h2><a href="/upstream/">${esc(t.upstream)} ↗</a>` };
}

function page({ lang, current, title, body, upstream = false }) {
  const t = T[lang];
  const n = nav(lang, current);
  if (upstream) n.other = lang === 'zh' ? '/en/' : '/';
  const brandHome = lang === 'zh' ? '/' : '/en/';
  const upstreamNav = upstream ? `<div class="docs-note">${esc(t.mirrored)} <a href="${GH}">HugoXK/LaunchPad</a> · <a href="${UPSTREAM}">upstream</a></div>` : '';
  return `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — LaunchPad Docs</title><meta name="description" content="LaunchPad documentation and independent analysis of agent-CI-Infra/bot."><meta name="theme-color" content="#080a0f">
<link rel="icon" href="/assets/images/logo.svg"><link rel="stylesheet" href="/assets/docs.css"><link rel="stylesheet" href="/assets/extra.css"></head><body>
<header class="site-header"><a class="brand" href="${brandHome}"><span class="brand-mark">L</span> HUGOXK <small>LAB / LAUNCHPAD DOCS</small></a>
<nav class="nav"><a href="${brandHome}">${esc(t.home)}</a><a href="${n.other}">${esc(t.other)}</a><a href="/upstream/">${esc(t.upstream)}</a><a href="${APP}">${esc(t.app)} ↗</a><a href="${GH}">GitHub ↗</a></nav></header>
<div class="docs-shell"><aside class="docs-nav"><h2>LaunchPad</h2>${n.html}<div class="app"><a href="${APP}">${esc(t.app)} ↗</a><a href="${GH}">${esc(t.source)} ↗</a></div></aside><main class="docs-main">${upstreamNav}${body}</main></div>
<footer class="docs-footer"><span>© 2026 HUGOXK // LAB · LAUNCHPAD DOCS</span><div><a href="${brandHome}">${esc(t.home)}</a><a href="${APP}">${esc(t.app)}</a><a href="${GH}">GitHub</a><a href="${UPSTREAM}">Upstream</a></div></footer></body></html>`;
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
- 上游文档：${docs.length} 篇

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
- upstream docs: ${docs.length} pages

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
  const body = `${edit}${marked.parse(rewriteDocLinks(md, lang))}`;
  writeFileSync(join(outDir, 'index.html'), page({ lang, current: slug, title, body }));
}

function upstreamSlug(path) {
  if (path === 'README.md') return '';
  return path.replace(/^docs\//, '').replace(/\.md$/, '').replace(/^README$/, '');
}
function upstreamUrl(path) {
  const slug = upstreamSlug(path);
  return slug ? `/upstream/${slug}/` : '/upstream/';
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
    if (/^(docs\/)?images\//.test(resolved)) return `](${resolved.replace(/^docs\//, '/assets/upstream/')}${hash}${title})`;
    if (map.has(resolved)) return `](${map.get(resolved)}${hash}${title})`;
    return `](${GH}/blob/main/${resolved}${hash}${title})`;
  });
  for (const path of files) {
    const md = read(join(ORIGIN, path));
    const title = titleOf(md, path.split('/').pop().replace(/\.md$/, ''));
    const slug = upstreamSlug(path);
    const outDir = join(OUT, 'upstream', slug);
    mkdirSync(outDir, { recursive: true });
    const body = `<p class="mut" style="margin-bottom:18px">${esc(T.zh.mirrored)} <a href="${GH}@${sha}">HugoXK/LaunchPad@${sha}</a> · <a href="${UPSTREAM}">upstream</a> · <a href="${GH}/blob/main/${path}">${esc(T.zh.edit)} ${esc(path)} ↗</a></p>${marked.parse(rewrite(md, path))}`;
    writeFileSync(join(outDir, 'index.html'), page({ lang: 'zh', current: 'upstream', title, body, upstream: true }));
  }
  // The upstream landing lists every mirrored page.
  const cards = files.map((path) => `<a class="docs-card" href="${upstreamUrl(path)}"><b>${esc(titleOf(read(join(ORIGIN, path)), path))}</b><span>${esc(path)}</span><em>READ ↗</em></a>`).join('');
  const body = `<span class="kicker">UPSTREAM · ${esc(sha)}</span><h1>上游文档</h1>
<p class="lead">这些页面在每次构建时从 <a href="${GH}">HugoXK/LaunchPad</a>（<code>agent-CI-Infra/bot</code> 的 origin）的 <code>docs/</code> 复制并渲染；不在这里锁定版本。</p>
<div class="docs-cards">${cards}</div>
<p class="mut">${esc(T.zh.updated)} · ${files.length} 篇 · ${esc(T.zh.generated)}</p>`;
  writeFileSync(join(OUT, 'upstream', 'index.html'), page({ lang: 'zh', current: 'upstream', title: '上游文档', body, upstream: true }));
  if (existsSync(join(ORIGIN, 'docs/images'))) cpSync(join(ORIGIN, 'docs/images'), join(OUT, 'assets', 'upstream'), { recursive: true });
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
cpSync(join(ROOT, 'assets', 'extra.css'), join(OUT, 'assets', 'extra.css'));
cpSync(join(ROOT, 'assets', 'images'), join(OUT, 'assets', 'images'), { recursive: true });
const upstreamCount = buildUpstream();
console.log(`built ${SLUGS.length * 2} independent pages + ${upstreamCount} upstream pages into ${OUT}`);
