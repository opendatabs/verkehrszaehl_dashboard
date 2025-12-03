import {getStateFromUrl} from './functions.js';

export function setupEventListeners(updateBoard, board) {
    setupFilterButtonsListeners(updateBoard, board);
    setupStrTypButtonListeners(updateBoard, board);
    setupZaehlstellenDropdownListener(updateBoard, board);
    setupFahrzeugtypListeners(updateBoard, board);
    setupDayRangeButtons(updateBoard, board);
    setupDateInputsListeners(updateBoard, board);
    setupZeitraumButtonsListeners(updateBoard, board);
    setupExportButtonListener(board);
}


function setupFilterButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#filter-buttons input[name="filter"]').forEach(filterElement => {
        filterElement.addEventListener('change', async event => {
            const currentState = getStateFromUrl();
            const activeType = event.target.value;
            await updateBoard(
                board,
                activeType,
                currentState.activeStrtyp,
                currentState.activeZst,
                currentState.activeFzgtyp,
                currentState.activeTimeRange,
                true,
                true
            );
        });
    });
}


function setupStrTypButtonListeners(updateBoard, board) {
    const radios = document.querySelectorAll('.filter-options input[name="filter-strtyp"]');
    let lastSelected = null;

    radios.forEach(radio => {
        radio.addEventListener('click', async function () {
            const currentState = getStateFromUrl();

            // If the same radio is clicked again ...
            if (lastSelected === this) {
                // ... uncheck all radios
                radios.forEach(r => (r.checked = false));
                lastSelected = null;

                // Update the board with "Alle"
                await updateBoard(
                    board,
                    currentState.activeType,
                    'Alle',
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            } else {
                // Check only the current radio and uncheck others
                radios.forEach(r => (r.checked = false));
                this.checked = true;
                lastSelected = this;

                // Update the board with the selected value
                const activeStrtyp = this.value;
                await updateBoard(
                    board,
                    currentState.activeType,
                    activeStrtyp,
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            }
        });
    });
}


function setupZaehlstellenDropdownListener(updateBoard, board) {
    document.getElementById('zaehlstellen-dropdown').addEventListener('change', async event => {
        const currentState = getStateFromUrl();
        const activeZst = event.target.value;
        await updateBoard(
            board,
            currentState.activeType,
            currentState.activeStrtyp,
            activeZst,
            currentState.activeFzgtyp,
            currentState.activeTimeRange,
            false,
            true
        );
    });
}


function setupDayRangeButtons(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[type="checkbox"]').forEach(button => {
        button.addEventListener('change', async (event) => {
            const currentState = getStateFromUrl();
            const moFr = document.querySelector('#mo-fr');
            const saSo = document.querySelector('#sa-so');

            // Ensure at least one button is always selected
            if (!moFr.checked && !saSo.checked) {
                event.target.checked = true; // Prevent unchecking the last selected button
            } else {
                // Update the board based on the new selection
                await updateBoard(
                    board,
                    currentState.activeType,
                    currentState.activeStrtyp,
                    currentState.activeZst,
                    currentState.activeFzgtyp,
                    currentState.activeTimeRange,
                    false,
                    false
                );
            }
        });
    });
}


function setupDateInputsListeners(updateBoard, board) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    async function onDatePickersChange() {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (startDateValue && endDateValue) {
            const min = Date.parse(startDateValue);
            // Date pickers should give the feeling the end date is inclusive
            const max = Date.parse(endDateValue) + 24 * 3600 * 1000;

            if (min > max) {
                alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
                return;
            }

            // Update time-range-selector extremes
            const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
            navigatorChart.xAxis[0].setExtremes(min, max);
        }
    }

    startDateInput.addEventListener('change', onDatePickersChange);
    endDateInput.addEventListener('change', onDatePickersChange);
}

function setupZeitraumButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        radio.addEventListener('change', async (event) => {
            if (event.target.checked) {
                const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
                const max = navigatorChart.xAxis[0].dataMax + 24 * 3600 * 1000;
                let min;

                switch (event.target.value) {
                    case '1 Tag':
                        min = max - (24 * 3600 * 1000);
                        break;
                    case '1 Woche':
                        min = max - (7 * 24 * 3600 * 1000);
                        break;
                    case '1 Monat':
                        min = Date.UTC(new Date(max).getFullYear(), new Date(max).getMonth() - 1, new Date(max).getDate());
                        break;
                    case '1 Jahr':
                        min = Date.UTC(new Date(max).getFullYear() - 1, new Date(max).getMonth(), new Date(max).getDate());
                        break;
                    case 'Alles':
                        min = navigatorChart.xAxis[0].dataMin;
                        break;
                    default:
                        return;
                }

                navigatorChart.xAxis[0].setExtremes(min, max);
            }
        });
    });
}

function setupFahrzeugtypListeners(updateBoard, board) {
    const vehicleTypeDropdown = document.getElementById('vehicle-type-dropdown');

    vehicleTypeDropdown.addEventListener('change', async event => {
        const activeFzgtyp = event.target.value;
        const currentState = getStateFromUrl();
        await updateBoard(
            board,
            currentState.activeType,
            currentState.activeStrtyp,
            currentState.activeZst,
            activeFzgtyp,
            currentState.activeTimeRange,
            false,
            true
        );
    });
}

function buildExportTitle(state) {
    // Adjust the wording to your liking
    const {
        activeType,
        activeStrtyp,
        activeZst,
        activeFzgtyp,
        activeTimeRange
    } = state;

    return `${activeType} ${activeFzgtyp} Zählstelle ${activeZst}, Von ${new Date(activeTimeRange[0]).toLocaleDateString('de-DE')} Bis ${new Date(activeTimeRange[1]).toLocaleDateString('de-DE')}`;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function setupExportButtonListener(board) {
    const btn = document.getElementById('export-dashboard');
    if (!btn || typeof Highcharts === 'undefined') {
        return;
    }

    btn.addEventListener('click', () => {

        const charts = [];
        const tables = [];

        board.mountedComponents.forEach(c => {
            // 1. TABLES (Grid) – they have no chart, but they have DOM
            if (
                ['hour-table', 'weekly-table', 'monthly-table'].includes(c.cell.id)
            ) {
                const el = document.getElementById(c.cell.id);
                if (el) {
                    tables.push({
                        id: c.cell.id,
                        html: el.innerHTML
                    });
                }
            }
            // 2. CHARTS (Highcharts)
            if (c.component?.chart && !['map', 'time-range-selector'].includes(c.cell.id)) {
                charts.push({
                    id: c.cell.id,
                    svg: c.component.chart.exporting.getSVG()
                });
            }
        });

        // NOTHING collected?
        if (!charts.length && !tables.length) return;

        const state = getStateFromUrl();
        const title = buildExportTitle(state);

        const items = [
            ...tables.map(t => ({ type: 'table', content: t.html })),
            ...charts.map(c => ({ type: 'chart', content: c.svg }))
        ];

        let pagesHtml = '';
        const itemsPerPage = 2;

        items.forEach((item, index) => {

            if (index % itemsPerPage === 0) {
                if (index > 0) pagesHtml += '</div>'; // close previous page
                pagesHtml += '<div class="page">';
            }

            if (item.type === 'table') {
                pagesHtml += `
            <div class="table-block">
                <div class="table-container">${item.content}</div>
                <textarea class="chart-note"></textarea>
            </div>
        `;
            }

            if (item.type === 'chart') {
                pagesHtml += `
            <div class="chart-block">
                <div class="chart-container">${item.content}</div>
                <textarea class="chart-note"></textarea>
            </div>
        `;
            }

            if (index === items.length - 1) {
                pagesHtml += '</div>';
            }
        });

        // Open pretty URL
        const editorWin = window.open('../export/', '_blank');

        if (!editorWin) {
            alert('Bitte Pop-ups für diese Seite erlauben, um den PDF-Editor zu öffnen.');
            return;
        }

        const sendExportData = () => {
            editorWin.postMessage({
                type: "EXPORT_DATA",
                title,
                pagesHtml
            }, "*");
        };

        let tries = 0;
        const interval = setInterval(() => {
            if (editorWin && editorWin.document && editorWin.document.readyState === "complete") {
                clearInterval(interval);
                sendExportData();
            }
            if (tries++ > 50) clearInterval(interval);
        }, 100);
    });
}
