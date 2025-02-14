# Verkehrszaehl-Dashboard README

## Beschreibung
Das **Verkehrszähl-Dashboard** ist eine Webanwendung zur Visualisierung von Verkehrsdaten in der Schweiz. Benutzer können verschiedene Filter anpassen, um spezifische Verkehrszählungen für unterschiedliche Verkehrstypen, Strassenkategorien und Zeiträume anzuzeigen.

[**data-bs.ch/mobilitaet/verkehrszaehl_dashboard**](https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard)

## Ansicht
Die Webanwendung unterstützt vier verschiedene Ansichten. Der Platzhalter `{ansicht}` gibt an, welche Ansicht des Dashboards geladen wird:
- `start` – Startseite mit einer Übersicht
- `stunde` – Stundenansicht
- `woche` – Wochenansicht
- `monat` – Monatsansicht

```
https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/{ansicht}
```

## URL-Parameter
Die Webanwendung unterstützt mehrere optionale URL-Parameter, die zur Filterung der Daten genutzt werden können. Die Parameter müssen im folgenden Format übergeben werden:

```
https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/{ansicht}/?traffic_type=MIV&strtyp=Alle&zst_id=235&fzgtyp=Total&start_date=2024-01-01&end_date=2024-12-31&weekday=mo-so
```

### Übersicht der Parameter
| Parameter    | Beschreibung | Mögliche Werte |
|-------------|-------------|---------------|
| `traffic_type` | Verkehrstyp | `MIV` (Motorisierter Individualverkehr), `Velo` (Fahrradverkehr), `Fussgaenger` (Fussgänger) |
| `strtyp` | Strassenkategorie | `Alle` (Alle Kategorien), `HLS` (Hochleistungsstrasse), `HVS` (Hauptverkehrsstrasse), `HSS` (Hauptsammelstrasse), `SOS` (Siedlungsorientierte Strasse), `Andere` (Steg, Gasse oder Sonstiges) |
| `zst_id` | Zählstellen-ID | Numerische ID der Strasse |
| `fzgtyp` | Fahrzeugtyp | Für `Velo` und `Fussgaenger` nur `Total`. Für `MIV`: `Total`, `MR` (Motorrad), `PW` (Personenwagen), `PW%2B` (Personenwagen mit Anhänger), `Lief` (Lieferwagen), `Lief%2B` (Lieferwagen mit Anhänger), `Lief%2BAufl.` (Lieferwagen mit Auflieger), `LW` (Lastwagen), `LW%2B` (Lastwagen mit Anhänger), `Sattelzug` (Sattelzug), `Bus` (Bus), `andere` (nicht klassifizierbare Fahrzeuge) |
| `start_date` | Startdatum | Format: `YYYY-MM-DD` (z. B. `2024-01-01`) |
| `end_date` | Enddatum | Format: `YYYY-MM-DD` (z. B. `2024-12-31`) |
| `weekday` | Wochentage | `mo-so` (Montag bis Sonntag), `mo-fr` (Montag bis Freitag), `sa-so` (Samstag und Sonntag) |

### Hinweise zur Nutzung
- Alle Parameter sind **optional**. Fehlen sie in der URL, werden Standardwerte verwendet.
- Die Fahrzeugtypen (`fzgtyp`) sind nur für `MIV` differenziert; für `Velo` und `Fussgaenger` gibt es nur `Total`.
- `start_date` und `end_date` müssen im Format `YYYY-MM-DD` angegeben werden. `start_date` muss vor `end_date` liegen oder gleich sein. Bei der Wochenansicht müssen die beiden Daten mindestens 7 Tage ausseinander liegen. Bei der Monatsansicht müssen die beiden Daten mindestens ein Jahr ausseinander liegen.
- `weekday` erlaubt die Filterung nach Werktagen oder Wochenenden.

## Beispiel-URLs
1. **Verkehrsdaten für die Zählstelle "235 A3-A35, Grenze CH-F" anzeigen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?zst_id=235
   ```
2. **Personenwagem-Daten für eine bestimmte Strasse und einen Zeitraum abrufen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/start/?traffic_type=MIV&fzgtyp=PW&zst_id=123&start_date=2024-03-01&end_date=2024-03-31
   ```
3. **Stundenansicht für die Zählstelle "651 Entenweidstrasse" aufrufen:**
   ```
   https://data-bs.ch/mobilitaet/verkehrszaehl_dashboard/stunde/?zst_id=456
   ```

