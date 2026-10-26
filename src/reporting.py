"""Self-contained, printable assessment report with escaped user content."""
from html import escape
import base64
import binascii

def render_report(r: dict) -> str:
    def e(value): return escape(str(value), quote=True)
    summary=r['summary']; weather=r['weather']
    blocks=''.join(f"<tr><td>{e(b['id'])}</td><td>{b['score']:.1f}</td><td class='{e(b['status'].lower())}'>{e(b['status'])}</td><td>{len(b['candidate_ids'])}</td><td>{e(', '.join(c['factor'] + ': ' + str(round(c['points'],2)) for c in b['contributions']))}</td></tr>" for b in r['blocks'])
    params=''.join(f"<tr><th>{e(k.replace('_',' '))}</th><td>{e(v)}</td></tr>" for k,v in r['parameters'].items())
    limits=''.join(f'<li>{e(v)}</li>' for v in r.get('limitations',[]))
    alerts=''.join(f"<tr><td>{e(a['block_id'])}</td><td>{e(a['status'])}</td><td>{e(a['message'])}</td><td>{e(a.get('acknowledged_at','Not acknowledged'))}</td></tr>" for a in r['alerts'])
    shap=''.join(f"<tr><td>{e(v['feature'])}</td><td>{e(v['input'])}</td><td>{v['value']:+.4f}</td></tr>" for v in r.get('model',{}).get('shap',[]))
    heatmap=r.get('overlays',{}).get('heatmap','')
    image = ''
    try:
        raw = base64.b64decode(heatmap, validate=True)
        if raw.startswith(b'\x89PNG\r\n\x1a\n'):
            image = f'<img alt="Saved image-block screening heatmap" src="data:image/png;base64,{e(heatmap)}"/>'
    except (ValueError, binascii.Error):
        pass
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeoGuard assessment · {e(r['site_name'])}</title><style>
body{{font:14px system-ui,sans-serif;color:#172033;max-width:1100px;padding:36px;margin:auto;background:#f4f7fb}}header{{border-bottom:3px solid #2563eb;padding-bottom:22px}}h1{{margin:8px 0;font-size:30px}}h2{{margin-top:32px;font-size:19px}}p,li{{line-height:1.7;color:#526176}}.eyebrow{{color:#2563eb;font-weight:700;letter-spacing:2px;font-size:11px}}.summary{{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0}}.summary>div{{background:white;padding:18px 24px;border:1px solid #d9e2ee;border-radius:10px;flex:1}}strong{{display:block;font-size:24px;margin:8px 0}}table{{width:100%;border-collapse:collapse;background:white;font-size:12px}}th,td{{padding:10px;text-align:left;border:1px solid #d9e2ee;vertical-align:top}}th{{background:#eef4ff}}img{{max-width:100%;max-height:600px;object-fit:contain;background:#fff}}.critical{{color:#b91c1c}}.warning{{color:#a16207}}.normal{{color:#047857}}.note{{background:#fff8e6;border:1px solid #f4d497;padding:16px;border-radius:8px}}footer{{margin-top:30px;font-size:11px;color:#64748b}}@media print{{body{{background:white;padding:0}}header,section{{break-inside:avoid}}thead{{display:table-header-group}}tr{{break-inside:avoid}}}}
</style></head><body><header><span class="eyebrow">GEOGUARD · ASSESSMENT RECORD</span><h1>{e(r['site_name'])}</h1><p>Saved {e(r['created_at'])} · Record {e(r['id'])}</p></header>
<div class="summary"><div>Maximum screening index<strong>{summary['score']:.1f} / 100</strong>{e(summary['status'])}</div><div>Illustrative factor of safety<strong>{r['fos']['value']:.2f}</strong>{e(r['fos']['method'])}</div><div>Slope Mass Rating<strong>{r['smr']['score']:.1f}</strong>Planar orientation screening</div></div>
<p class="note">Research screening only. This index is not a failure probability or a predicted failure time. Normal does not certify safety. Acknowledgement records review and does not resolve a hazard. Field measurements and site geotechnical review are required.</p>
<h2>Spatial evidence</h2>{image}<p>{'Operator-supplied orthorectified bounds; registration must be verified.' if r['georeferenced'] else 'Image blocks only; this photograph is not registered to survey coordinates.'}</p>
<h2>Weather snapshot</h2><p>Source: {e(weather['source'])} · Retrieved {e(weather.get('retrieved_at','manual input'))}<br>Past 24 h: {weather['past_24h_mm']} mm · Past 72 h: {weather['past_72h_mm']} mm · Next 24 h: {weather['next_24h_mm']} mm<br>{e(weather.get('attribution',''))}</p>
<h2>Block evidence and contributions</h2><p>FoS or SMR gates may raise an index above the sum of weighted contributions; the saved status includes these gates.</p><table><thead><tr><th>Block</th><th>Index / 100</th><th>Status</th><th>Candidate lines</th><th>Additive screening contributions</th></tr></thead><tbody>{blocks}</tbody></table>
<h2>Warning review log</h2><table><thead><tr><th>Block</th><th>Status</th><th>Message</th><th>Review timestamp</th></tr></thead><tbody>{alerts or '<tr><td colspan="4">No threshold warnings in this snapshot.</td></tr>'}</tbody></table>
<h2>Model explanation · research comparison</h2><p>TreeSHAP explains a synthetic-data XGBoost classifier in log-odds. It does not explain or alter the operational block index. Model score: {e(r.get('model',{}).get('score','unavailable'))}. The crack transfer baseline is excluded from warning generation.</p><table><thead><tr><th>Feature</th><th>Input</th><th>SHAP log-odds</th></tr></thead><tbody>{shap or '<tr><td colspan="3">Unavailable</td></tr>'}</tbody></table>
<h2>Saved input parameters</h2><table><tbody>{params}</tbody></table><h2>Limitations</h2><ul>{limits}</ul><footer>GeoGuard v3 · Generated from the saved assessment; no new forecast or AI request was made. Use your browser’s Print / Save as PDF command to preserve this report.</footer></body></html>'''
