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

    return `Zählstelle ${activeZst}, ${activeType} - ${activeFzgtyp} Von ${new Date(activeTimeRange[0]).toLocaleDateString('de-DE')} Bis ${new Date(activeTimeRange[1]).toLocaleDateString('de-DE')}`;
}


function setupExportButtonListener(board) {
    const btn = document.getElementById('export-dashboard');

    // Button not present or Highcharts not loaded – bail out silently
    if (!btn || typeof Highcharts === 'undefined') {
        return;
    }

    // Define helper once per page load
    if (!Highcharts.getSVGForCharts) {
        /**
         * Combine multiple charts into a single SVG, stacked vertically.
         * Adds an optional title at the top and can snap height to A4 page multiples.
         */
        Highcharts.getSVGForCharts = function (charts, opts = {}) {
            const title = opts.title || '';
            const pageHeight = opts.pageHeight || null;

            let top = 0;
            let width = 0;

            const titleHeight = title ? 40 : 0;
            top += titleHeight;

            const groups = charts.map(chart => {
                let svg = chart.exporting.getSVG();

                // Get width/height of SVG for export
                const svgWidth = +svg.match(
                    /^<svg[^>]*width\s*=\s*\"?(\d+)\"?[^>]*>/
                )[1];
                const svgHeight = +svg.match(
                    /^<svg[^>]*height\s*=\s*\"?(\d+)\"?[^>]*>/
                )[1];

                svg = svg
                    .replace('<svg', `<g transform="translate(0,${top})"`)
                    .replace('</svg>', '</g>');

                top += svgHeight;
                width = Math.max(width, svgWidth);

                return svg;
            }).join('');

            // Total height so far (incl. title)
            let totalHeight = top;

            // Optionally snap height to whole A4 “pages” (purely visual – still one PDF page)
            if (pageHeight) {
                const pages = Math.max(1, Math.ceil(totalHeight / pageHeight));
                totalHeight = pages * pageHeight;
            }

            const esc = s =>
                String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

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
    }

    if (!Highcharts.exportCharts) {
        /**
         * Export multiple charts as one combined file.
         */
        Highcharts.exportCharts = async function (charts, options) {
            // Merge the options with global exporting options
            options = Highcharts.merge(
                Highcharts.getOptions().exporting,
                options
            );

            // Post to export server
            await Highcharts.post(options.url, {
                filename: options.filename || 'chart',
                type: options.type,
                width: options.width,
                svg: Highcharts.getSVGForCharts(charts)
            });
        };
    }

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
            type: 'application/pdf',
            filename: 'verkehrs-dashboard',
            width: 794,
            exportTitle: title,
            pageHeight: 1123
        });
    });
}

