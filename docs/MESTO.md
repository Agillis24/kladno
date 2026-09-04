# Podklad pro jednání s magistrátem

Stav k 3. 9. 2026. Argumenty níže stojí na skutečně ověřených zjištěních, ne na dojmech —
každé číslo je doložené v [ZDROJE.md](ZDROJE.md).

---

## 1. Proč oslovit město dřív než později

Tři důvody, všechny praktické:

1. **`robots.txt` blokuje celý web** pro všechny roboty kromě osmi vyhledávačů. Bez výjimky
   nebo souhlasu nelze legitimně scrapovat uzavírky, odpady ani kontakty. Viz [PRAVNI.md](PRAVNI.md).
2. **App Store pravidlo 5.2.1** — aplikace vypadající jako oficiální aplikace instituce bez
   doložené autorizace se odmítá. Souhlas v App Review Notes tenhle problém odstraní.
3. **Data MHD Kladno neexistují ve veřejné podobě.** Město je objednatelem městské dopravy.
   Tohle je věc, kterou aplikace získá jedině spoluprací.

Čekání nic nezlepší — souhlas dorazí až po týdnech a fáze 5 na něm stojí.

---

## 2. Co je naše vyjednávací výhoda

### 2.1 Město už data pro cizí mobilní aplikaci publikuje

Kanály `?5` a `?7` se ve svém vlastním názvu jmenují **„Město Kladno – Aktuality –
inCity/mobilní aplikace"** a **„…Úřední deska – inCity/mobilní aplikace"**. Magistrát tedy už
dnes vědomě vyrábí data pro mobilní aplikaci třetí strany. Nežádáme o precedens, žádáme
o rovné zacházení.

### 2.2 Našli jsme v jejich datech vady, které jim můžeme opravit zdarma

Tohle je nejsilnější věc, se kterou lze přijít — přinášíme hodnotu dřív, než o něco žádáme:

| Nález | Rozsah | Dopad |
|---|---|---|
| **V OFN feedu úřední desky je `&amp;` místo `&` v URL příloh** | **113 ze 114 záznamů** | Kdokoli data zpracuje strojově podle normy, dostane rozbité odkazy na přílohy. Postihuje to i Národní katalog otevřených dat. |
| Sekce „Přerušení dodávky pitné vody" a „…elektrické energie" jsou od roku 2023 beze změny | 2 sekce | Občan tam chodí pro informaci, která tam není |
| Sekce „Informace z dopravy" je prakticky prázdná (289 znaků) | 1 sekce | totéž |
| RSS kanály 4 a 8 vrací 0 položek | 2 kanály | „Tiskové zprávy" nefungují |
| `robots.txt` je generický soubor dodavatele z roku **2011** | celý web | Blokuje i vlastní otevřená data města registrovaná v NKOD |
| **Web má v DNS záznam AAAA, ale na IPv6 spojení nepřijímá** | celý web | Komukoli, kdo web volá z prostředí s IPv6, spojení náhodně padá. Ověřeno: `curl -4` vrátí 200, `curl -6` selže. |

### 2.3 Kvalitou proti stávajícímu řešení

Stávající aplikace „Města a obce" (`cz.webhouse.cityApp`) od dodavatele CMS přelévá dva RSS
kanály. My máme ověřeno, že z veřejných zdrojů lze bez jediné koruny provozních nákladů
postavit podstatně víc: 114 dokumentů úřední desky **s kategoriemi a lhůtami**, kalendář akcí,
578 ulic z RÚIAN pro personalizaci, index kvality ovzduší ze dvou kladenských stanic,
30 dopravních linek a výstrahy ČHMÚ.

---

## 3. O co konkrétně žádat

Seřazeno podle toho, co nejvíc pomůže a co nejmíň stojí úřad:

1. **Výjimka v `robots.txt`** pro `MojeKladnoBot` — jednořádková změna u dodavatele CMS,
   nebo písemný souhlas se scrapingem v šetrném režimu (1 požadavek / 1,5 s).
