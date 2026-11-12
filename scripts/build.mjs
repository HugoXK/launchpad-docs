import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { marked } from 'marked';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const OUT = join(ROOT, 'site');
const ORDER = ['index', 'architecture', 'modules', 'lifecycle', 'github', 'security', 'deployment', 'analysis'];
const LABELS = {
  index: '概览',
  architecture: '架构',
  modules: '代码地图',
  lifecycle: '生命周期',
  github: 'GitHub 集成',
  security: '安全模型',
  deployment: '部署与运维',
  analysis: '独立分析',
};

function titleOf(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function rewriteLinks(html) {
  return html
    .replace(/href="(?:\.\/)?docs\/([a-z0-9-]+)\.md(#[^"]*)?"/g, (_, slug, hash) => `href="../${slug}/${hash || ''}"`)
    .replace(/href="([a-z0-9-]+)\.md(#[^"]*)?"/g, (_, slug, hash) => `href="../${slug}/${hash || ''}"`)
    .replace(/href="index\.md(#[^"]*)?"/g, () => `href="../${hash || ''}"`);
}

function page({ title, body, current, description }) {
  const nav = ORDER.map(slug => {
    const cls = slug === current ? ' class="active"' : '';
    return `<a${cls} href="${slug === 'index' ? '../' : `../${slug}/`}">${LABELS[slug]}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — LaunchPad 文档</title>
<meta name="description" content="${description || 'LaunchPad (agent-CI-Infra/bot) 深度分析与文档'}">
<meta name="theme-color" content="#0b0e14">
<link rel="stylesheet" href="../assets/docs.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="../"><span class="brand-mark">L</span> LAUNCHPAD <small>DOCS</small></a>
  <nav class="top"><a href="https://launchpad.hugoxk.online">服务</a><a href="https://github.com/agent-CI-Infra/bot">上游仓库</a><a href="https://github.com/HugoXK/launchpad-docs">本文档源</a></nav>
</header>
<div class="shell">
  <aside class="side"><h2>文档</h2>${nav}</aside>
  <main class="main">${body}</main>
</div>
<footer class="site-footer"><span>© 2026 HUGOXK LAB · LAUNCHPAD DOCS</span><span>基线 main@95231e8 · Apache-2.0 upstream</span></footer>
</body>
</html>`;
}

const files = ORDER.filter(slug => existsSync(join(DOCS, `${slug}.md`)));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

for (const slug of files) {
  const md = readFileSync(join(DOCS, `${slug}.md`), 'utf8');
  const title = titleOf(md, LABELS[slug] || slug);
  let html = marked.parse(md);
  html = rewriteLinks(html);
  const outDir = slug === 'index' ? join(OUT, 'docs') : join(OUT, 'docs', slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), page({ title, body: html, current: slug }));
  if (slug === 'index') {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./docs/"><title>LaunchPad 文档</title></head><body><a href="./docs/">LaunchPad 文档</a></body></html>`);
  }
}

cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
console.log(`built ${files.length} pages into ${OUT}`);
