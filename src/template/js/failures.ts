export const FAILURES_JS = `
function renderFailures(){
  const panel=document.getElementById('tab-failures');clear(panel);panel.appendChild(h('h2',{text:'Failures'}));
  const comparison=model.comparison;
  if(comparison){
    const cards=h('div',{class:'grid-cards'});
    for(const [key,label] of [['newFailures','New failures'],['fixed','Fixed'],['stillFailing','Still failing'],['newTests','New tests'],['removedTests','Removed tests']]){
      const items=comparison[key]||[],card=h('div',{class:'section-card'},h('strong',{text:label+' · '+items.length}));
      for(const item of items.slice(0,10)){
        if(key==='removedTests'||!byId.has(item.testId)){card.appendChild(h('p',{text:item.title}));continue}
        const button=h('button',{class:'button',type:'button',text:item.title});
        button.addEventListener('click',()=>openTest(item.testId,button));card.appendChild(button);
      }
      cards.appendChild(card);
    }
    panel.appendChild(cards);
  }
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
