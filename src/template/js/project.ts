export const PROJECT_JS = `
function renderProject(){
  const panel=document.getElementById('tab-project');clear(panel);const info=model.run.project;
  panel.appendChild(h('h2',{text:'Project'}));
  panel.appendChild(h('p',{class:'muted',text:(info.name||'(unnamed)')+' · '+(info.configFile||'No config file')}));
  panel.appendChild(h('h3',{text:'Playwright projects'}));
  const cards=h('div',{class:'grid-cards'});
  for(const item of model.projects||[]){
    const rate=item.total?Math.round(item.passed/item.total*100):0;
    cards.appendChild(h('div',{class:'section-card'},h('strong',{text:item.name||'(default)'}),
      h('p',{text:item.total+' tests · '+rate+'% passed'}),h('small',{text:formatDuration(item.durationMs)})));
  }
  panel.appendChild(cards);
  panel.appendChild(h('h3',{text:'Files'}));
  const sort=h('select',{'aria-label':'Sort files'});
  for(const [value,label] of [['file','File'],['failed','Most failed'],['flaky','Most flaky'],['durationMs','Slowest']])sort.appendChild(h('option',{value,text:label}));
  panel.appendChild(sort);const files=h('div',{});panel.appendChild(files);
  function drawFiles(){
    clear(files);const key=sort.value;
    const ordered=[...model.files].sort((a,b)=>key==='file'?(a.file<b.file?-1:a.file>b.file?1:0):b[key]-a[key]||(a.file<b.file?-1:1));
    const rows=ordered.map(item=>{
      const failed=h('span',{},String(item.failed),h('span',{class:'heat hot'},h('span',{style:'width:'+(item.total?Math.round(item.failed/item.total*100):0)+'%'})));
      const flaky=h('span',{},String(item.flaky),h('span',{class:'heat'},h('span',{style:'width:'+(item.total?Math.round(item.flaky/item.total*100):0)+'%'})));
      return [item.file,item.total,failed,flaky,item.skipped,formatDuration(item.durationMs)];
    });
    files.appendChild(table(['File','Total','Failed','Flaky','Skipped','Duration'],rows));
  }
  sort.addEventListener('change',drawFiles);drawFiles();
  panel.appendChild(h('h3',{text:'Tags'}));const tags=h('div',{class:'toolbar'});
  for(const item of model.tags){const button=h('button',{class:'chip-button',type:'button',text:item.tag+' · '+item.count});
    button.addEventListener('click',()=>setState({tab:'tests',tag:item.tag}));tags.appendChild(button)}
  panel.appendChild(tags);panel.appendChild(h('h3',{text:'Slowest tests'}));
  panel.appendChild(table(['Test','File','Project','Duration'],model.slowest.map(item=>{
    const button=h('button',{class:'button',type:'button',text:item.title});
    button.addEventListener('click',()=>openTest(item.testId,button));
    return [button,item.file,item.project,formatDuration(item.durationMs)];
  })));
}
`;
