import { tokensToCss } from './tokens.js';

export const REPORT_CSS = `:root{${tokensToCss('light')} --topbar-h:56px; --sidebar-w:196px; --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --r-card:12px; --r-ctl:8px; --r-pill:999px; --t-xs:12px; --t-sm:13px; --t-md:14px; --t-lg:16px; --t-xl:20px; --t-2xl:26px; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color-scheme:light}
:root[data-theme="dark"]{${tokensToCss('dark')}color-scheme:dark}
:root[data-theme="light"]{${tokensToCss('light')}color-scheme:light}
*{box-sizing:border-box}html{font-size:14px}body{margin:0;background:var(--bg);color:var(--text);font-size:var(--t-md);line-height:1.5;font-variant-numeric:tabular-nums}button,input,select{font:inherit}button{cursor:pointer}a{color:var(--accent)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.skip-link{position:absolute;top:-80px;left:12px;z-index:30;background:var(--surface);padding:8px}.skip-link:focus{top:12px}.topbar{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:var(--shadow)}.topbar-inner{max-width:1280px;margin:auto;padding:8px 20px;display:flex;align-items:center;gap:16px;min-height:56px}.wordmark{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;color:var(--text);text-decoration:none}.wordmark svg,.icon{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.topbar-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.topbar-actions{margin-left:auto;display:flex;gap:6px}.btn,.button,.topbar-actions button,.chip-button,.select,.input{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:var(--r-ctl);padding:6px 10px;display:inline-flex;align-items:center;gap:5px;min-height:36px;transition:background 140ms ease-out}.btn:hover,.button:hover,.topbar-actions button:hover,.chip-button:hover{background:var(--surface-2)}.btn-icon{padding-inline:10px;min-width:36px;justify-content:center}.btn-secondary{background:var(--surface-2)}.optional{opacity:.9}.input,.select{min-height:36px;padding:0 10px;background-color:var(--surface);color:var(--text)}input[type="search"],.input{min-height:40px;padding:0 12px;min-width:220px;flex:1}.select{appearance:none;-webkit-appearance:none;padding-right:28px;background-image:url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Cpath d="M3.5 6.5 8 11l4.5-4.5" fill="none" stroke="%23626d7d" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 10px center;background-size:12px 12px}.select:focus,.input:focus,.btn:focus{outline:2px solid var(--accent);outline-offset:2px}.container{max-width:1280px;margin:auto;padding:24px 20px 48px}.hero{display:grid;grid-template-columns:150px minmax(0,1fr);gap:24px;align-items:center}.donut{width:144px;height:144px}.donut-track{stroke:var(--border)}.donut-center{font-size:22px;font-weight:600;fill:var(--text)}.donut-label{font-size:10px;fill:var(--muted)}h1{font-size:24px;line-height:1.2;margin:0 0 8px}h2{font-size:20px;margin:0 0 14px}h3{font-size:16px;margin:20px 0 8px}.muted,small{color:var(--muted)}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.meta>*{border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:3px 8px}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:24px 0}.card{border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:16px;text-align:left;color:var(--text)}.card strong{display:block;font-size:28px;line-height:1.2;margin-top:4px;font-variant-numeric:tabular-nums}.card[data-kind="passed"] strong{color:var(--passed)}.card[data-kind="failed"] strong{color:var(--failed)}.card[data-kind="flaky"] strong{color:var(--flaky)}.delta,.banner,.notice{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:12px 16px;margin:12px 0}.banner{border-color:var(--flaky);color:var(--text)}.delta{display:flex;gap:16px;flex-wrap:wrap}.delta span{white-space:nowrap}.tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--border);margin:24px 0 16px}.tabs button{background:none;border:0;border-bottom:3px solid transparent;color:var(--muted);padding:10px 14px;white-space:nowrap}.tabs button[aria-current="page"]{color:var(--text);border-color:var(--accent);font-weight:600}.panel[hidden]{display:none}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}.toolbar input,.toolbar select{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px 9px}.toolbar input{min-width:220px;flex:1}.chip-button[aria-pressed="true"]{border-color:var(--accent);background:var(--surface-2)}.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}th{position:sticky;top:var(--topbar-h);z-index:1;font-size:12px;color:var(--muted);font-weight:600;background:var(--surface)}td{font-size:13px}tbody tr:last-child td{border-bottom:0}tr[data-test-id]{cursor:pointer}tr[data-test-id]:hover{background:var(--surface-2)}td strong{display:block;font-weight:500;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td small{display:block;max-width:620px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.status-chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;border-radius:6px;padding:3px 7px;white-space:nowrap}.status-chip.passed{color:var(--passed);background:var(--passed-bg)}.status-chip.failed,.status-chip.timedout{color:var(--failed);background:var(--failed-bg)}.status-chip.flaky{color:var(--flaky);background:var(--flaky-bg)}.status-chip.skipped{color:var(--skipped);background:var(--skipped-bg)}.status-chip .mark{font-size:12px}.heat{display:block;height:3px;background:var(--surface-2);border-radius:3px;margin-top:5px}.heat span{display:block;height:100%;background:var(--accent)}.heat.hot span{background:var(--flaky)}.recent{display:flex;gap:3px}.recent span{width:9px;height:9px;border-radius:2px;background:var(--border)}.recent .passed{background:var(--passed)}.recent .failed{background:var(--failed)}.recent .flaky{background:var(--flaky)}.recent .skipped{background:var(--skipped)}.empty{padding:32px;text-align:center;color:var(--muted)}.group-header{background:var(--surface-2);font-weight:600}.section-card{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:16px;margin:12px 0}.grid-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.panel-backdrop{position:fixed;inset:0;background:var(--shadow);z-index:25}.detail-panel{position:fixed;z-index:26;right:0;top:0;bottom:0;width:min(520px,100vw);overflow:auto;background:var(--surface);border-left:1px solid var(--border);box-shadow:var(--shadow);padding:20px}.detail-panel[hidden],.panel-backdrop[hidden]{display:none}.panel-head{display:flex;align-items:center;gap:8px;position:sticky;top:-20px;background:var(--surface);padding:12px 0;z-index:1}.panel-head h2{margin:0;flex:1}.detail-panel pre{background:var(--code-bg);border:1px solid var(--border);border-radius:6px;padding:12px;overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.attempts{display:flex;gap:6px;flex-wrap:wrap}.attempts button[aria-pressed="true"]{border-color:var(--accent)}.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);border-radius:6px;padding:8px 14px;z-index:50}.toast[hidden]{display:none}.help-dialog,.lightbox{border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);max-width:min(600px,95vw);box-shadow:var(--shadow)}.help-dialog::backdrop,.lightbox::backdrop{background:var(--shadow)}.chart{width:100%;height:190px;background:var(--surface);border:1px solid var(--border);border-radius:12px}.chart line,.chart path{stroke:var(--accent);fill:none;stroke-width:2}.chart rect{fill:var(--surface-2)}.chart text{fill:var(--muted);font-size:10px}.timeline{width:100%;min-width:700px;height:auto;min-height:160px}.timeline rect.passed{fill:var(--passed)}.timeline rect.failed{fill:var(--failed)}.timeline rect.flaky{fill:var(--flaky)}footer{color:var(--muted);padding:32px 0}.error-banner{border:1px solid var(--failed);color:var(--failed);padding:12px}.error-banner[hidden]{display:none}button{transition:background 140ms ease-out}svg{overflow:visible}
.donut-segment.passed{stroke:var(--passed)}.donut-segment.failed{stroke:var(--failed)}.donut-segment.flaky{stroke:var(--flaky)}.donut-segment.skipped{stroke:var(--skipped)}.donut-segment{transition:stroke-dasharray 400ms ease-out}.detail-panel{width:min(1040px,96vw);right:50%;top:3vh;bottom:3vh;transform:translateX(50%);border:1px solid var(--border);border-radius:12px}.container pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--code-bg);border:1px solid var(--border);padding:12px;border-radius:6px}.test-history-row{display:grid;grid-template-columns:90px minmax(0,1fr) 80px auto;gap:12px;align-items:center;border-bottom:1px solid var(--border);padding:8px 0}.test-history-row span{overflow-wrap:anywhere}.test-comparison{display:grid;gap:8px}.test-comparison>div{display:grid;grid-template-columns:100px minmax(0,1fr) 24px minmax(0,1fr);gap:8px;border-bottom:1px solid var(--border);padding:8px 0}.test-comparison span{overflow-wrap:anywhere}.detail-panel li.failed{color:var(--failed)}.topbar .status-chip{font-size:11px}.section-card button{margin:4px}.panel .chart{margin:12px 0}
.card{appearance:none;background-color:var(--surface)}.card[data-card-kind="passed"] strong{color:var(--passed)}.card[data-card-kind="failed"] strong{color:var(--failed)}.card[data-card-kind="flaky"] strong{color:var(--flaky)}
.chart .trend-area{fill:var(--passed-bg);stroke:none}.chart .trend-line{fill:none;stroke:var(--accent);stroke-width:2}.chart .trend-dot{fill:var(--accent);stroke:none}.run-strip{display:flex;gap:4px;margin:12px 0}.run-strip span{width:14px;height:14px;border-radius:3px;background:var(--border)}.run-strip .passed{background:var(--passed)}.run-strip .failed{background:var(--failed)}.group-header{cursor:pointer}
.steps{padding-left:20px}.steps li{padding:5px 0;border-bottom:1px solid var(--border)}.steps li.failed{font-weight:600}
.tag-chip,.case-chip{display:inline-block;padding:1px 5px;margin:1px 3px 1px 0;border:1px solid var(--border);border-radius:6px;color:var(--muted);white-space:nowrap}.case-chip{background:var(--surface-2)}
[hidden]{display:none!important}.hero-main{min-width:0}.eyebrow{margin:0 0 5px;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}.eyebrow strong{color:var(--accent);font-weight:700;margin-left:5px}.run-facts{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 0}.run-facts div{min-width:0;max-width:100%;padding:7px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px}.run-facts dt{color:var(--muted);font-size:11px;line-height:1.25}.run-facts dd{margin:2px 0 0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.env-disclosure{margin-top:10px;color:var(--muted);font-size:12px}.env-disclosure summary{cursor:pointer;width:max-content}.env-disclosure summary:hover{color:var(--accent)}.env-disclosure .meta{margin-top:8px}.comparison{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:16px;margin:0 0 8px}.comparison-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.comparison h2{font-size:15px;margin:0 0 3px}.comparison p{margin:0;color:var(--muted);font-size:12px}.comparison code{font:inherit;color:var(--text)}.comparison-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.comparison-metric{padding:9px 12px;background:var(--surface-2);border-radius:8px;min-width:0}.comparison-metric span{display:block;color:var(--muted);font-size:11px}.comparison-metric strong{display:block;margin-top:2px;font-size:18px;font-variant-numeric:tabular-nums}.comparison-empty{border-style:dashed}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px}.pagination p{margin:0;color:var(--muted);font-size:12px}.card:hover{border-color:var(--accent);box-shadow:0 3px 12px var(--shadow)}.card:active{transform:translateY(1px)}
@media(max-width:1100px){.topbar-title{display:none}}
@media(max-width:640px){.container{padding:16px 12px}.topbar-inner{padding:8px 12px}.topbar-actions .optional{display:none}.hero{grid-template-columns:1fr;gap:12px}.donut{width:110px;height:110px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-panel{width:100vw;top:0;bottom:0;border:0;border-radius:0}.test-history-row{grid-template-columns:1fr auto}.test-comparison>div{grid-template-columns:1fr 1fr}.toolbar input{min-width:100%}.run-facts{gap:6px}.run-facts div{flex:1 1 135px}.run-facts dd{max-width:100%}.comparison-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.comparison-head{align-items:flex-start;flex-direction:column}.pagination{flex-direction:column;align-items:stretch}}
@media(max-width:640px){.run-facts div{flex:1 1 100%}}
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
.focused-report .container>.hero,.focused-report .container>.cards,.focused-report .container>.comparison,.focused-report .container>.tabs,.focused-report .container>.panel,.focused-report .container>footer{display:none!important}
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
.overview-meta details{position:relative}
.overview-meta summary{cursor:pointer;color:var(--accent);text-decoration:underline}
.overview-meta .meta{position:absolute;z-index:5;top:24px;left:0;min-width:min(440px,80vw);padding:10px;background:var(--surface);box-shadow:var(--shadow);border:1px solid var(--border);border-radius:8px}
.status-chip.incomplete{color:var(--flaky);background:var(--flaky-bg)}
.banner{border-color:var(--flaky);background:var(--flaky-bg)}
.cards{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}
.card{min-height:102px;padding:14px;text-align:left}
.card strong{font-size:26px}
.card>span{display:block;margin-top:3px;color:var(--muted);font-size:12px}
.comparison{margin:14px 0}
.overview-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(240px,.8fr);gap:12px;margin:14px 0}
.overview-card{min-width:0;padding:15px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.overview-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.overview-card-head h2{margin:0;font-size:16px}
.overview-card-head .muted{font-size:12px}
.text-button{padding:3px 0;border:0;background:none;color:var(--accent);font-weight:600;white-space:nowrap}
.overview-attention-row,.overview-test-row{display:flex;align-items:center;gap:10px;width:100%;min-width:0;padding:10px 0;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text);text-align:left}
.overview-attention-row>span:last-child,.overview-test-row>span:nth-child(2){flex:1;min-width:0}
.overview-attention-row strong,.overview-test-row strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.overview-attention-row small,.overview-test-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.overview-attention-row:hover,.overview-test-row:hover{background:var(--surface-2)}
.overview-empty{padding:20px 8px}
.pass-rate-history,.overview-test-list{list-style:none;margin:0;padding:0}
.pass-rate-history li{display:grid;grid-template-columns:minmax(55px,1fr) minmax(70px,2fr) 42px;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--border);font-size:12px}
.pass-rate-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.pass-rate-track{height:8px;overflow:hidden;border-radius:6px;background:var(--surface-2)}
.pass-rate-track span{display:block;height:100%;border-radius:inherit;background:var(--passed)}
.pass-rate-history strong{text-align:right;font-variant-numeric:tabular-nums}
.overview-test-row .status-chip{flex:none}
.overview-test-row .muted{flex:none;font-variant-numeric:tabular-nums}
.panel>h2{margin:0 0 14px}
.toolbar{padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
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
.failure-trend th{position:static}
.failure-trend td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.history-chart{display:block;width:100%;height:auto;min-height:150px;margin:12px 0}
.history-chart .chart-grid{stroke:var(--border);stroke-width:1}
.history-chart .axis-label,.history-chart .axis-run{fill:var(--muted);font-size:11px}
.history-chart .trend-line{fill:none;stroke:var(--accent);stroke-width:2.5}
.history-chart .trend-dot{fill:var(--surface);stroke:var(--accent);stroke-width:2}
.history-chart .duration-bar{fill:var(--accent);opacity:.72}
.history-chart .duration-bar.current{fill:var(--failed);opacity:1}
.trend-card h3{margin:0 0 4px}
.trend-card>.muted{margin-bottom:8px}
.flaky-matrix table{font-variant-numeric:tabular-nums}
.flaky-matrix table th:not(:first-child),.flaky-matrix table td:not(:first-child){text-align:center}
.matrix-cell{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:6px;background:var(--surface-2);font-weight:700}
.matrix-cell[aria-label^="Passed"]{color:var(--passed);background:var(--passed-bg)}
.matrix-cell[aria-label^="Failed"]{color:var(--failed);background:var(--failed-bg)}
.matrix-cell[aria-label^="Flaky"]{color:var(--flaky);background:var(--flaky-bg)}
.project-bar{display:flex;width:min(260px,100%);height:12px;overflow:hidden;border-radius:8px;background:var(--surface-2)}
.project-bar span{height:100%}
.project-bar .passed{background:var(--passed)}.project-bar .failed{background:var(--failed)}.project-bar .flaky{background:var(--flaky)}.project-bar .skipped{background:var(--skipped)}
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
.test-filters{display:grid;gap:10px;padding:14px;margin:14px 0;border-color:var(--border);background:var(--surface)}
.filter-dropdown{position:relative}
.test-filters #lb-search{width:100%;min-height:40px;padding:9px 13px;border-radius:8px;background:var(--bg)}
.filter-row{display:flex;align-items:end;gap:9px;min-width:0}
.filter-primary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.filter-trigger,.filter-field select{width:100%;height:40px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:13px}
.filter-trigger{display:flex;align-items:center;justify-content:space-between;padding:0 11px;cursor:pointer;list-style:none}
.filter-menu{position:absolute;top:39px;left:0;z-index:15;width:100%;min-width:210px;padding:5px;border:1px solid var(--border);border-radius:0 0 8px 8px;background:var(--surface);box-shadow:var(--shadow)}
.filter-option{display:flex;align-items:center;gap:8px;min-height:34px;padding:4px 6px;border-radius:5px;cursor:pointer;font-size:12px}
.filter-option input{width:14px;height:14px;margin:0;accent-color:var(--accent)}
.filter-field{display:grid;flex:1;gap:4px;min-width:0;color:var(--muted);font-size:11px;font-weight:600}
.filter-field select{padding:0 28px 0 10px;font-weight:500}
.filter-secondary{padding-top:9px;border-top:1px solid var(--border)}
.filter-secondary #lb-group,.filter-secondary #lb-changed{height:40px;white-space:nowrap}
.active-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.active-filters[hidden]{display:none}
.active-filter{border-radius:999px;font-size:11px}
.active-filter span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.active-filter .icon{width:12px;height:12px;flex:none;color:var(--muted)}
.clear-filters{padding:5px 3px;border:0;background:none;color:var(--accent);font-size:11px;font-weight:600}
#lb-result-count{margin:14px 2px 8px;font-size:12px;font-weight:600}
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
body{letter-spacing:-.008em}
.topbar{background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(14px)}
.topbar-inner{max-width:1440px}
.overview-header h1{letter-spacing:-.04em}
.status-chip{border-radius:999px}
.card,.comparison,.overview-card,.toolbar,.table-wrap{box-shadow:0 1px 2px rgba(20,29,48,.035)}
:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 58%,transparent);outline-offset:2px}
@media print{:root,:root[data-theme="dark"]{${tokensToCss('light')}color-scheme:light}body{background:var(--surface)}.topbar-actions,.tabs,.toolbar,.button,.chip-button,.panel-head button,.toast,.skip-link{display:none!important}.report-shell{display:block;max-width:none}.report-sidebar{display:none}.report-content{padding:0}.overview-panel,.panel[hidden]{display:block!important}.detail-panel{position:static;width:auto;box-shadow:none;border:0}.panel-backdrop{display:none}.container{max-width:none}.section-card,tr{break-inside:avoid}a{color:var(--text)}}`;
