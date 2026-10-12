export const PERF_JS = `
function renderPerf(){
  const panel=document.getElementById('tab-perf');clear(panel);
  panel.appendChild(h('h2',{text:'Performance'}));
  panel.appendChild(h('p',{class:'muted',text:'Playwright test timings from this run. Durations include retries; parallel tests can overlap, so their sum is not the run wall time.'}));
  const tests=allTests.filter(test=>test.attemptCount>0&&Number.isFinite(test.durationMs)&&test.durationMs>=0);
  if(!tests.length){panel.appendChild(h('p',{class:'empty',text:'No completed test timings are available for this run.'}));return}
  const durations=tests.map(test=>test.durationMs).sort((a,b)=>a-b);
  const percentile=value=>durations[Math.max(0,Math.ceil(durations.length*value)-1)];
  const retryTime=tests.reduce((total,test)=>total+test.attempts.slice(0,-1).reduce((sum,attempt)=>sum+attempt.durationMs,0),0);
  const summary=h('div',{class:'perf-summary'});
  for(const [label,value,note] of [
    ['Median test',formatDuration(percentile(.5)),'Half of recorded tests finished within this time.'],
    ['95th percentile',formatDuration(percentile(.95)),'Nearest-rank duration across recorded tests.'],
    ['Retry time',formatDuration(retryTime),'Time spent in attempts before the final attempt.'],
    ['Run wall time',formatDuration(model.run.durationMs),'Elapsed time for the run, including parallel work.']
  ])summary.appendChild(h('div',{class:'section-card perf-stat'},h('span',{text:label}),h('strong',{text:value}),h('small',{text:note})));
  panel.appendChild(summary);
  const slow=[...tests].sort((a,b)=>b.durationMs-a.durationMs||(a.testId<b.testId?-1:a.testId>b.testId?1:0)).slice(0,10);
  const slowCard=h('section',{class:'section-card perf-slow'},h('h3',{text:'Slowest tests'}),h('p',{class:'muted',text:'Total test time across attempts. Select a test to inspect its timing and evidence.'}));
  const max=Math.max(1,slow[0].durationMs);
  for(const test of slow){
    const button=h('button',{type:'button',class:'perf-test',onclick:()=>openTest(test.testId)},
      h('span',{class:'perf-test-name',text:test.title}),
      h('span',{class:'perf-test-track','aria-hidden':'true'},h('span',{style:'width:'+Math.max(2,test.durationMs/max*100)+'%'})),
      h('span',{class:'perf-test-value',text:formatDuration(test.durationMs)}));
    slowCard.appendChild(button);
  }
  panel.appendChild(slowCard);
  const steps=[];
  for(const test of tests)for(const attempt of test.attempts)for(const step of attempt.steps||[]){
    if(!Number.isFinite(step.durationMs)||step.durationMs<0)continue;
    const item={test,step,retry:attempt.retry};
    const before=steps.findIndex(other=>item.step.durationMs>other.step.durationMs||item.step.durationMs===other.step.durationMs&&item.test.testId<other.test.testId);
    if(before>=0)steps.splice(before,0,item);else if(steps.length<10)steps.push(item);
    if(steps.length>10)steps.pop();
  }
  const stepCard=h('section',{class:'section-card perf-steps'},h('h3',{text:'Longest recorded steps'}));
  if(steps.length){
    stepCard.appendChild(h('p',{class:'muted',text:'Individual step durations can overlap when steps are nested. Steps are recorded when captureDetails is enabled.'}));
    stepCard.appendChild(table(['Step','Test','Attempt','Duration'],steps.map(({test,step,retry})=>[
      step.title,h('button',{type:'button',class:'text-button',text:test.title,onclick:()=>openTest(test.testId)}),retry+1,formatDuration(step.durationMs)
    ])));
  }else stepCard.appendChild(h('p',{class:'muted',text:'No step timings were recorded. Enable captureDetails in the Logbook reporter options to see them.'}));
  panel.appendChild(stepCard);
  panel.appendChild(h('p',{class:'muted perf-scope',text:'Browser navigation, network and Web Vitals are not captured by reporter-only setup.'}));
}
`;
