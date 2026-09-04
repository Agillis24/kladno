# Katalog datových zdrojů

**Poslední kontrola: 4. 9. 2026.** Vše níže bylo skutečně staženo a rozebráno, ne odhadnuto.
Sloupec „ověřeno" znamená: staženo, otevřeno, spočítány záznamy, zkontrolována pole.

Legenda stavu:
- **funguje** — ověřeno, použitelné tak, jak je
- **funguje s výhradou** — ověřeno, ale má vadu, kterou musí pipeline obejít
- **nepoužitelné** — ověřeno, ale nedává data, která zadání předpokládalo
- **nedořešeno** — zbývá doplnit, cesta k řešení je známá

---

## 1. Shrnutí pro netrpělivé

Sedm věcí, které mění zadání:

1. **`robots.txt` města zakazuje přístup všem robotům kromě osmi jmenovaných vyhledávačů.** Není to výjimka pro pár skriptů, jak píše zadání v kap. 5.1 — je to plošný `Disallow: /`. Podrobně v [PRAVNI.md](PRAVNI.md), rozhodnutí je na zadavateli.
2. **Našel jsem dva nezdokumentované XML exporty**, které zadání nezná: kanál `?6` (kalendář akcí) a kanál `?9` (úřední deska s kategoriemi). Oba jsou výrazně lepší než cesty, které zadání navrhuje.
3. **Kalendář akcí strojový export má** — zadání v kap. 5.4 tvrdí opak. Scraping akcí odpadá.
4. **Párování úřední desky přes RSS 7 je zbytečné.** Kanál 9 nese kategorii u všech 114 záznamů, RSS 7 jen u 50.
5. **MHD Kladno v PID GTFS není.** Jsou tam jen příměstské a regionální linky. Dopravní modul se musí přestavět.
6. **Sekce města pro výpadky vody, elektřiny a „informace z dopravy" jsou mrtvé.** Poslední změna 2023, žádná provozní data.
7. **Kladno má 6 úředních částí obce, ne 11.** Zadání v kap. 4 míchá úřední části s lidovými názvy lokalit.

---

## 2. Web města — technický základ

| Položka | Zjištění | Stav |
|---|---|---|
| CMS | VISMO (WEBHOUSE s.r.o.), ASP, HTML 4.01 | ověřeno |
| `id_org` | `6506` | ověřeno |
| Sitemap | `https://www.mestokladno.cz/vismo/sitemap.asp` — 3,59 MB, **19 563 URL**, stažení 12 s | funguje |
| Rozpad sitemapy | 14 136 `d-` (dokumenty), 1 913 `a-` (akce), 1 496 `ds-` (sekce), 845 `ms-` (menu), 586 `gs-` (galerie), 378 `o-`, 178 `os-` (odbory), 31 ostatní | ověřeno |
| `lastmod` | **U všech 19 563 URL.** Nečekaný bonus — umožňuje detekovat změny bez stahování stránek. | funguje |
| Rychlost | Sitemap 12 s, běžná stránka ~0,2 s | ověřeno |
| CORS | Server posílá `Access-Control-Allow-Origin: *` | ověřeno |
| Detail dokumentu | Obsah v `#hlobsah`, ale **chudý** — u úřední desky ~800 znaků, jen název, příloha a razítka. Plný text dokumentu je jen v PDF. | ověřeno |
| Velikost příloh | Detail uvádí `[PDF, 205 kB]`. OFN ani XML feedy velikost nenesou. | ověřeno |

### 2.1 `robots.txt` — čtěte pozorně

Staženo 3. 9. 2026, hlavička souboru: `# robots.txt for all webhouse's webs`, `# Last modified: 2011-09-09`.

```
User-agent: seznambot, twitterbot, facebookexternalhit, centrumbot,
            holmes, googlebot, bingbot, msnbot
Disallow: /VismoOnline_ActionScripts/CaptchaImage.aspx
Disallow: /vismo/ZaslatEmailem.asp
... (a několik konkrétních dokumentů)

User-agent: *          # match all bots
Disallow: /            # keep them out
```

