// 生成可以直接打包进手机 App（如 Capacitor 的 webDir）的静态目录 dist/：
//   public/ 下的全部文件 + 页面用到的 KaTeX、JSXGraph（网页版由服务端从 node_modules 提供，App 里没有服务端）
// 用法：npm run build:mobile
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const nm = (...p) => path.join(root, 'node_modules', ...p);

for (const dep of [nm('katex', 'dist', 'katex.min.js'), nm('jsxgraph', 'distrib', 'jsxgraphcore.js')]) {
  if (!fs.existsSync(dep)) {
    console.error(`缺少依赖：${path.relative(root, dep)}。请先运行 npm install。`);
    process.exit(1);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'katex'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'jsxgraph'), { recursive: true });
for (const f of ['katex.min.js', 'katex.min.css']) fs.copyFileSync(nm('katex', 'dist', f), path.join(out, 'vendor', 'katex', f));
fs.cpSync(nm('katex', 'dist', 'fonts'), path.join(out, 'vendor', 'katex', 'fonts'), { recursive: true });
for (const f of ['jsxgraphcore.js', 'jsxgraph.css']) fs.copyFileSync(nm('jsxgraph', 'distrib', f), path.join(out, 'vendor', 'jsxgraph', f));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'build-info.json'), JSON.stringify({ name: pkg.name, version: pkg.version, builtAt: new Date().toISOString() }, null, 2));

let files = 0, bytes = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
})(out);
console.log(`已生成 dist/：${files} 个文件，共 ${(bytes / 1024 / 1024).toFixed(1)} MB`);
console.log('打包进 App 后默认在手机上运行模型（原生插件 native/local-model）；也可以在“设置”里改成连接电脑上的服务（npm run lan）。');
