---
id: deck-demo.de
lang: de
title: Eine Geschichte, die auch ein Vortrag ist
theme: midnight
collection: Reference
accent: "#2a7de1"
---

## Eine Geschichte, die auch ein Vortrag ist   {eyebrow="Demo · Folienmodus"}

```block
type: cover
image: assets/Narta-Zvernec.webp
image_credit: Photo reused from the slider story · Who Owns the Albanian Coast
text: 'Drücke **Präsentieren**, und diese Seite wird zur Foliensammlung. Jeder Block ist eine Folie, jeder Abschnitt eine Spalte. **Alle Zahlen sind fiktiv.** Probiere `→`, `↓`, `O`, `F`, `B`, `?`.'
```

# Abschnitt 1 · Navigieren   {eyebrow="Abschnitte"}

Ein `cover` oder eine Überschrift der Ebene 1/2 beginnt einen **Abschnitt**. Mit `→` springst du zum nächsten.

## Zwei Arten der Bewegung   {eyebrow="Text"}

`←` `→` wechseln zwischen Abschnitten. `↑` `↓` und die Leertaste gehen jede Folie der Reihe nach durch. `Pos1` und `Ende` springen an die Enden.

```block
type: callout
tone: note
title: Direktlinks
text: 'Die Adressleiste führt beim Präsentieren `#/N` mit, so lässt sich jede Folie verlinken. `?present` startet die Präsentation sofort.'
```

```block
type: quote
text: Eine Präsentation ist nur eine Geschichte, die man unterbrechen darf.
cite: Regel für Vortragende
source: Fiktiv
```

# Abschnitt 2 · Zeigen   {eyebrow="Zahlen"}

```block
type: kpi
figures:
- value: "17"
  label: Blocktypen
  text: Zählt beim Einblenden hoch.
- value: "5"
  unit: "Tasten"
  label: Für einen Vortrag
  text: Pfeile, O, F, B, ?
- value: "100"
  unit: "%"
  label: Statisch veröffentlichbar
  text: Außer Live-Einbettungen.
```

```block
type: chart
kind: hbar
labels: ["Text", "Diagramm", "Tabelle", "Karte", "Code", "Einbettung"]
series:
- name: Folien in diesem Vortrag
  data: [4, 1, 1, 1, 2, 1]
unit: Folien
source: Fiktive Daten.
text: Diagramme, Tabellen und Karten werden direkt im Text verfasst und funktionieren daher ohne Server.
```

```block
type: table
columns:
- Taste
- {label: Wirkung, num: false}
rows:
- ["O", "Übersicht aller Folien"]
- ["F", "Vollbild"]
- ["B", "Bildschirm abdunkeln"]
- ["?", "Tastenkürzel anzeigen"]
- ["Esc", "Schließen, dann beenden"]
caption: Suche und Sortierung funktionieren auch beim Präsentieren.
```

```block
type: map
title: Auch eine Karte ist eine Folie
markers:
- title: Narta lagoon
  text: Klicke auf einen Marker für seine Karte.
  center: [19.4237892, 40.5316622]
legend:
- {label: Beispielmarker, color: "#e01e26"}
text: Auch Karten sind Folien; ziehe und zoome sie während des Vortrags.
```

# Abschnitt 3 · Erzählen   {eyebrow="Code und Live-Seiten"}

```block
type: code
title: Eine Folie ist ein Block
language: yaml
code: |
  type: callout
  tone: note
  title: Deep links
  text: 'Jeder Block kann eine Folie sein.'
caption: Code wird wörtlich angezeigt, nie interpretiert.
```

```block
type: embed
title: Eine Live-Seite in einer Folie
src: /story/format-showcase
height: 65
caption: Eine Einbettung rahmt jede http(s)-Seite oder jeden Seitenpfad. Sie braucht das Netz und fehlt daher im statischen Export.
```

```block
type: timeline
intro: So würde der Vortrag ablaufen.
```

### Eröffnen {date="0:00" tag=Einstieg}
Titelfolie, dann `→` drücken.

### Zeigen {date="0:05" tag=Demo}
Zahlen, Diagramm, Tabelle, Karte.

### Erzählen {date="0:15" tag=Abschluss}
Code, eine Live-Seite, Fragen.

```block
type: credits
items:
- label: Format
  html: 'Fiktive Demo des Folienmodus; keine echten Daten.'
```
