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

    return `${activeType} ${activeFzgtyp} Zählstelle ${activeZst} ${activeStrtyp}, Von ${new Date(activeTimeRange[0]).toLocaleDateString('de-DE')} Bis ${new Date(activeTimeRange[1]).toLocaleDateString('de-DE')}`;
}

function setupExportButtonListener(board) {
    const btn = document.getElementById('export-dashboard');

    /**
     * Combine multiple charts into a single SVG.
     * - Supports a title at the top.
     * - Paginates with a fixed pageHeight.
     * - Puts N charts per page (N = chartsPerPage, default 2).
     */
    Highcharts.getSVGForCharts = function (charts, opts = {}) {
        const title         = opts.title || '';
        const pageHeight    = opts.pageHeight || 1123;          // ~ A4 @ 96dpi
        const chartsPerPage = opts.chartsPerPage || 2;
        const marginTop     = opts.marginTop || 20;
        const gap           = opts.gap || 20;

        const titleHeight   = title ? 40 : 0;
        let width           = 0;

        // Track where to place the next chart *within each page*
        const pageNextY = {}; // pageIndex -> next Y in that page

        const esc = s =>
            String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

        const groups = charts.map((chart, index) => {
            let svg = chart.exporting.getSVG();

            const svgWidth = +svg.match(
                /^<svg[^>]*width\s*=\s*\"?(\d+)\"?[^>]*>/
            )[1];
            const svgHeight = +svg.match(
                /^<svg[^>]*height\s*=\s*\"?(\d+)\"?[^>]*>/
            )[1];

            width = Math.max(width, svgWidth);

            const pageIndex   = Math.floor(index / chartsPerPage);
            const basePageY   = titleHeight + pageIndex * pageHeight;

            // First chart on this page?
            if (pageNextY[pageIndex] == null) {
                pageNextY[pageIndex] = basePageY + marginTop;
            }

            const chartY = pageNextY[pageIndex];

            // Next chart in this page starts below this one
            pageNextY[pageIndex] = chartY + svgHeight + gap;

            svg = svg
                .replace('<svg', `<g transform="translate(0,${chartY})"`)
                .replace('</svg>', '</g>');

            return svg;
        }).join('');

        const pageCount   = Math.max(1, Math.ceil(charts.length / chartsPerPage));
        const totalHeight = titleHeight + pageCount * pageHeight;

        const titleElement = title
            ? `<text x="${width / 2}" y="24" text-anchor="middle"
                  font-size="16"
                  font-family="Inter, sans-serif">
                ${esc(title)}
           </text>`
            : '';

        return `<svg height="${totalHeight}" width="${width}" version="1.1"
        xmlns="http://www.w3.org/2000/svg">
            ${titleElement}
            ${groups}
        </svg>`;
    };

    /**
     * Export multiple charts as one combined file.
     */
    Highcharts.exportCharts = async function (charts, options) {
        // Merge with global exporting options
        options = Highcharts.merge(Highcharts.getOptions().exporting, options);

        const svg = Highcharts.getSVGForCharts(charts, {
            title:         options.exportTitle,
            pageHeight:    options.pageHeight,
            chartsPerPage: options.chartsPerPage,
            marginTop:     options.marginTop,
            gap:           options.gap
        });

        await Highcharts.post(options.url, {
            filename: options.filename || 'chart',
            type:     options.type,
            width:    options.width,
            svg
        });
    };

    btn.addEventListener('click', async () => {
        // Collect all Highcharts charts from the Dashboards board
        const charts = board.mountedComponents
            .filter(c =>
                c.component &&
                c.component.chart &&
                !['map', 'time-range-selector'].includes(c.cell.id)
            )
            .map(c => c.component.chart);

        if (!charts.length) {
            return;
        }

        const state = getStateFromUrl();
        const title = buildExportTitle(state);

        await Highcharts.exportCharts(charts, {
            type:          'application/pdf',
            filename:      'verkehrs-dashboard',
            width:         794,
            exportTitle:   title,
            pageHeight:    1123,
            chartsPerPage: 2,
            marginTop:     20,
            gap:           20
        });
    });
}

