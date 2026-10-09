export const PANEL_JS = `
let panelShown='',comparisonBaseline='';
function renderPanel(){
  const panel=document.getElementById('lb-panel'),backdrop=document.getElementById('lb-backdrop');
  const content=document.getElementById('lb-panel-content'),test=byId.get(state.test);
  panel.hidden=!test;backdrop.hidden=!test;if(!test){panelShown='';return}
  clear(content);
  const heading=document.getElementById('lb-panel-heading');heading.textContent=test.title;
  panel.dataset.status=statusKind(test);
  const fresh=panelShown!==test.testId;panelShown=test.testId;if(fresh)comparisonBaseline=document.body.classList.contains('focused-report')?(model.testHistory?.[test.testId]||[]).filter(entry=>!entry.commit||!model.run.env.git.commit||entry.commit!==model.run.env.git.commit).at(-1)?.runId||'':'';
  content.appendChild(chip(statusKind(test)));
  content.appendChild(h('p',{class:'muted',text:test.titlePath.join(' › ')}));
  content.appendChild(h('p',{},test.file+':'+test.line+' · '+(test.project||'(default)')+' · '+formatDuration(test.durationMs)));
  if(test.tags.length||test.caseIds.length)content.appendChild(h('p',{class:'muted',text:[...test.tags,...test.caseIds].join(' · ')}));
  content.appendChild(h('p',{class:'muted',text:test.attemptCount+' attempts'+(test.timing?' · worker '+test.timing.workerIndex:'')}));
  const toolsBox=h('details',{class:'report-debug-tools'},h('summary',{text:'Rerun and debug context'}));
  toolsBox.appendChild(h('h3',{text:'Rerun'}));
  const command=rerunCommand(test);toolsBox.appendChild(h('pre',{text:command}));
  toolsBox.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(command)},icon('copy'),'Copy rerun command'));
  toolsBox.appendChild(h('h3',{text:'AI-ready debug context'}));
  toolsBox.appendChild(h('p',{class:'muted',text:'Evidence only, not a diagnosis. Preview and review for secrets before sharing.'}));
  const debugPacket=buildDebugPacket(model.run,test.testId,model.recent?.[test.testId]||'',model.attachmentAvailability||{},detectSignals);
  toolsBox.appendChild(h('h3',{text:'Debugging clues'}));
  toolsBox.appendChild(h('p',{class:'muted',text:'Inferences from recorded evidence, not Playwright facts or a diagnosis.'}));
  for(const signal of debugPacket.signals)toolsBox.appendChild(h('p',{},h('strong',{text:signal.label+' · '}),signal.explanation,h('small',{text:signal.evidenceIds.length?'Evidence: '+signal.evidenceIds.join(', '):'Insufficient evidence'})));
  const debugText=debugPacketMarkdown(debugPacket);
  const preview=h('details',{},h('summary',{text:'Preview debug context'}),h('pre',{text:debugText}));
  toolsBox.appendChild(preview);
  toolsBox.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(debugText),text:'Copy debug context'}));
  const attempt=test.attempts[Math.min(state.attempt,test.attempts.length-1)];
  if(test.attempts.length>1){
    content.appendChild(h('h3',{text:'Attempts'}));const switcher=h('div',{class:'attempts'});
    test.attempts.forEach((item,index)=>switcher.appendChild(h('button',{class:'button',type:'button','aria-pressed':String(index===state.attempt),onclick:()=>setState({attempt:index}),text:'Attempt '+(index+1)+' · '+item.status+' · '+formatDuration(item.durationMs)})));
    content.appendChild(switcher);
  }
  const errors=attempt?.errors?.length?attempt.errors:test.firstError?[test.firstError]:[];
  if(test.firstError)content.appendChild(h('p',{class:'detail-error-headline',text:test.firstError.message.split('\\n')[0]}));
  if(test.annotations?.length){content.appendChild(h('h3',{text:'Annotations'}));for(const item of test.annotations)content.appendChild(h('p',{text:item.type+(item.description?' · '+item.description:'')}))}
  const evidence=h('section',{class:'detail-evidence'}),nav=h('div',{class:'evidence-nav',role:'tablist','aria-label':'Attempt evidence'});
  const keys=['steps','logs','errors','attachments'],panels={};
  const active=attempt?.attachments?.length?'attachments':errors.length?'errors':attempt?.steps?.length?'steps':'logs';
  for(const key of keys){const count=key==='steps'?(attempt?.steps?.length||0):key==='attachments'?(attempt?.attachments?.length||0):key==='errors'?errors.length:Number(Boolean(attempt?.stdout))+Number(Boolean(attempt?.stderr));
    const button=h('button',{type:'button',role:'tab','aria-selected':String(key===active),text:key[0].toUpperCase()+key.slice(1)+' '+count});
    const body=h('section',{class:'evidence-body',role:'tabpanel','data-evidence':key});body.hidden=key!==active;panels[key]=body;
    button.addEventListener('click',()=>{for(const other of nav.children)other.setAttribute('aria-selected',String(other===button));for(const [name,item] of Object.entries(panels))item.hidden=name!==key});nav.appendChild(button);
  }
  evidence.appendChild(nav);for(const key of keys)evidence.appendChild(panels[key]);content.appendChild(evidence);
  if(attempt?.steps?.length){const list=h('ol',{class:'steps'}),max=Math.max(1,...attempt.steps.map(step=>step.durationMs));let failedStep=null;
    for(const step of attempt.steps){const item=h('li',{class:step.failed?'failed':'',style:'--depth:'+Math.max(0,step.depth)},
      h('span',{class:'step-title',text:step.title}),h('span',{class:'step-duration',text:formatDuration(step.durationMs)}),h('span',{class:'heat'+(step.failed?' hot':'')},h('span',{style:'width:'+Math.max(2,Math.round(step.durationMs/max*100))+'%'})));
      if(step.failed&&!failedStep)failedStep=item;list.appendChild(item)}panels.steps.appendChild(list);
    if(fresh&&failedStep&&active==='steps')requestAnimationFrame(()=>failedStep.scrollIntoView({block:'nearest'}));
  }else panels.steps.appendChild(h('p',{class:'muted',text:'Steps not recorded for this attempt.'}));
  for(const channel of ['stdout','stderr']){const value=attempt?.[channel];panels.logs.appendChild(h('h4',{text:channel}));
    panels.logs.appendChild(value?h('pre',{text:value}):h('p',{class:'muted',text:value===''?'No output recorded.':'Not recorded.'}));
  }
  if(errors.length)for(const error of errors){panels.errors.appendChild(h('p',{class:'detail-error-headline',text:error.message.split('\\n')[0]}));
    panels.errors.appendChild(h('details',{},h('summary',{text:'Full recorded error'}),h('pre',{text:error.message})));
    if(error.snippet)panels.errors.appendChild(h('pre',{text:error.snippet}));
    if(error.stack)panels.errors.appendChild(h('details',{},h('summary',{text:'Stack trace'}),h('pre',{text:error.stack})));
  }else panels.errors.appendChild(h('p',{class:'muted',text:'No recorded errors for this attempt.'}));
  if(attempt?.attachments?.length)for(const attachment of attempt.attachments){
    const availability=attachment.path?(model.attachmentAvailability?.[attachment.path]||'unknown'):'inline';
    const href=attachment.path&&availability!=='missing'?links[attachment.path]:attachment.dataUri;
    const safe=attachmentHref(href),mime=attachment.contentType||'';
    const image=mime==='image/png'||mime==='image/jpeg',video=mime==='video/mp4'||mime==='video/webm';
    const preview=safe&&(image||video)?h('button',{class:'button',type:'button',onclick:()=>showAttachment(safe,attachment.name,mime),text:'View '+(image?'screenshot':'video')}):null;
    const card=h('div',{class:'report-attachment'},h('strong',{text:attachment.name}),h('small',{text:mime}),preview,
      safe?link('Download file',safe,attachment.path?.split('/').pop()||attachment.name):h('span',{class:'muted',text:availability==='missing'?'File not retained':'File link unavailable'}));
    if(attachment.dataUri&&image&&attachmentHref(attachment.dataUri))card.appendChild(h('img',{src:attachment.dataUri,alt:attachment.name,loading:'lazy'}));
    if(attachment.name==='trace'&&mime==='application/zip'&&attachment.path&&safe&&!safe.startsWith('data:')){
      const trace=traceCommand(attachment.path);card.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(trace),text:'Copy trace command'}));
    }
    panels.attachments.appendChild(card);
  }else panels.attachments.appendChild(h('p',{class:'muted',text:'No attachments recorded for this attempt.'}));
  if(attempt?.attachments?.length)panels.attachments.appendChild(h('p',{class:'muted',text:'Traces and attachments may contain page data or secrets. Review before sharing.'}));
  if(!test.attempts.some(item=>item.steps?.length||item.stdout||item.stderr||item.attachments?.some(a=>a.dataUri)))content.appendChild(h('p',{class:'muted',text:'Enable captureDetails to see steps, output and screenshots.'}));
  const history=[...(model.testHistory?.[test.testId]||[])].reverse();
  content.appendChild(h('h3',{text:'Recorded history · '+history.length}));
  content.appendChild(h('p',{class:'muted',text:'Available matching executions in the last 10 loaded runs. Missing runs and incomplete records do not establish a pass.'}));
  if(!history.length)content.appendChild(h('p',{class:'muted',text:'No earlier matching execution is available.'}));
  for(const entry of history){const sameRevision=Boolean(entry.commit&&model.run.env.git.commit&&entry.commit===model.run.env.git.commit);
    const button=sameRevision?null:h('button',{class:'button',type:'button','aria-pressed':String(comparisonBaseline===entry.runId),text:'Compare'});
    button?.addEventListener('click',()=>{comparisonBaseline=entry.runId;renderPanel();document.getElementById('lb-test-comparison')?.scrollIntoView({block:'center'})});
    content.appendChild(h('div',{class:'test-history-row'},h('span',{},chip(entry.outcome==='flaky'?'flaky':entry.status==='timedOut'?'failed':entry.status)),
      h('span',{text:entry.startedAt.replace('T',' ').slice(0,19)+' UTC · '+entry.runId+(entry.branch?' · '+entry.branch:'')+(entry.complete?'':' · incomplete')}),
      h('span',{text:formatDuration(entry.durationMs)}),button||h('small',{class:'muted',text:'Same commit'})));
  }
  const baseline=history.find(entry=>entry.runId===comparisonBaseline);
  if(baseline){content.appendChild(h('h3',{id:'lb-test-comparison',tabindex:'-1',text:'Compared with '+baseline.runId}));
    const beforeError=baseline.firstError?.message||'No recorded error',afterError=test.firstError?.message||'No recorded error';
    const changed=h('section',{class:'comparison-changes'},h('h4',{text:'What changed'}));
    for(const [label,before,after] of [['Status',baseline.status,test.status],['Recorded error',beforeError===afterError?'Same recorded message':'Different recorded messages',''],['Attempts',baseline.attemptCount,test.attemptCount],['Final-attempt duration',formatDuration(baseline.attempts.at(-1)?.durationMs??baseline.durationMs),formatDuration(test.attempts.at(-1)?.durationMs??test.durationMs)]])
      changed.appendChild(h('div',{},h('strong',{text:label}),h('span',{text:String(before)}),after?h('span',{text:'→ '+after}):null));
    content.appendChild(changed);
    content.appendChild(h('div',{class:'comparison-sides'},comparisonSide('Baseline',baseline,{runId:baseline.runId,startedAt:baseline.startedAt,branch:baseline.branch,commit:baseline.commit,complete:baseline.complete}),
      comparisonSide('Selected',test,{runId:model.run.runId,startedAt:model.run.startedAt,branch:model.run.env.git.branch,commit:model.run.env.git.commit,complete:model.run.complete})));
    if(baseline.firstError?.snippet||test.firstError?.snippet)content.appendChild(h('section',{class:'comparison-snippets'},h('h4',{text:'Recorded failure excerpts'}),
      h('div',{class:'comparison-sides'},h('pre',{text:baseline.firstError?.snippet||'No excerpt recorded.'}),h('pre',{text:test.firstError?.snippet||'No excerpt recorded.'}))));
    content.appendChild(h('p',{class:'muted',text:'Committed source diff is unavailable in an offline report: run records contain revision IDs and recorded excerpts, not both committed files. Working-tree changes at execution are unknown.'}));
  }
  content.appendChild(toolsBox);
  content.appendChild(h('button',{class:'button',type:'button',onclick:()=>copyText(location.href)},icon('link'),'Copy link'));
  if(fresh)heading.focus();
}
function comparisonSide(label,result,meta){const card=h('section',{class:'comparison-side'},h('h4',{text:label+' · '+meta.runId}),
  h('p',{class:'muted',text:meta.startedAt.replace('T',' ').slice(0,19)+' UTC · '+(meta.branch||'Branch unknown')+' · '+(meta.complete?'Complete':'Incomplete')}),
  chip(result.outcome==='flaky'?'flaky':result.status==='timedOut'?'failed':result.status));
  for(const [name,value] of [['Expected status',result.expectedStatus],['Outcome',result.outcome],['Project',result.project||'Unknown'],['Source',result.file+':'+result.line],['Commit',meta.commit||'Unknown']])
    card.appendChild(h('p',{},h('strong',{text:name+' · '}),String(value)));
  card.appendChild(h('h5',{text:'Recorded error'}));
  if(result.firstError){card.appendChild(h('pre',{text:result.firstError.message}));if(result.firstError.stack)card.appendChild(h('details',{},h('summary',{text:'Stack trace'}),h('pre',{text:result.firstError.stack})))}
  else card.appendChild(h('p',{class:'muted',text:result.status==='passed'||result.status==='skipped'?'No error recorded.':'Error metadata unavailable.'}));
  card.appendChild(h('h5',{text:'Recorded attempts'}));
  if(result.attempts.length)for(const item of result.attempts)card.appendChild(h('p',{text:'Attempt '+(item.retry+1)+' · '+item.status+' · '+formatDuration(item.durationMs)+' · '+item.errors.length+' errors'}));
  else card.appendChild(h('p',{class:'muted',text:'Attempt details unavailable.'}));
  return card;
}
function showAttachment(url,label,mime){const safe=attachmentHref(url);if(!safe)return;
  const dialog=document.getElementById('lb-lightbox');clear(dialog);
  dialog.appendChild(h('button',{class:'button',type:'button',onclick:()=>dialog.close(),text:'Close'}));
  dialog.appendChild(mime.startsWith('video/')?h('video',{src:safe,controls:'',style:'max-width:90vw;max-height:80vh'}):h('img',{src:safe,alt:label,style:'max-width:90vw;max-height:80vh'}));dialog.showModal();
}
`;
