# Moje Kladno

Mobilní aplikace pro obyvatele Kladna: úřední deska, aktuality, akce, doprava, odpady,
ovzduší a kontakty na úřad na jednom místě.

> **Nezávislý projekt.** Aplikace není provozována Statutárním městem Kladnem.
> Veškerá data pocházejí z veřejných zdrojů a aplikace u každé položky odkazuje na originál.

## Stav

**Fáze 0 — průzkum dokončen, plán čeká na odsouhlasení.** Aplikační kód zatím nevzniká.

| Dokument | Obsah |
|---|---|
| [docs/ZDROJE.md](docs/ZDROJE.md) | Katalog datových zdrojů, co je ověřené a co ne |
| [docs/PLAN.md](docs/PLAN.md) | Rozpad na fáze s odhady |
| [docs/PRAVNI.md](docs/PRAVNI.md) | Licence, GDPR, otázka `robots.txt` |
| [docs/MESTO.md](docs/MESTO.md) | Podklad pro jednání s magistrátem |

## Architektura

Žádný běžící server. GitHub Actions v hodinovém cyklu stáhnou zdroje, znormalizují je
a zapíší hotové JSONy do `data/v1/`. Aplikace čte jen tyto soubory, nikdy nesahá přímo
na weby města.

```
GitHub Actions (cron) → pipeline → validace → data/v1/*.json → CDN → aplikace
```

## Struktura

```
apps/mobile/       Expo aplikace (React Native, TypeScript) — fáze 2
packages/schema/   sdílený datový model
pipeline/          stahování, normalizace, validace
  fixtures/        uložené vzorky vstupů — každý zdroj musí mít fixture a test
data/v1/           vygenerované JSONy (commitované, to je naše „API")
docs/              dokumentace
```

## Vývoj

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## Zdroje dat a licence

Úřední deska — Statutární město Kladno, otevřená data podle OFN ·
RÚIAN — ČÚZK, CC BY 4.0 · ČHMÚ — CC BY 4.0 · PID GTFS — ROPID/IDSK, CC-BY ·
ostatní obsah © Statutární město Kladno a jednotliví provozovatelé webů, aplikace odkazuje.
