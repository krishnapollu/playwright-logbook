export const OVERVIEW_JS = `
function fmtDate(iso){if(!iso)return'Unknown';const d=new Date(iso);if(isNaN(d))return iso;const p=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',hour12:false}).formatToParts(d);const m=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return m.day+' '+m.month+' '+m.year+', '+m.hour+':'+m.minute+' UTC'}
function renderOverview(){
  const panel=document.getElementById('lb-overview-content');
  if(panel.dataset.ready)return;
  panel.dataset.ready='true';
  const run=model.run,sum=run.summary,comparison=model.comparison;
  // Verdict band
  const band=h('section',{id:'lb-cards',class:'verdict-band','aria-label':'Run verdict'});
  // Segmented bar
  const bar=h('div',{class:'seg-bar','role':'group','aria-label':'Filter tests by result status'});
  for(const [kind,count] of [['passed',sum.passed],['failed',sum.failed],['flaky',sum.flaky],['skipped',sum.skipped]]){
    if(!count)continue;
    const btn=h('button',{class:kind,type:'button',style:'flex-grow:'+count,'aria-label':kind+' '+count,'title':kind+' '+count});
    btn.addEventListener('click',()=>setState({tab:'tests',status:[kind==='passed'?'passed':kind]}));
    bar.appendChild(btn);
  }
  band.appendChild(bar);
  // Legend
  const legend=h('div',{class:'seg-legend'});
  for(const [kind,count] of [['passed',sum.passed],['failed',sum.failed],['flaky',sum.flaky],['skipped',sum.skipped]]){
    const btn=h('button',{class:kind,type:'button'});
    btn.appendChild(h('span',{class:'dot','aria-hidden':'true'}));
    btn.appendChild(document.createTextNode(kind[0].toUpperCase()+kind.slice(1)+' '+count));
    btn.addEventListener('click',()=>setState({tab:'tests',status:[kind]}));
    legend.appendChild(btn);
  }
  band.appendChild(legend);
  panel.appendChild(band);
  const comparisonPanel=document.querySelector('#tab-overview .comparison');
  if(comparisonPanel)panel.appendChild(comparisonPanel);
  // Comparison delta
  const delta=model.delta;
  if(delta){
    const comp=document.querySelector('.comparison');
    if(comp){
      const grid=comp.querySelector('.comparison-grid');
      if(grid){
        for(const metric of grid.querySelectorAll('.comparison-metric')){
          const strong=metric.querySelector('strong');
          if(!strong)continue;
          const text=strong.textContent||'';
          const num=parseFloat(text.replace(/[^0-9.+-]/g,''));
          if(isNaN(num)||num===0){strong.className='delta-neutral';continue}
          const label=metric.querySelector('span')?.textContent||'';
          const goodUp=label.includes('Pass rate');
          const isGood=goodUp?num>0:num<0;
          strong.className=isGood?'delta-good':'delta-bad';
          const arrow=h('span',{class:'delta-arrow','aria-hidden':'true',text:num>0?'↑':'↓'});
          strong.prepend(arrow);
        }
      }
    }
  }
  // Needs attention
  const attention=h('section',{class:'overview-card','aria-labelledby':'lb-attention-heading'});
  attention.appendChild(h('div',{class:'overview-card-head'},h('h2',{id:'lb-attention-heading',text:'Needs attention'}),h('button',{class:'text-button',type:'button',text:'All failures →',onclick:()=>selectTab('failures')})));
  const rows=[];
  for(const item of (comparison?.newFailures||[]).slice(0,3))rows.push({item,label:'New'});
  for(const item of (comparison?.stillFailing||[]).slice(0,3))rows.push({item,label:'Still failing'});
  const knownRows=rows.filter(({item})=>byId.has(item.testId));
  if(knownRows.length){
    for(const {item,label} of knownRows){
      const test=byId.get(item.testId);
      const row=h('div',{class:'overview-attention-item'});
      const button=h('button',{class:'overview-attention-row',type:'button','data-test-id':test.testId});
      button.addEventListener('click',()=>openTest(test.testId,button));
      button.appendChild(h('span',{class:'status-chip '+(label==='New'?'failed':'timedout'),text:label}));
      button.appendChild(h('span',{class:'attention-copy'},h('strong',{text:test.title}),h('small',{text:test.firstError?.message?.split('\\n')[0]||test.file+':'+test.line+' · '+test.project})));
      button.appendChild(recentStrip(model.recent?.[test.testId]));
      const copyBtn=h('button',{class:'btn btn-icon',type:'button','aria-label':'Copy debug context for '+test.title,title:'Copy debug context',onclick:(e)=>{e.stopPropagation();const pkt=buildDebugPacket(model.run,test.testId,model.recent?.[test.testId]||'',model.attachmentAvailability||{},detectSignals);copyText(debugPacketMarkdown(pkt))}});
      copyBtn.appendChild(icon('copy'));
      row.append(button,copyBtn);
      attention.appendChild(row);
    }
  }else{
    attention.appendChild(h('p',{class:'empty overview-empty',text:comparison?'No new or still-failing tests in this comparison.':'No earlier run is available to compare. Run history will appear here when a previous run is recorded.'}));
  }
  // Pass-rate sparkline
  const rates=model.history.filter(entry=>entry.complete&&entry.summary.total>0).slice(-12);
  const passRate=h('section',{class:'overview-card','aria-labelledby':'lb-pass-rate-heading'});
  passRate.appendChild(h('div',{class:'overview-card-head'},h('h2',{id:'lb-pass-rate-heading',text:'Pass rate'}),h('span',{class:'muted',text:rates.length?'Last '+rates.length+' complete runs':'No history'})));
  if(rates.length){
    const vals=rates.map(e=>Math.round(e.summary.passed/e.summary.total*100));
    const cur=vals[vals.length-1];
    const prev=vals.length>1?vals[vals.length-2]:null;
    const delta2=prev!==null?cur-prev:null;
    const W=300,H=90,pad=8;
    const minV=Math.max(0,Math.min(...vals)-5),maxV=Math.min(100,Math.max(...vals)+5);
    const range=maxV-minV||1;
    const pts=vals.map((v,i)=>{const x=pad+(vals.length===1?(W-2*pad)/2:i*(W-2*pad)/(vals.length-1));const y=H-pad-(v-minV)/(range)*(H-2*pad);return{x,y,v}});
    const spark=s('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':'true'});
    if(pts.length>1)spark.appendChild(s('polyline',{points:pts.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'var(--accent)','stroke-width':'2','stroke-linejoin':'round'}));
    const last=pts[pts.length-1];
    spark.appendChild(s('circle',{cx:last.x,cy:last.y,r:4,fill:'var(--accent)'}));
    const deltaText=delta2===null?'':(delta2>0?'+'+delta2+' pp':delta2<0?delta2+' pp':'no change')+' vs '+rates[rates.length-2].runId;
    const deltaClass=delta2===null?'delta-neutral':delta2>0?'delta-good':delta2<0?'delta-bad':'delta-neutral';
    passRate.appendChild(h('div',{class:'sparkline-card'},spark,h('div',{class:'sparkline-value'},h('strong',{text:cur+'%'}),h('span',{class:'muted',text:rates[rates.length-1].runId}),h('span',{class:'spark-delta '+deltaClass,text:deltaText}))));
  }else{
    passRate.appendChild(h('p',{class:'empty overview-empty',text:'A pass-rate history needs a complete run with recorded tests.'}));
  }
  panel.appendChild(h('div',{class:'overview-grid'},attention,passRate));
  // Tests to explore
  const recent2=h('section',{class:'overview-card recent-tests','aria-labelledby':'lb-recent-tests-heading'});
  const ordered=sortTests(allTests,'default').slice(0,6);
  recent2.appendChild(h('div',{class:'overview-card-head'},h('h2',{id:'lb-recent-tests-heading',text:'Tests to explore'}),h('button',{class:'text-button',type:'button',text:'View all '+allTests.length+' tests →',onclick:()=>selectTab('tests')})));
  if(!ordered.length){
    recent2.appendChild(h('p',{class:'empty overview-empty',text:'No tests were recorded in this run.'}));
  }else{
    const list=h('ul',{class:'overview-test-list'});
    for(const test of ordered){
      const button=h('button',{class:'overview-test-row',type:'button','data-test-id':test.testId});
      button.addEventListener('click',()=>openTest(test.testId,button));
      button.appendChild(chip(statusKind(test)));
      button.appendChild(h('span',{},h('strong',{text:test.title}),h('small',{text:test.file+':'+test.line+' · '+(test.project||'(default)')})));
      button.appendChild(h('span',{class:'muted',text:formatDuration(test.durationMs)}));
      list.appendChild(h('li',{},button));
    }
    recent2.appendChild(list);
  }
  panel.appendChild(recent2);
}
`;