Zadání v kap. 5.1 popisuje jen první blok („Disallow pro konkrétní skripty"). **Druhý blok, který je pro nás jediný relevantní, zadání neuvádí.** Pro jakéhokoli robota, který není jedním z osmi jmenovaných vyhledávačů, je zakázaný celý web — včetně `/opendata-uredni-deska` a všech RSS kanálů.

Není to rozhodnutí Kladna. Je to generický soubor dodavatele CMS pro všechny weby WEBHOUSE, nezměněný od roku 2011 — tedy z doby, kdy zákon o otevřených datech ani OFN úředních desek neexistovaly. Argumenty a možná řešení jsou v [PRAVNI.md](PRAVNI.md).

---

## 3. Úřední deska

### 3.1 OFN JSON-LD — `/opendata-uredni-deska`

**Stav: funguje s výhradou.** Ověřeno 3. 9. 2026: 147 263 B, `application/ld+json`.

| Vlastnost | Hodnota |
|---|---|
| Záznamů | **114** |
| Kontext | `https://ofn.gov.cz/úřední-desky/2021-07-20/kontexty/úřední-deska.jsonld` |
| Provozovatel | IČO `00234516` |
| Rozsah vyvěšení | **2021-02-19 až 2026-09-03** (na desce visí i pět let staré dokumenty) |
| Příloh celkem | 132, max. 6 u jednoho záznamu, 1 záznam bez přílohy |

Skutečné pokrytí polí (ne co slibuje norma):

| Pole | Vyplněno | Poznámka |
|---|---|---|
| `typ`, `url`, `iri`, `název`, `vyvěšení` | **114 / 114** | spolehlivé |
| `relevantní_do` → `datum` | **67 / 114** | u zbylých 47 je `nespecifikovaný: true` — konec vyvěšení není znám (typicky volební dokumenty). Opraveno 4. 9. 2026: dřívější údaj „114 / 114" počítal přítomnost klíče, ne hodnoty. |
| `dokument` | 113 / 114 | |
| `číslo_jednací` | **10 / 114** | prakticky nepoužitelné |
| `spisová_značka` | **1 / 114** | prakticky nepoužitelné |

> **Vada v datech města:** URL příloh obsahují HTML entitu `&amp;` místo `&` — a to uvnitř JSONu, kde nemá co dělat. Postihuje **113 ze 114** záznamů. Bez dekódování jsou odkazy na přílohy rozbité. Pipeline to musí opravit; stojí za to na to město upozornit.

### 3.2 Kanál `?9` — XML úřední deska ⭐ NOVÝ NÁLEZ

**Stav: funguje.** V zadání není. `https://www.mestokladno.cz/rss/?9`, 77 138 B, 114 záznamů, 132 příloh.

```xml
<ud><item id="1513126">
  <NAZEV>Exekutorský úřad Rakovník - Usnesení o elektronické dražbě…</NAZEV>
  <TYP>Písemnosti mimokladenských institucí</TYP>
  <TYPCESTA>Písemnosti jiných institucí / Písemnosti mimokladenských institucí</TYPCESTA>
  <VYVESENO>2026-09-03</VYVESENO>
  <STAZENO>2026-10-07</STAZENO>
  <PRILOHY><item><ID>1513127</ID><URL>…File.ashx?id_org=6506&amp;id_dokumenty=1513127</URL>
    <NAME>…pdf</NAME></item></PRILOHY>
</item></ud>
```

Ověřeno porovnáním množin ID: **kanál 9 a OFN obsahují přesně stejných 114 dokumentů.** Doplňují se:

| | OFN | Kanál 9 |
|---|---|---|
| Kategorie / složka | ✗ chybí | ✅ **114 / 114** (`TYP` + `TYPCESTA` s celou cestou) |
| Konec vyvěšení | ⚠️ 67 / 114 (u 47 `nespecifikovaný`) | ⚠️ stejných 67 / 114 |
| Číslo jednací, spisová značka | ⚠️ 10, resp. 1 | ✗ |

**Doporučení: spojit OFN + kanál 9 přes ID dokumentu.** Zadání v kap. 5.2 navrhuje párovat OFN s RSS 7, ale ten má jen 50 položek — pokryl by méně než polovinu desky. Kanál 9 pokryje vše.

Ověřeno 19 složek desky, přesně jak zadání uvádí. Nejobsazenější: rozpočet (32), doprava a služby (18), mimokladenské instituce (14), výstavba (14), životní prostředí (10).

---

## 4. RSS a XML kanály — úplný inventář

Kanály jsou na `/rss?<N>`, což **přesměrovává (301) na `/rss/?<N>`**. Bez následování redirectu dostanete prázdnou stránku — zadání redirect nezmiňuje. Ověřeny hodnoty 0–15; nad 9 vrací server .NET výjimku, takže kanálů je právě devět.

| N | Obsah | Formát | Položek | Stav |
|---|---|---|---|---|
| 0 / bez parametru | Kladno – aktuálně | RSS 2.0 | 50 | funguje |
| 1 | Kladno – aktuálně | RSS 2.0 | 50 | funguje |
| 2 | Aktuality z radnice | RSS 2.0 | 48 | funguje |
| 3 | Úřední deska | RSS 2.0 | 50 | funguje |
| 4 | Tiskové zprávy | RSS 2.0 | **0** | prázdný |
| 5 | Aktuality – inCity | RSS 2.0 + `wh_*` | 50 | funguje |
| **6** | **Kalendář akcí** | **`<events>` XML** | **28** | **funguje ⭐** |
| 7 | Úřední deska – inCity | RSS 2.0 + `wh_*` | 50 | funguje |
| 8 | — | — | **0** | prázdný |
| **9** | **Úřední deska** | **`<ud>` XML** | **114** | **funguje ⭐** |

Kanály 5 a 7 nesou navíc `wh_authorname`, `wh_path` (kategorie), `wh_ud_od`, `wh_ud_do` a číselné `<guid>` = ID dokumentu.

> Pojmenování kanálů 5 a 7 („inCity/mobilní aplikace") potvrzuje, že město už dnes vědomě publikuje data pro mobilní aplikaci třetí strany. Pro jednání s magistrátem je to silný argument.

---

## 5. Kalendář akcí

### 5.1 Kanál `?6` ⭐ NOVÝ NÁLEZ — vyvrací zadání

**Stav: funguje.** Zadání v kap. 5.4 tvrdí: *„Žádný iCal ani JSON export neexistuje — nutný scraping."* **Není to pravda.**

`https://www.mestokladno.cz/rss/?6`, 42 662 B, **28 akcí**, čitelné XML:

```xml
<events><event>
  <id>3197</id>
  <name>Charitativní koncert pro Denní stacionář Druhý život</name>
  <dates><date><start_date>2026-10-02</start_date><start_time>18:00</start_time>
    <end_date>2026-10-02</end_date><end_time>21:00</end_time></date></dates>
  <description>Přijďte podpořit činnost…</description>   <!-- čistý text -->
  <place><other>ŠK Kladno, Na Kovárně 567, Kladno</other></place>
  <organizer><name>…</name></organizer>
  <types><type>Ostatní</type></types>
  <details><url>…</url></details>
  <note><![CDATA[ <p class="MsoNormal" style="…"> ]]></note>  <!-- HTML z Wordu -->
</event></events>
```

Pokrytí polí (z 28): `start_date` 28, `end_date` 22, `description` 27, `place/other` 21, `start_time` 14, `organizer` 8, `end_time` 6, `note` 4.

Poznámky k použití:
- **Žádné geo souřadnice.** `place` je volný text („ŠK Kladno, Na Kovárně 567"). Pro mapu je nutné geokódovat proti RÚIAN.
- `description` je čistý text a dá se použít rovnou. `note` je HTML vyexportované z Wordu (`MsoNormal`, `mso-themecolor`, `<o:p>`) — buď důkladně sanitizovat, nebo v MVP zahodit.
- **28 akcí je jen aktuální výhled.** 1 913 akcí v sitemapě je celá historie od roku 2008. Pro aplikaci stačí feed; archiv nepotřebujeme.

### 5.2 Vstupenky

GoOut (`goout.net/cs/kladno/…`) — bez veřejného API. Zůstává u doporučení zadání: odkazovat, nescrapovat.

---

## 6. Sekce webu města

Všech **23 ID ze zadání (kap. 5.5) ověřeno proti sitemapě — všechna existují.** Kontrola proběhla nad staženou sitemapou, tedy bez zátěže serveru. Jedna oprava sluggu:

| Zadání uvádí | Ve skutečnosti |
|---|---|
| `/aktuality-a-tiskove-zpravy/ds-901` | `/aktuality/ds-901` |

`lastmod` ze sitemapy ukazuje, které sekce jsou živé a které mrtvé:

| Sekce | ID | lastmod | Stav |
|---|---|---|---|
| Ztráty a nálezy | ds-200235 | 2026-09-03 | živá |
| Volná pracovní místa | ds-4363 | 2026-09-03 | živá |
| Aktuality | ds-901 | 2026-09-02 | živá |
| Uzavírky komunikací | ds-43821 | 2026-09-02 | živá |
| Sběrné dvory | ds-200618 | 2026-08-27 | živá |
| Blokové čištění | ds-201379 | 2026-08-06 | živá |
| Podklady pro zasedání ZM | ds-200937 | 2026-06-09 | živá |
| **Informace z dopravy** | ds-201023 | **2023-03-29** | **mrtvá** |
| **Přerušení dodávky vody** | ds-201255 | **2023-04-05** | **mrtvá** |
| **Přerušení dodávky elektřiny** | ds-201261 | **2023-04-17** | **mrtvá** |
| **Usnesení a zápisy ZM** | ds-200003 | **2022-10-25** | **mrtvá** |

Stažené a rozebrané sekce:

| Sekce | Co v ní skutečně je | Použitelnost |
|---|---|---|
| **Uzavírky** ds-43821 | Volný text přímo ve stránce, ne seznam dokumentů. Jednotlivé uzavírky jsou odstavce: *„Dočasný zákaz zastavení… ulice Čs. armády (2.9.2026)… sil. II/238 v km 4,930–5,030… v délce cca 100 m, s platností od 3.9."* | **Nutné parsovat volný text.** Názvy ulic a data v textu jsou, ale bez struktury. Nejnáročnější scraper projektu. |
| **Blokové čištění** ds-201379 | Odkaz na PDF „Operační plán zimní údržby 2025/2026" (d-1507716) | ⚠️ **Harmonogram je v PDF, ne v HTML.** Viz riziko níže. |
| **Přerušení vody** ds-201255 | Jen kontakt na Středočeské vodárny. Žádná data. | **nepoužitelné** |
| **Přerušení elektřiny** ds-201261 | Věta „Aktuální odstávky naleznete v banneru níže" + embed ČEZ. Žádná data. | **nepoužitelné** |
| **Informace z dopravy** ds-201023 | 289 znaků, prakticky prázdná | **nepoužitelné** |
| **Sběrné dvory** ds-200618 | 5 464 znaků souvislého textu s adresami a otevírací dobou. Mění se (sběrné místo M. Horákové ukončeno k 28. 2. 2026). | Použitelné, ale volný text |
| **Odbory** `os-*` (178 stránek) | Ověřeno na `os-1018`: **16 e-mailů, 28 telefonů**, náplň činnosti, adresa | **funguje** — nejlepší zdroj kontaktů |

> **Riziko pro fázi 3 — blokové čištění.** Zadání staví notifikaci „blokové čištění v mé ulici den předem v 18:00" mezi hlavní funkce. Harmonogram je ale v PDF. To znamená buď parsování PDF (křehké, s každou sezónou jiné), nebo funkci vypustit. Rozhodnout před fází 3, ne v ní.

---

## 7. Doprava

### 7.1 PID GTFS — hlavní otevřená otázka zadání, **zodpovězena**

**Staženo 3. 9. 2026: `https://data.pid.cz/PID_GTFS.zip`, 46,7 MB, ~246 MB rozbaleno.** Bez klíče, bez registrace.

Rozbor obsahu vůči Kladnu:

| Zjištění | Hodnota |
|---|---|
| Zastávek celkem v ČR | 19 232 |
| Zastávek s „Kladno" v názvu | **146** (65 unikátních názvů) |
| Z toho obsluhovaných nějakou linkou | 122 |
| Linek obsluhujících Kladno | **30** |
| Tarifní pásmo | 3 |

**Všech 30 linek je příměstských, regionálních nebo železničních:**

- z Prahy: 300, 306, 307, 322, 324, 330, 342, 350, 386, 399
- z Kladna do okolí: 555, 600, 616, 617, 618, 619, 620, 622, 623, 624, 625, 626, 628, 630, 650
- vlaky: **S5** (Praha–Kladno), S45, S50, R24, R45

**Městské linky MHD Kladno tam nejsou.** Ověřeno třemi způsoby: v `routes.txt` není žádná linka s městským číslováním obsluhující Kladno; v `agency.txt` je jediný dopravce („Pražská integrovaná doprava"); v `route_sub_agencies.txt` **není žádný záznam obsahující „Arriva" ani „City"**.

**Důsledek pro zadání:** dopravní modul ve fázi 4 nemůže stát na PID GTFS tak, jak zadání předpokládá. Návrh náhrady:

1. **Fáze 4 postavit na tom, co ověřeně funguje** — příměstské a regionální odjezdy plus vlaky z GTFS. Pro obyvatele Kladna dojíždějícího do Prahy je to nejcennější část (linka 399 a vlak S5).
2. **MHD Kladno vyřešit odkazem**, ne vlastními daty — deep link do IDOS na konkrétní zastávku. Nula nákladů, nula rizika.
3. **Vlastní GTFS pro MHD Kladno nedělat.** Znamenalo by to ručně udržovat jízdní řády — přesně ten druh práce, který se rozpadne za tři měsíce.
4. Při jednání s městem **požádat o data MHD**. Město je objednatelem dopravy, na data má nárok. To je konkrétní věc, kterou aplikace získá jedině spoluprací — dobrý argument do jednání.

### 7.2 Ostatní dopravní zdroje

| Zdroj | Zjištění | Stav |
|---|---|---|
| PID GTFS Realtime (Golemio) | Vyžaduje registraci klíče na `api.golemio.cz/api-keys`. Klíč zdarma, ale **uložení klíče do repozitáře je vyloučeno** (kap. 10 zadání) — musí jít do GitHub Secrets. Neověřeno, klíč nemám. | nedořešeno |
| Odjezdová tabule SŽ (Kladno Key=1919) | HTTP 200, 119 651 B, 20 řádků tabulky | funguje, ale **nepotřebujeme** — vlaky pokrývá GTFS |
| dopravniinfo.cz (JSDI) | Neověřeno, zadání samo varuje. Nespoléhat. | vynecháno |

---

## 8. Výpadky sítí, ovzduší, výstrahy

### 8.1 Ovzduší ČHMÚ — **funguje, lepší než čekáno**

Data: `https://opendata.chmi.cz/air_quality/now/data/airquality_1h_avg_CZ.csv` (18 487 B, hodinové průměry)
Metadata: `https://opendata.chmi.cz/air_quality/now/metadata/metadata.json` (1,5 MB)

**Oprava zadání:** kap. 5.7 uvádí čtyři kladenské stanice (SKLM, SKLR, SKLC, SKLS). V aktuálních datech jsou **jen dvě** — SKLR (Rozdělov) ani SKLC (Vrapice) v metadatech nejsou.

Ověřeno spárování metadat s živým CSV — **všech 9 veličin mělo 3. 9. 2026 ve 21:00 skutečnou hodnotu**:

| Stanice | Souřadnice | Měří | `IdRegistration` |
|---|---|---|---|
| **SKLM** Kladno-střed města | 50.14386, 14.10178 | O₃ (69,0), PM2,5 (1,0), PM10 (3,8), **index kvality ovzduší (2,0)** | 41043, 41050, 41045, 1648358 |
| **SKLS** Kladno-Švermov | 50.16741, 14.10605 | SO₂ (3,5), NO₂ (3,3), NOx (4,2), PM10 (1,0), **index (2,0)** | 41056, 41058, 41059, 41060, 1649039 |

Index kvality ovzduší je hotové číslo 1–6 — přesně to, co potřebuje dlaždice na hlavní obrazovce. Licence CC BY 4.0.

### 8.2 Výstrahy ČHMÚ (SIVS) — funguje, ale filtr zbývá dořešit

Zadání uvádí `https://vystrahy.chmi.cz/cap/` — to je **PWA aplikace pro lidi, ne feed**. Skutečný feed je:

**`https://opendata.chmi.cz/meteorology/weather/alerts/cap/`** — 726 CAP XML souborů, ověřeno stažením jednoho (46 465 B).

- Struktura odpovídá CAP: `identifier`, `event`, `severity`, `urgency`, `certainty`, `onset`, `area`, `geocode`
- **Nemá polygony**, jen kódy ORP: `<valueName>CISORP</valueName><value>2115</value>`
- Jeden soubor pokrývá celou ČR: 28 bloků `<area>` (kraje), 412 záznamů CISORP, 206 unikátních ORP
- Dokumentace: `…/alerts/metadata/Dokumentace_CAP.pdf` (11 stran, poslední aktualizace 2018) — potvrzuje význam CISORP, ale seznam kódů neobsahuje

> **Nedořešeno: číselný kód ORP Kladno.** Zkoušel jsem export číselníku ČSÚ (`apl.czso.cz/iSMS/cisexp.jsp` → 404), VDP RÚIAN (formulář bez URL parametrů) a dokumentaci CAP (kód neuvádí). **Kód nebudu hádat.** Vyřeší se ve fázi 1 jedním z: (a) stažení číselníku ČSÚ 65 z NKOD, (b) odečtení z první výstrahy pro Středočeský kraj. Není to blokující — modul výstrah není v MVP.

### 8.3 Voda, elektřina, teplo

| Zdroj | Zjištění | Stav |
|---|---|---|
| Sekce města — voda / elektřina | Mrtvé od 2023, jen kontakty a embed banner | **nepoužitelné**, viz kap. 6 |
| Středočeské vodárny `svas.cz/aktuality/aktualni-havarie-vody/` | HTTP 200, 20 230 B. Bez API, nutný scraping. **Vlastní `robots.txt` neověřen — nutné před scrapingem.** | k ověření |
| ČEZ Distribuce | Zadání samo doporučuje nepoužívat. Souhlasím — smluvní API. | vynecháno |
| Teplo | Zadání správně upozorňuje, že `teploprokladno.cz` je web ke sporu, ne provozní hlášení. Nenašel jsem zdroj odstávek tepla. | **žádný zdroj** |

**Důsledek:** modul „výpadky sítí" z fáze 1 nemá spolehlivý zdroj pro vodu ani elektřinu. Doporučuji ho z fáze 1 vypustit a nahradit ho ovzduším a výstrahami ČHMÚ, které fungují.

---

## 9. Adresy a území — RÚIAN

**Stav: funguje.** Ověřeno stažením tří měsíčních snapshotů.

`https://vdp.cuzk.cz/vymenny_format/csv/<RRRRMMDD>_OB_532053_ADR.csv.zip` — kde `532053` je kód obce Kladno (potvrzeno z ARES). Ověřeny soubory k 30. 6., 31. 7. a 31. 8. 2026 (203 840 B), tedy měsíční aktualizace funguje.

| Vlastnost | Hodnota |
|---|---|
| Adresních míst | **9 716** |
| **Unikátních ulic** | **578** |
| Adres bez ulice | 185 |
| Kódování | **windows-1250** (ne UTF-8 — snadná past) |
| Oddělovač | středník |
| Souřadnice | S-JTSK (`Souřadnice Y`, `Souřadnice X`), nutný převod na WGS84 |
| Licence | CC BY 4.0 |

**Oprava zadání kap. 4 — části města.** RÚIAN zná **6 úředních částí obce**:

| Část obce | Adresních míst |
|---|---|
| Kročehlavy | 3 033 |
| Kladno | 2 830 |
| Švermov | 1 806 |
| Rozdělov | 1 076 |
| Dubí | 828 |
| Vrapice | 143 |

Zadání jich uvádí jedenáct. **Dříň, Ostrovec, Hnidousy, Motyčín, Sítná a „Kladno-střed" nejsou úřední části obce** — jsou to lidové názvy lokalit (Hnidousy a Motyčín se sloučily do Švermova). V RÚIAN nejsou, nelze je z dat odvodit.

Doporučení: v aplikaci nabídnout **6 úředních částí** a lidové názvy případně doplnit později ručním číselníkem ulic. Ale ne v MVP — je to ruční práce, která zestárne.

---

## 10. Úřad, zakázky, rozpočet

| Zdroj | Ověření 3. 9. 2026 | Stav |
|---|---|---|
| **ARES** | HTTP 200, JSON, 3 237 B. Dává `kodObce` **532053**, `kodOkresu` 3203, `kodKraje` 27, adresu sídla, DIČ. | **funguje** |
| **Registr smluv** | `data.smlouvy.gov.cz/index.xml` — HTTP 200, 1,27 MB, měsíční dumpy od 2017. Filtrovat podle IČO 00234516. Dumpy ~70 MB/měsíc. | **funguje** |
| **Monitor státní pokladny** | `…/api/i-view/00234516` vrací **`text/html`, ne JSON** — je to vizualizační widget (jQuery + Highcharts), ne API. Zadání kap. 5.8 tvrdí „JSON, časová řada 2010–2026". **Není pravda.** Strojová data jsou jinde (CSV v datovém katalogu). | **nepoužitelné tak, jak zadání popisuje** |
| **Tender Arena** (profil Z0002380) | HTTP 200, ale jen 4 574 B — JS aplikace bez obsahu v HTML. Strojový výstup na této URL není. | **nepoužitelné bez dalšího průzkumu** |
| **edesky.cz** | `api/v1/dashboards` → **HTTP 401**, vyžaduje klíč | nedořešeno |
| **Volby** | `volby.gov.cz/opendata/opendata.htm` HTTP 200 | funguje |
| **NKOD** | Kladno má registrovanou jedinou datovou sadu — úřední desku | ověřeno |

---

## 11. Kultura, sport, ostatní

| Subjekt | Zjištění | Stav |
|---|---|---|
| **Městské divadlo Kladno** | HTTP 200. **WordPress** (AIOSEO), má **RSS `divadlokladno.cz/feed/`** a funkční REST API (`/wp-json/wp/v2/types` → 200). Ale post types jsou jen `post`, `page`, `herci` — **vlastní typ pro představení neexistuje**, program je mimo REST. | RSS ano, program nutno scrapovat |
| **Sportovní areály SAMK** | HTTP 200, 314 KB, žádná strukturovaná data | scraping |
| **Rytíři Kladno** | HTTP 200, OG tagy, bez JSON-LD | scraping |
| **Kladenský zámek** | HTTP 200, OG tagy | scraping |
| **Oblastní nemocnice** | HTTP 200, Joomla, 1 blok JSON-LD | scraping |
| **Městská knihovna** `mkkl.cz` | **HTTP 500** — server hlásí chybu. Tritius API neověřitelné. | **nedostupné** |
| **Městská policie** `mpkladno.cz` | Také VISMO. **RSS ale nemá** — `/rss?1` i `/rss/?6` vrací 404. Sitemap má (651 KB). `robots.txt` **opět `Disallow: /`**. | bez RSS |
| **YouTube kanál města** | HTTP 200, Atom, 26 034 B, bez klíče | **funguje** |
| Portál občana, Rezervace | Bez API, jen deep link — dle zadání | ok |

---

## 11a. Co ukázal ostrý provoz (4. 9. 2026)

Pipeline běží a plní `data/v1/`. Několik věcí se dalo zjistit až při skutečném zpracování,
ne při průzkumu:

| Zjištění | Dopad |
|---|---|
| **OFN uvádí `nespecifikovaný: true`** místo data u 47 ze 114 dokumentů | Konec vyvěšení prostě není znám. Průzkum to přehlédl — počítal přítomnost klíče, ne hodnoty. |
| **Kanál 9 posílá prázdný `<STAZENO></STAZENO>`** místo vynechání tagu | Bez ošetření se prázdný řetězec protlačí dál jako neplatné datum. |
| **Jmenovité zákazy v `robots.txt` jsou zapsané u vyhledávačů**, ne ve skupině `*` | Skupina `*` má jen plošné `Disallow: /`. Kdo čte jen ji, nechrání nic — pipeline proto sbírá jmenovité zákazy ze všech skupin (20 cest). |
| **Sběrné dvory jsou v HTML tabulkách**, ne v plochém textu | Parser je čte z `<table>`, což je spolehlivější, než jak to vypadalo z textového výpisu. |
| **Datumy v uzavírkách se píšou i bez roku** („od 23.06. do 30.09. 2026") | Rok se doplňuje z nejbližšího dalšího data v textu. |
| **První datum v textu uzavírky nebývá začátek**, ale termín dokončení | Začátek se bere jen za slovem „od", jinak platí datum vyvěšení. Jinak by uzavírka tvrdila, že začne za rok. |
| **Ulice se v textech vždy uvádějí s uvozením** („ul. Kladenská") | Jednoslovné názvy se proto bez uvození nepřijímají — jinak „Práce jsou ve finální fázi" označí náměstí Práce. |
| **Řada pracovišť nemá vlastní úřední e-mail** | 15 z 33; zbytek zůstává bez kontaktu. Podrobně v [PRAVNI.md](PRAVNI.md), kap. 3.2. |

Ověřený objem dat z ostrého běhu: 578 ulic, 6 částí obce, 112 dokumentů úřední desky,
27 akcí, 50 aktualit, 2 stanice ovzduší, 21 uzavírek, 3 sběrné dvory, 33 pracovišť.
Celý běh trvá 61 s včetně povinných prodlev mezi požadavky.

---

## 12. Co zbývá ověřit

| Co | Proč nezbytné | Kdy |
|---|---|---|
| Kód ORP Kladno pro CAP | filtr výstrah ČHMÚ | fáze 1 |
| `robots.txt` u svas.cz, divadlokladno.cz, samk.cz | před jakýmkoli scrapingem | před fází 1 |
| Golemio API klíč | realtime MHD; vyžaduje registraci | fáze 4 |
| Frekvence aktualizace kanálů 6 a 9 | nastavení cronu | fáze 1, měřením |
| Tritius API knihovny | web hlásí 500 | backlog |
| Jak město publikuje harmonogram blokového čištění mimo PDF | funkce z fáze 3 | před fází 3 |
