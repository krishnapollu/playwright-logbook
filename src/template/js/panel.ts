export const PANEL_JS = `
let panelShown='';
function renderPanel(){
  const panel=document.getElementById('lb-panel'),backdrop=document.getElementById('lb-backdrop');
  const content=document.getElementById('lb-panel-content'),test=byId.get(state.test);
  panel.hidden=!test;backdrop.hidden=!test;if(!test){panelShown='';return}
  clear(content);
  const heading=document.getElementById('lb-panel-heading');heading.textContent=test.title;
  const fresh=panelShown!==test.testId;panelShown=test.testId;
  content.appendChild(chip(statusKind(test)));
  content.appendChild(h('p',{class:'muted',text:test.titlePath.join(' › ')}));
  content.appendChild(h('p',{},test.file+':'+test.line+' · '+(test.project||'(default)')+' · '+formatDuration(test.durationMs)));
  if(test.tags.length||test.caseIds.length)content.appendChild(h('p',{class:'muted',text:[...test.tags,...test.caseIds].join(' · ')}));
  content.appendChild(h('p',{class:'muted',text:test.attemptCount+' attempts'+(test.timing?' · worker '+test.timing.workerIndex:'')}));
  content.appendChild(h('h3',{text:'Rerun'}));
  const command=rerunCommand(test);content.appendChild(h('pre',{text:command}));
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(command)},icon('copy'),'Copy rerun command'));
  const attempt=test.attempts[Math.min(state.attempt,test.attempts.length-1)];
  if(test.attempts.length>1){
    content.appendChild(h('h3',{text:'Attempts'}));const switcher=h('div',{class:'attempts'});
    test.attempts.forEach((item,index)=>switcher.appendChild(h('button',{class:'button',type:'button','aria-pressed':String(index===state.attempt),onclick:()=>setState({attempt:index}),text:'Attempt '+(index+1)+' · '+item.status+' · '+formatDuration(item.durationMs)})));
    content.appendChild(switcher);
  }
  const errors=attempt?.errors?.length?attempt.errors:test.firstError?[test.firstError]:[];
  if(errors.length){content.appendChild(h('h3',{text:'Error'}));for(const error of errors){
    content.appendChild(h('p',{text:error.message.split('\\n')[0]}));
    if(error.snippet)content.appendChild(h('pre',{text:error.snippet}));
    if(error.stack)content.appendChild(h('details',{},h('summary',{text:'Stack trace'}),h('pre',{text:error.stack})));
  }}
  if(test.annotations?.length){content.appendChild(h('h3',{text:'Annotations'}));for(const item of test.annotations)content.appendChild(h('p',{text:item.type+(item.description?' · '+item.description:'')}))}
  if(attempt?.attachments?.length){content.appendChild(h('h3',{text:'Attachments'}));for(const attachment of attempt.attachments){
    const href=attachment.path&&links[attachment.path];content.appendChild(h('p',{},link(attachment.name,href)));
    if(attachment.path&&(attachment.name==='trace'||attachment.path.endsWith('.zip'))){
      const trace=traceCommand(attachment.path||'');content.appendChild(h('pre',{text:trace}));
      content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(trace),text:'Copy trace command'}));
    }
    if(attachment.dataUri&&new RegExp('^data:image/(png|jpeg);base64,').test(attachment.dataUri)){
      const thumb=h('img',{src:attachment.dataUri,alt:attachment.name,style:'max-width:100%;max-height:220px'});
      thumb.addEventListener('click',()=>showImage(attachment.dataUri,attachment.name));content.appendChild(thumb);
    }
  }}
  if(attempt?.steps?.length){content.appendChild(h('h3',{text:'Steps'}));const list=h('ol',{class:'steps'});
    const max=Math.max(1,...attempt.steps.map(step=>step.durationMs));let failedStep=null;
    for(const step of attempt.steps){const item=h('li',{class:step.failed?'failed':'',style:'margin-left:'+(step.depth*12)+'px'},
      h('span',{text:step.title+' · '+formatDuration(step.durationMs)}),h('span',{class:'heat'+(step.failed?' hot':'')},h('span',{style:'width:'+Math.max(2,Math.round(step.durationMs/max*100))+'%'})));
      if(step.failed&&!failedStep)failedStep=item;list.appendChild(item)}content.appendChild(list);
    if(fresh&&failedStep)requestAnimationFrame(()=>failedStep.scrollIntoView({block:'nearest'}));
  }
  if(attempt?.stdout||attempt?.stderr){content.appendChild(h('h3',{text:'Output'}));
    const tabs=h('div',{class:'attempts'}),output=h('pre',{});
    for(const [label,value] of [['stdout',attempt.stdout],['stderr',attempt.stderr]])if(value){
      const button=h('button',{class:'button',type:'button','aria-pressed':String(!output.textContent),text:label});
      button.addEventListener('click',()=>{output.textContent=value;for(const other of tabs.children)other.setAttribute('aria-pressed',String(other===button))});
      tabs.appendChild(button);if(!output.textContent)output.textContent=value;
    }
    content.appendChild(tabs);content.appendChild(output);
  }
  if(!test.attempts.some(item=>item.steps?.length||item.stdout||item.stderr||item.attachments?.some(a=>a.dataUri)))content.appendChild(h('p',{class:'muted',text:'Enable captureDetails to see steps, output and screenshots.'}));
  content.appendChild(h('h3',{text:'Last 10 results'}));content.appendChild(recentStrip(model.recent?.[test.testId]));
  const previous=model.recent?.[test.testId]?.at(-1);
  content.appendChild(h('p',{class:'muted',text:'Previous run: '+({'p':'passed','f':'failed','k':'flaky','s':'skipped','-':'absent'}[previous]||'absent')}));
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(location.href)},icon('link'),'Copy link'));
  if(fresh)heading.focus();
}
function showImage(dataUri,label){const dialog=document.getElementById('lb-lightbox');clear(dialog);
  dialog.appendChild(h('button',{class:'button',type:'button',onclick:()=>dialog.close(),text:'Close'}));
  dialog.appendChild(h('img',{src:dataUri,alt:label,style:'max-width:90vw;max-height:80vh'}));dialog.showModal();
}
`;
