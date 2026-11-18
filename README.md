# Verkehrszaehl-Dashboard README

## Beschreibung
Das **Verkehrszähl-Dashboard** ist eine Webanwendung zur Visualisierung von Verkehrsdaten in der Schweiz. Benutzer können verschiedene Filter anpassen, um spezifische Verkehrszählungen für unterschiedliche Verkehrstypen, Strassenkategorien und Zeiträume anzuzeigen.

[**data-bs.ch/mobilitaet/verkehrszaehl_dashboard**](https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard)

## Ansicht
Die Webanwendung unterstützt fünf verschiedene Ansichten. Der Platzhalter `{ansicht}` gibt an, welche Ansicht des Dashboards geladen wird:
- `start` – Startseite mit einer Übersicht
- `stunde` – Stundenansicht
- `woche` – Wochenansicht
- `monat` – Monatsansicht
- `jahr` – Jahresansicht

```
https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/{ansicht}
```

## URL-Parameter
Die Webanwendung unterstützt mehrere optionale URL-Parameter, die zur Filterung der Daten genutzt werden können. Die Parameter müssen im folgenden Format übergeben werden:

```
https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/{ansicht}/?traffic_type=MIV&zst_id=235&fzgtyp=Total&start_date=2024-01-01&end_date=2024-12-31&weekday=mo-so
```

### Übersicht der Parameter
| Parameter    | Beschreibung | Mögliche Werte |
|-------------|-------------|---------------|
| `traffic_type` | Verkehrstyp | `MIV` (Motorisierter Individualverkehr), `Velo` (Fahrradverkehr), `Fussgaenger` (Fussgänger) |
| `zst_id` | Zählstellen-ID | Numerische ID der Strasse |
| `fzgtyp` | Fahrzeugtyp (Mehrfachauswahl möglich) | Für `Velo` und `Fussgaenger` nur `Total`. Für `MIV`: `Total`, `MR` (Motorrad), `PW` (Personenwagen), `PW%2B` (Personenwagen mit Anhänger), `Lief` (Lieferwagen), `Lief%2B` (Lieferwagen mit Anhänger), `Lief%2BAufl.` (Lieferwagen mit Auflieger), `LW` (Lastwagen), `LW%2B` (Lastwagen mit Anhänger), `Sattelzug` (Sattelzug), `Bus` (Bus), `andere` (nicht klassifizierbare Fahrzeuge). Mehrere Fahrzeugtypen können komma-separiert übergeben werden, z. B. `fzgtyp=PW,LW,Bus`. |
| `speed` | Geschwindigkeitsklassen (nur MIV mit vorhandenen Geschwindigkeitsdaten; Mehrfachauswahl möglich) | Standard ist `Total` (keine Auswahl / alle Geschwindigkeiten). Verwendete Schlüssel sind: `<20`, `20-30`, `30-40`, `40-50`, `50-60`, `60-70`, `70-80`, `80-90`, `90-100`, `100-110`, `110-120`, `120-130`, `>130`. Mehrere Klassen können komma-separiert übergeben werden, z. B. `speed=30-40,40-50,50-60`. |
| `start_date` | Startdatum | Format: `YYYY-MM-DD` (z. B. `2024-01-01`) |
| `end_date` | Enddatum | Format: `YYYY-MM-DD` (z. B. `2024-12-31`) |
| `weekday` | Wochentage (Mehrfachauswahl möglich) | `mo-so` (Montag bis Sonntag), `mo-fr` (Montag bis Freitag), `sa-so` (Samstag und Sonntag) oder einzelne Tage `mo`, `di`, `mi`, `do`, `fr`, `sa`, `so`. Mehrere Tage können komma-separiert übergeben werden, z. B. `weekday=di,mi,do`. |
| `feiertage` | Gesetzliche Feiertage im Kanton Basel-Stadt | `mit` (Standard, Feiertage eingeschlossen) oder `ohne` (Feiertage ausgeschlossen) |

### Hinweise zur Nutzung
- Alle Parameter sind **optional**. Fehlen sie in der URL, werden Standardwerte verwendet.
- Die Fahrzeugtypen (`fzgtyp`) sind nur für `MIV` differenziert; für `Velo` und `Fussgaenger` gibt es nur `Total`.
- Mehrere Fahrzeugtypen in `fzgtyp` bzw. Geschwindigkeitsklassen in `speed` können komma-separiert übergeben werden (z. B. `fzgtyp=PW,LW` oder `speed=30-40,40-50`). Intern werden diese als Liste verarbeitet.
- Sobald mindestens eine Geschwindigkeitsklasse in `speed` ungleich `Total` gewählt ist, basiert die Auswertung auf den Geschwindigkeitsdaten (`MIV_Speed`), andernfalls auf den Standard-MIV-Daten und ggf. `fzgtyp`.
- `start_date` und `end_date` müssen im Format `YYYY-MM-DD` angegeben werden. `start_date` muss vor `end_date` liegen oder gleich sein. Bei der Wochenansicht müssen die beiden Daten mindestens 7 Tage ausseinander liegen. Bei der Monats- und der Jahresansicht müssen die beiden Daten mindestens ein Jahr ausseinander liegen.
- `weekday` erlaubt die Filterung nach Werktagen, Wochenenden oder einzelnen Wochentagen.
- `feiertage=ohne` schliesst die neun gesetzlichen Feiertage des Kantons Basel-Stadt aus (Neujahrstag, Karfreitag, Ostermontag, Tag der Arbeit, Auffahrt, Pfingstmontag, Nationalfeiertag, Weihnachtstag, Stephanstag; siehe [bs.ch](https://www.bs.ch/themen/arbeit-und-steuern/feiertage-im-kanton-basel-stadt)). Die Daten werden pro Jahr berechnet.

## Beispiel-URLs
1. **Verkehrsdaten für die Zählstelle "235 A3-A35, Grenze CH-F" anzeigen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?zst_id=235
   ```
2. **Personenwagen-Daten für eine bestimmte Strasse und einen Zeitraum abrufen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?traffic_type=MIV&fzgtyp=PW&zst_id=420&start_date=2024-03-01&end_date=2024-03-31
   ```
3. **Mehrere Fahrzeugtypen gleichzeitig filtern (z. B. Personenwagen, Lastwagen, Bus):**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?traffic_type=MIV&fzgtyp=PW,LW,Bus&zst_id=420
   ```
4. **Geschwindigkeitsklassen filtern (z. B. 30–40 und 40–50 km/h) – falls an der Zählstelle Geschwindigkeitsdaten vorhanden sind:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?traffic_type=MIV&zst_id=420&speed=30-40,40-50
   ```
5. **Stundenansicht für die Zählstelle "651 Entenweidstrasse" aufrufen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/stunde/?zst_id=651
   ```

