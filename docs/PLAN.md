# Plán vývoje

Stav: **odsouhlaseno 4. 9. 2026, probíhá fáze 1.** Napsáno po ověření všech zdrojů —
podklady jsou v [ZDROJE.md](ZDROJE.md), právní rámec v [PRAVNI.md](PRAVNI.md).

Odhady jsou v „dnech práce" ve smyslu soustředěné práce na jednom tématu, ne kalendářních dní.

---

## 0. Co se oproti zadání mění a proč

Ověření změnilo pět věcí. Bez nich by plán stál na chybných předpokladech.

| # | Zadání předpokládá | Skutečnost | Dopad na plán |
|---|---|---|---|
| 1 | Scraping webu je v pořádku, `robots.txt` blokuje jen pár skriptů | Plošný `Disallow: /` pro všechny kromě 8 vyhledávačů | Zadavatel 4. 9. 2026 rozhodl scrapovat v plném rozsahu. **Šetrný režim je povinný** — viz [PRAVNI.md](PRAVNI.md) |
| 2 | Kalendář akcí nemá export, nutný scraping | Kanál `?6` je hotový XML export | Scraping akcí odpadá, fáze 1 je levnější |
| 3 | Kategorii desky doplnit párováním s RSS 7 (50 položek) | Kanál `?9` má kategorii u všech 114 | Jednodušší a úplnější |
| 4 | MHD Kladno je v PID GTFS | Není. Jen příměstské, regionální a vlaky | **Fáze 4 přestavěna** |
| 5 | Sekce města dávají výpadky vody a elektřiny | Mrtvé od 2023, žádná data | Výpadky ven z fáze 1, místo nich ovzduší a výstrahy ČHMÚ |

**Dobrá zpráva:** i po těchto škrtech je fáze 1 obsahově bohatší, než zadání plánovalo —
protože kanály 6 a 9 nahradily tři scrapery, které by se rozbily při každé úpravě webu.

---

## Fáze 0 — Průzkum a plán ✅ HOTOVO

Ověřeno 3. 9. 2026, výstupem je [ZDROJE.md](ZDROJE.md), [PRAVNI.md](PRAVNI.md), tento plán
a kostra repozitáře s CI.

Ověřeno stažením: `robots.txt`, sitemap (19 563 URL), OFN deska (114 záznamů), 16 variant
RSS kanálů, 7 stránek webu města, PID GTFS (46,7 MB), RÚIAN Kladno (9 716 adres),
ČHMÚ ovzduší + metadata + CAP, ARES, registr smluv, volby, YouTube, 8 externích webů.

Rozhodnuto 4. 9. 2026: scrapovat v plném rozsahu v šetrném režimu, e-mail městu zatím
neposílat. Zbývá jediné — doplnit kontaktní e-mail do `User-Agent`.

---

## Fáze 1 — Pipeline a data ✅ HOTOVO

Dokončeno 4. 9. 2026. Pipeline běží v GitHub Actions každou hodinu a plní `data/v1/`.
Ověřený ostrý běh: 578 ulic, 6 částí, 112 dokumentů úřední desky, 27 akcí, 50 aktualit,
2 stanice ovzduší, 21 uzavírek, 3 sběrné dvory, 33 kontaktů odborů. 88 testů prochází.

Cíl: v `data/v1/` leží validované JSONy, generuje je GitHub Action, jde si je otevřít
v prohlížeči. Bez aplikace.

### 1.1 Základ (1–1,5 dne)
- pnpm workspace, TypeScript, Vitest, ESLint
- `packages/schema` — Zod schémata podle kanonického modelu (kap. 4 zadání) + odvozené typy
- HTTP klient: vlastní `User-Agent`, **1 požadavek / 1,5 s**, `If-Modified-Since`/ETag,
  exponenciální backoff, povinné následování 301 (kanály bez něj vrací prázdno)
- `parseRobots()` — načtení a vyhodnocení `robots.txt` před každým během, ne jednorázově

