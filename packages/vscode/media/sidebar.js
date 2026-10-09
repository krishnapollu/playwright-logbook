const vscode = acquireVsCodeApi();
const root = document.getElementById('runs');
const filter = document.getElementById('filter');
const scope = document.getElementById('filter-scope');
filter.addEventListener('input', () => vscode.postMessage({ type: 'filter', query: filter.value }));
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => vscode.postMessage({ type: 'mode', mode: button.dataset.mode }));
root.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (button && root.contains(button)) vscode.postMessage({ type: button.dataset.action, id: button.dataset.id });
});
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'render' || typeof event.data.html !== 'string') return;
  const scroll = document.documentElement.scrollTop;
  if (typeof event.data.query === 'string' && filter.value !== event.data.query) filter.value = event.data.query;
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === event.data.mode));
  root.setAttribute('aria-label', event.data.mode === 'tests' ? 'Tests' : 'Runs');
  scope.textContent = event.data.scope || '';
  scope.hidden = !scope.textContent;
  root.innerHTML = event.data.html;
  document.documentElement.scrollTop = scroll;
  if (event.data.focusFilter) filter.focus();
});
vscode.postMessage({ type: 'ready' });
