import { AnalyzedPage } from '../scanner/types';

export function generateReport(pages: AnalyzedPage[]): string {
  // Inline the template - we'll build it as a string to avoid fs dependencies at runtime
  const dataJson = JSON.stringify(pages, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ContrastCheck Report</title>
<style>
  :root { --bg:#0f172a; --card:#1e293b; --text:#f8fafc; --muted:#94a3b8; --pass:#22c55e; --fail:#ef4444; --warn:#eab308; --accent:#38bdf8; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; padding:2rem 1rem; }
  .container { max-width:1200px; margin:0 auto; }
  header { text-align:center; margin-bottom:2rem; }
  h1 { font-size:2rem; margin-bottom:.5rem; }
  .subtitle { color:var(--muted); }
  .summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:1rem; margin-bottom:2rem; }
  .stat-card { background:var(--card); border-radius:.75rem; padding:1.25rem; text-align:center; border:1px solid #334155; }
  .stat-value { font-size:1.75rem; font-weight:700; }
  .stat-label { font-size:.875rem; color:var(--muted); margin-top:.25rem; }
  .pass { color:var(--pass); }
  .fail { color:var(--fail); }
  .warn { color:var(--warn); }
  .page-section { background:var(--card); border-radius:.75rem; border:1px solid #334155; margin-bottom:1.5rem; overflow:hidden; }
  .page-header { padding:1rem 1.25rem; background:#162032; display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
  .page-header:hover { background:#1a2b45; }
  .page-title { font-weight:600; font-size:1rem; }
  .page-url { font-size:.75rem; color:var(--muted); }
  .page-meta { display:flex; gap:1rem; font-size:.875rem; }
  .badge { padding:.25rem .5rem; border-radius:9999px; font-size:.75rem; font-weight:600; }
  .badge-pass { background:rgba(34,197,94,.15); color:var(--pass); }
  .badge-fail { background:rgba(239,68,68,.15); color:var(--fail); }
  .page-body { display:none; padding:1rem 1.25rem; }
  .page-body.open { display:block; }
  .filters { display:flex; gap:.5rem; margin-bottom:1rem; flex-wrap:wrap; }
  .filter-btn { background:#162032; border:1px solid #334155; color:var(--text); padding:.375rem .75rem; border-radius:.375rem; cursor:pointer; font-size:.875rem; }
  .filter-btn.active { background:var(--accent); color:#0f172a; border-color:var(--accent); }
  .pair-list { display:flex; flex-direction:column; gap:.75rem; }
  .pair { background:#162032; border:1px solid #334155; border-radius:.5rem; padding:1rem; display:grid; grid-template-columns:auto 1fr auto; gap:1rem; align-items:center; }
  .pair.pass { border-left:3px solid var(--pass); }
  .pair.fail { border-left:3px solid var(--fail); }
  .swatches { display:flex; gap:.5rem; align-items:center; }
  .swatch { width:2rem; height:2rem; border-radius:.375rem; border:1px solid #334155; position:relative; }
  .swatch-label { position:absolute; bottom:-1.25rem; left:50%; transform:translateX(-50%); font-size:.625rem; color:var(--muted); white-space:nowrap; }
  .pair-info { min-width:0; }
  .pair-text { font-size:.875rem; word-break:break-word; }
  .pair-meta { font-size:.75rem; color:var(--muted); margin-top:.25rem; }
  .pair-ratio { text-align:right; }
  .ratio-value { font-size:1.25rem; font-weight:700; }
  .ratio-grade { font-size:.75rem; color:var(--muted); }
  .suggestion { font-size:.75rem; margin-top:.5rem; padding:.5rem; background:rgba(56,189,248,.08); border-radius:.25rem; }
  .screenshot { margin-top:.75rem; border-radius:.375rem; border:1px solid #334155; overflow:hidden; max-width:320px; }
  .screenshot img { display:block; width:100%; height:auto; }
  .screenshot-label { font-size:.625rem; color:var(--muted); padding:.25rem .5rem; background:#0f172a; }
  .empty { text-align:center; padding:2rem; color:var(--muted); }
  .var-issue { background:#162032; border:1px solid #334155; border-radius:.5rem; padding:1rem; margin-bottom:.75rem; }
  .var-issue-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.5rem; }
  .var-name { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:.875rem; color:var(--accent); }
  .var-count { font-size:.75rem; color:var(--muted); }
  .var-detail { font-size:.75rem; color:var(--muted); margin-top:.25rem; }
  .var-suggestion { font-size:.75rem; margin-top:.5rem; padding:.5rem; background:rgba(56,189,248,.08); border-radius:.25rem; }
  .var-instances { margin-top:.5rem; font-size:.75rem; color:var(--muted); }
  .var-instance-tag { display:inline-block; background:#0f172a; padding:.125rem .375rem; border-radius:.25rem; margin-right:.25rem; margin-bottom:.25rem; }
  .section-title { font-size:1rem; font-weight:600; margin-bottom:.75rem; margin-top:1rem; }
  @media (max-width:640px) { .pair { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>ContrastCheck Report</h1>
    <p class="subtitle">Accessibility color contrast analysis</p>
  </header>
  <div id="summary" class="summary"></div>
  <div id="pages"></div>
</div>
<script>
const pages = ${dataJson};

function el(tag, props, children) {
  const e = document.createElement(tag);
  if (props) Object.assign(e, props);
  if (children) children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function renderSummary() {
  const total = pages.reduce((s,p)=>s+p.stats.total,0);
  const passAA = pages.reduce((s,p)=>s+p.stats.passAA,0);
  const failAA = pages.reduce((s,p)=>s+p.stats.failAA,0);
  const violations = pages.reduce((s,p)=>s+p.violations.length,0);
  const varIssues = pages.reduce((s,p)=>s+p.variableIssues.length,0);

  const stats = [
    { label:'Pages', value:pages.length },
    { label:'Elements', value:total },
    { label:'Pass AA', value:passAA, cls:'pass' },
    { label:'Fail AA', value:failAA, cls:'fail' },
    { label:'Violations', value:violations, cls:'fail' },
  ];
  if (varIssues > 0) {
    stats.push({ label:'Var Issues', value:varIssues, cls:'warn' });
  }

  const container = document.getElementById('summary');
  stats.forEach(s => {
    container.appendChild(el('div', {className:'stat-card'}, [
      el('div', {className:'stat-value '+(s.cls||''), textContent:s.value}),
      el('div', {className:'stat-label', textContent:s.label})
    ]));
  });
}

function renderVariableIssue(issue) {
  const div = el('div', {className:'var-issue'}, []);

  const header = el('div', {className:'var-issue-header'}, [
    el('div', {}, [
      el('div', {className:'var-name', textContent:issue.variable + ' (' + issue.property + ')'}),
      el('div', {className:'var-detail', textContent:issue.currentHex + ' on ' + (issue.againstVariable || issue.againstHex) + ' = ' + issue.contrastRatio + ':1'})
    ]),
    el('div', {className:'var-count', textContent:issue.affectedCount + ' element' + (issue.affectedCount>1?'s':'')})
  ]);
  div.appendChild(header);

  if (issue.suggestedFix) {
    div.appendChild(el('div', {className:'var-suggestion', textContent:'Suggested: ' + issue.suggestedFix.newValue + ' (' + issue.suggestedFix.contrastRatio.toFixed(2) + ':1)'}));
  }

  const instances = el('div', {className:'var-instances'}, []);
  issue.instances.slice(0, 8).forEach(inst => {
    instances.appendChild(el('span', {className:'var-instance-tag', textContent:inst.text || '(empty)'}));
  });
  if (issue.instances.length > 8) {
    instances.appendChild(el('span', {className:'var-instance-tag', textContent:'+' + (issue.instances.length - 8) + ' more'}));
  }
  div.appendChild(instances);

  return div;
}

function renderPair(p) {
  const isFail = !p.aa;
  const pairEl = el('div', {className:'pair '+(isFail?'fail':'pass')}, []);

  const swatches = el('div', {className:'swatches'}, []);
  if (p.fgParsed) {
    const hex = '#'+[p.fgParsed.r,p.fgParsed.g,p.fgParsed.b].map(v=>v.toString(16).padStart(2,'0')).join('');
    swatches.appendChild(el('div', {className:'swatch', style:'background:'+hex, title:hex}, [el('span', {className:'swatch-label', textContent:'FG'})]));
  }
  if (p.bgParsed) {
    const hex = '#'+[p.bgParsed.r,p.bgParsed.g,p.bgParsed.b].map(v=>v.toString(16).padStart(2,'0')).join('');
    swatches.appendChild(el('div', {className:'swatch', style:'background:'+hex, title:hex}, [el('span', {className:'swatch-label', textContent:'BG'})]));
  }

  const info = el('div', {className:'pair-info'}, [
    el('div', {className:'pair-text', textContent:p.text || '(empty)'}),
    el('div', {className:'pair-meta', textContent:\`\${p.tag} \u00B7 \${p.fontSize} \u00B7 \${p.fontWeight}\`})
  ]);

  const ratio = el('div', {className:'pair-ratio'}, [
    el('div', {className:'ratio-value '+(isFail?'fail':'pass'), textContent:p.contrastRatio+':1'}),
    el('div', {className:'ratio-grade', textContent:p.aaa?'AAA':p.aa?'AA':'Fail'})
  ]);

  pairEl.append(swatches, info, ratio);

  if (isFail && p.suggestedFix) {
    info.appendChild(el('div', {className:'suggestion', textContent:\`Suggested: \${p.suggestedFix.hex} (\${p.suggestedFix.ratio}:1)\`}));
  }

  if (p.screenshot) {
    info.appendChild(el('div', {className:'screenshot'}, [
      el('img', {src:p.screenshot, alt:'Element screenshot'}),
      el('div', {className:'screenshot-label', textContent:p.selector})
    ]));
  }

  return pairEl;
}

function renderPages() {
  const container = document.getElementById('pages');
  pages.forEach((page, idx) => {
    const section = el('div', {className:'page-section'}, []);

    const header = el('div', {className:'page-header'}, [
      el('div', {}, [
        el('div', {className:'page-title', textContent:page.title || 'Untitled'}),
        el('div', {className:'page-url', textContent:page.url})
      ]),
      el('div', {className:'page-meta'}, [
        el('span', {className:'badge badge-pass', textContent:page.stats.passAA+' pass'}),
        el('span', {className:'badge badge-fail', textContent:page.stats.failAA+' fail'})
      ])
    ]);

    header.onclick = () => body.classList.toggle('open');

    const body = el('div', {className:'page-body'}, []);
    if (idx===0) body.classList.add('open');

    // Variable Issues Section
    if (page.variableIssues && page.variableIssues.length > 0) {
      body.appendChild(el('div', {className:'section-title', textContent:'Design System Issues (' + page.variableIssues.length + ' variable' + (page.variableIssues.length>1?'s':'') + ' \u2192 ' + page.variableStats.affectedElements + ' element' + (page.variableStats.affectedElements>1?'s':'') + ')'}));
      page.variableIssues.forEach(issue => {
        body.appendChild(renderVariableIssue(issue));
      });
    }

    // One-off filters
    const hasOneOffs = page.violations.some(v => !v.colorVar && !v.bgVar);
    const hasVariableAffected = page.variableStats && page.variableStats.affectedElements > 0;

    const filters = el('div', {className:'filters'}, []);
    const filterAll = el('button', {className:'filter-btn active', textContent:'All'});
    const filterFail = el('button', {className:'filter-btn', textContent:'Failures'});
    const filterPass = el('button', {className:'filter-btn', textContent:'Passes'});
    filters.append(filterAll, filterFail, filterPass);

    const pairList = el('div', {className:'pair-list'}, []);

    function applyFilter(type) {
      [filterAll, filterFail, filterPass].forEach(b=>b.classList.remove('active'));
      if (type==='all') filterAll.classList.add('active');
      if (type==='fail') filterFail.classList.add('active');
      if (type==='pass') filterPass.classList.add('active');

      pairList.innerHTML = '';
      const items = type==='fail' ? page.violations : type==='pass' ? page.passes : page.pairs;
      if (items.length===0) {
        pairList.appendChild(el('div', {className:'empty', textContent:'No items'}));
        return;
      }
      items.forEach(p => pairList.appendChild(renderPair(p)));
    }

    filterAll.onclick = (e) => { e.stopPropagation(); applyFilter('all'); };
    filterFail.onclick = (e) => { e.stopPropagation(); applyFilter('fail'); };
    filterPass.onclick = (e) => { e.stopPropagation(); applyFilter('pass'); };

    if (hasVariableAffected) {
      body.appendChild(el('div', {className:'section-title', textContent:'All Elements'}));
    }
    body.append(filters, pairList);
    section.append(header, body);
    container.appendChild(section);

    applyFilter('fail'); // default to failures
  });
}

renderSummary();
renderPages();
</script>
</body>
</html>`;
}