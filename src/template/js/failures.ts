export const FAILURES_JS = `
function renderFailures(){
  const panel=document.getElementById('tab-failures');clear(panel);panel.appendChild(h('h2',{text:'Failures'}));
  const comparison=model.comparison;
  if(comparison){
    const cards=h('div',{class:'grid-cards failure-summary-grid'});
    for(const [key,label] of [['newFailures','New failures'],['fixed','Fixed'],['stillFailing','Still failing'],['newTests','New tests'],['removedTests','Removed tests']]){
      const items=comparison[key]||[],card=h('div',{class:'section-card failure-summary-card'},h('strong',{text:label+' · '+items.length}));
      for(const item of items.slice(0,10)){
        if(key==='removedTests'||!byId.has(item.testId)){card.appendChild(h('p',{text:item.title}));continue}
        const button=h('button',{class:'button',type:'button',text:item.title});
        button.addEventListener('click',()=>openTest(item.testId,button));card.appendChild(button);
      }
      cards.appendChild(card);
    }
    panel.appendChild(cards);
  }
  const history=(model.history||[]).filter(item=>item.complete);
  const chartRuns=history.slice(-20);
  const trend=h('section',{class:'section-card failure-trend','aria-labelledby':'lb-failure-trend-heading'});
  trend.appendChild(h('h3',{id:'lb-failure-trend-heading',text:'Failed tests by complete run'}));
  if(!chartRuns.length){
    trend.appendChild(h('p',{class:'empty',text:'No complete-run failure history is available.'}));
  }else{
    const max=Math.max(1,...chartRuns.map(item=>item.summary.failed));
    const width=640,height=150,left=34,right=12,top=12,bottom=28;
    const chart=s('svg',{class:'chart failure-chart',viewBox:'0 0 '+width+' '+height,role:'img','aria-labelledby':'lb-failure-chart-title lb-failure-chart-desc'});
    chart.appendChild(s('title',{id:'lb-failure-chart-title'},'Failed test count by complete run'));
    chart.appendChild(s('desc',{id:'lb-failure-chart-desc'},'Bars show the exact number of failed tests in each complete run. Failure counts do not identify whether the same tests failed.'));
    chart.appendChild(s('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,class:'chart-axis'}));
    const slot=(width-left-right)/chartRuns.length;
    chartRuns.forEach((item,index)=>{
      const count=item.summary.failed;
      const barHeight=(height-top-bottom)*count/max;
      const x=left+index*slot+slot*.2;
      const rect=s('rect',{x,y:height-bottom-barHeight,width:Math.max(2,slot*.6),height:Math.max(1,barHeight),class:item.runId===model.run.runId?'failure-bar current':'failure-bar'});
      rect.appendChild(s('title',{},item.runId+' · '+count+' failed'));
      chart.appendChild(rect);
    });
    trend.appendChild(chart);
    trend.appendChild(h('p',{class:'muted',text:'Latest '+chartRuns.length+' complete runs · counts do not imply the same tests failed.'}));
    trend.appendChild(table(['Run','Date','Failed'],chartRuns.map(item=>[
      item.runId+(item.runId===model.run.runId?' · current':''),
      h('time',{datetime:item.startedAt,title:item.startedAt,text:fmtDate(item.startedAt)}),
      item.summary.failed
    ])));
  }
  panel.appendChild(trend);
  const groups=model.errorGroups||[];
  if(!groups.length){panel.appendChild(h('p',{class:'empty',text:'No failures or flaky tests in this run.'}));return}
  for(const group of groups){
    const box=h('details',{class:'section-card'});
    box.appendChild(h('summary',{},group.signature+' · '+group.count+' tests · '+group.projects.join(', '),
      group.newCount?h('span',{class:'status-chip failed',text:' NEW '+group.newCount}):null));
    for(const id of group.testIds){
      const test=byId.get(id);if(!test)continue;
      const button=h('button',{class:'button',type:'button',text:test.title+' · '+test.project});
      button.addEventListener('click',()=>openTest(id,button));box.appendChild(h('p',{},button));
    }
    panel.appendChild(box);
  }
}
`;
