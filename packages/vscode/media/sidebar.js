const vscode = acquireVsCodeApi();
const root = document.getElementById('runs');
root.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (button && root.contains(button)) vscode.postMessage({ type: button.dataset.action, id: button.dataset.id });
});
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'render' || typeof event.data.html !== 'string') return;
  const scroll = document.documentElement.scrollTop;
  root.innerHTML = event.data.html;
  document.documentElement.scrollTop = scroll;
});
vscode.postMessage({ type: 'ready' });
