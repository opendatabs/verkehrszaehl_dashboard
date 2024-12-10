export function getFilterComponent(basePath = '../') {
    return {
        cell: 'filter-section',
        type: 'HTML',
        html: `
            <div id="filter-buttons">
                <!-- Verkehrsmittel -->
                <div class="filter-group">
                    <h3>Verkehrsmittel:</h3>
                    <div class="filter-options">
                        <input type="radio" id="filter-velo" name="filter" value="Velo">
                        <label for="filter-velo">
                            <img src="${basePath}/img/bicycle.png" alt="Velo" class="filter-icon"> Velo
                        </label>
                        <input type="radio" id="filter-fuss" name="filter" value="Fussgaenger">
                        <label for="filter-fuss">
                            <img src="${basePath}/img/pedestrian.png" alt="Fuss" class="filter-icon"> Fussgänger
                        </label>
                        <input type="radio" id="filter-miv" name="filter" value="MIV" checked>
                        <label for="filter-miv">
                            <img src="${basePath}/img/car.png" alt="MIV" class="filter-icon"> MIV
                        </label>
                    </div>
                </div>
                <!-- Strassentyp -->
                <div class="filter-group">
                    <h3>Strassentyp:</h3>
                    <div class="filter-options">
                        <input type="radio" id="filter-hls" name="filter-strtyp" value="HLS">
                        <label for="filter-hls" title="Hochleistungsstrasse">
                            <span class="filter-icon color-circle" style="background-color: #ffeb00;"></span> HLS
                        </label>
                        <input type="radio" id="filter-hvs" name="filter-strtyp" value="HVS">
                        <label for="filter-hvs" title="Haupverkehrstrasse">
                            <span class="filter-icon color-circle" style="background-color: #ff0000;"></span> HVS
                        </label>
                        <input type="radio" id="filter-hss" name="filter-strtyp" value="HSS">
                        <label for="filter-hss" title="Hauptsammelstrasse">
                            <span class="filter-icon color-circle" style="background-color: #4ce600;"></span> HSS
                        </label>
                        <input type="radio" id="filter-sos" name="filter-strtyp" value="SOS">
                        <label for="filter-sos" title="Siedlungsorientierte Strasse">
                            <span class="filter-icon color-circle" style="background-color: #0070ff;"></span> SOS
                        </label>
                        <input type="radio" id="filter-andere" name="filter-strtyp" value="Andere">
                        <label for="filter-andere" title="Steg, Gasse oder sonst.">
                            <span class="filter-icon color-circle" style="background-color: #71a903;"></span> Andere
                        </label>
                    </div>
                </div>
                <!-- Zählstelle -->
                <div class="filter-group">
                    <h3>Zählstelle:</h3>
                    <div class="filter-options">
                        <div class="custom-select">
                            <select id="zaehlstellen-dropdown"></select>
                        </div>
                    </div>
                </div>
                <!-- Fahrzeugtyp -->
                <div class="filter-group">
                    <h3>Fahrzeugtyp:</h3>
                    <div class="filter-options">
                        <div class="custom-select">
                            <select id="vehicle-type-dropdown">
                                <option value="Total">Total</option>
                                <option value="MR">Motorrad</option>
                                <option value="PW">Personenwagen</option>
                                <option value="PW+">Personenwagen mit Anhänger</option>
                                <option value="Lief">Lieferwagen</option>
                                <option value="Lief+">Lieferwagen mit Anhänger</option>
                                <option value="Lief+Aufl.">Lieferwagen mit Auflieger</option>
                                <option value="LW">Lastwagen</option>
                                <option value="LW+">Lastwagen mit Anhänger</option>
                                <option value="Sattelzug">Sattelzug</option>
                                <option value="Bus">Bus</option>
                                <option value="andere">nicht klassifizierbare Fahrzeuge</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `
    };
}

export function getDayRangeButtonsComponent(weekday, smallestZeiteinheit = 1) {
    return {
        cell: 'filter-section-2',
        type: 'HTML',
        html: `
            <div id="day-range-buttons">
                <!-- Wochentage -->
                <div class="filter-group">
                    <h3>Wochentage:</h3>
                    <div class="filter-options">
                        <input type="checkbox" id="mo-fr" value="Mo-Fr" ${weekday.includes('mo') ? 'checked' : ''}>
                        <label for="mo-fr">Mo-Fr</label>
                        <input type="checkbox" id="sa-so" value="Sa-So" ${weekday.includes('so') ? 'checked' : ''}>
                        <label for="sa-so">Sa+So</label>
                    </div>
                </div>
                <!-- Zeitraum ... -->
                <div class="filter-group">
                    <h3>Zeitraum:</h3>
                    <div class="filter-options">
                        <label for="start-date">Von:</label>
                        <input type="date" id="start-date" name="start-date" value="2023-01-01">
                        <label for="end-date">Bis:</label>
                        <input type="date" id="end-date" name="end-date" value="2023-12-31">
                    </div>
                </div>
                <!-- Zeitraum -->
                <div class="filter-group">
                    <h3>Zeiteinheit:</h3>
                    <div class="filter-options">
                        ${smallestZeiteinheit <= 1 ? `
                            <input type="radio" id="zeitraum-1-tag" name="zeitraum" value="1 Tag">
                            <label for="zeitraum-1-tag">1 Tag</label>
                        ` : ''}
                        ${smallestZeiteinheit <= 7 ? `
                            <input type="radio" id="zeitraum-1-woche" name="zeitraum" value="1 Woche">
                            <label for="zeitraum-1-woche">1 Woche</label>
                        ` : ''}
                        ${smallestZeiteinheit <= 28 ? `
                            <input type="radio" id="zeitraum-1-monat" name="zeitraum" value="1 Monat">
                            <label for="zeitraum-1-monat">1 Monat</label>
                        ` : ''}
                        <input type="radio" id="zeitraum-1-jahr" name="zeitraum" value="1 Jahr">
                        <label for="zeitraum-1-jahr">1 Jahr</label>
                        <input type="radio" id="zeitraum-alles" name="zeitraum" value="Alles">
                        <label for="zeitraum-alles">Alles</label>
                    </div>
                </div>
            </div>
        `
    };
}
