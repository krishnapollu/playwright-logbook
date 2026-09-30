export const TRENDS_JS = `
function renderTrends(){
  const panel=document.getElementById('tab-trends');clear(panel);panel.appendChild(h('h2',{text:'Trends'}));
  const history=model.history||[];
  if(history.length<2){panel.appendChild(h('p',{class:'empty',text:'Run the suite more times to see trends.'}));return}
  const branches=[...new Set(history.map(item=>item.branch).filter(Boolean))].sort();
  const select=h('select',{'aria-label':'Filter branch'},h('option',{value:'',text:'All branches'}));
  for(const branch of branches)select.appendChild(h('option',{value:branch,text:branch}));
  panel.appendChild(select);const content=h('div',{});panel.appendChild(content);
  select.addEventListener('change',draw);
  function draw(){
    clear(content);const values=history.filter(item=>!select.value||item.branch===select.value);
    const maxDuration=Math.max(1,...values.map(item=>item.durationMs));
    const chart=s('svg',{class:'chart',viewBox:'0 0 800 190',role:'img','aria-label':'Pass rate and duration over runs'});
    const coordinates=[];
    values.forEach((item,index)=>{
      const x=25+(values.length===1?375:index*750/(values.length-1));
      const rate=item.summary.total?item.summary.passed/item.summary.total:0;
      const y=150-120*rate;
      coordinates.push([x,y]);
      const barHeight=70*item.durationMs/maxDuration;
      const bar=s('rect',{x:x-7,y:165-barHeight,width:14,height:barHeight});
      bar.appendChild(s('title',{},item.runId+' · '+formatDuration(item.durationMs)));
      chart.appendChild(bar);
    });
    const points=coordinates.map(([x,y])=>x+','+y).join(' ');
    const area=s('polygon',{points:'25,165 '+points+' 775,165',class:'trend-area'});
    chart.appendChild(area);chart.appendChild(s('polyline',{points,class:'trend-line'}));
    values.forEach((item,index)=>{
      const [x,y]=coordinates[index];const dot=s('circle',{cx:x,cy:y,r:4,class:'trend-dot'});
      dot.appendChild(s('title',{},item.runId+' · '+item.status));
      chart.appendChild(dot);
    });
    content.appendChild(chart);
    const strip=h('div',{class:'run-strip','aria-label':'Run status history'});
    for(const item of values)strip.appendChild(h('span',{class:item.status==='passed'?'passed':'failed',title:item.runId+' · '+item.status,'aria-label':item.runId+' '+item.status}));
    content.appendChild(strip);
    content.appendChild(table(['Run','Date','Branch','Status','Pass rate','Duration'],values.map(item=>[
      item.runId+(item.runId===model.run.runId?' · current':''),item.startedAt,item.branch||'',item.status,
      (item.summary.total?Math.round(100*item.summary.passed/item.summary.total):0)+'%',formatDuration(item.durationMs)
    ])));
  }
  draw();
}
function renderFlaky(){
  const panel=document.getElementById('tab-flaky');clear(panel);panel.appendChild(h('h2',{text:'Flaky tests'}));
  if(!model.flaky?.length){panel.appendChild(h('p',{class:'empty',text:'No flaky tests detected in the available runs.'}));return}
  const rows=model.flaky.map(item=>{
    const button=h('button',{class:'button',type:'button',text:item.title});
    button.addEventListener('click',()=>byId.has(item.testId)&&openTest(item.testId,button));
    const score=h('span',{},(item.score*100).toFixed(0)+'%',h('span',{class:'heat'},h('span',{style:'width:'+Math.round(item.score*100)+'%'})));
    return [button,item.file,item.project,score,item.runs,item.flakyRuns,item.fails,recentStrip(model.recent?.[item.testId])];
  });
  panel.appendChild(table(['Test','File','Project','Score','Runs','Flaky runs','Fails','Last 10'],rows));
}
`;
