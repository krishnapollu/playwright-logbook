export const HELP_JS = `
function showHelp(){const dialog=document.getElementById('lb-help-dialog');if(!dialog.childNodes.length){dialog.appendChild(h('h2',{text:'Keyboard shortcuts'}));dialog.appendChild(table(['Key','Action'],[['1–6','Switch tabs'],['/','Search tests'],['j / k','Move between rows'],['Enter / o','Open test'],['Esc','Close panel'],['[ / ]','Previous / next failure'],['t','Theme'],['?','Help']]));dialog.appendChild(h('button',{class:'button',type:'button',onclick:()=>dialog.close(),text:'Close'}))}dialog.showModal()}
`;
