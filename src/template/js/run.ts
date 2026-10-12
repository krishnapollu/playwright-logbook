export const RUN_JS = `
function renderRun(){
  const panel=document.getElementById('tab-run');clear(panel);panel.appendChild(h('h2',{text:'Run details'}));
  const run=model.run,env=run.env,cards=h('div',{class:'grid-cards run-meta-grid'});
  const sections=[
    ...(env.ci?[['CI',[['Provider',env.ci.provider],['Build ID',env.ci.buildId]]]]:[]),
    ['Git',[['Branch',env.git.branch],['Commit',env.git.commit],['PR',env.git.prNumber]]],
    ['Machine',[['OS',env.machine.os],['Architecture',env.machine.arch],['Node',env.machine.node],['CPUs',env.machine.cpus]]],
    ['Playwright',[['Version',env.playwrightVersion],['Workers',env.workers]]],
    ...((run.expectedShards??1)>1||!run.complete?[['Shards',[['Expected parts',run.expectedShards],['Received parts',run.receivedShards.join(', ')]]]]:[])
  ];
  for(const [name,values] of sections){
    const card=h('div',{class:'section-card'},h('h3',{text:name}),...values.map(([label,value])=>h('p',{},label+': '+(value??'—'))));
    const url=env.ci?.buildUrl;
    if(name==='CI'&&url&&new RegExp('^https?://','i').test(url)&&safeHref(url))card.appendChild(link('Open CI build',url));
    cards.appendChild(card);
  }
  panel.appendChild(cards);
  panel.appendChild(h('h3',{class:'timeline-heading',text:'Execution timeline'}));
  panel.appendChild(h('p',{class:'timeline-description muted',text:'Approximate execution windows by worker. Select a test bar to inspect its evidence.'}));
  if((run.expectedShards??1)!==1){panel.appendChild(h('p',{class:'empty',text:'Timeline is unavailable for sharded runs.'}));return}
  const tests=run.tests.filter(test=>test.timing).sort((a,b)=>b.durationMs-a.durationMs).slice(0,1500);
  if(run.tests.length>1500)panel.appendChild(h('p',{class:'muted',text:'Showing the 1500 longest tests.'}));
  if(!tests.length){panel.appendChild(h('p',{class:'empty',text:'No timing data is available for this unsharded run.'}));return}
  const starts=tests.map(test=>Date.parse(test.timing.startedAt));
  const min=Math.min(...starts),max=Math.max(...tests.map((test,index)=>starts[index]+test.durationMs));
  const workers=[...new Set(tests.map(test=>test.timing.workerIndex))].sort((a,b)=>a-b);
  const chartHeight=Math.max(190,workers.length*38+72),plotTop=22,plotHeight=workers.length*38;
  const chart=s('svg',{class:'chart timeline',viewBox:'0 0 800 '+chartHeight,role:'group','aria-label':'Approximate test timeline with worker lanes from '+new Date(min).toISOString()+' to '+new Date(max).toISOString()});
  workers.forEach((worker,index)=>{
    const y=plotTop+index*38;
    chart.appendChild(s('rect',{x:66,y,width:710,height:30,rx:5,class:index%2?'worker-lane alt':'worker-lane'}));
    chart.appendChild(s('text',{x:8,y:y+19,class:'worker-label'},'W'+worker));
  });
  for(const fraction of [0,.25,.5,.75,1]){
    const x=70+700*fraction;
    chart.appendChild(s('line',{x1:x,y1:plotTop-4,x2:x,y2:plotTop+plotHeight,class:'timeline-grid'}));
    chart.appendChild(s('text',{x,y:chartHeight-8,'text-anchor':fraction===0?'start':fraction===1?'end':'middle',class:'timeline-time'},new Date(min+(max-min)*fraction).toISOString().slice(11,19)+' UTC'));
  }
  tests.forEach((test,index)=>{
    const x=70+700*(starts[index]-min)/Math.max(1,max-min);
    const width=Math.max(2,700*test.durationMs/Math.max(1,max-min));
    const y=plotTop+workers.indexOf(test.timing.workerIndex)*38+5;
    const rect=s('rect',{x,y,width,height:20,rx:4,class:statusKind(test),tabindex:'0',role:'button','aria-label':test.title+' · worker '+test.timing.workerIndex+' · '+formatDuration(test.durationMs)});
    rect.appendChild(s('title',{},test.title+' · '+formatDuration(test.durationMs)+' · '+new Date(starts[index]).toISOString()));
    rect.addEventListener('click',()=>openTest(test.testId));
    rect.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openTest(test.testId)}});
    chart.appendChild(rect);
  });
  panel.appendChild(h('div',{class:'timeline-wrap'},chart));
  panel.appendChild(table(['Test','Worker','Started','Duration'],tests.map(test=>[
    h('button',{class:'button',type:'button',text:test.title,onclick:()=>openTest(test.testId)}),
    test.timing?.workerIndex,
    test.timing?.startedAt,
    formatDuration(test.durationMs)
  ])));
}
`;
