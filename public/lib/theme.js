// 从 CSS 变量读取作图配色，深色/浅色模式自动切换。
export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    bg: v('--fig-bg', '#ffffff'),
    ink: v('--fig-ink', '#1d2433'),
    muted: v('--fig-muted', '#6b7385'),
    axis: v('--fig-axis', '#4b5262'),
    grid: v('--fig-grid', '#e8ebf1'),
    aux: v('--fig-aux', '#7b8597'),
    accent: v('--fig-accent', '#e8590c'),
    accent2: v('--fig-fill', '#3b6ef5'),
    result: v('--fig-result', '#1f9d55'),
    free: v('--fig-free', '#3b6ef5'),
    hidden: v('--fig-hidden', '#9aa3b2'),
    face: v('--fig-face', '#3b6ef5'),
    functions: [v('--fig-f1', '#3b6ef5'), v('--fig-f2', '#d6336c'), v('--fig-f3', '#1f9d55'), v('--fig-f4', '#7048e8')],
  };
}
