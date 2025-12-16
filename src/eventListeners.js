import {getStateFromUrl, getSelectedFzgtypsFromButtons, getSelectedSpeedClassesFromButtons, getStationName} from './functions.js';

export function setupEventListeners(updateBoard, board) {
    setupFilterButtonsListeners(updateBoard, board);
    setupZaehlstellenDropdownListener(updateBoard, board);
    setupFzgtypPanelListeners(updateBoard, board);
    setupSpeedPanelListeners(updateBoard, board);
    setupDayRangeButtons(updateBoard, board);
    setupDateInputsListeners(updateBoard, board);
    setupZeitraumButtonsListeners(updateBoard, board);
    setupExportButtonListener(board);
    setupChartTypeToggle();
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
                currentState.activeSpeed,
                currentState.activeTimeRange,
                true,
                true
            );
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
            currentState.activeSpeed,
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
                    currentState.activeSpeed,
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

function setupFzgtypPanelListeners(updateBoard, board) {
    const openBtn = document.getElementById('fzgtyp-open');
    const panel   = document.getElementById('fzgtyp-panel');
    const wrap    = document.getElementById('fzgtyp-buttons');
    const speedPanel = document.getElementById('speed-panel');

    if (!openBtn || !panel) return;

    // OPEN button: opens this panel and closes the other one
    openBtn.addEventListener('click', async () => {
        if (openBtn.disabled || openBtn.classList.contains('is-hidden')) return;
        
        const { activeFzgtyp } = getStateFromUrl();
        const arr = Array.isArray(activeFzgtyp) ? activeFzgtyp : [activeFzgtyp];
        const hasSelection = arr.some(v => v && v !== 'Total');

        if (hasSelection) {
            // If there's a selection, reset it
            await updateBoard(
                board,
                getStateFromUrl().activeType,
                getStateFromUrl().activeStrtyp,
                getStateFromUrl().activeZst,
                ['Total'],
                getStateFromUrl().activeSpeed,
                getStateFromUrl().activeTimeRange,
                false,
                true
            );
        } else {
            // If no selection, toggle this panel and close the other
            const isCurrentlyHidden = panel.classList.contains('is-hidden');
            
            // Close speed panel if it's open
            if (speedPanel && !speedPanel.classList.contains('is-hidden')) {
                speedPanel.classList.add('is-hidden');
            }
            
            // Toggle this panel
            if (isCurrentlyHidden) {
                panel.classList.remove('is-hidden');
            } else {
                panel.classList.add('is-hidden');
            }
        }
    });

    if (!wrap) return;

    // checkbox change → updateBoard ONLY (panel stays open)
    wrap.addEventListener('change', async (e) => {
        if (e.target?.name !== 'fzgtyp') return;

        await updateBoard(
            board,
            getStateFromUrl().activeType,
            getStateFromUrl().activeStrtyp,
            getStateFromUrl().activeZst,
            getSelectedFzgtypsFromButtons(),
            ['Total'], // Reset speed when fzgtyp changes
            getStateFromUrl().activeTimeRange,
            false,
            true
        );
    });
}

function setupSpeedPanelListeners(updateBoard, board) {
    const openBtn = document.getElementById('speed-open');
    const panel   = document.getElementById('speed-panel');
    const wrap    = document.getElementById('speed-buttons');
    const fzgtypPanel = document.getElementById('fzgtyp-panel');

    if (!openBtn || !panel) return;

    // OPEN button: opens this panel and closes the other one
    openBtn.addEventListener('click', async () => {
        if (openBtn.disabled || openBtn.classList.contains('is-hidden')) return;
        
        const { activeSpeed } = getStateFromUrl();
        const arr = Array.isArray(activeSpeed) ? activeSpeed : [activeSpeed];
        const hasSelection = arr.some(v => v && v !== 'Total');

        if (hasSelection) {
            // If there's a selection, reset it
            await updateBoard(
                board,
                getStateFromUrl().activeType,
                getStateFromUrl().activeStrtyp,
                getStateFromUrl().activeZst,
                ['Total'], // Reset fzgtyp when speed changes
                ['Total'],
                getStateFromUrl().activeTimeRange,
                false,
                true
            );
        } else {
            // If no selection, toggle this panel and close the other
            const isCurrentlyHidden = panel.classList.contains('is-hidden');
            
            // Close fzgtyp panel if it's open
            if (fzgtypPanel && !fzgtypPanel.classList.contains('is-hidden')) {
                fzgtypPanel.classList.add('is-hidden');
            }
            
            // Toggle this panel
            if (isCurrentlyHidden) {
                panel.classList.remove('is-hidden');
            } else {
                panel.classList.add('is-hidden');
            }
        }
    });

    if (!wrap) return;

    // checkbox change → updateBoard ONLY (panel stays open)
    wrap.addEventListener('change', async (e) => {
        if (e.target?.name !== 'speed') return;

        await updateBoard(
            board,
            getStateFromUrl().activeType,
            getStateFromUrl().activeStrtyp,
            getStateFromUrl().activeZst,
            ['Total'], // Reset fzgtyp when speed changes
            getSelectedSpeedClassesFromButtons(),
            getStateFromUrl().activeTimeRange,
            false,
            true
        );
    });
}