2. **Písemný souhlas s aplikací** (stačí e-mail od tiskového odboru nebo tajemníka) pro
   App Review Notes.
3. **Data MHD Kladno** — jízdní řády ve strojově čitelné podobě, ideálně GTFS.
4. Do budoucna: souhlas s užitím znaku města podle § 34a zákona č. 128/2000 Sb. a název
   „Moje Kladno". Tohle je až poslední krok, ne první.

---

## 4. Návrh e-mailu

Krátký, konkrétní, bez žádosti hned v prvním odstavci. Doplňte kontaktní údaje a odešlete
tiskovému odboru nebo tajemníkovi magistrátu.

> **Předmět:** Chyba v otevřených datech úřední desky + nabídka spolupráce na mobilní aplikaci
>
> Dobrý den,
>
> jmenuji se […] a jsem obyvatel Kladna. Ve volném čase pracuji na mobilní aplikaci, která
> má občanům zpřístupnit informace z webu města v přehlednější podobě. Než Vás o cokoli
> požádám, rád bych upozornil na dvě věci, které jsem při práci s Vašimi daty našel.
>
> **1) Chyba v otevřených datech úřední desky.** V souboru
> `https://www.mestokladno.cz/opendata-uredni-deska`, který město publikuje podle Otevřené
> formální normy a má registrovaný v Národním katalogu otevřených dat, jsou URL příloh
> zapsané s HTML entitou `&amp;` místo znaku `&`. Týká se to 113 ze 114 aktuálních záznamů.
> Kdokoli data zpracuje strojově, dostane nefunkční odkazy na přílohy. Je to chyba
> v generátoru na straně CMS a předpokládám, že ji dodavatel opraví rychle.
>
> **2) Neaktuální sekce.** Stránky „Přerušení dodávky pitné vody", „Přerušení dodávky
> elektrické energie" a „Informace z dopravy" se podle sitemapy naposledy změnily v roce 2023
> a neobsahují žádné aktuální informace. Občané je přitom mohou hledat jako první.
>
> K té aplikaci: staví jen na veřejných zdrojích (Vaše otevřená data a RSS kanály, RÚIAN,
> ČHMÚ, PID) a je nekomerční. Narazil jsem ale na to, že soubor `robots.txt` na Vašem webu
> plošně zakazuje přístup všem automatům kromě osmi vyhledávačů — včetně přístupu k Vašim
> vlastním otevřeným datům. Soubor je podle hlavičky z roku 2011 a je generický pro všechny
> weby dodavatele CMS, takže předpokládám, že nejde o záměr města.
>
> Rád bych se proto zeptal:
>
> - Bylo by možné doplnit do `robots.txt` výjimku pro identifikátor `MojeKladnoBot`, případně
>   mi dát písemný souhlas s automatizovaným čtením? Data bych odebíral šetrně — nejvýše
>   jeden požadavek za 1,5 sekundy, s vlastní identifikací a kontaktem.
> - Vydává město jízdní řády MHD Kladno ve strojově čitelné podobě? V datech PID jsou pouze
>   příměstské a regionální linky, městské linky tam nejsou.
> - Měli byste zájem aplikaci vidět, až bude v použitelném stavu? Mým cílem není konkurovat
>   webu města, ale usnadnit lidem přístup k tomu, co už zveřejňujete.
>
> Děkuji za čas.
>
> S pozdravem
> […]

**Poznámka k tónu:** e-mail nezmiňuje stávající aplikaci dodavatele ani nabídku převzetí.
Obojí patří až do jednání, ne do prvního e-mailu — jinak to čte jako útok na zakázku
a odpověď přijde od dodavatele, ne od města.

---

## 5. Co dělat, když město neodpoví

Nedělat nic dramatického. Fáze 1 stojí jen na feedech a funguje i bez odpovědi. Po měsíci
zkusit jiný kanál (tajemník, IT odbor, konkrétní radní), případně podat žádost podle zákona
č. 106/1999 Sb. na jízdní řády MHD — ale až tehdy, když bude aplikace hotová a bude co ukázat.