### 1.2 Úřední deska (1,5 dne) — hlavní hodnota
- zdroj A: OFN `/opendata-uredni-deska` → `relevantní_do`, číslo jednací, spisová značka
- zdroj B: kanál `?9` → `TYP`, `TYPCESTA`, přílohy
- spojení přes ID dokumentu (`d-<ID>` z OFN url = `item id` z kanálu 9)
- **dekódování `&amp;` v URL příloh** — postihuje 113 ze 114 záznamů
- filtr `relevantní_do >= dnes` do základních výpisů
- výstup `board.json`

### 1.3 Akce (1 den)
- kanál `?6` → `events.json`
- `description` je čistý text, použít; `note` je HTML z Wordu — v MVP zahodit
- spojení `start_date` + `start_time` do ISO, `allDay` když čas chybí (14 z 28 nemá)
- `geo: null` — kanál souřadnice nemá, geokódování až ve fázi 4

### 1.4 Aktuality (0,5 dne)
- kanál `?5` (má `wh_*` pole) → `news.json`

### 1.5 Ulice a části města (1 den)
- RÚIAN CSV pro obec 532053, **kódování windows-1250**, oddělovač `;`
- převod S-JTSK → WGS84
- `streets.json`: 578 ulic s centroidem a bounding boxem
- `districts.json`: **6 úředních částí** (ne 11)

### 1.6 Ovzduší (0,5 dne)
- ČHMÚ `airquality_1h_avg_CZ.csv` + `metadata.json`
- pevný číselník: SKLM (4 veličiny), SKLS (5 veličin) — `IdRegistration` jsou v ZDROJE.md
- `air.json` — hlavně index kvality ovzduší 1–6

### 1.7 Odolnost a manifest (1 den) — dělat spolu s prvním scraperem, ne až nakonec
- `index.json`: verze, `generatedAt`, hash a `lastSuccessfulFetch` každého datasetu, `stale`
- **pokles počtu položek > 40 % nebo nula u dřív neprázdného datasetu → nepublikovat**,
  zachovat předchozí, založit GitHub Issue
- fixture + test pro každý zdroj, včetně úmyslně rozbité fixture pro test ochrany
- GitHub Action, cron **jednou za hodinu**

### 1.8 Scrapery webu města (2,5–3,5 dne)
Zařazeno do fáze 1 na základě rozhodnutí ze 4. 9. 2026. Povinně v šetrném režimu
(1 požadavek / 1,5 s, vlastní UA, podmíněné požadavky) — podrobnosti v [PRAVNI.md](PRAVNI.md).

- **uzavírky** (ds-43821) → `traffic.json` — parsování volného textu, nejnáročnější scraper
  projektu. Extrahovat název ulice, platnost od–do a popis.
- **sběrné dvory a kontejnery** (ds-200618, ds-200879) → `waste.json`
- **kontakty odborů** (178× `os-`) → `contacts.json` — jen pracovní kontakt v rozsahu, v jakém
  ho město zveřejňuje; 178 stránek při 1,5 s je ~4,5 minuty běhu, stahovat proto obden
- **blokové čištění** (ds-201379) — nejdřív zjistit, zda je harmonogram jinde než v PDF

### Definice hotovo
`pnpm typecheck`, `lint`, `test` procházejí · každý zdroj má fixture a test · Zod validace
běží před zápisem · ochrana proti prázdným datům otestována rozbitou fixture · Action
commituje data · žádná tajemství v repozitáři.

---

## Fáze 2 — Aplikace, čtecí režim · odhad 8–10 dní

Expo + TypeScript + Expo Router, 5 tabů podle kap. 6 zadání.

- **Dnes** — dnešní akce, nejnovější aktuality, dlaždice ovzduší
- **Úřad** — deska s filtrem podle 19 složek, fulltext, detail, otevírání PDF
- **Město** — zatím jen odpady a odkazy (doprava až fáze 4)
- **Kultura** — kalendář akcí
- **Já** — velikost písma, tmavý režim, o aplikaci, zdroje a licence

Průřezově: offline-first (SQLite/MMKV, poslední data se zobrazí okamžitě), skeletony místo
spinnerů, u každé položky „Otevřít na webu města", u PDF vždy velikost, proužek u zastaralých
dat, přístupnost (Dynamic Type, kontrast 4,5:1, VoiceOver i TalkBack), disclaimer
o nezávislosti na první obrazovce.

