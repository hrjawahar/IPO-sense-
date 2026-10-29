/* Offline reader for IPO text copied (or read from a screenshot) from Chittorgarh,
   Investorgain, NSE, BSE or news pages. Best-effort pattern matching: it fills
   only what it can find clearly, and copes with common screenshot-reading errors. */
function parseIpoText(raw){
  const out = {}, found = [];
  const num = s => { const v = Number(String(s).replace(/,/g,"")); return isFinite(v) ? v : null; };
  const set = (k, v, label) => { if (v!=null && isFinite(typeof v==="number" ? v : 0) && out[k]==null){ out[k]=v; found.push(label||k); } };

  let text = String(raw||"")
    .replace(/ /g," ")
    .replace(/[¥€£]|\bRs\.?\s?|\bINR\s?/g, "₹")          // rupee sign variants and OCR misreads
    .replace(/(^|[\s(|])[FRZ](?=\d)/g, "$1₹")             // ₹ read as F/R/Z before a number
    .replace(/[ \t|]+/g," ")
    .replace(/(\b\d{1,2}[-/]\d{1,2}[-/])(?!\d)[ ]*([^\n]*)\n\s*(\d{4})\b/g, "$1$3 $2"); // dates split over two lines
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const flat = lines.join(" ");

  // name: prefer "X IPO Details/GMP/Subscription", then a line that is just "X IPO"
  const skipName = /^(home|ipo|ipos|mainboard|sme|upcoming|live|current|latest|buyback|news|menu|reports?|gmp)\b/i;
  const badName = /gmp|date|price|subscri|status|details|upcoming|mainboard|buyback/i;
  const nameFrom = re => { for (const l of lines.slice(0,60)){ const x = l.match(re); if (x && !skipName.test(x[1]) && !badName.test(x[1])) return x[1].replace(/\s+(Ltd\.?|Limited)$/i,"").trim(); } return null; };
  const tidy = n => { if (!n) return n; n = n.replace(/\s*[-–:|]\s*$/,"").replace(/\s+(Ltd\.?|Limited)$/i,"").trim(); return n===n.toUpperCase() ? n.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()) : n; };
  const exch = nameFrom(/^(.{3,60}?)\s*[-–]\s*(?:Public\s+Issue|IPO)\b/i);
  if (exch) set("name", tidy(exch), "name");
  set("name", tidy(nameFrom(/^(.{3,60}?)\s+(?:Ltd\.?\s+|Limited\s+)?IPO\s+(?:Details|GMP|Subscription|Date|Review|Timeline)\b/i) ?? nameFrom(/^(.{3,60}?)\s+(?:Ltd\.?\s+|Limited\s+)?IPO\s*$/i) ?? nameFrom(/^(.{3,60}?)\s+(?:Ltd\.?\s+|Limited\s+)?IPO\b/i)), "name");

  // price band upper
  let m = flat.match(/(?:price\s*(?:band|range)|(?:issue|offer)\s*price)[^\d₹]{0,25}₹?\s*([\d,]+(?:\.\d+)?)\s*(?:to|-|–|—)\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  if (m) set("price", num(m[2]), "price band");
  else if ((m = flat.match(/(?:issue|offer|final)\s*price[^\d₹]{0,15}₹?\s*([\d,.]+)/i))) set("price", num(m[1]), "issue price");

  // lot size
  m = flat.match(/(?:lot\s*size|market\s*lot|minimum\s*(?:bid|order)\s*(?:quantity|lot)?)[^\d]{0,20}([\d,]+)\s*(?:shares|equity)/i)
   || flat.match(/(?:lot\s*size|market\s*lot)[^\d]{0,10}([\d,]+)/i);
  if (m) set("lot", num(m[1]), "lot size");

  // issue size, fresh issue and OFS in crore (rows may wrap, so search the flattened text)
  const cr = re => { const x = flat.match(re); return x ? num(x[1]) : null; };
  const amt = "[^₹]{0,90}?₹?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(?:cr|crore)\\b";
  const size  = cr(new RegExp("total\\s*issue(?:\\s*size)?" + amt, "i")) ?? cr(new RegExp("issue\\s*size" + amt, "i"));
  const fresh = cr(new RegExp("fresh\\s*issue" + amt, "i"));
  const ofs   = cr(new RegExp("offer\\s*for(?:\\s*sale)?" + amt, "i"));
  const size2 = size ?? cr(/₹\s*([\d,]+(?:\.\d+)?)\s*-?\s*(?:cr|crore)\s*(?:initial\s+public\s+offer(?:ing)?|IPO|issue|public\s+issue)/i);
  if (size2) set("size", size2, "issue size");
  if (fresh!=null && ofs!=null && fresh+ofs>0) set("fresh", Math.round(fresh/(fresh+ofs)*100), "fresh issue %");
  else if (fresh!=null && size2) set("fresh", Math.min(100, Math.round(fresh/size2*100)), "fresh issue %");
  else if (ofs!=null && size2 && ofs<=size2) set("fresh", Math.round((size2-ofs)/size2*100), "fresh issue %");
  else if (/entirely\s+(?:a\s+)?fresh\s+issue|no\s+offer\s+for\s+sale|no\s+OFS/i.test(flat)) set("fresh", 100, "fresh issue %");
  else if (/entirely\s+(?:an\s+)?offer\s+for\s+sale/i.test(flat)) set("fresh", 0, "fresh issue %");

  if (/NSE\s*Emerge|BSE\s*SME|listing\s*at[^.]{0,20}\bSME\b|\bis\s+an?\s+SME\b|\bSME\s+IPO\s+(?:of|by|is)\b/i.test(flat) || (/\bSME\b/.test(flat) && !/mainboard/i.test(flat) && flat.length<4000)) set("board", "sme", "SME board");

  // GMP: day-wise rows. Prefer the "(x%)" figure × issue price, which survives screenshot errors best.
  const dateRe = /(\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b|\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{1,2}\b)/i;
  const rowLines = lines.filter(l => dateRe.test(l) && !/subscri|allot|listing date|refund|open|close|anchor|credit|ipo date/i.test(l));
  const rowNums = rowLines.map(l => [...l.replace(dateRe,"").replace(/\(\s*-?[\d.]+\s*%\s*\)/g,"").matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map(x=>num(x[0])).filter(v=>v!=null));
  let P = out.price ?? null;
  if (P==null && rowNums.length>=2){           // the issue price repeats on every row
    const cnt = {}; rowNums.forEach(r => new Set(r).forEach(v => cnt[v]=(cnt[v]||0)+1));
    const best = Object.entries(cnt).filter(([,c]) => c>=Math.ceil(rowNums.length*0.6)).sort((a,b)=>b[1]-a[1])[0];
    if (best) P = Number(best[0]);
  }
  const rows = [];
  rowLines.forEach((l, k) => {
    const pc = l.match(/\(\s*(-?[\d.]+)\s*%\s*\)/);
    if (pc && P){ rows.push(Math.round(P*Number(pc[1])/100)); return; }
    const rup = [...l.replace(dateRe,"").matchAll(/(-?)₹\s*(-?[\d,.]+)/g)].map(g => (g[1]?-1:1)*num(g[2])).filter(v => v!=null && v!==P);
    const nums = rowNums[k];
    if (P && nums.length>=2){ const L = Math.max(...nums); if (L>P && L<P*3){ rows.push(Math.round(L-P)); return; } }
    if (rup.length) rows.push(rup.reduce((a,b) => Math.abs(b)<Math.abs(a) ? b : a));
  });
  const gm = flat.match(/GMP\)?[^\d₹\-.]{0,45}?(-?)\s*₹\s*(-?[\d,]+(?:\.\d+)?)(?![\d,]*\s*-?\s*(?:cr|crore|lakh))/i) || flat.match(/GMP\s*(?:is|of|at|:)?\s*(-?)\s*(-?[\d,]+(?:\.\d+)?)\b(?!\s*%)(?!\s*-?\s*(?:cr|crore|lakh))/i);
  if (rows.length>=2){
    set("gmp", rows[0], "latest GMP");
    if (rows.length>=4) set("gmp3", rows[3], "GMP 3 days back");
    set("gmpPeak", Math.max(...rows), "highest GMP");
  } else if (gm){ const v = num(gm[2]); if (v!=null) set("gmp", (gm[1]?-1:1)*v, "GMP"); }

  // subscription by category: first decimal (or "Nx") on a line that starts with the category
  const subVal = l => { const x = l.match(/(\d+(?:\.\d+)?)\s*(?:x|times)\b/i) || l.match(/\b(\d+\.\d{1,2})\b/); return x ? num(x[1]) : null; };
  for (const l of lines){
    const s = l.toLowerCase().replace(/^[*•\-\s]+/,"");
    if (/^(qibs?\b|qualified\s*institution[a-z]*|q[il1]b\b)/.test(s)) set("qib", subVal(l), "QIB");
    else if (/^(n[il1t][il1t]s?|non[-\s]*institution[a-z\s]*|hnis?)\s*\**\s*(\(|\d|$|investors?|total)/.test(s) && !/above|below|small|big|more\s*than|less\s*than|lakh|₹\s*2|₹\s*10|10l|2l/.test(s)) set("nii", subVal(l), "NII");
    else if (/^(retail|rii|individual\s*investor)/.test(s)) set("rii", subVal(l), "retail");
    else if (/^(total|overall)\b/.test(s) && !/size|issue|applic|shares/.test(s)) set("total", subVal(l), "total");
  }
  const prose = (k, re, label) => { if (out[k]==null){ const x = flat.match(re); if (x) set(k, num(x[1]), label); } };
  prose("qib", /\bQIBs?\b[^.]{0,50}?(\d+(?:\.\d+)?)\s*(?:x|times)\b/i, "QIB");
  prose("nii", /\b(?:NIIs?|HNIs?|non[-\s]*institutional\s*investors?)\b[^.]{0,50}?(\d+(?:\.\d+)?)\s*(?:x|times)\b/i, "NII");
  prose("rii", /\bretail\b[^.]{0,50}?(\d+(?:\.\d+)?)\s*(?:x|times)\b/i, "retail");
  if (out.total==null && (m = flat.match(/subscribed\s*(\d+(?:\.\d+)?)\s*(?:x|times)/i))) set("total", num(m[1]), "total");
  if (/final\s*day|day\s*3|issue\s*closed|closed\s*with|\bfinal\b.*subscri/i.test(flat)) set("subDay","final","final day");
  else if (/day\s*2/i.test(flat)) set("subDay","day2","day 2");
  else if (/day\s*1/i.test(flat)) set("subDay","day1","day 1");

  Object.keys(out).forEach(k => { if (out[k]==null) delete out[k]; });
  return {data: out, found};
}
if (typeof module!=="undefined") module.exports = parseIpoText;
