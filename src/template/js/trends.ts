export const TRENDS_JS = `
function renderTrends(){
  const date=item=>h('time',{datetime:item.startedAt,title:item.startedAt,text:fmtDate(item.startedAt)});
  const panel=document.getElementById('tab-trends');clear(panel);panel.appendChild(h('h2',{text:'Trends'}));
  const history=(model.history||[]).filter(item=>item.complete);
  if((model.history||[]).some(item=>!item.complete))panel.appendChild(h('p',{class:'banner',text:'Incomplete runs are omitted from trend charts.'}));
  const branches=[...new Set(history.map(item=>item.branch).filter(Boolean))].sort();
  const select=h('select',{'aria-label':'Filter branch'},h('option',{value:'',text:'All branches'}));
  for(const branch of branches)select.appendChild(h('option',{value:branch,text:branch}));
  const range=h('select',{'aria-label':'Runs to show'},...[[20,'Last 20 runs'],[10,'Last 10 runs'],[50,'Last 50 runs']].map(([count,label])=>h('option',{value:String(count),text:String(label)})));
  const controls=h('div',{class:'toolbar trend-controls'},select,range);panel.appendChild(controls);
  const content=h('div',{});panel.appendChild(content);
  select.addEventListener('change',draw);range.addEventListener('change',draw);
  function draw(){
    clear(content);
    const values=history.filter(item=>!select.value||item.branch===select.value).slice(-Number(range.value));
    if(!values.length){content.appendChild(h('p',{class:'empty',text:'No complete runs are available for this branch.'}));return}
    const passRuns=values.filter(item=>item.summary.total>0);
    const passCard=h('section',{class:'section-card trend-card','aria-labelledby':'lb-pass-trend-heading'});
    passCard.appendChild(h('h3',{id:'lb-pass-trend-heading',text:'Pass rate'}));
    passCard.appendChild(h('p',{class:'muted',text:'Percent of recorded tests passed in each complete run. Vertical axis: 0–100%.'}));
    if(passRuns.length){
      const chart=s('svg',{class:'chart history-chart','viewBox':'0 0 800 210',role:'img','aria-label':'Pass rate from zero to one hundred percent across complete runs'});
      const left=46,right=20,top=20,bottom=36,plotWidth=800-left-right,plotHeight=210-top-bottom;
      for(const tick of [0,50,100]){
        const y=top+plotHeight*(1-tick/100);
        chart.appendChild(s('line',{x1:left,y1:y,x2:800-right,y2:y,class:'chart-grid'}));
        chart.appendChild(s('text',{x:4,y:y+4,class:'axis-label'},tick+'%'));
      }
      const points=passRuns.map((item,index)=>{
        const x=left+(passRuns.length===1?plotWidth/2:index*plotWidth/(passRuns.length-1));
        const rate=item.summary.passed/item.summary.total*100;
        const y=top+plotHeight*(1-rate/100);
        return {item,x,y,rate};
      });
      if(points.length>1)chart.appendChild(s('polyline',{points:points.map(point=>point.x+','+point.y).join(' '),class:'trend-line'}));
      for(const point of points){
        const marker=s('circle',{cx:point.x,cy:point.y,r:4,class:'trend-dot'});
        marker.appendChild(s('title',{},point.item.runId+' · '+point.rate.toFixed(1)+'%'));
        chart.appendChild(marker);
      }
      chart.appendChild(s('text',{x:left,y:202,class:'axis-run'},points[0].item.runId));
      if(points.length>1)chart.appendChild(s('text',{x:800-right,y:202,'text-anchor':'end',class:'axis-run'},points[points.length-1].item.runId));
      passCard.appendChild(chart);
      passCard.appendChild(table(['Run','Date','Passed','Total','Pass rate'],passRuns.map(item=>[
        item.runId+(item.runId===model.run.runId?' · current':''),
        date(item),item.summary.passed,item.summary.total,
        (100*item.summary.passed/item.summary.total).toFixed(1)+'%'
      ])));
    }else passCard.appendChild(h('p',{class:'empty',text:'No complete runs contain tests to calculate a pass rate.'}));
    content.appendChild(passCard);

    const failures=h('section',{class:'section-card trend-card','aria-labelledby':'lb-failure-trend-heading'});
    failures.appendChild(h('h3',{id:'lb-failure-trend-heading',text:'Failed and flaky tests'}));
    failures.appendChild(h('p',{class:'muted',text:'Recorded counts per complete run. Compare alongside test totals to account for suite-size changes.'}));
    const legend=h('div',{class:'trend-legend','aria-label':'Chart legend'},
      h('span',{},h('i',{}),'Failed'),h('span',{},h('i',{class:'flaky-dot'}),'Flaky'));
    failures.appendChild(legend);
    const maxCount=Math.max(1,...values.map(item=>Math.max(item.summary.failed,item.summary.flaky)));
    const countChart=s('svg',{class:'chart history-chart failure-count-chart','viewBox':'0 0 800 210',role:'img','aria-label':'Failed and flaky test counts across complete runs'});
    const countLeft=46,countRight=20,countTop=20,countBottom=36,countPlotWidth=800-countLeft-countRight,countPlotHeight=210-countTop-countBottom,countSlot=countPlotWidth/values.length;
    for(const tick of [...new Set([0,maxCount])]){
      const y=countTop+countPlotHeight*(1-tick/maxCount);
      countChart.appendChild(s('line',{x1:countLeft,y1:y,x2:800-countRight,y2:y,class:'chart-grid'}));
      countChart.appendChild(s('text',{x:8,y:y+4,class:'axis-label'},String(tick)));
    }
    values.forEach((item,index)=>{
      const width=Math.max(2,countSlot*.24),base=countLeft+index*countSlot+countSlot*.25;
      for(const [key,value,offset] of [['failed',item.summary.failed,0],['flaky',item.summary.flaky,width*1.4]]){
        const height=countPlotHeight*value/maxCount;
        const bar=s('rect',{x:base+offset,y:countTop+countPlotHeight-height,width,height:Math.max(1,height),class:key+'-bar',tabindex:'0','aria-label':item.runId+' · '+key+': '+value+' · '+item.summary.total+' total tests'});
        bar.appendChild(s('title',{},item.runId+' · '+key+': '+value+' of '+item.summary.total+' tests'));
        countChart.appendChild(bar);
      }
    });
    countChart.appendChild(s('text',{x:countLeft,y:202,class:'axis-run'},values[0].runId));
    if(values.length>1)countChart.appendChild(s('text',{x:800-countRight,y:202,'text-anchor':'end',class:'axis-run'},values[values.length-1].runId));
    failures.appendChild(countChart);
    failures.appendChild(table(['Run','Date','Failed','Flaky','Total tests'],values.map(item=>[
      item.runId+(item.runId===model.run.runId?' · current':''),
      date(item),item.summary.failed,item.summary.flaky,item.summary.total
    ])));
    content.appendChild(failures);

    const durationCard=h('section',{class:'section-card trend-card','aria-labelledby':'lb-duration-trend-heading'});
    durationCard.appendChild(h('h3',{id:'lb-duration-trend-heading',text:'Run duration'}));
    durationCard.appendChild(h('p',{class:'muted',text:'Total recorded duration per complete run. Vertical axis starts at 0 seconds.'}));
    const maxDuration=Math.max(1,...values.map(item=>item.durationMs));
    const chart=s('svg',{class:'chart history-chart','viewBox':'0 0 800 210',role:'img','aria-label':'Run duration from zero to '+formatDuration(maxDuration)+' across complete runs'});
    const left=46,right=20,top=20,bottom=36,plotWidth=800-left-right,plotHeight=210-top-bottom;
    const slot=plotWidth/values.length;
    chart.appendChild(s('line',{x1:left,y1:top+plotHeight,x2:800-right,y2:top+plotHeight,class:'chart-grid'}));
    chart.appendChild(s('text',{x:4,y:top+plotHeight+4,class:'axis-label'},'0s'));
    chart.appendChild(s('text',{x:4,y:top+4,class:'axis-label'},formatDuration(maxDuration)));
    values.forEach((item,index)=>{
      const barHeight=plotHeight*item.durationMs/maxDuration;
      const rect=s('rect',{x:left+index*slot+slot*.2,y:top+plotHeight-barHeight,width:Math.max(2,slot*.6),height:Math.max(1,barHeight),class:item.runId===model.run.runId?'duration-bar current':'duration-bar'});
      rect.appendChild(s('title',{},item.runId+' · '+formatDuration(item.durationMs)));
      chart.appendChild(rect);
    });
    chart.appendChild(s('text',{x:left,y:202,class:'axis-run'},values[0].runId));
    if(values.length>1)chart.appendChild(s('text',{x:800-right,y:202,'text-anchor':'end',class:'axis-run'},values[values.length-1].runId));
    durationCard.appendChild(chart);
    durationCard.appendChild(table(['Run','Date','Duration'],values.map(item=>[
      item.runId+(item.runId===model.run.runId?' · current':''),
      date(item),formatDuration(item.durationMs)
    ])));
    content.appendChild(durationCard);
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
