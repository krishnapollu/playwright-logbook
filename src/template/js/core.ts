export const CORE_JS = `
const model=JSON.parse(document.getElementById('lb-data').textContent);
const links=JSON.parse(document.getElementById('lb-links').textContent);
const allTests=model.run.tests;
const byId=new Map(allTests.map(test=>[test.testId,test]));
const tabs=['overview','tests','failures','flaky','trends','run','project'];
const tabButtons=[...document.querySelectorAll('[data-tab]')];
let state=parseHash(location.hash),panelReturnId='',toastTimer=0,visibleRows=[];
if(document.body.classList.contains('focused-report')&&state.test&&!location.hash.includes('attempt='))state.attempt=Math.max(0,(byId.get(state.test)?.attempts.length||1)-1);
function h(tag,props,...children){const el=document.createElement(tag);for(const [key,value] of Object.entries(props||{})){if(value===null||value===undefined)continue;if(key==='class')el.className=String(value);else if(key==='text')el.textContent=String(value);else if(key.startsWith('on')&&typeof value==='function')el.addEventListener(key.slice(2).toLowerCase(),value);else el.setAttribute(key,String(value))}for(const child of children.flat(Infinity)){if(child===null||child===undefined)continue;el.appendChild(typeof child==='string'||typeof child==='number'?document.createTextNode(String(child)):child)}return el}
const svgNS='http'+':/'+'/www.w3.org/2000/svg';
function s(tag,props,...children){const el=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(props||{}))el.setAttribute(key,String(value));for(const child of children.flat(Infinity)){if(child!==null&&child!==undefined)el.appendChild(typeof child==='string'||typeof child==='number'?document.createTextNode(String(child)):child)}return el}
function clear(el){while(el.firstChild)el.removeChild(el.firstChild)}
function icon(name){const svg=s('svg',{viewBox:'0 0 24 24',class:'icon','aria-hidden':'true'});svg.appendChild(s('path',{d:icons[name]||icons.alert}));return svg}
function chip(kind){const labels={passed:'Passed',failed:'Failed',timedout:'Timed out',flaky:'Flaky',skipped:'Skipped'};const marks={passed:'✓',failed:'×',timedout:'!',flaky:'↝',skipped:'–'};return h('span',{class:'status-chip '+kind},h('span',{class:'mark','aria-hidden':'true',text:marks[kind]||'!'}),labels[kind]||kind)}
function recentStrip(value){const kinds=recentToKinds(value||'');const wrap=h('span',{class:'recent',role:'img','aria-label':kinds.length?'Previous results, oldest to newest: '+kinds.join(', '):'No previous results'});for(const kind of kinds)wrap.appendChild(h('span',{class:kind,title:kind,'aria-hidden':'true'}));return wrap}
function attachmentHref(url){return new RegExp('^data:(?:image/(?:png|jpeg)|video/(?:mp4|webm)|application/octet-stream);base64,[A-Za-z0-9+/=]+$').test(url||'')?url:safeHref(url||'')}
function link(label,url,filename=label){const href=attachmentHref(url);return href?h('a',{href,download:href.startsWith('data:')?filename:null,rel:'noopener noreferrer',text:label}):h('span',{text:label})}
function syncHash(){const hash=buildHash(state);if(location.hash!==hash)history.replaceState(null,'',location.pathname+location.search+hash)}
function setState(patch){state={...state,...patch};syncHash();renderAll()}
function validateState(){if(state.project&&!allTests.some(test=>test.project===state.project))state.project='';if(state.tag&&!allTests.some(test=>test.tags.includes(state.tag)))state.tag='';if(state.test&&!byId.has(state.test))state.test='';if(state.test&&state.attempt>=byId.get(state.test).attempts.length)state.attempt=0}
function toast(message){const el=document.getElementById('lb-toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},2300)}
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('Copied')}catch{const area=h('textarea',{'aria-label':'Copy text'});area.value=value;document.body.appendChild(area);area.select();try{document.execCommand('copy');toast('Copied')}catch{toast('Select and copy the text')}area.remove()}}
function applyTheme(theme){document.documentElement.setAttribute('data-theme',theme);const button=document.getElementById('lb-theme');button.replaceChildren(icon(theme==='dark'?'sun':'moon'));button.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');button.setAttribute('title',theme==='dark'?'Switch to light mode':'Switch to dark mode');try{localStorage.setItem('logbook-theme',theme)}catch{}}
function toggleTheme(){const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';applyTheme(next);toast(next==='dark'?'Dark mode on':'Light mode on')}
function renderAll(){for(const button of tabButtons){const active=button.dataset.tab===state.tab;if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');button.classList.toggle('active',active);button.tabIndex=active?0:-1;document.getElementById('tab-'+button.dataset.tab).hidden=!active}if(state.tab==='overview')renderOverview();else if(state.tab==='tests'){renderTests();renderPagination();decorateTestRows();makeGroupsCollapsible()}else if(state.tab==='failures')renderFailures();else if(state.tab==='trends')renderTrends();else if(state.tab==='flaky')renderFlaky();else if(state.tab==='run')renderRun();else renderProject();renderPanel()}
function decorateTestRows(){for(const row of document.querySelectorAll('#lb-tests-body tr[data-test-id]')){
  const test=byId.get(row.dataset.testId),name=row.children[1],tags=row.children[3];
  if(test.titlePath.length>1)name.appendChild(h('small',{text:test.titlePath.slice(0,-1).join(' › ')}));
  clear(tags);for(const tag of test.tags.slice(0,3))tags.appendChild(h('span',{class:'tag-chip',text:tag}));
  if(test.tags.length>3)tags.appendChild(h('span',{class:'tag-chip',text:'+'+(test.tags.length-3)}));
  for(const id of test.caseIds)tags.appendChild(h('span',{class:'case-chip',text:id}));
}}
function makeGroupsCollapsible(){
  if(state.group!=='file')return;
  const body=document.getElementById('lb-tests-body');
  const rows=[...body.querySelectorAll('tr[data-test-id]')];
  if(!rows.length)return;
  clear(body);
  const files=[...new Set(rows.map(row=>byId.get(row.dataset.testId).file))].sort();
  for(const file of files){
    const members=rows.filter(row=>byId.get(row.dataset.testId).file===file);
    const total=visibleRows.filter(test=>test.file===file).length;
    const worst=members.map(row=>statusKind(byId.get(row.dataset.testId))).sort((a,b)=>['failed','timedout','flaky','skipped','passed'].indexOf(a)-['failed','timedout','flaky','skipped','passed'].indexOf(b))[0];
    const header=h('tr',{class:'group-header',tabindex:'0','aria-expanded':'true'},h('td',{colspan:'7'},file+' · '+total+' tests ',chip(worst)));
    const toggle=()=>{const expanded=header.getAttribute('aria-expanded')==='true';header.setAttribute('aria-expanded',String(!expanded));for(const row of members)row.hidden=expanded};
    header.addEventListener('click',toggle);
    header.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}});
    body.appendChild(header);for(const row of members)body.appendChild(row);
  }
}
function selectTab(name,focus){setState({tab:name});if(focus)tabButtons[tabs.indexOf(name)].focus()}
function table(headings,rows){const head=h('thead',{},h('tr',{},headings.map(name=>h('th',{text:name}))));const body=h('tbody',{},rows.map(values=>h('tr',{},values.map(value=>h('td',{},value===null||value===undefined?'':value)))));return h('div',{class:'table-wrap'},h('table',{},head,body))}
function openTest(id,origin){if(origin)panelReturnId=origin.dataset.testId;state={...state,test:id,attempt:Math.max(0,(byId.get(id)?.attempts.length||1)-1)};syncHash();renderPanel()}
function closePanel(){if(!state.test)return;const returnId=panelReturnId;panelReturnId='';state={...state,test:'',attempt:0};syncHash();const panel=document.getElementById('lb-panel');if(panel.open)panel.close();else panel.removeAttribute('open');panelShown='';const origin=[...document.querySelectorAll('#tab-'+state.tab+' [data-test-id]')].find(element=>element.dataset.testId===returnId),target=origin||tabButtons[tabs.indexOf(state.tab)];if(target)requestAnimationFrame(()=>target.focus({preventScroll:true}))}
function handleKeys(event){if(event.metaKey||event.ctrlKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;const key=event.key;if(key>='1'&&key<='7'){selectTab(tabs[Number(key)-1],true);return}if(key==='Escape'){if(state.test){event.preventDefault();closePanel();return}const dialog=document.querySelector('dialog[open]');if(dialog)dialog.close();return}if(key==='t'){toggleTheme();return}if(key==='/'&&state.tab==='tests'){event.preventDefault();document.getElementById('lb-search')?.focus();return}if(key==='['||key===']'){moveFailure(key===']'?1:-1);return}if(state.tab==='tests'&&(key==='j'||key==='k')){const rows=[...document.querySelectorAll('#lb-tests-body tr[data-test-id]')];const at=rows.indexOf(document.activeElement);rows[Math.max(0,Math.min(rows.length-1,at+(key==='j'?1:-1)))]?.focus();return}if((key==='Enter'||key==='o')&&document.activeElement?.dataset?.testId){openTest(document.activeElement.dataset.testId,document.activeElement)}}
function moveFailure(step){const ids=allTests.filter(test=>test.outcome==='unexpected'||test.outcome==='flaky').map(test=>test.testId);if(!ids.length)return;const at=ids.indexOf(state.test);openTest(ids[(at+step+ids.length)%ids.length])}
function initExportPopover(){
  const btn=document.getElementById('lb-export-btn'),pop=document.getElementById('lb-export-popover');if(!btn||!pop)return;
  btn.addEventListener('click',()=>{const open=!pop.hidden;pop.hidden=open;btn.setAttribute('aria-expanded',String(!open))});
  document.addEventListener('click',e=>{if(!btn.contains(e.target)&&!pop.contains(e.target)){pop.hidden=true;btn.setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){pop.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus()}});
}
function initShaCopy(){
  for(const btn of document.querySelectorAll('[data-copy-sha]'))btn.addEventListener('click',e=>{e.stopPropagation();copyText(btn.getAttribute('data-copy-sha'))});
}
function init(){
  let saved=null;try{saved=localStorage.getItem('logbook-theme')}catch{}
  if(!saved){try{saved=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch{saved='light'}}
  applyTheme(saved||'light');
  for(const button of tabButtons){
    button.addEventListener('click',()=>selectTab(button.dataset.tab));
    button.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
      event.preventDefault();const step=event.key==='ArrowRight'?1:-1;
      selectTab(tabs[(tabs.indexOf(button.dataset.tab)+step+tabs.length)%tabs.length],true)
    }});
  }
  document.getElementById('lb-theme').addEventListener('click',toggleTheme);
  document.getElementById('lb-copy-summary').addEventListener('click',()=>{copyText(model.summaryMarkdown||'');document.getElementById('lb-export-popover').hidden=true;document.getElementById('lb-export-btn').setAttribute('aria-expanded','false')});
  document.getElementById('lb-download').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(model.run,null,2)+'\\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=h('a',{href:url,download:model.run.runId+'.json'});
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    document.getElementById('lb-export-popover').hidden=true;document.getElementById('lb-export-btn').setAttribute('aria-expanded','false');
  });
  document.getElementById('lb-print').addEventListener('click',()=>{window.print();document.getElementById('lb-export-popover').hidden=true;document.getElementById('lb-export-btn').setAttribute('aria-expanded','false')});
  initExportPopover();
  initShaCopy();
  window.addEventListener('beforeprint',()=>{renderFailures();renderTrends();renderFlaky();renderRun();renderProject();for(const details of document.querySelectorAll('details'))details.open=true});
  const detail=document.getElementById('lb-panel');
  document.getElementById('lb-panel-close').addEventListener('click',closePanel);
  detail.addEventListener('click',event=>{if(event.target===detail)closePanel()});
  const panelClose=document.getElementById('lb-panel-close'),panelHead=panelClose.parentElement;
  panelHead.insertBefore(h('button',{class:'button',type:'button','aria-label':'Previous failing test',onclick:()=>moveFailure(-1),text:'←'}),panelClose);
  panelHead.insertBefore(h('button',{class:'button',type:'button','aria-label':'Next failing test',onclick:()=>moveFailure(1),text:'→'}),panelClose);
  const mark=document.querySelector('.wordmark');if(mark){mark.textContent='logbook';mark.prepend(icon('book'))}
  for(const button of tabButtons){
    button.prepend(icon(button.dataset.icon||'alert'));
    const count=button.dataset.count;
    if(count!==undefined)button.appendChild(h('span',{class:'nav-count',text:count}));
  }
  document.getElementById('lb-new-failures')?.addEventListener('click',()=>selectTab('failures'));
  window.addEventListener('hashchange',()=>{state=parseHash(location.hash);validateState();renderAll()});
  document.addEventListener('keydown',handleKeys);
  for(const button of document.querySelectorAll('[data-card-kind]'))button.addEventListener('click',()=>setState({tab:'tests',status:button.dataset.cardKind==='total'?[]:[button.dataset.cardKind]}));
  validateState();
  renderAll();
}
`;
