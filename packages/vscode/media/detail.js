const vscode = acquireVsCodeApi();
const selection = document.body.dataset.selection;
const saved = vscode.getState();
const tabsState = saved?.selection === selection ? saved?.tabs || {} : {};
const saveState = () => vscode.setState({ selection, scroll: window.scrollY, tabs: tabsState });
if (saved && saved.selection === selection) window.scrollTo(0, saved.scroll || 0);
window.addEventListener('scroll', saveState, { passive: true });
document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  vscode.postMessage({ type: button.dataset.action, ...(button.dataset.key === undefined ? {} : { key: button.dataset.key }) });
});

function selectTab(button) {
  const group = button.closest('[data-tab-group]');
  if (!group) return;
  const tabs = [...group.querySelectorAll('[role="tab"]')].filter(tab => tab.closest('[data-tab-group]') === group);
  const panels = [...group.querySelectorAll('[role="tabpanel"]')].filter(panel => panel.closest('[data-tab-group]') === group);
  for (const tab of tabs) {
    const active = tab === button;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== button.dataset.tabTarget;
  if (tabs.length) tabsState[tabs[0].id] = button.id;
  saveState();
}
document.addEventListener('click', event => {
  const tab = event.target.closest('button[data-tab-target]');
  if (tab) selectTab(tab);
});
document.addEventListener('keydown', event => {
  const tab = event.target.closest('button[data-tab-target]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const group = tab.closest('[data-tab-group]');
  const tabs = [...group.querySelectorAll('[role="tab"]')].filter(item => item.closest('[data-tab-group]') === group);
  const index = tabs.indexOf(tab);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault(); selectTab(tabs[next]); tabs[next].focus();
});

for (const id of Object.values(tabsState)) {
  if (typeof id !== 'string') continue;
  const tab = document.getElementById(id);
  if (tab?.matches('button[data-tab-target]')) selectTab(tab);
}
