# TAC data attribution

- **Primary (free):** [Osmocom TAC database](http://tacdb.osmocom.org/) — CC-BY-SA 3.0  
  Import: `npm run tac:import` (downloads `osmocom-tacdb.csv` if missing)
- **Overlay:** `tradein-tac-seed.json` — curated TACs for current buy-matrix models Osmocom may not list yet
- **On miss:** [HiCellTek](https://hicelltek.com/en/imei-api/) TAC API when `HICELLTEK_API_KEY` is set  
  Free ~100 lookups/mo — request a key via their contact form (no credit card).  
  Hits are cached into `StoreImeiTac` so the same TAC is not charged again.
