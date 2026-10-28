/* Offline reader for IPO text copied from Chittorgarh, Investorgain, NSE, BSE or news pages.
   Best-effort pattern matching: it fills only what it can find clearly. */
function parseIpoText(raw){
  const out = {}, found = [];
  const text = String(raw||"").replace(/ /g," ").replace(/[ \t]+/g," ");
  const num = s => { const v = Number(String(s).replace(/,/g,"")); return isFinite(v) ? v : null; };
  const set = (k, v, label) => { if (v!=null && out[k]==null){ out[k]=v; found.push(label||k); } };
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);

  // name: "Jio Platforms IPO ..." or "Jio Platforms Limited"
  for (const l of lines.slice(0,15)){
    const m = l.match(/^(.{3,60}?)\s+(?:Ltd\.?\s+|Limited\s+)?IPO\b/i);
    if (m && !/^(upcoming|live|current|mainboard|sme|latest)\b/i.test(m[1]) && !/gmp|date|price|subscri|status/i.test(m[1])){ set("name", m[1].replace(/\s+(Ltd\.?|Limited)$/i,"").trim(), "name"); break; }
  }

  // price band upper
  let m = text.match(/price\s*band[^\d₹]{0,25}₹?\s*([\d,.]+)\s*(?:to|-|–|—)\s*₹?\s*([\d,.]+)/i);
  if (m) set("price", num(m[2]), "price band");
  else if ((m = text.match(/(?:issue|offer|final)\s*price[^\d₹]{0,15}₹?\s*([\d,.]+)/i))) set("price", num(m[1]), "issue price");

  // lot size
  m = text.match(/(?:lot\s*size|market\s*lot|minimum\s*(?:bid|order)\s*(?:quantity|lot)?)[^\d\n]{0,20}([\d,]+)\s*(?:shares|equity)/i)
   || text.match(/(?:lot\s*size|market\s*lot)[^\d\n]{0,10}([\d,]+)/i);
  if (m) set("lot", num(m[1]), "lot size");

  // issue size and fresh issue in crore
  const cr = re => { const x = text.match(re); return x ? num(x[1]) : null; };
  const size = cr(/(?:total\s*)?issue\s*size[^\n₹]{0,80}?₹\s*([\d,.]+)\s*(?:cr|crore)/i) ?? cr(/(?:total\s*)?issue\s*size[^\n]{0,60}?([\d,.]+)\s*(?:cr|crore)/i);
  const fresh = cr(/fresh\s*issue[^\n₹]{0,80}?₹\s*([\d,.]+)\s*(?:cr|crore)/i) ?? cr(/fresh\s*issue[^\n]{0,60}?([\d,.]+)\s*(?:cr|crore)/i);
  const ofs = cr(/offer\s*for\s*sale[^\n₹]{0,80}?₹\s*([\d,.]+)\s*(?:cr|crore)/i) ?? cr(/offer\s*for\s*sale[^\n]{0,60}?([\d,.]+)\s*(?:cr|crore)/i);
  if (size) set("size", size, "issue size");
  if (fresh!=null && ofs!=null && fresh+ofs>0) set("fresh", Math.round(fresh/(fresh+ofs)*100), "fresh issue %");
  else if (fresh!=null && size) set("fresh", Math.min(100, Math.round(fresh/size*100)), "fresh issue %");
  else if (/entirely\s+(?:a\s+)?fresh\s+issue|no\s+offer\s+for\s+sale|no\s+OFS/i.test(text)) set("fresh", 100, "fresh issue %");
  else if (/entirely\s+(?:an\s+)?offer\s+for\s+sale/i.test(text)) set("fresh", 0, "fresh issue %");

  if (/\bSME\b|NSE\s*Emerge|BSE\s*SME/i.test(text)) set("board", "sme", "SME board");

  // GMP: day-wise rows (date + ₹ amount) or a single "GMP ₹x"
  const dateRe = /(\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b|\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}\b)/i;
  const rows = [];
  for (const l of lines){
    if (!dateRe.test(l)) continue;
    if (/subscri|allot|listing|refund|open|close|anchor|credit/i.test(l)) continue;
    const vals = [...l.replace(dateRe,"").matchAll(/(-?)₹\s*(-?[\d,.]+)/g)].map(g => (g[1]?-1:1)*num(g[2])).filter(v => v!=null);
    if (vals.length) rows.push(vals.reduce((a,b) => Math.abs(b)<Math.abs(a) ? b : a));
  }
  const gm = text.match(/GMP[^\d₹\-\n]{0,30}(-?)\s*₹\s*(-?[\d,.]+)/i) || text.match(/GMP[^\d\-\n]{0,15}(-?)\s*(-?[\d,.]+)/i);
  if (rows.length>=2){
    set("gmp", rows[0], "latest GMP");
    if (rows.length>=4) set("gmp3", rows[3], "GMP 3 entries back");
    set("gmpPeak", Math.max(...rows), "highest GMP");
  } else if (gm){ const v = num(gm[2]); if (v!=null) set("gmp", (gm[1]?-1:1)*v, "GMP"); }

  // subscription by category: first decimal (or "Nx") on a line that starts with the category
  const subVal = l => { const x = l.match(/(\d+(?:\.\d+)?)\s*(?:x|times)\b/i) || l.match(/\b(\d+\.\d{1,2})\b/); return x ? num(x[1]) : null; };
  for (const l of lines){
    const s = l.toLowerCase().replace(/^[*•\-\s]+/,"");
    if (/^(qibs?|qualified\s*institution)/.test(s)) set("qib", subVal(l), "QIB");
    else if (/^(niis?\b|non[-\s]*institution|hnis?\b)(?!.*(above|below|₹\s*2|₹\s*10|2l|10l|small|big))/.test(s) || /^(niis?|non[-\s]*institutional[a-z\s]*)\s*\**\s*[\d(]/.test(s)) set("nii", subVal(l), "NII");
    else if (/^(retail|rii|individual\s*investor)/.test(s)) set("rii", subVal(l), "retail");
    else if (/^(total|overall)\b/.test(s) && !/size|issue|applic/.test(s)) set("total", subVal(l), "total");
  }
  if (out.total==null && (m = text.match(/subscribed\s*(\d+(?:\.\d+)?)\s*(?:x|times)/i))) set("total", num(m[1]), "total");
  if (/final\s*day|day\s*3|issue\s*closed|closed\s*with|\bfinal\b.*subscri/i.test(text)) set("subDay","final","final day");
  else if (/day\s*2/i.test(text)) set("subDay","day2","day 2");
  else if (/day\s*1/i.test(text)) set("subDay","day1","day 1");

  Object.keys(out).forEach(k => { if (out[k]==null) delete out[k]; });
  return {data: out, found};
}
if (typeof module!=="undefined") module.exports = parseIpoText;
