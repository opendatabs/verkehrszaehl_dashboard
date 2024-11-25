export function getFilterComponent() {
    return {
        cell: 'filter-section',
        type: 'HTML',
        html: `
            <div id="filter-buttons">
                <!-- Verkehrsmittel -->
                <div class="filter-group">
                    <h3>Verkehrsmittel</h3>
                    <input type="radio" id="filter-velo" name="filter" value="Velo">
                    <label for="filter-velo">
                        <img src="../../img/bicycle.png" alt="Velo" class="filter-icon"> Velo
                    </label>
                    <input type="radio" id="filter-fuss" name="filter" value="Fussgaenger">
                    <label for="filter-fuss">
                        <img src="../../img/pedestrian.png" alt="Fuss" class="filter-icon"> Fussgänger
                    </label>
                    <input type="radio" id="filter-miv" name="filter" value="MIV" checked>
                    <label for="filter-miv">
                        <img src="../../img/car.png" alt="MIV" class="filter-icon"> MIV
                    </label>
                </div>
                <!-- Zählstelle -->
                <div class="filter-group">
                    <h3>Zählstelle</h3>
                    <div class="custom-select">
                        <select id="counting-station-dropdown"></select>
                    </div>
                </div>
            </div>
        `
    };
}

export function getDayRangeButtonsComponent() {
    return {
        cell: 'filter-section-2',
        type: 'HTML',
        html: `
            <div id="day-range-buttons">
                <!-- Wochentage -->
                <div class="filter-group">
                    <h3>Wochentage</h3>
                    <input type="checkbox" id="mo-fr" value="Mo-Fr" checked>
                    <label for="mo-fr">Mo-Fr</label>
                    <input type="checkbox" id="sa-so" value="Sa-So" checked>
                    <label for="sa-so">Sa+So</label>
                </div>
                <!-- Zeitraum -->
                <div class="filter-group">
                    <h3>Zeitraum</h3>
                    <label for="start-date">Von:</label>
                    <input type="date" id="start-date" name="start-date">
                    <label for="end-date">Bis:</label>
                    <input type="date" id="end-date" name="end-date">
                </div>
                <!-- Zeiteinheit -->
                <div class="filter-group">
                    <h3>Zeiteinheit</h3>
                    <input type="radio" id="zeitraum-1-tag" name="zeitraum" value="1 Tag">
                    <label for="zeitraum-1-tag">1 Tag</label>
                    <input type="radio" id="zeitraum-1-woche" name="zeitraum" value="1 Woche">
                    <label for="zeitraum-1-woche">1 Woche</label>
                    <input type="radio" id="zeitraum-1-monat" name="zeitraum" value="1 Monat">
                    <label for="zeitraum-1-monat">1 Monat</label>
                    <input type="radio" id="zeitraum-1-jahr" name="zeitraum" value="1 Jahr">
                    <label for="zeitraum-1-jahr">1 Jahr</label>
                    <input type="radio" id="zeitraum-alles" name="zeitraum" value="Alles" checked>
                    <label for="zeitraum-alles">Alles</label>
                </div>
            </div>
        `
    };
}