async function buildExportTitle(state) {
    const {
        activeType,
        activeStrtyp,
        activeZst,
        activeFzgtyp,
        activeTimeRange,
        activeSpeed
    } = state;

    const path = window.location.pathname;

    // Base label differs by view
    let prefix = '';
    if (path.includes('/stunde')) {
        prefix = 'Stundenansicht – ';
    } else if (path.includes('/woche')) {
        prefix = 'Wochenansicht – ';
    } else if (path.includes('/monat')) {
        prefix = 'Monatsansicht – ';
    } else {
        // start or anything else
        prefix = '';
    }

    // Format fzgtyp (it's an array)
    const fzgtypArr = Array.isArray(activeFzgtyp) ? activeFzgtyp : [activeFzgtyp];
    const fzgtypStr = fzgtypArr.filter(f => f && f !== 'Total').join(', ') || 'Total';

    // Get the station name
    const stationName = await getStationName(activeType, activeZst);
    const zstLabel = stationName ? `Zählstelle ${activeZst} ${stationName}` : `Zählstelle ${activeZst}`;

    // Get weekday filter from DOM
    const moFr = document.querySelector('#mo-fr')?.checked;
    const saSo = document.querySelector('#sa-so')?.checked;
    let weekdayFilter = '';
    if (moFr && saSo) {
        weekdayFilter = 'Mo-So';
    } else if (moFr) {
        weekdayFilter = 'Mo-Fr';
    } else if (saSo) {
        weekdayFilter = 'Sa+So';
    }

    // Format speed filter (it's an array)
    const speedArr = Array.isArray(activeSpeed) ? activeSpeed : [activeSpeed];
    const speedStr = speedArr.filter(s => s && s !== 'Total').join(', ') || '';

    // Build filter string for brackets (fzgtyp and speed only)
    const filterParts = [];
    if (fzgtypStr && fzgtypStr !== 'Total') {
        filterParts.push(fzgtypStr);
    }
    if (speedStr && speedStr !== 'Total') {
        filterParts.push(speedStr);
    }
    const filterBracket = filterParts.length > 0 ? `(${filterParts.join(', ')})` : '';

    // Build title with line breaks
    let title = `${prefix}${activeType}`;
    if (filterBracket) {
        title += ` ${filterBracket}`;
    }
    title += `<br>${zstLabel}`;

    // start: no timerange in title
    if (!path.includes('/start')) {
        // stunde / woche / monat: include timerange
        const von = new Date(activeTimeRange[0]).toLocaleDateString('de-DE');
        const bis = new Date(activeTimeRange[1]).toLocaleDateString('de-DE');
        title += `<br>Von ${von} Bis ${bis}`;
        // Add weekday filter after timerange if selected
        if (weekdayFilter) {
            title += ` (${weekdayFilter})`;
        }
    }

    return title;
}

