const vscode = acquireVsCodeApi();
const selection = document.body.dataset.selection;
const saved = vscode.getState();
if (saved?.selection === selection) window.scrollTo(0, saved.scroll || 0);
window.addEventListener('scroll', () => vscode.setState({ selection, scroll: window.scrollY }), { passive: true });
document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  vscode.postMessage({ type: button.dataset.action, ...(button.dataset.key === undefined ? {} : { key: button.dataset.key }) });
});
