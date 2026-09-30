export const RUN_JS = `
function renderRun(){
  const panel=document.getElementById('tab-run');clear(panel);panel.appendChild(h('h2',{text:'Run details'}));
  const run=model.run,env=run.env,cards=h('div',{class:'grid-cards'});
  const sections=[
    ['CI',[['Provider',env.ci?.provider],['Build ID',env.ci?.buildId]]],
    ['Git',[['Branch',env.git.branch],['Commit',env.git.commit],['PR',env.git.prNumber]]],
    ['Machine',[['OS',env.machine.os],['Architecture',env.machine.arch],['Node',env.machine.node],['CPUs',env.machine.cpus]]],
    ['Playwright',[['Version',env.playwrightVersion],['Workers',env.workers]]],
    ['Shards',[['Expected',run.expectedShards],['Received',run.receivedShards.join(', ')]]]
  ];
  for(const [name,values] of sections)cards.appendChild(h('div',{class:'section-card'},h('h3',{text:name}),...values.map(([label,value])=>h('p',{},label+': '+(value??'—')))));
  panel.appendChild(cards);
  if(env.ci?.buildUrl)panel.appendChild(link('Open CI build',env.ci.buildUrl));
  panel.appendChild(h('h3',{text:'Timeline · approximate'}));
  if(run.expectedShards!==1){panel.appendChild(h('p',{class:'muted',text:'Timeline is available for unsharded runs.'}));return}
  const tests=run.tests.filter(test=>test.timing).sort((a,b)=>b.durationMs-a.durationMs).slice(0,1500);
  if(run.tests.length>1500)panel.appendChild(h('p',{class:'muted',text:'Showing the 1500 longest tests.'}));
  if(!tests.length){panel.appendChild(h('p',{class:'muted',text:'No timing data available.'}));return}
  const starts=tests.map(test=>Date.parse(test.timing.startedAt));
  const min=Math.min(...starts),max=Math.max(...tests.map((test,index)=>starts[index]+test.durationMs));
  const workers=[...new Set(tests.map(test=>test.timing.workerIndex))].sort((a,b)=>a-b);
  const chart=s('svg',{class:'chart timeline',viewBox:'0 0 800 '+Math.max(160,workers.length*34+30),role:'img','aria-label':'Test timeline'});
  tests.forEach((test,index)=>{
    const x=70+700*(starts[index]-min)/Math.max(1,max-min);
    const width=Math.max(2,700*test.durationMs/Math.max(1,max-min));
    const y=15+workers.indexOf(test.timing.workerIndex)*34;
    const rect=s('rect',{x,y,width,height:20,class:statusKind(test),tabindex:'0'});
    rect.appendChild(s('title',{},test.title+' · '+formatDuration(test.durationMs)));
    rect.addEventListener('click',()=>openTest(test.testId));
    rect.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openTest(test.testId)}});
    chart.appendChild(rect);
  });
  workers.forEach((worker,index)=>chart.appendChild(s('text',{x:4,y:30+index*34},'W'+worker)));
  panel.appendChild(h('div',{class:'table-wrap'},chart));
}
`;
