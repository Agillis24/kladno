# Právní rámec

Stav k 3. 9. 2026. Tenhle dokument popisuje, co jsem zjistil, a kde je rozhodnutí na vás.
Nejsem právník a vy ano — tak níže nenajdete poučování o správním právu, ale fakta zjištěná
z reálných zdrojů a otázky, na které je potřeba odpovědět, než se napíše první scraper.

---

## 1. Otevřená otázka číslo jedna: `robots.txt`

### Co jsem skutečně stáhl

`https://www.mestokladno.cz/robots.txt`, 3. 9. 2026, 1 585 B. Hlavička souboru:

```
# robots.txt for all webhouse's webs
# Last modified: 2011-09-09 09:09 CEST
```

Soubor má dva bloky. **Zadání v kap. 5.1 popisuje jen ten první** (výjimky pro captcha,
`ZaslatEmailem.asp`, `galerie3.asp`, `/aa/` a několik konkrétních dokumentů). Ten se ale
vztahuje na osm jmenovaných vyhledávačů — seznambot, googlebot, bingbot, twitterbot,
facebookexternalhit, centrumbot, holmes, msnbot.

Druhý blok, který zadání neuvádí a který je pro nás jediný relevantní:

```
User-agent: *          # match all bots
Disallow: /            # keep them out
```

**Pro robota, který není jedním z osmi jmenovaných vyhledávačů, je zakázaný celý web** —
včetně `/opendata-uredni-deska` a všech devíti RSS/XML kanálů.

Stejný soubor má i `mpkladno.cz`, s komentářem `# new webs @ temporary addressess blocked
for indexing by default`.

### Co k tomu mám za pozorování

Nejsou to argumenty pro ani proti, jen fakta, která by v rozhodování měla zaznít:

