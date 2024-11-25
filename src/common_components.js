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
                <input type="checkbox" id="mo-fr" value="Mo-Fr" checked>
                <label for="mo-fr">Mo-Fr</label>
                <input type="checkbox" id="sa-so" value="Sa-So" checked>
                <label for="sa-so">Sa+So</label>
            </div>
        `
    };
}
