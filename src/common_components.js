import { chartHelpConfigByContext } from './functions.js';

export function getFilterComponent() {
    return {
        renderTo: 'filter-section',
        type: 'HTML',
        html: `
            <div id="filter-buttons">
                <div class="filter-group">
                    <h3>Verkehrsmittel</h3>
                    <div class="filter-options">
                        <input type="radio" id="filter-velo" name="filter" value="Velo">
                        <label for="filter-velo">
                            <img src="../img/bicycle.svg" alt="Velo" class="filter-icon"> Velo
                        </label>
                        <input type="radio" id="filter-fuss" name="filter" value="Fussgaenger">
                        <label for="filter-fuss">
                            <img src="../img/pedestrian.svg" alt="Fuss" class="filter-icon"> Fussgänger
                        </label>
                        <input type="radio" id="filter-miv" name="filter" value="MIV" checked>
                        <label for="filter-miv">
                            <img src="../img/car.svg" alt="MIV" class="filter-icon"> MIV
                        </label>
                    </div>
                </div>
                <div class="filter-group">
                    <h3>Zählstelle</h3>
                    <div class="filter-options">
                        <div class="custom-select">
                            <select id="zaehlstellen-dropdown"></select>
                        </div>
                    </div>
                </div>
                <div class="filter-group" id="fzgtyp-group">
                  <h3>Fahrzeugtyp</h3>
                  <div class="filter-options">
                    <button type="button" id="fzgtyp-open" class="filter-like-btn">
                      <img src="../img/filter.svg" alt="Filtern" class="filter-icon"> Filtern
                    </button>
                  </div>
                </div>
                <div class="filter-group" id="speed-group">
                  <h3>Geschwindigkeitsklassen</h3>
                  <div class="filter-options">
                    <button type="button" id="speed-open" class="filter-like-btn">
                      <img src="../img/filter.svg" alt="Filtern" class="filter-icon"> Filtern
                    </button>
                  </div>
                </div>
            </div>
        `
    };
}

export function getFzgtypFilterSectionComponent() {
    return {
        renderTo: 'filter-section-fzgtyp',
        type: 'HTML',
        html: `
      <div id="fzgtyp-panel" class="fzgtyp-panel is-hidden">
        <div class="filter-group">
          <h3>Fahrzeugtyp auswählen</h3>
          <div class="filter-options" id="fzgtyp-buttons"></div>
        </div>
      </div>
    `
    };
}

export function getSpeedFilterSectionComponent() {
    return {
        renderTo: 'filter-section-speed',
        type: 'HTML',
        html: `
      <div id="speed-panel" class="fzgtyp-panel is-hidden">
        <div class="filter-group">
          <h3>Geschwindigkeitsklasse auswählen</h3>
          <div class="filter-options" id="speed-buttons"></div>
        </div>
      </div>
    `
    };
}

export function getDayRangeButtonsComponent(weekday, smallestZeiteinheitInDays = 1, show_weekday = true) {
    return {
        renderTo: 'filter-section-2',
        type: 'HTML',
        html: `
            <div id="day-range-buttons">
                ${show_weekday ? `
                <div class="filter-group">
                    <h3>Wochentage</h3>
                    <div class="filter-options">
                        <input type="checkbox" id="mo-fr" value="Mo-Fr" ${weekday.includes('mo') ? 'checked' : ''}>
                        <label for="mo-fr">Mo-Fr</label>
                        <input type="checkbox" id="sa-so" value="Sa-So" ${weekday.includes('so') ? 'checked' : ''}>
                        <label for="sa-so">Sa+So</label>
                    </div>
                </div>
                ` : ''}
                <div class="filter-group">
                    <h3>Zeitraum</h3>
                    <div class="date-picker">
                        <div class="date-item">
                            <label for="start-date">Von:</label>
                            <input type="date" id="start-date" name="start-date" value="2023-01-01">
                        </div>
                        <div class="date-item">
                            <label for="end-date">Bis:</label>
                            <input type="date" id="end-date" name="end-date" value="2023-12-31">
                        </div>
                    </div>
                </div>
                <div class="filter-group">
                    <h3>Zeiteinheit</h3>
                    <div class="filter-options">
                        ${smallestZeiteinheitInDays <= 1 ? `
                            <input type="radio" id="zeitraum-1-tag" name="zeitraum" value="1 Tag">
                            <label for="zeitraum-1-tag">1 Tag</label>
                        ` : ''}
                        ${smallestZeiteinheitInDays <= 7 ? `
                            <input type="radio" id="zeitraum-1-woche" name="zeitraum" value="1 Woche">
                            <label for="zeitraum-1-woche">1 Woche</label>
                        ` : ''}
                        ${smallestZeiteinheitInDays <= 28 ? `
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

export function getBoxScatterToggleComponent(context = 'generic') {
    const cfg = chartHelpConfigByContext[context] || chartHelpConfigByContext.generic;
    const { title, addon, body } = cfg;

    return {
        renderTo: 'filter-section-3',
        type: 'HTML',
        html: `
            <div id="chart-toggle-buttons">
                <div class="filter-group">
                    <div class="filter-group-header">
                        <h3>Darstellung</h3>
                        <div class="chart-info">
                            <button
                                type="button"
                                class="chart-info__icon"
                                aria-label="Erklärung zu Boxplot und Streudiagramm"
                            >
                                <img src="../img/info.svg" alt="Info">
                            </button>

                            <!-- floating help card -->
                            <div class="chart-info__box">
                                <div class="box box--empfehlung">
                                    <div class="box__header">
                                        <div>
                                            <div class="box__title">${title}</div>
                                            ${addon ? `<div class="box__addon">${addon}</div>` : ''}
                                        </div>
                                        <div class="box__icon">
                                            <img src="../img/info.svg" alt="">
                                        </div>
                                    </div>
                                    <div class="box__content">
                                        ${body}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="filter-options">
                        <input type="radio" id="chart-type-boxplot" name="chart-type" value="boxplot">
                        <label for="chart-type-boxplot">
                            <img src="../img/chart-box.svg" alt="Boxplot" class="filter-icon"> Boxplot
                        </label>
                        <input type="radio" id="chart-type-scatter" name="chart-type" value="scatter" checked>
                        <label for="chart-type-scatter">
                            <img src="../img/chart-scatter.svg" alt="Streudiagramm" class="filter-icon"> Streudiagramm
                        </label>
                    </div>
                </div>

                <div class="filter-group" id="chart-scope-group">
                    <h3>Anzeige</h3>
                    <div class="filter-options">
                        <input type="radio" id="chart-scope-directions" name="chart-scope" value="directions" checked>
                        <label for="chart-scope-directions">Richtungen</label>
                        <input type="radio" id="chart-scope-gesamt" name="chart-scope" value="gesamt">
                        <label for="chart-scope-gesamt">Gesamtquerschnitt</label>
                    </div>
                </div>
            </div>
        `
    };
}
