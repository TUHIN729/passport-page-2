# The Passport Page of a Country That Isn't There

[![make.fun](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318)
[![rank](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/TUHIN729/passport-page-2/rank.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard)
[![reward](https://make.fun/badge/the-passport-page-of-a-countr-2-20261121-0318/TUHIN729/passport-page-2/reward.svg)](https://make.fun/bounty/the-passport-page-of-a-countr-2-20261121-0318/leaderboard)

An invented passport spread for the **Republic of Caldara** — a North Atlantic
island with no airport, reached by ferry only — held by **Mara Ellin Voss**,
lighthouse keeper of Port Vey.

`main.ts` (Node 22, no dependencies) draws the whole spread programmatically
from scratch: the data page with a drawn portrait, the coat of arms, and a
machine-readable zone with real ICAO 9303 check digits, plus a visa page
carrying twelve stamps that tell one strictly chronological travel history —
three ferry round trips to Meridia and the Isle of Tarn, every exit preceding
its matching entry, nothing before the passport's issue on 12 JUN 2024.

The telling detail is the Meridia short-stay visa: **ferry arrival only, no
air entry** — because Caldara has no airport to fly out of.

Run it with:

```sh
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

It writes `entry.png` (1024×1024, under 1 MiB), deterministically — two runs
produce byte-identical output.
