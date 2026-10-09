export const PANEL_JS = `
let panelShown='',comparisonBaseline='';
function renderPanel(){
  const panel=document.getElementById('lb-panel'),backdrop=document.getElementById('lb-backdrop');
  const content=document.getElementById('lb-panel-content'),test=byId.get(state.test);
  panel.hidden=!test;backdrop.hidden=!test;if(!test){panelShown='';return}
  clear(content);
  const heading=document.getElementById('lb-panel-heading');heading.textContent=test.title;
  panel.dataset.status=statusKind(test);
  const fresh=panelShown!==test.testId;panelShown=test.testId;if(fresh)comparisonBaseline='';
  content.appendChild(chip(statusKind(test)));
  content.appendChild(h('p',{class:'muted',text:test.titlePath.join(' › ')}));
  content.appendChild(h('p',{},test.file+':'+test.line+' · '+(test.project||'(default)')+' · '+formatDuration(test.durationMs)));
  if(test.tags.length||test.caseIds.length)content.appendChild(h('p',{class:'muted',text:[...test.tags,...test.caseIds].join(' · ')}));
  content.appendChild(h('p',{class:'muted',text:test.attemptCount+' attempts'+(test.timing?' · worker '+test.timing.workerIndex:'')}));
  content.appendChild(h('h3',{text:'Rerun'}));
  const command=rerunCommand(test);content.appendChild(h('pre',{text:command}));
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(command)},icon('copy'),'Copy rerun command'));
  content.appendChild(h('h3',{text:'AI-ready debug context'}));
  content.appendChild(h('p',{class:'muted',text:'Evidence only, not a diagnosis. Preview and review for secrets before sharing.'}));
  const debugPacket=buildDebugPacket(model.run,test.testId,model.recent?.[test.testId]||'',model.attachmentAvailability||{},detectSignals);
  content.appendChild(h('h3',{text:'Debugging clues'}));
  content.appendChild(h('p',{class:'muted',text:'Inferences from recorded evidence, not Playwright facts or a diagnosis.'}));
  for(const signal of debugPacket.signals)content.appendChild(h('p',{},h('strong',{text:signal.label+' · '}),signal.explanation,h('small',{text:signal.evidenceIds.length?'Evidence: '+signal.evidenceIds.join(', '):'Insufficient evidence'})));
  const debugText=debugPacketMarkdown(debugPacket);
  const preview=h('details',{},h('summary',{text:'Preview debug context'}),h('pre',{text:debugText}));
  content.appendChild(preview);
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(debugText),text:'Copy debug context'}));
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
    const availability=attachment.path?(model.attachmentAvailability?.[attachment.path]||'unknown'):'inline';
    const href=attachment.path&&availability!=='missing'?links[attachment.path]:attachment.dataUri;
    const traceAttachment=attachment.name==='trace'&&attachment.contentType==='application/zip';
    const kind=traceAttachment?'Trace':attachment.contentType?.startsWith('image/')?'Screenshot':attachment.contentType?.startsWith('video/')?'Video':'Attachment';
    content.appendChild(h('p',{},h('strong',{text:kind+' · '}),link(attachment.name,href,attachment.path?.split('/').pop()||attachment.name),h('small',{text:availability==='missing'?(attachment.dataUri?'Inline copy available':'File not retained'):availability==='unknown'?'Link unverified':availability==='inline'?'Inline attachment':''})));
    if(traceAttachment&&attachment.path&&availability!=='missing'&&!href?.startsWith('data:')){
      const trace=traceCommand(attachment.path||'');content.appendChild(h('pre',{text:trace}));
      content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(trace),text:'Copy trace command'}));
    }
    if(attachment.dataUri&&new RegExp('^data:image/(png|jpeg);base64,').test(attachment.dataUri)){
      const thumb=h('img',{src:attachment.dataUri,alt:attachment.name,style:'max-width:100%;max-height:220px'});
      thumb.addEventListener('click',()=>showImage(attachment.dataUri,attachment.name));content.appendChild(thumb);
    }
  }content.appendChild(h('p',{class:'muted',text:'Traces and attachments may contain page data or secrets. Review before sharing.'}))}
  if(attempt?.steps?.length){content.appendChild(h('h3',{text:'Steps'}));const list=h('ol',{class:'steps'});
    const max=Math.max(1,...attempt.steps.map(step=>step.durationMs));let failedStep=null;
    for(const step of attempt.steps){const item=h('li',{class:step.failed?'failed':'',style:'--depth:'+Math.max(0,step.depth)},
      h('span',{class:'step-title',text:step.title}),h('span',{class:'step-duration',text:formatDuration(step.durationMs)}),h('span',{class:'heat'+(step.failed?' hot':'')},h('span',{style:'width:'+Math.max(2,Math.round(step.durationMs/max*100))+'%'})));
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
  const history=[...(model.testHistory?.[test.testId]||[])].reverse();
  content.appendChild(h('h3',{text:'Recorded history · '+history.length}));
  content.appendChild(h('p',{class:'muted',text:'Available matching executions in the last 10 loaded runs. Missing runs and incomplete records do not establish a pass.'}));
  if(!history.length)content.appendChild(h('p',{class:'muted',text:'No earlier matching execution is available.'}));
  for(const entry of history){const button=h('button',{class:'button',type:'button','aria-pressed':String(comparisonBaseline===entry.runId),text:'Compare'});
    button.addEventListener('click',()=>{comparisonBaseline=entry.runId;renderPanel();document.getElementById('lb-test-comparison')?.scrollIntoView({block:'center'})});
    content.appendChild(h('div',{class:'test-history-row'},h('span',{},chip(entry.outcome==='flaky'?'flaky':entry.status==='timedOut'?'failed':entry.status)),
      h('span',{text:entry.startedAt.replace('T',' ').slice(0,19)+' UTC · '+entry.runId+(entry.branch?' · '+entry.branch:'')+(entry.complete?'':' · incomplete')}),
      h('span',{text:formatDuration(entry.durationMs)}),button));
  }
  const baseline=history.find(entry=>entry.runId===comparisonBaseline);
  if(baseline){content.appendChild(h('h3',{id:'lb-test-comparison',tabindex:'-1',text:'Compared with '+baseline.runId}));
    const currentError=test.firstError?.message.split('\\n')[0]||'No recorded error',previousError=baseline.firstError||'No recorded error';
    content.appendChild(h('div',{class:'test-comparison'},
      ...[['Status',baseline.status,test.status],['Attempts',baseline.attemptCount,test.attemptCount],['Duration',formatDuration(baseline.durationMs),formatDuration(test.durationMs)],['Error',previousError,currentError]].map(([label,before,after])=>
        h('div',{},h('strong',{text:label}),h('span',{text:String(before)}),h('span',{text:'→'}),h('span',{text:String(after)})))));
    content.appendChild(h('p',{class:'muted',text:'Recorded values only. Duration changes and similar errors do not establish a cause.'}));
  }
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(location.href)},icon('link'),'Copy link'));
  if(fresh)heading.focus();
}
function showImage(dataUri,label){const dialog=document.getElementById('lb-lightbox');clear(dialog);
  dialog.appendChild(h('button',{class:'button',type:'button',onclick:()=>dialog.close(),text:'Close'}));
  dialog.appendChild(h('img',{src:dataUri,alt:label,style:'max-width:90vw;max-height:80vh'}));dialog.showModal();
}
`;