První obrazovka do 1 s. Bez přihlašování, bez účtu, bez analytiky.

---

## Fáze 3 — Personalizace a notifikace · odhad 5–6 dní

- výběr až 3 ulic a částí města (578 ulic, 6 částí z fáze 1)
- rozpoznávání ulic v textu: bez diakritiky, lowercase, ošetření skloňování
  („v ulici Milady Horákové" → „Milady Horákové"), **ochrana proti falešným shodám
  u krátkých názvů** — ověřit proti reálným 578 názvům
- hlídací psi nad úřední deskou (klíčové slovo, ulice, složka) — hlavní důvod, proč si
  aplikaci nechat
- lokální notifikace přes `expo-background-task` + `expo-notifications`, žádný server
- **rozhodnout osud notifikace o blokovém čištění** — harmonogram je v PDF

---

## Fáze 4 — Doprava a mapa · odhad 6–8 dní · PŘESTAVĚNO

Původní zadání předpokládalo MHD Kladno z PID GTFS. Tam není, takže:

- **odjezdy z nejbližší zastávky** pro 65 kladenských zastávek, 30 linek — příměstské (399,
  324, 300…), regionální (616–630) a **vlaky S5, R45, S45, S50, R24**
- pro dojíždějícího do Prahy je to nejcennější část dopravy vůbec
- **MHD Kladno řešit deep linkem do IDOS**, ne vlastními daty
- v pipeline zpracovat GTFS na malé JSONy jen pro kladenské zastávky (z 246 MB na jednotky
  set kB) — velká data zůstávají na runneru
- MapLibre + OSM (ODbL, atribuce), body zájmu, uzavírky v mapě (pokud budou scrapery)

---

## Fáze 5 — Vydání · odhad 4–5 dní

Ikona a splash bez znaku města, screenshoty, texty do obchodů s disclaimerem v prvním
odstavci, zásady ochrany osobních údajů na veřejné URL (GitHub Pages), TestFlight a interní
testování, submit.

**Před submitem projít [PRAVNI.md](PRAVNI.md).** Ideálně mít v ruce souhlas města do App
Review Notes — proto je dobré napsat městu už teď, ne až tady.

---

## Backlog (pořadí podle zadání, s poznámkami z ověření)

1. veřejné zakázky — **Tender Arena je JS aplikace bez strojového výstupu**, nutný další průzkum
2. registr smluv (ověřeno, funguje — filtr podle IČO 00234516)
3. Měsíčník Kladno a TV měsíčník (YouTube Atom ověřen, funguje)
4. rozpočet — **Monitor státní pokladny není JSON API**, nutné hledat CSV v datovém katalogu
5. parkování · zastupitelstvo · knihovna (`mkkl.cz` vrací 500) · školy
6. volební výsledky 10/2026 — hezký „launch moment"
7. widgety, Apple Watch, hlášení závad (vyžaduje dohodu s městem)

---

## Souhrn odhadu

| Fáze | Odhad | Poznámka |
|---|---|---|
| 0 | hotovo | |
| 1 | 9–12 dní | včetně scraperů webu města |
| 2 | 8–10 dní | |
| 3 | 5–6 dní | |
| 4 | 6–8 dní | přestavěno oproti zadání |
| 5 | 4–5 dní | |
| **Celkem** | **32–41 dní** | bez čekání na město a na review v obchodech |

---

## Čtyři největší rizika

1. **`robots.txt`** — blokuje celý web, zadavatel se rozhodl scrapovat i tak. Zbytkové
   riziko je hlavně vyjednávací, ne právní: až se povede jednat s městem, může to přijít
   na přetřes. Zmírnění: šetrný režim, identifikovatelný UA a připravený e-mail v
   [MESTO.md](MESTO.md), který lze poslat kdykoli.
2. **Odmítnutí v App Store** podle pravidla 5.2.1 (vydávání se za instituci). Řešení: souhlas
   města předem, jinak důsledný disclaimer a jiný název.
3. **Blokové čištění je v PDF.** Zadání z něj dělá hlavní notifikaci. Rozhodnout před fází 3.
4. **Křehkost scraperů uzavírek** — volný text bez struktury. Fixtures a testy to odhalí, ale
   neopraví. Počítat s údržbou.
