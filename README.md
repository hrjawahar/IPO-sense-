# IPO Sense

A single-file, offline web app that helps Indian retail investors make calculated decisions on IPOs.

- **Score**: enter an IPO's numbers (price band, GMP trend, QIB/NII/retail subscription, anchors, profits, valuation, analyst calls, market mood). It gives an apply or skip score out of 100, shows which signals moved it, lists watch-outs, estimates the listing range, and works out your lottery odds.
- **Quick fill**: read a screenshot (on-device text recognition via Tesseract.js, downloaded once) or paste copied text from Chittorgarh, Investorgain, NSE or BSE pages, and the app picks out the figures.
- **Listing day**: enter the pre-open discovered price and get a plan (sell all, sell half and trail, hold with a stop, or recover capital), with exact orders and take-home profit after charges and tax.
- **Watchlist**: log GMP daily, record the actual listing, and build your own track record. Export or restore a backup file.
- **Learn**: 16 short lessons for first-time investors (categories, lottery, UPI, T+3, GMP, subscription, anchors, RHP, listing day, tax, red flags, past listings, FAQ, glossary).

No account, no server, no tracking. Data stays in the browser's local storage on each device.

## Using it on a phone

`index.html` is the whole app. Two ways to use it:

1. **Android**: copy `index.html` to the phone (WhatsApp to yourself, Google Drive, USB), then open it in Chrome. Chrome may ask which app to open it with. Bookmark it or use Chrome's menu → *Add to Home screen*.
2. **Any phone, best experience**: host the file on any static host (GitHub Pages needs a public repo on the free plan; Netlify Drop and Cloudflare Pages also work), then open the link and *Add to Home screen*.

On iPhone, opening a local HTML file from the Files app shows a preview without running the app, so use option 2.

Each device keeps its own watchlist. Use **Watchlist → Export backup** to move it.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The complete app (HTML, CSS and JS in one file) |
| `parser.js` | Source of the offline quick-fill reader (also embedded in `index.html`); run with Node for testing |

## How the score works

The score starts at 40 and adds or subtracts points per signal. The weights are rules of thumb, not a back-tested model. Hard stops: a negative GMP, or QIBs not filling their quota at close, means Skip regardless of score. Bands: 75+ strong apply, 60–74 apply, 45–59 only with long-term conviction, below 45 skip. The watchlist's track record is how you find out whether the weights work for you.

## Disclaimer

This is a learning and note-keeping tool, not investment advice. GMP is unofficial. Rules (SEBI, exchange, tax) change; confirm in the RHP and on the NSE, BSE and SEBI websites.