function setupExportButtonListener(board) {
    const btn = document.getElementById('export-dashboard');
    if (!btn || typeof Highcharts === 'undefined') {
        return;
    }

    btn.addEventListener('click', async () => {

        const charts = [];
        const tables = [];

        board.mountedComponents.forEach(c => {
            if (['hour-table', 'weekly-table', 'month-table'].includes(c.cell.id)) {
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
                const chartId = c.cell.id;
                
                // Check if this is a "directions" chart (boxplot or scatter without -gesamt suffix)
                const isDirectionsChart = (
                    chartId === 'hourly-box-plot' ||
                    chartId === 'hourly-scatter-plot' ||
                    chartId === 'weekly-box-plot' ||
                    chartId === 'weekly-scatter-plot' ||
                    chartId === 'monthly-box-plot' ||
                    chartId === 'monthly-scatter-plot'
                );
                
                // Check if there's only one direction (scope group is hidden)
                const scopeGroup = document.getElementById('chart-scope-group');
                const isSingleDirection = scopeGroup && scopeGroup.style.display === 'none';
                
                // Skip directions charts when there's only one direction
                // Always export gesamt charts and all other charts
                if (isDirectionsChart && isSingleDirection) {
                    // Skip this chart
                    return;
                }
                
                charts.push({
                    id: chartId,
                    svg: c.component.chart.exporting.getSVG()
                });
            }
        });

        if (!charts.length && !tables.length) return;

        const state = getStateFromUrl();
        const title = await buildExportTitle(state);

        const items = [
            ...tables.map(t => ({ type: 'table', id: t.id, content: t.html })),
            ...charts.map(c => ({ type: 'chart', id: c.id, content: c.svg }))
        ];

        const fullPageIds = new Set([
            'hour-table', 'month-table',
        ]);

        const renderItem = (item) => {
            if (item.type === 'table') {
                const extraClass =
                    item.id === 'hour-table'
                        ? ' table-block--hour'
                        : ' table-block--default';

                return `
                    <div class="table-block${extraClass}" data-id="${item.id}">
                        <div class="table-container">
                            ${item.content}
                        </div>
                        <textarea class="chart-note"></textarea>
                    </div>`;
            }

            if (item.type === 'chart') {
                let extraClass = '';

                return `
                    <div class="chart-block${extraClass}" data-id="${item.id}">
                        <div class="chart-container">
                            ${item.content}
                        </div>
                        <textarea class="chart-note"></textarea>
                    </div>`;
            }

            return '';
        };

        let pagesHtml = '';
        let openPage = false;
        let itemsOnCurrentPage = 0;
        let isFirstPage = true;
        const maxPerPage = 2;

        items.forEach((item) => {
            const isFull = fullPageIds.has(item.id);

            if (isFull) {
                if (openPage) {
                    pagesHtml += '</div>';
                    openPage = false;
                    itemsOnCurrentPage = 0;
                    isFirstPage = false;
                }

                const pageClass = `page page-full page-${item.id}`;
                pagesHtml += `<div class="${pageClass}">`;
                if (isFirstPage) {
                    pagesHtml += `<h1 class="page-title">${title}</h1>`;
                    isFirstPage = false;
                }
                pagesHtml += renderItem(item);
                pagesHtml += '</div>';
                return;
            }

            // Normal items: max 2 per page
            if (!openPage || itemsOnCurrentPage >= maxPerPage) {
                if (openPage) {
                    pagesHtml += '</div>';
                }
                pagesHtml += '<div class="page">';
                if (isFirstPage) {
                    pagesHtml += `<h1 class="page-title">${title}</h1>`;
                    isFirstPage = false;
                }
                openPage = true;
                itemsOnCurrentPage = 0;
            }

            pagesHtml += renderItem(item);
            itemsOnCurrentPage++;
        });

        if (openPage) {
            pagesHtml += '</div>';
        }

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

function setupChartTypeToggle() {
    const typeRadios  = document.querySelectorAll('input[name="chart-type"]');
    const scopeRadios = document.querySelectorAll('input[name="chart-scope"]');

    if (!typeRadios.length) {
        return;
    }

    const chartConfig = {
        hourly: {
            directions: { box: 'hourly-box-plot',          scatter: 'hourly-scatter-plot' },
            gesamt:     { box: 'hourly-box-plot-gesamt',   scatter: 'hourly-scatter-plot-gesamt' }
        },
        weekly: {
            directions: { box: 'weekly-box-plot',          scatter: 'weekly-scatter-plot' },
            gesamt:     { box: 'weekly-box-plot-gesamt',   scatter: 'weekly-scatter-plot-gesamt' }
        },
        monthly: {
            directions: { box: 'monthly-box-plot',         scatter: 'monthly-scatter-plot' },
            gesamt:     { box: 'monthly-box-plot-gesamt',  scatter: 'monthly-scatter-plot-gesamt' }
        }
    };

    const getCurrentType = () =>
        (document.querySelector('input[name="chart-type"]:checked')?.value) || 'scatter';

    const getCurrentScope = () =>
        (document.querySelector('input[name="chart-scope"]:checked')?.value) || 'directions';

    const applyVisibility = () => {
        const type  = getCurrentType();
        const scope = getCurrentScope();

        Object.values(chartConfig).forEach(view => {
            ['directions', 'gesamt'].forEach(mode => {
                const ids = [view[mode].box, view[mode].scatter];

                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;

                    const isCurrentMode = (mode === scope);
                    const isCorrectType =
                        (type === 'boxplot'  && id === view[mode].box) ||
                        (type === 'scatter'  && id === view[mode].scatter);

                    const shouldShow = isCurrentMode && isCorrectType;

                    if (shouldShow) {
                        el.classList.remove('chart-hidden');
                    } else {
                        el.classList.add('chart-hidden');
                    }
                });
            });
        });
    };

    [...typeRadios, ...scopeRadios].forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                applyVisibility();
            }
        });
    });

    applyVisibility();

    window.applyChartTypeAndScopeVisibility = applyVisibility;
}