1. **Soubor není rozhodnutím Kladna.** Je to generický soubor dodavatele CMS pro všechny weby
   WEBHOUSE („for all webhouse's webs"), nezměněný od **září 2011**. Tehdy neexistoval ani
   zákon o otevřených datech, ani OFN úředních desek (2021), ani mobilní aplikace, pro kterou
   město dnes samo připravuje kanály.
2. **Město současně publikuje data výslovně pro strojové zpracování.** Úřední deska je
   registrovaná v Národním katalogu otevřených dat pod IČO 00234516 a publikovaná v OFN. To je
   akt, jehož jediný smysl je strojové čtení třetími stranami.
3. **Kanály 5 a 7 se jmenují „inCity/mobilní aplikace".** Město je vytvořilo pro mobilní
   aplikaci třetí strany. Existuje tedy zavedená praxe, kdy cizí aplikace tato data odebírá.
4. **Server posílá `Access-Control-Allow-Origin: *`.** Technicky vzato explicitní povolení
   číst data z cizího klienta.
5. Zároveň: `robots.txt` je konvence, ne právní předpis, a nic z výše uvedeného nemění to,
   co v souboru stojí.

### Kde je hranice, kterou nepřekročím bez vašeho pokynu

Rozlišuji dvě různé věci, protože mají různou váhu:

| | Co to je | Co si o tom myslím |
|---|---|---|
| **A. Odběr publikovaných feedů** | 10 URL (OFN + 9 kanálů), volaných jednou za hodinu | Data určená ke strojovému čtení, publikovaná v NKOD. Odebírat je považuji za obhajitelné i přes plošný `Disallow`. |
| **B. Scraping HTML stránek** | Uzavírky, odpady, kontakty, akce — jednotlivé stránky webu | Tady `Disallow: /` míří přesně. Navíc přichází ke slovu **zvláštní právo pořizovatele databáze** (§ 88a a násl. autorského zákona) — systematické vytěžování obsahu webu je jiná kategorie než odběr feedu. |

**Do doby, než rozhodnete, postavím fázi 1 výhradně na (A).** Ukázalo se, že to stačí na
podstatně víc, než zadání předpokládalo — feedy pokrývají úřední desku i kalendář akcí.

### Tři cesty, ze kterých je potřeba vybrat

| | Cesta | Co to znamená | Co získáte | Co ztratíte |
|---|---|---|---|---|
| **1** | **Napsat městu dřív než psát scrapery** | E-mail tiskovému odboru / tajemníkovi: kdo jste, co stavíte, prosba o souhlas se scrapingem a o výjimku v `robots.txt` pro `MojeKladnoBot` | Právní jistotu, kontakt navázaný před fází 5, možná i data MHD | Několik týdnů čekání |
| **2** | **Jen feedy, žádný scraping** | Fáze 1 pouze na (A) | Můžete stavět hned, bez otevřených otázek | Uzavírky, odpady, kontakty a sběrné dvory v aplikaci nebudou |
| **3** | **Scrapovat i tak** | Šetrně, s vlastním UA, 1 req/1,5 s | Plný rozsah zadání hned | Rozpor s `robots.txt` a s kap. 9.5 zadání; riziko v okamžiku, kdy budete s městem jednat |

**Moje doporučení: kombinace 1 + 2.** Napsat městu hned teď (návrh e-mailu je v
[MESTO.md](MESTO.md)) a mezitím postavit fázi 1 na feedech. Když souhlas přijde, scrapery
se doplní; když nepřijde, aplikace i tak funguje. Cesta 3 se mi nelíbí ne kvůli riziku žaloby
— to je u obecního webu spíš teoretické — ale proto, že cílem projektu je nabídnout aplikaci
městu. Začínat vztah porušením jejich `robots.txt` je špatná vyjednávací pozice, a je to první
věc, kterou dodavatel CMS při obraně své zakázky zmíní.

---

## 2. Publikace v obchodech (kap. 9.1 zadání)

Zadání riziko popisuje správně a nemám k němu co dodat kromě jednoho zjištění, které
vyjednávací pozici zlepšuje: **město už dnes data pro cizí mobilní aplikaci publikuje**
(kanály 5 a 7, pojmenované „inCity/mobilní aplikace"). Argument „poskytujete data pro cizí
aplikaci, poskytněte je i nám" je konkrétní a doložitelný.

Do vyřešení souhlasu platí:

- pracovní název **není** „Moje Kladno" v obchodech; ten si držíme pro variantu se souhlasem
- na první obrazovce, v „O aplikaci" i v prvním odstavci popisu v obchodě:
  *„Nezávislá aplikace. Není provozována Statutárním městem Kladnem."*
- žádný znak, prapor ani logo města — viz § 34a zákona č. 128/2000 Sb.

**Pozor na jeden detail:** stažená stránka města používá `/html/images/logo.svg` s alt textem
„Kladno - oficiální stránky". Při scrapingu se nesmí stát, že se logo dostane do dat aplikace
jako obrázek článku. Pipeline musí obrázky z domény města filtrovat, ne jen přeposílat.

---

## 3. Osobní údaje

### 3.1 Úřední deska

Ověřený obsah: ze 114 dokumentů je 14 od mimokladenských institucí (exekutorské dražby),
18 veřejných vyhlášek odboru dopravy, 14 odboru výstavby, 10 životního prostředí. Jsou to
typicky dokumenty se jmény fyzických osob.

Zadání v kap. 9.3 stanovuje pravidla, která považuji za správná a zapracuji je do pipeline:
žádné profilování, žádné spojování osob napříč dokumenty, žádné vyhledávání podle jména jako
samostatná funkce, respektování lhůt.

Dvě věci, které z ověření vyplynuly navíc:

- **Na desce visí dokumenty s datem vyvěšení až 2021-02-19.** Pole `relevantní_do` je
  vyplněné u všech 114, takže lhůtu lze respektovat spolehlivě. Pipeline bude do výpisů pouštět
  jen dokumenty s `relevantní_do >= dnes`.
- **Plný text dokumentů nikam nekopírujeme.** Detail na webu města obsahuje jen ~800 znaků
  (název + odkaz na PDF). Obsah je v PDF a ten pipeline nestahuje — aplikace na něj odkazuje.
  To je z hlediska ochrany údajů výhodné a je dobré to takhle nechat i kdyby šlo jinak.

### 3.2 Kontakty úředníků

Ověřeno na `os-1018`: stránka odboru obsahuje 16 e-mailů a 28 telefonů se jmény. Jde o údaje
zveřejněné povinným subjektem, ale je to zpracování osobních údajů. Pravidlo pro pipeline:
přebírat **jen pracovní kontakt v rozsahu, v jakém ho město zveřejňuje**, nespojovat s ničím
dalším a nedělat z toho vyhledávatelný rejstřík osob. (Modul kontaktů je stejně až za feedy —
je závislý na scrapingu, viz kapitola 1.)

### 3.3 Uživatel aplikace

Ve fázi 1–3 neodchází z telefonu nic. Notifikace se počítají lokálně, výběr ulic zůstává
v zařízení. Žádná analytika. To je nejen správné, ale i praktické: bez serveru není co řešit
v zásadách ochrany osobních údajů kromě konstatování, že se nic nesbírá.

---

## 4. Licence dat — ověřený stav

| Zdroj | Licence | Ověřeno |
|---|---|---|
| Úřední deska (OFN) | otevřená data, registrace v NKOD pod IČO 00234516 | ano |
| PID GTFS | CC-BY (ROPID/IDSK) | staženo, bez klíče |
| RÚIAN | CC BY 4.0 (ČÚZK) | staženo |
| ČHMÚ (ovzduší, výstrahy) | CC BY 4.0 | staženo |
| ARES | veřejný rejstřík | staženo |
| Registr smluv | veřejný registr | staženo |
| OpenStreetMap | ODbL, nutná atribuce | fáze 4 |
| Ostatní obsah webu města a organizací | **bez výslovné licence** | — |

Poslední řádek je důvod, proč aplikace u každé položky odkazuje na originál a proč
nekopírujeme PDF ani fotogalerie.

---

## 5. Co je potřeba rozhodnout, než začne fáze 1

1. **Cesta podle kapitoly 1** (doporučuji 1 + 2).
2. **Kontaktní e-mail do `User-Agent`.** Zadání předepisuje UA s kontaktem. Zatím používám
   `MojeKladnoBot/1.0 (+https://github.com/Agillis24/kladno)` bez e-mailu — doplňte adresu,
   na kterou vám může správce webu napsat, nebo potvrďte, že stačí odkaz na repozitář.
3. **Zda oslovit město hned** (návrh e-mailu v [MESTO.md](MESTO.md)).

## 6. Poznámka k repozitáři

`github.com/Agillis24/kladno` je **veřejný**. Pro projekt, který má být nabídnut městu, je to
spíš výhoda. Znamená to ale, že v něm nesmí skončit žádný klíč — zejména Golemio API klíč
(fáze 4) patří do GitHub Secrets, ne do souboru.
