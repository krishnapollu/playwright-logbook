export const TRENDS_JS = `
function renderTrends(){
  const panel=document.getElementById('tab-trends');clear(panel);panel.appendChild(h('h2',{text:'Trends'}));
  const history=(model.history||[]).filter(item=>item.complete);
  if((model.history||[]).some(item=>!item.complete))panel.appendChild(h('p',{class:'banner',text:'Incomplete runs are omitted from trend charts.'}));
  const branches=[...new Set(history.map(item=>item.branch).filter(Boolean))].sort();
  const select=h('select',{'aria-label':'Filter branch'},h('option',{value:'',text:'All branches'}));
  for(const branch of branches)select.appendChild(h('option',{value:branch,text:branch}));
  const range=h('select',{'aria-label':'Runs to show'},...[[20,'Last 20 runs'],[10,'Last 10 runs'],[50,'Last 50 runs']].map(([count,label])=>h('option',{value:String(count),text:String(label)})));
  const metrics=[['pass','Pass rate'],['failed','Failed'],['flaky','Flaky'],['duration','Duration']];
  let metric='pass';
  const metricButtons=metrics.map(([value,label])=>{
    const button=h('button',{type:'button',class:'metric-button',text:label,'aria-pressed':String(value===metric)});
    button.addEventListener('click',()=>{metric=value;for(const [key] of metrics)metricButtons.find(item=>item.dataset.metric===key).setAttribute('aria-pressed',String(key===metric));draw()});
    button.dataset.metric=value;
    return button;
  });
  const metricControl=h('div',{class:'trend-metrics','role':'group','aria-label':'Trend metric'},...metricButtons);
  const controls=h('div',{class:'toolbar trend-controls'},select,range,metricControl);panel.appendChild(controls);
  const content=h('div',{});panel.appendChild(content);
  select.addEventListener('change',draw);range.addEventListener('change',draw);
  function draw(){
    clear(content);
    const values=history.filter(item=>!select.value||item.branch===select.value).slice(-Number(range.value));
    if(!values.length){content.appendChild(h('p',{class:'empty',text:'No complete runs are available for this branch.'}));return}
    const series=metric==='pass'?values.filter(item=>item.summary.total>0):values;
    if(!series.length){content.appendChild(h('p',{class:'empty',text:'No complete runs contain tests to calculate a pass rate.'}));return}
    const titles={pass:'Pass rate',failed:'Failed tests',flaky:'Flaky tests',duration:'Run duration'};
    const valueOf=item=>metric==='pass'?item.summary.passed/item.summary.total*100:metric==='failed'?item.summary.failed:metric==='flaky'?item.summary.flaky:item.durationMs;
    const format=value=>metric==='pass'?value.toFixed(1)+'%':metric==='duration'?formatDuration(value):String(Math.round(value));
    const numbers=series.map(valueOf),minimum=Math.min(...numbers),maximum=Math.max(...numbers);
    let floor=0,ceiling=Math.max(1,maximum);
    if(metric==='pass'){
      floor=Math.max(0,Math.floor((minimum-5)/10)*10);
      ceiling=Math.min(100,Math.ceil((maximum+5)/10)*10);
      if(ceiling-floor<10){floor=Math.max(0,ceiling-10);ceiling=Math.min(100,floor+10)}
    }
    const mean=numbers.reduce((sum,value)=>sum+value,0)/numbers.length;
    const card=h('section',{class:'section-card trend-card','aria-labelledby':'lb-trend-heading'});
    card.appendChild(h('h3',{id:'lb-trend-heading',text:titles[metric]}));
    card.appendChild(h('p',{class:'muted',text:metric==='pass'?'Pass rate uses a data-scaled axis; the labelled floor avoids flattening small changes.':metric==='duration'?'Total recorded duration per complete run; vertical axis starts at zero.':'Recorded test count per complete run; vertical axis starts at zero.'}));
    if(metric==='pass')card.appendChild(h('p',{class:'muted trend-axis-note',text:'Axis starts at '+floor+'%'}));
    const chart=s('svg',{class:'chart history-chart','viewBox':'0 0 800 240',role:'img','aria-label':titles[metric]+' over complete runs'});
    const left=54,right=20,top=22,bottom=50,width=800-left-right,height=240-top-bottom;
    const yFor=value=>top+height-(value-floor)/(ceiling-floor)*height;
    for(let index=0;index<=2;index++){
      const value=floor+(ceiling-floor)*index/2,y=yFor(value);
      chart.appendChild(s('line',{x1:left,y1:y,x2:800-right,y2:y,class:'chart-grid'}));
      chart.appendChild(s('text',{x:4,y:y+4,class:'axis-label'},format(value)));
    }
    const meanY=yFor(mean);
    chart.appendChild(s('line',{x1:left,y1:meanY,x2:800-right,y2:meanY,class:'trend-mean'}));
    const points=series.map((item,index)=>{
      const x=left+(series.length===1?width/2:index*width/(series.length-1));
      return {item,x,y:yFor(valueOf(item)),value:valueOf(item)};
    });
    const crosshair=s('line',{x1:0,y1:top,x2:0,y2:top+height,class:'trend-crosshair',visibility:'hidden'});
    chart.appendChild(crosshair);
    if(points.length>1)chart.appendChild(s('polyline',{points:points.map(point=>point.x+','+point.y).join(' '),class:'trend-line'}));
    const tooltip=h('p',{class:'trend-tooltip',role:'status','aria-live':'polite',text:'Focus or point to a chart mark for run details.'});
    const detail=point=>point.item.runId+' · '+fmtDate(point.item.startedAt)+' · branch '+(point.item.branch||'unknown')+' · SHA '+(point.item.commit?point.item.commit.slice(0,7):'unavailable')+' · '+format(point.value);
    for(const point of points){
      const marker=s('circle',{cx:point.x,cy:point.y,r:5,class:'trend-dot'+(point.item.runId===model.run.runId?' current':''),tabindex:'0','aria-label':detail(point)});
      marker.appendChild(s('title',{},detail(point)));
      const show=()=>{crosshair.setAttribute('x1',String(point.x));crosshair.setAttribute('x2',String(point.x));crosshair.setAttribute('visibility','visible');tooltip.textContent=detail(point)};
      const hide=()=>{crosshair.setAttribute('visibility','hidden');tooltip.textContent='Focus or point to a chart mark for run details.'};
      marker.addEventListener('pointerenter',show);marker.addEventListener('pointerleave',hide);
      marker.addEventListener('focus',show);marker.addEventListener('blur',hide);
      chart.appendChild(marker);
    }
    const labelEvery=Math.max(1,Math.ceil(points.length/6));
    points.forEach((point,index)=>{if(index%labelEvery===0||index===points.length-1)chart.appendChild(s('text',{x:point.x,y:226,'text-anchor':index===0?'start':index===points.length-1?'end':'middle',class:'axis-run'},point.item.runId))});
    card.appendChild(chart);card.appendChild(tooltip);
    const rows=series.map(item=>[item.runId+(item.runId===model.run.runId?' · current':''),h('time',{datetime:item.startedAt,title:item.startedAt,text:fmtDate(item.startedAt)}),item.branch||'—',item.commit?item.commit.slice(0,7):'—',format(valueOf(item))]);
    const data= h('details',{class:'trend-data'},h('summary',{text:'Show data table'}),table(['Run','Date','Branch','SHA','Value'],rows));
    card.appendChild(data);content.appendChild(card);
  }
  draw();
}
function renderFlaky(){
  const panel=document.getElementById('tab-flaky');clear(panel);panel.appendChild(h('h2',{text:'Flaky tests'}));
  if(!model.flaky?.length){panel.appendChild(h('p',{class:'empty',text:'No flaky tests detected in the available runs.'}));return}
  panel.appendChild(h('p',{class:'muted',text:'A flaky classification reflects recorded outcomes, not a diagnosis.'}));
  const labels=model.recentRunLabels||[];
  const matrixEntries=model.flaky.map(item=>({item,test:byId.get(item.testId),letters:model.recent?.[item.testId]||''}))
    .filter(entry=>entry.test&&labels.some((label,index)=>label.complete&&entry.letters[index]&&entry.letters[index]!=='-'));
  if(matrixEntries.length){
    const section=h('section',{class:'section-card flaky-matrix','aria-labelledby':'lb-flaky-matrix-heading'});
    section.appendChild(h('h3',{id:'lb-flaky-matrix-heading',text:'Recent outcomes for current-run flaky tests'}));
    section.appendChild(h('p',{class:'muted',text:'Older to newer · P passed · F failed · R passed on retry · — unavailable or run incomplete.'}));
    const headings=['Test',...labels.map(label=>label.runId+(label.complete?'':' (incomplete)')),'Current run'+(model.run.complete?'':' (incomplete)')];
    const rows=matrixEntries.map(({item,test,letters})=>{
      const outcome=letters.split('').map((letter,index)=>!labels[index]?.complete?{mark:'—',label:'Unavailable: run incomplete'}:({p:{mark:'P',label:'Passed'},f:{mark:'F',label:'Failed'},k:{mark:'R',label:'Flaky retry'},s:{mark:'S',label:'Skipped'},'-':{mark:'—',label:'Test not recorded'}}[letter]||{mark:'—',label:'Unavailable'}));
      const current=model.run.complete?({expected:{mark:'P',label:'Passed'},unexpected:{mark:'F',label:'Failed'},flaky:{mark:'R',label:'Passed on retry'},skipped:{mark:'S',label:'Skipped'}}[test.outcome]||{mark:'—',label:'Unavailable'}):{mark:'—',label:'Current run incomplete'};
      const name=h('button',{class:'text-button',type:'button',text:item.title});
      name.addEventListener('click',()=>openTest(item.testId,name));
      return [name,...outcome.map(cell=>h('span',{class:'matrix-cell','aria-label':cell.label,title:cell.label,text:cell.mark})),h('span',{class:'matrix-cell','aria-label':current.label,title:current.label,text:current.mark})];
    });
    section.appendChild(table(headings,rows));
    panel.appendChild(section);
  }else{
    panel.appendChild(h('p',{class:'empty',text:'Per-run outcomes are unavailable for the current flaky tests; aggregate flaky records are shown below.'}));
  }
  const rows=model.flaky.map(item=>{
    const button=h('button',{class:'button',type:'button',text:item.title});
    button.addEventListener('click',()=>byId.has(item.testId)&&openTest(item.testId,button));
    const score=h('span',{},(item.score*100).toFixed(0)+'%',h('span',{class:'heat'},h('span',{style:'width:'+Math.round(item.score*100)+'%'})));
    return [button,item.file,item.project,score,item.runs,item.flakyRuns,item.fails,recentStrip(model.recent?.[item.testId])];
  });
  panel.appendChild(h('h3',{text:'Aggregate flaky history'}));
  panel.appendChild(table(['Test','File','Project','Score','Runs','Flaky runs','Fails','Recent'],rows));
}
`;
