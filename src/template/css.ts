import { tokensToCss } from './tokens.js';

export const REPORT_CSS = `:root{${tokensToCss('light')} --topbar-h:56px; --sidebar-w:196px; --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --r-card:12px; --r-ctl:8px; --r-pill:999px; --t-xs:12px; --t-sm:13px; --t-md:14px; --t-lg:16px; --t-xl:20px; --t-2xl:26px; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color-scheme:light}
:root[data-theme="dark"]{${tokensToCss('dark')}color-scheme:dark}
:root[data-theme="light"]{${tokensToCss('light')}color-scheme:light}
:root[data-theme="light"][data-palette="ivory"]{${tokensToCss('ivoryLight')}}
:root[data-theme="dark"][data-palette="ivory"]{${tokensToCss('ivoryDark')}}
:root[data-theme="light"][data-palette="github"]{${tokensToCss('githubLight')}}
:root[data-theme="dark"][data-palette="github"]{${tokensToCss('githubDark')}}
*{box-sizing:border-box}html{font-size:14px}body{margin:0;background:var(--bg);color:var(--text);font-size:var(--t-md);line-height:1.5;font-variant-numeric:tabular-nums}button,input,select{font:inherit}button{cursor:pointer}a{color:var(--accent)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.skip-link{position:absolute;top:-80px;left:12px;z-index:30;background:var(--surface);padding:8px}.skip-link:focus{top:12px}.topbar{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:var(--shadow)}.topbar-inner{max-width:1440px;margin:auto;padding:8px 20px;display:flex;align-items:center;gap:16px;min-height:56px}.wordmark{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;color:var(--text);text-decoration:none}.wordmark svg,.icon{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.topbar-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.topbar-actions{margin-left:auto;display:flex;gap:6px}.btn,.button,.topbar-actions button,.chip-button,.select,.input{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:var(--r-ctl);padding:6px 10px;display:inline-flex;align-items:center;gap:5px;min-height:36px;transition:background 140ms ease-out}.btn:hover,.button:hover,.topbar-actions button:hover,.chip-button:hover{background:var(--surface-2)}.btn-icon{padding-inline:10px;min-width:36px;justify-content:center}.btn-secondary{background:var(--surface-2)}.optional{opacity:.9}.input,.select{min-height:36px;padding:0 10px;background-color:var(--surface);color:var(--text)}input[type="search"],.input{min-height:40px;padding:0 12px;min-width:220px;flex:1}.select{appearance:none;-webkit-appearance:none;padding-right:28px;background-image:url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Cpath d="M3.5 6.5 8 11l4.5-4.5" fill="none" stroke="%23626d7d" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 10px center;background-size:12px 12px}.select:focus,.input:focus,.btn:focus{outline:2px solid var(--accent);outline-offset:2px}h1{font-size:24px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:0 0 14px}h3{font-size:16px;margin:20px 0 8px}.muted,small{color:var(--muted)}.banner{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:12px 16px;margin:12px 0border-color:var(--flaky);color:var(--text)}.tabs button{background:none;white-space:nowrap}.panel[hidden]{display:none}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}.toolbar input,.toolbar select{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 9px}.toolbar input{min-width:220px;flex:1}.chip-button[aria-pressed="true"]{border-color:var(--accent);background:var(--surface-2)}.table-wrap{max-height:min(65vh,560px);overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}th{position:sticky;top:0;z-index:1;font-size:12px;color:var(--muted);font-weight:600;background:var(--surface)}td{font-size:13px}tbody tr:last-child td{border-bottom:0}tr[data-test-id]{cursor:pointer}tr[data-test-id]:hover{background:var(--surface-2)}td strong{display:block;font-weight:500;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td small{display:block;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.status-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;border-radius:999px;padding:3px 7px;white-space:nowrap}.status-chip.passed{color:var(--passed);background:var(--passed-bg)}.status-chip.failed,.status-chip.timedout{color:var(--failed);background:var(--failed-bg)}.status-chip.flaky{color:var(--flaky);background:var(--flaky-bg)}.status-chip.skipped{color:var(--skipped);background:var(--skipped-bg)}.status-chip .mark{font-size:12px}.heat{display:block;height:3px;background:var(--surface-2);border-radius:3px;margin-top:5px}.heat span{display:block;height:100%;background:var(--accent)}.heat.hot span{background:var(--flaky)}.recent{display:flex;gap:3px}.recent span{width:9px;height:9px;border-radius:2px;background:var(--border)}.recent .passed{background:var(--passed)}.recent .failed{background:repeating-linear-gradient(135deg,var(--failed)0 2px,var(--failed-bg)2px 4px)}.recent .flaky{background:linear-gradient(90deg,var(--flaky)50%,var(--flaky-bg)50%)}.recent .skipped{background:var(--skipped)}.empty{padding:32px;text-align:center;color:var(--muted)}.group-header{background:var(--surface-2);font-weight:600}.section-card{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:16px;margin:12px 0}.grid-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.panel-backdrop{position:fixed;inset:0;background:var(--shadow);z-index:25}.detail-panel{position:fixed;z-index:26;right:0;top:0;bottom:0;width:min(520px,100vw);overflow:auto;background:var(--surface);border-left:1px solid var(--border);box-shadow:var(--shadow);padding:20px}.detail-panel[hidden],.panel-backdrop[hidden]{display:none}.panel-head{display:flex;align-items:center;gap:8px;position:sticky;top:-20px;background:var(--surface);padding:12px 0;z-index:1}.panel-head h2{margin:0;flex:1}.detail-panel pre{background:var(--code-bg);border:1px solid var(--border);border-radius:6px;padding:12px;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.attempts{display:flex;gap:6px;flex-wrap:wrap}.attempts button[aria-pressed="true"]{border-color:var(--accent)}.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);border-radius:6px;padding:8px 14px;z-index:50}.toast[hidden]{display:none}.help-dialog,.lightbox{border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);max-width:min(600px,95vw);box-shadow:var(--shadow)}.help-dialog::backdrop,.lightbox::backdrop{background:var(--shadow)}.chart{width:100%;height:190px;background:var(--surface);border:1px solid var(--border);border-radius:12px}.chart line,.chart path{stroke:var(--accent);fill:none;stroke-width:2}.chart rect{fill:var(--surface-2)}.chart text{fill:var(--muted);font-size:10px}.timeline{width:100%;min-width:700px;height:auto;min-height:160px}.timeline rect.passed{fill:var(--passed)}.timeline rect.failed{fill:var(--failed)}.timeline rect.flaky{fill:var(--flaky)}footer{color:var(--muted);padding:32px 0}.error-banner{border:1px solid var(--failed);color:var(--failed);padding:12px}.error-banner[hidden]{display:none}button{transition:background 140ms ease-out}svg{overflow:visible}
.detail-panel{width:min(1040px,96vw);right:50%;top:3vh;bottom:3vh;transform:translateX(50%);border:1px solid var(--border);border-radius:12px}.test-history-row{display:grid;grid-template-columns:90px minmax(0,1fr) 80px auto;gap:12px;align-items:center;border-bottom:1px solid var(--border);padding:8px 0}.test-history-row span{overflow-wrap:anywhere}.test-comparison{display:grid;gap:8px}.test-comparison>div{display:grid;grid-template-columns:100px minmax(0,1fr) 24px minmax(0,1fr);gap:8px;border-bottom:1px solid var(--border);padding:8px 0}.test-comparison span{overflow-wrap:anywhere}.detail-panel li.failed{color:var(--failed)}.topbar .status-chip{font-size:11px}.section-card button{margin:4px}.panel .chart{margin:12px 0}

.chart .trend-area{fill:var(--passed-bg);stroke:none}.chart .trend-line{fill:none;stroke:var(--accent);stroke-width:2}.chart .trend-dot{fill:var(--accent);stroke:none}.group-header{cursor:pointer}
.steps{padding-left:20px}.steps li{padding:5px 0;border-bottom:1px solid var(--border)}.steps li.failed{font-weight:600}
.tag-chip,.case-chip{display:inline-block;padding:1px 5px;margin:1px 3px 1px 0;border:1px solid var(--border);border-radius:6px;color:var(--muted);white-space:nowrap}.case-chip{background:var(--surface-2)}
[hidden]{display:none!important}.eyebrow{margin:0 0 5px;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}.eyebrow strong{color:var(--accent);font-weight:700;margin-left:5px}.comparison{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:16px;margin:0 0 8px}.comparison-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.comparison h2{font-size:15px;margin:0 0 3px}.comparison p{margin:0;color:var(--muted);font-size:12px}.comparison code{font:inherit;color:var(--text)}.comparison-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.comparison-metric{padding:9px 12px;background:var(--surface-2);border-radius:8px;min-width:0}.comparison-metric span{display:block;color:var(--muted);font-size:11px}.comparison-metric strong{display:block;margin-top:2px;font-size:18px;font-variant-numeric:tabular-nums}.comparison-empty{border-style:dashed}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px}.pagination p{margin:0;color:var(--muted);font-size:12px}
@media(max-width:1100px){.topbar-title{display:none}}
@media(max-width:640px){.topbar-inner{padding:8px 12px}.topbar-actions .optional{display:none}.detail-panel{width:100vw;top:0;bottom:0;border:0;border-radius:0}.test-history-row{grid-template-columns:1fr auto}.test-comparison>div{grid-template-columns:1fr 1fr}.toolbar input{min-width:100%}.comparison-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison-head{align-items:flex-start;flex-direction:column}.pagination{flex-direction:column;align-items:stretch}}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
.panel-backdrop{background:rgba(44,48,52,.68)}
.detail-panel{padding:0;background:var(--surface);border:1px solid var(--border);box-shadow:0 24px 70px rgba(0,0,0,.28)}
.panel-head{top:0;padding:14px 20px;background:var(--surface-2);border-bottom:1px solid var(--border)}
#lb-panel-content{padding:8px 24px 28px}
#lb-panel-content>h3{margin-top:24px;border-top:1px solid var(--border);padding-top:16px}
#lb-panel-content>.status-chip{margin-top:8px}
.steps{list-style:none;padding:0;margin:8px 0}
.steps li{display:grid;grid-template-columns:minmax(0,1fr) 90px;column-gap:16px;align-items:center;padding:7px 8px;border-bottom:1px solid var(--border)}
.steps .step-title{padding-left:calc(var(--depth)*16px);overflow-wrap:anywhere}
.steps .step-duration{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.steps .heat{grid-column:1/-1;margin:4px 0 0}
.test-comparison{border:1px solid var(--accent);border-radius:8px;background:var(--surface);padding:8px 16px}
.focused-report .panel-backdrop,.focused-report #lb-panel-close{display:none!important}
.focused-report .focused-intro{margin:20px auto 14px;padding:18px 22px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.focused-report .detail-panel{position:static;transform:none;width:min(1160px,calc(100% - 32px));max-height:none;margin:0 auto 28px;overflow:visible}
.focused-report .panel-head{position:static}
.focused-report #lb-copy-summary,.focused-report #lb-download,.focused-report .skip-link{display:none}
.detail-error-headline{padding:10px 12px;border-left:3px solid var(--failed);background:var(--failed-bg);font-weight:600}
.detail-evidence{margin:16px 0;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)}
.detail-evidence .evidence-nav{display:flex;flex-wrap:wrap;border-bottom:1px solid var(--border);background:var(--surface-2)}
.detail-evidence .evidence-nav button{border:0;border-radius:0;background:transparent;color:var(--text);padding:10px 14px}
.detail-evidence .evidence-nav button[aria-selected="true"]{box-shadow:inset 0 -3px var(--accent);font-weight:700}
.evidence-body{padding:14px 16px;min-height:90px}
dialog.detail-panel .evidence-body{max-height:min(55vh,480px);overflow:auto}
.evidence-body h4{margin:8px 0;color:var(--muted)}
.report-attachment{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:12px;border:1px solid var(--border);border-radius:8px;margin:8px 0;background:var(--surface-2)}
.report-attachment strong{font-size:14px}.report-attachment small{color:var(--muted)}
.report-attachment img{display:block;max-width:100%;max-height:160px;object-fit:contain;flex-basis:100%}
.report-debug-tools{margin-top:24px;padding:12px;border:1px solid var(--border);border-radius:8px}
.comparison-changes,.comparison-side,.comparison-snippets{border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface)}
.comparison-changes>div{display:grid;grid-template-columns:150px minmax(0,1fr) minmax(0,1fr);gap:12px;border-top:1px solid var(--border);padding:7px 0}
.comparison-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
.comparison-side pre,.comparison-snippets pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}
@media(max-width:640px){.comparison-sides{grid-template-columns:1fr}.comparison-changes>div{grid-template-columns:1fr 1fr}}
@media(max-width:640px){#lb-panel-content{padding:8px 16px 24px}}
.report-shell{max-width:1440px;min-height:calc(100vh - 56px);margin:0 auto;display:grid;grid-template-columns:196px minmax(0,1fr)}
.report-sidebar{min-width:0;background:var(--surface);border-right:1px solid var(--border)}
.tabs{position:sticky;top:72px;display:flex;flex-direction:column;align-items:stretch;gap:3px;overflow:visible;margin:0;padding:18px 10px;border:0}
.tabs .nav-group{display:grid;gap:3px}
.tabs .nav-label{margin:11px 10px 5px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.tabs button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:8px 10px;border:0;border-radius:8px;border-bottom:0;color:var(--muted);text-align:left}
.tabs button[aria-current="page"]{color:var(--accent);background:var(--surface-2);font-weight:650}
.tabs button .icon{width:17px;height:17px;flex:none}
.tabs button .nav-count{margin-left:auto;color:inherit;font-size:12px;font-variant-numeric:tabular-nums}
.report-content{min-width:0;padding:24px clamp(16px,3vw,36px) 40px}
.panel[hidden]{display:none}
.overview-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:0 0 18px}
.overview-header>div{min-width:0}
.overview-header h1{margin:3px 0 9px;font-size:26px;letter-spacing:-.03em}
.overview-header>.status-chip{margin-top:4px}
.incomplete-banner .banner{margin:0 0 16px}
.overview-meta{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;color:var(--muted);font-size:13px}
.overview-meta>span{overflow-wrap:anywhere}
.status-chip.incomplete{color:var(--flaky);background:var(--flaky-bg)}
.banner{border-color:var(--flaky);background:var(--flaky-bg)}
.comparison{margin:14px 0}
.overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}
.overview-title-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.overview-title-row h1{margin:3px 0 9px}
.overview-title-row .status-chip{flex:none}
.overview-card{min-width:0;padding:15px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.overview-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.overview-card-head h2{margin:0;font-size:16px}
.overview-card-head .muted{font-size:12px}
.text-button{padding:3px 0;border:0;background:none;color:var(--accent);font-weight:600;white-space:nowrap}
.overview-attention-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;border-top:1px solid var(--border)}
.overview-attention-row,.overview-test-row{display:flex;align-items:center;gap:10px;width:100%;min-width:0;padding:10px 0;border:0;background:transparent;color:var(--text);text-align:left}
.attention-copy,.overview-test-row>span:nth-child(2){flex:1;min-width:0}
.overview-attention-row strong,.overview-test-row strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.test-title-link{display:block;overflow:hidden;color:var(--text);text-overflow:ellipsis;white-space:nowrap;font-weight:500;text-decoration:none}
.test-title-link:hover{text-decoration:underline}
.overview-attention-row small,.overview-test-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.overview-attention-row:hover,.overview-test-row:hover{background:var(--surface-2)}
.overview-attention-item>.btn-icon{min-width:32px;min-height:32px;padding:5px}
.overview-empty{padding:20px 8px}
.overview-test-list{list-style:none;margin:0;padding:0}
.overview-test-row .status-chip{flex:none}
.overview-test-row .muted{flex:none;font-variant-numeric:tabular-nums}
.panel>h2{margin:0 0 14px}
.toolbar .chip-button{min-height:36px}
.toolbar select{max-width:100%}
.panel .table-wrap{margin:10px 0 14px}
.panel table{min-width:640px}
.panel th{position:sticky;top:0;background:var(--surface)}
.panel td strong,.panel td small{max-width:440px}
.failure-trend h3{margin:0 0 10px}
.failure-chart{height:190px;padding:8px}
.failure-chart .failure-bar{fill:var(--failed);opacity:.75}
.failure-chart .failure-bar.current{opacity:1}
.failure-chart .chart-axis{stroke:var(--border);stroke-width:1}
.failure-trend>.muted{margin:7px 0}
.failure-trend .table-wrap{max-height:280px;overflow:auto}
.failure-trend table{min-width:420px}
.failure-trend th{position:static;top:auto}
.failure-trend td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.history-chart{display:block;width:100%;height:auto;min-height:150px;margin:12px 0}
.history-chart .chart-grid{stroke:var(--border);stroke-width:1}
.history-chart .axis-label,.history-chart .axis-run{fill:var(--muted);font-size:12px}
.history-chart .trend-line{fill:none;stroke:var(--accent);stroke-width:2.5}
.history-chart .trend-dot{fill:var(--surface);stroke:var(--accent);stroke-width:2}
.history-chart .trend-dot.current{fill:var(--accent);stroke:var(--text);stroke-width:3}
.history-chart .trend-dot:focus{outline:none;stroke:var(--text);stroke-width:4}
.history-chart .trend-mean{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:6 4}
.history-chart .trend-crosshair{stroke:var(--accent);stroke-width:1.5;stroke-dasharray:3 3}
.history-chart .duration-bar{fill:var(--accent);opacity:.72}
.history-chart .duration-bar.current{fill:var(--failed);opacity:1}
.trend-card h3{margin:0 0 4px}
.trend-card>.muted{margin-bottom:8px}
.trend-metrics{display:flex;align-items:center;gap:4px;padding:3px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.metric-button{min-height:34px;padding:6px 10px;border:0;border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:13px}
.metric-button:hover{background:var(--surface-2);color:var(--text)}
.metric-button[aria-pressed="true"]{background:var(--accent);color:#fff}
.trend-tooltip{min-height:20px;margin:0 0 12px;color:var(--text);font-size:13px;font-variant-numeric:tabular-nums}
.trend-data{margin-top:8px}
.trend-data summary{width:max-content;color:var(--accent);cursor:pointer;font-size:13px}
.trend-data table{min-width:600px}
.trend-data th{position:static;top:auto}
.trend-data td:nth-child(2),.trend-data td:nth-child(4){font-family:var(--mono);font-size:12px}
.trend-data td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.trend-axis-note{font-size:12px}
.flaky-matrix table{font-variant-numeric:tabular-nums}
.flaky-matrix table th:not(:first-child),.flaky-matrix table td:not(:first-child){text-align:center}
.matrix-cell{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:6px;background:var(--surface-2);font-weight:700}
.matrix-cell[aria-label^="Passed"]{color:var(--passed);background:var(--passed-bg)}
.matrix-cell[aria-label^="Failed"]{color:var(--failed);background:var(--failed-bg)}
.matrix-cell[aria-label^="Flaky"]{color:var(--flaky);background:var(--flaky-bg)}
.project-bar{display:flex;width:min(260px,100%);height:12px;overflow:hidden;border-radius:8px;background:var(--surface-2)}
.project-bar span{height:100%}
.project-bar .passed{background:var(--passed)}.project-bar .failed{background:var(--failed)}.project-bar .flaky{background:var(--flaky)}.project-bar .skipped{background:var(--skipped)}
.heat.failed span{background:var(--failed)}.heat.flaky span{background:var(--flaky)}
.timeline text{font-size:10px}
.timeline rect:focus{stroke:var(--text);stroke-width:2}
.focused-report .report-shell{display:block;max-width:1200px}
.focused-report .report-sidebar,.focused-report .overview-panel,.focused-report .report-content>footer{display:none!important}
.focused-report .detail-panel{position:static;transform:none;width:calc(100% - 32px);max-width:1160px;max-height:none;margin:0 auto 28px;overflow:visible}
dialog.detail-panel{position:fixed;inset:50% auto auto 50%;transform:translate(-50%,-50%);margin:0;width:min(1040px,96vw);max-height:94vh;overflow:auto;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--text);padding:0;box-shadow:0 24px 70px rgba(15,23,42,.32)}
dialog.detail-panel:not([open]){display:none}
dialog.detail-panel::backdrop{background:rgba(15,23,42,.58);backdrop-filter:blur(3px)}
dialog.detail-panel .panel-head{position:sticky;top:0;z-index:2}
dialog.detail-panel #lb-panel-content{max-width:900px;margin:auto}
.brand-links{display:flex;align-items:center;gap:5px}
.brand-links a{display:grid;place-items:center;width:34px;height:34px;border:1px solid transparent;border-radius:8px;color:var(--muted)}
.brand-links a:hover{border-color:var(--border);background:var(--surface-2);color:var(--text)}
.brand-links svg{width:18px;height:18px;fill:currentColor}
.brand-links .brand-cutout{fill:var(--surface)}
.topbar-actions button{min-height:34px;border-color:transparent;background:transparent;color:var(--muted);font-size:12px;font-weight:550}
.topbar-actions button:hover{border-color:var(--border);background:var(--surface-2);color:var(--text)}
.topbar-actions .palette-select{width:100px;min-width:0;min-height:34px;font-size:12px;background-color:var(--surface);color:var(--text)}
.toolbar .chip-button{min-height:34px;padding:6px 11px;border-color:var(--border);border-radius:8px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:550;transition:background 140ms,border-color 140ms,color 140ms}
.toolbar .chip-button:hover{border-color:var(--accent);color:var(--text)}
.toolbar .chip-button[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent)}
.toolbar [data-status="failed"][aria-pressed="true"]{border-color:var(--failed);background:var(--failed-bg);color:var(--failed)}
.toolbar [data-status="flaky"][aria-pressed="true"]{border-color:var(--flaky);background:var(--flaky-bg);color:var(--flaky)}
.toolbar [data-status="passed"][aria-pressed="true"]{border-color:var(--passed);background:var(--passed-bg);color:var(--passed)}
.toolbar [data-status="skipped"][aria-pressed="true"]{border-color:var(--skipped);background:var(--skipped-bg);color:var(--skipped)}
.trend-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.trend-legend{display:flex;gap:14px;flex-wrap:wrap;margin:4px 0;color:var(--muted);font-size:12px}
.trend-legend span{display:inline-flex;align-items:center;gap:6px}
.trend-legend i{width:9px;height:9px;border-radius:50%;background:var(--failed)}
.trend-legend .flaky-dot{background:var(--flaky)}
.failure-count-chart .failed-bar{fill:var(--failed);opacity:.85}
.failure-count-chart .flaky-bar{fill:var(--flaky);opacity:.9}
.failure-count-chart rect:focus{stroke:var(--text);stroke-width:2}
.failure-count-chart .chart-grid{stroke:var(--border);stroke-width:1}
.test-filters{display:grid;grid-template-columns:minmax(180px,1.5fr) repeat(4,minmax(110px,1fr)) auto auto;align-items:end;gap:8px;padding:10px;margin:12px 0;border-color:var(--border);background:var(--surface)}
.filter-dropdown{position:relative}
.test-filters #lb-search{width:100%;min-width:0;min-height:36px;padding:0 10px;border-radius:8px;background:var(--surface)}
.filter-trigger,.filter-field select{width:100%;height:36px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:13px}
.filter-trigger{display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:pointer;list-style:none}
.filter-trigger::-webkit-details-marker{display:none}
.filter-trigger::after{content:"";width:7px;height:7px;margin-left:8px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:translateY(-2px) rotate(45deg)}
.filter-menu{position:absolute;top:calc(100% + 5px);left:0;z-index:15;width:max(100%,200px);padding:5px;border:1px solid var(--border);border-radius:8px;background:var(--surface);box-shadow:var(--shadow)}
.filter-option{display:flex;align-items:center;gap:8px;min-height:34px;padding:4px 6px;border-radius:5px;cursor:pointer;font-size:12px}
.filter-option:hover{background:var(--surface-2)}
.filter-option input{width:16px;min-width:16px;height:16px;flex:0 0 16px;margin:0;accent-color:var(--accent)}
.filter-field{display:grid;gap:3px;min-width:0;color:var(--muted);font-size:11px;font-weight:600}
.filter-field select{padding:0 28px 0 10px;font-weight:500}
.test-filters>.chip-button{height:36px;white-space:nowrap}
.active-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.active-filters:not([hidden]){grid-column:1/-1}
.active-filters[hidden]{display:none}
.active-filter{border-radius:999px;font-size:11px}
.active-filter span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.active-filter .icon{width:12px;height:12px;flex:none;color:var(--muted)}
.clear-filters{padding:5px 3px;border:0;background:none;color:var(--accent);font-size:11px;font-weight:600}
#lb-result-count{margin:10px 2px 6px;font-size:12px;font-weight:600}
#tab-tests .table-wrap,#tab-failures .table-wrap,#tab-run .table-wrap{border-color:var(--border);box-shadow:0 5px 18px rgba(23,33,47,.035)}
#tab-tests table,#tab-failures table,#tab-run table{border-spacing:0}
#tab-tests th,#tab-failures th,#tab-run th{padding:12px 14px;background:var(--surface-2);color:var(--muted);font-size:11px;letter-spacing:.045em;text-transform:uppercase}
#tab-tests tbody tr[data-test-id]:nth-child(even){background:color-mix(in srgb,var(--surface-2) 36%,var(--surface))}
#tab-tests tbody tr[data-test-id]:hover{background:color-mix(in srgb,var(--accent) 8%,var(--surface))}
#tab-tests tbody tr[data-test-id] td{padding-top:12px;padding-bottom:12px}
#tab-failures>.grid-cards.failure-summary-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));align-items:start;gap:10px}
#tab-failures .failure-summary-card{display:flex;flex-wrap:wrap;align-content:flex-start;gap:6px;min-height:80px;margin:0;padding:15px;border-radius:11px;background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--surface-2) 70%,var(--surface)))}
#tab-failures .failure-summary-card strong{flex-basis:100%;display:block;padding-bottom:9px;border-bottom:1px solid var(--border);font-size:13px;letter-spacing:.01em}
#tab-failures .failure-summary-card .button{width:auto;max-width:100%;min-height:32px;flex:0 1 auto;margin:0;padding:5px 8px;border-color:transparent;background:transparent;color:var(--accent);font-size:12px;text-align:left}
#tab-failures .failure-summary-card .button:hover{border-color:var(--border);background:var(--surface)}
#tab-failures .failure-trend{padding:20px;border-radius:12px;background:linear-gradient(145deg,var(--surface),var(--surface-2))}
#tab-failures .failure-trend h3{font-size:16px}
#tab-failures details.section-card{padding:0;overflow:hidden;border-radius:10px;background:var(--surface)}
#tab-failures details.section-card summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;background:var(--failed-bg);font-weight:650}
#tab-failures details.section-card[open] summary{border-bottom:1px solid var(--border)}
#tab-failures details.section-card>p{margin:8px 14px}
#tab-failures .failure-chart{background:var(--surface);border-color:var(--border)}
#tab-failures .failure-trend table td:last-child{font-weight:650;color:var(--failed)}
#tab-run>.run-meta-grid{grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
#tab-run .run-meta-grid .section-card{margin:0;padding:15px;border-radius:10px;background:linear-gradient(145deg,var(--surface),var(--surface-2))}
#tab-run .run-meta-grid .section-card h3{margin:0 0 9px;color:var(--accent);font-size:13px}
#tab-run .run-meta-grid .section-card p{margin:5px 0;padding-top:5px;border-top:1px solid color-mix(in srgb,var(--border) 70%,transparent);font-size:12px;overflow-wrap:anywhere}
#tab-run .timeline-heading{margin-top:26px;font-size:17px}
#tab-run .timeline-description{margin:-8px 0 12px;font-size:12px}
.timeline-wrap{overflow-x:auto;padding:10px;border:1px solid var(--border);border-radius:12px;background:linear-gradient(145deg,var(--surface),var(--surface-2));box-shadow:0 5px 18px rgba(23,33,47,.04)}
.timeline{display:block;width:100%;min-width:680px;min-height:0;height:auto;border:0;background:transparent}
.timeline .worker-lane{fill:var(--surface);stroke:var(--border);stroke-width:.7}
.timeline .worker-lane.alt{fill:color-mix(in srgb,var(--surface-2) 65%,var(--surface))}
.timeline .timeline-grid{stroke:var(--border);stroke-width:.8;stroke-dasharray:3 4}
.timeline .worker-label{fill:var(--muted);font-size:11px;font-weight:650}
.timeline .timeline-time{fill:var(--muted);font-size:10px}
.timeline rect{cursor:pointer;transition:filter 120ms,opacity 120ms}
.timeline rect:hover,.timeline rect:focus{filter:brightness(.9);stroke:var(--text);stroke-width:1.5}
#tab-run .table-wrap{margin-top:14px}
@media(max-width:700px){.table-wrap th{top:0}}
@media(max-width:1100px){.test-filters{grid-template-columns:repeat(4,minmax(0,1fr)) auto auto}.test-filters #lb-search{grid-column:1/-1}}
@media(max-width:700px){.test-filters{grid-template-columns:repeat(2,minmax(0,1fr));padding:10px}.test-filters #lb-search{grid-column:1/-1}.test-filters>.chip-button{min-width:0;justify-content:center}}
@media(max-width:800px){.report-shell{display:flex;flex-direction:column}.report-sidebar{position:sticky;top:56px;z-index:10;border-right:0;border-bottom:1px solid var(--border)}.tabs{position:static;flex-direction:row;align-items:center;gap:4px;overflow-x:auto;padding:6px 10px}.tabs .nav-group{display:contents}.tabs .nav-label{display:none}.tabs button{width:auto;min-width:max-content;min-height:38px;padding:7px 9px}.report-content{padding:18px 14px 32px}.overview-grid{grid-template-columns:1fr}.overview-header h1{font-size:23px}}
@media(max-width:900px){.overview-grid{grid-template-columns:1fr}}
@media(max-width:420px){.topbar-inner{gap:8px;padding:8px 10px}.wordmark{font-size:14px}.topbar-title{font-size:12px}.topbar-actions{gap:4px}.topbar-actions button{padding:6px}.topbar-actions .optional{display:none}.brand-links{gap:0}.brand-links a{width:30px;height:32px}}
body{letter-spacing:-.008em}
.topbar{background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px)}
.overview-header h1{letter-spacing:-.04em}
.comparison,.overview-card,.toolbar,.table-wrap{box-shadow:0 1px 2px rgba(20,29,48,.035)}
:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 58%,transparent);outline-offset:2px}
@media print{:root,:root[data-theme],:root[data-theme][data-palette]{${tokensToCss('light')}color-scheme:light}body{background:var(--surface)}.topbar-actions,.tabs,.toolbar,.button,.chip-button,.panel-head button,.toast,.skip-link{display:none!important}.report-shell{display:block;max-width:none}.report-sidebar{display:none}.report-content{padding:0}.overview-panel,.panel[hidden]{display:block!important}.detail-panel{position:static;width:auto;box-shadow:none;border:0}.panel-backdrop{display:none}.section-card,tr{break-inside:avoid}a{color:var(--text)}}
/* verdict band */
.verdict-band{border:1px solid var(--border);border-radius:var(--r-card);background:var(--surface);padding:16px 18px;margin:0 0 14px}
.verdict-copy{margin:0 0 12px;font-size:var(--t-lg);font-weight:600}
.seg-bar{display:flex;height:22px;border-radius:var(--r-pill);overflow:hidden;background:var(--surface-2);margin:0 0 10px}
.seg-bar button{height:100%;min-width:6px;border:0;padding:0;cursor:pointer;transition:filter 120ms}
.seg-bar button:hover{filter:brightness(.85)}
.seg-bar .passed{background:var(--passed)}
.seg-bar .failed{background:var(--failed)}
.seg-bar .flaky{background:var(--flaky)}
.seg-bar .skipped{background:var(--skipped)}
.seg-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:var(--t-xs);font-variant-numeric:tabular-nums}
.seg-legend button{border:0;background:none;padding:0;display:inline-flex;align-items:center;gap:5px;color:var(--muted);cursor:pointer;font-size:inherit}
.seg-legend button:hover{color:var(--text)}
.seg-legend .dot{width:8px;height:8px;border-radius:50%;flex:none}
.seg-legend .passed .dot{background:var(--passed)}
.seg-legend .failed .dot{background:var(--failed)}
.seg-legend .flaky .dot{background:var(--flaky)}
.seg-legend .skipped .dot{background:var(--skipped)}
/* overview header meta chips */
.meta-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--border);border-radius:var(--r-pill);font-size:var(--t-xs);color:var(--muted);background:var(--surface);font-family:inherit}
.meta-chip.mono{font-family:var(--mono)}
.meta-chip .icon{width:13px;height:13px}
.meta-chip-copy{border:0;background:none;padding:0 0 0 3px;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center}
.meta-chip-copy:hover{color:var(--accent)}
.meta-chip-copy .icon{width:12px;height:12px}
.overview-meta-row{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;margin:8px 0 0}
/* comparison delta improvements */
.delta-good{color:var(--passed)}
.delta-bad{color:var(--failed)}
.delta-neutral{color:var(--muted)}
.comparison-metric strong{display:flex;align-items:center;gap:4px}
.delta-arrow{font-size:10px}
/* attention row history strip */
.overview-attention-row .recent{margin-left:auto;flex:none}
/* pass-rate sparkline */
.sparkline-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0;min-height:150px}
.sparkline-card svg{display:block;width:100%;min-width:0;max-width:none;height:auto}
.sparkline-value{display:grid;justify-items:end;gap:4px}
.sparkline-value strong{font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}
.sparkline-card .spark-delta{font-size:var(--t-xs);font-variant-numeric:tabular-nums;white-space:nowrap}
/* topbar export popover */
.export-popover{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:180px;padding:6px;border:1px solid var(--border);border-radius:var(--r-ctl);background:var(--surface);box-shadow:var(--elev,0 12px 32px rgba(20,29,48,.12))}
.export-popover button{display:flex;width:100%;align-items:center;gap:8px;padding:8px 10px;border:0;border-radius:6px;background:none;color:var(--text);font-size:var(--t-sm);text-align:left;cursor:pointer}
.export-popover button:hover{background:var(--surface-2)}
.export-wrap{position:relative}
/* flaky legend */
.flaky-legend{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px;font-size:var(--t-xs)}
.flaky-legend span{display:inline-flex;align-items:center;gap:4px;color:var(--muted)}
.flaky-legend .lk{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:4px;background:var(--surface-2);font-weight:700;font-size:11px}
/* triage strip */
.triage-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px}
.triage-col{border:1px solid var(--border);border-radius:var(--r-card);background:var(--surface);padding:12px 14px}
.triage-col-head{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:var(--t-sm);font-weight:650}
.triage-col-head .count{margin-left:auto;font-variant-numeric:tabular-nums;font-size:var(--t-xs);color:var(--muted)}
.triage-item{display:flex;flex-direction:column;gap:2px;padding:7px 0;border-top:1px solid var(--border)}
.triage-item button{border:0;background:none;padding:0;color:var(--accent);font-size:var(--t-sm);text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.triage-item button:hover{text-decoration:underline}
.triage-item small{color:var(--muted);font-size:var(--t-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.triage-empty{color:var(--muted);font-size:var(--t-xs);padding:8px 0}
@media(max-width:640px){.triage-strip{grid-template-columns:1fr}.seg-legend{gap:8px}}
@media(max-width:640px){.comparison-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.comparison-metric:nth-child(-n+3){grid-column:span 2}.comparison-metric:nth-child(n+4){grid-column:span 3}.comparison-metric strong{font-size:15px}}
@media(max-width:800px){.report-sidebar::after{content:"";position:absolute;right:0;bottom:0;width:24px;height:50px;pointer-events:none;background:linear-gradient(90deg,transparent,var(--surface))}.tabs{scroll-snap-type:x proximity}.tabs button{scroll-snap-align:start}}
@media(max-width:420px){.topbar-actions .palette-select{width:82px;padding-left:7px;padding-right:19px;background-position:right 6px center}}
/* slowest tests bar chart in run tab */
.slowest-chart{margin:12px 0}
.slowest-chart .bar-row{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:var(--t-xs)}
.slowest-chart .bar-label{flex:none;width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.slowest-chart .bar-track{flex:1;height:14px;background:var(--surface-2);border-radius:3px;overflow:hidden}
.slowest-chart .bar-fill{height:100%;background:var(--accent);border-radius:3px}
.slowest-chart .bar-val{flex:none;width:52px;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
`;
