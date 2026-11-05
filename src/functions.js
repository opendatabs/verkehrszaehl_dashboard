/**
 * Reads a CSV file from a URL or File object and returns an array of objects.
 * @param {string | File} input - The URL string or File object of the CSV file.
 * @returns {Promise<Object[]>} A promise that resolves to an array of objects representing the CSV data.
 */
export function readCSV(input) {
    return new Promise((resolve, reject) => {
        if (typeof input === 'string') {
            // Input is a URL
            fetch(input)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(csvText => {
                    const results = Papa.parse(csvText, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                    });
                    if (results.errors.length) {
                        reject(results.errors);
                    } else {
                        resolve(results.data);
                    }
                })
                .catch(error => {
                    reject(error);
                });
        } else if (input instanceof File) {
            // Input is a File object
            const reader = new FileReader();
            reader.onload = function(e) {
                const csvText = e.target.result;
                const results = Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                });
                if (results.errors.length) {
                    reject(results.errors);
                } else {
                    resolve(results.data);
                }
            };
            reader.onerror = function(error) {
                reject(error);
            };
            reader.readAsText(input);
        } else {
            reject(new Error('Invalid input. Must be a URL string or a File object.'));
        }
    });
}

// cache to avoid refetching
const _stationsCache = new Map();
const _speedStationsCache = new Map();

export async function loadStations(type) {
    if (_stationsCache.has(type)) return _stationsCache.get(type);

    const url = `../data/dtv_${type}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const arr = await res.json();        // [ [headers...], [row...], ... ]

    const [headers, ...rows] = arr;
    const data = rows.map(row => Object.fromEntries(
        headers.map((h, i) => [h, row[i]])
    ));

    _stationsCache.set(type, data);
    return data;
}

export async function loadSpeedStations() {
    if (_speedStationsCache.has('MIV_Speed')) return _speedStationsCache.get('MIV_Speed');

    const url = `../data/dtv_MIV_Speed.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const arr = await res.json();

    const [headers, ...rows] = arr;
    const data = rows.map(row => Object.fromEntries(
        headers.map((h, i) => [h, row[i]])
    ));

    _speedStationsCache.set('MIV_Speed', data);
    return data;
}

export function hasSpeedData(zst) {
    // Check if station has speed data by checking if it exists in speed stations
    // This will be checked asynchronously when needed
    return _speedStationsCache.has('MIV_Speed') 
        ? _speedStationsCache.get('MIV_Speed').some(r => String(r.Zst_id) === String(zst))
        : null; // null means not yet loaded
}

export async function getStationName(type, zst) {
    const res = await fetch(`../data/dtv_${type}.json`);
    if (!res.ok) return '';
    const arr = await res.json();
    const [headers, ...rows] = arr;
    const idIdx   = headers.indexOf('Zst_id');
    const nameIdx = headers.indexOf('name');
    const hit = rows.find(r => String(r[idIdx]) === String(zst));
    return hit ? String(hit[nameIdx]) : '';
}

export function updateCredits(credits, type){
    if (type === 'MIV') {
        credits.update({
            text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
            href: 'https://data.bs.ch/explore/dataset/100006/'
        });
    } else {
        credits.update({
            text: 'Datenquelle: Verkehrszähldaten Velos und Fussgänger',
            href: 'https://data.bs.ch/explore/dataset/100013/'
        });
    }
}

export function normalizeZsts(zsts) {
    if (Array.isArray(zsts)) {
        return [...new Set(zsts.map(z => String(z).trim()).filter(z => z && z !== 'default_station'))];
    }
    if (zsts == null || zsts === '' || zsts === 'default_station') return [];
    return parseZstParam(String(zsts));
}

/** Palette for Vergleich (multi-station) chart series */
export const VERGLEICH_COLORS = [
    '#007a2f', '#008ac3', '#c43e00', '#6A0DAD',
    '#b8860b', '#2f4f4f', '#dc143c', '#4682b4',
    '#228b22', '#ff7f50'
];

export function vergleichColor(index) {
    return VERGLEICH_COLORS[index % VERGLEICH_COLORS.length];
}

/**
 * Remove dynamically added Vergleich series (id starts with vergleich-)
 * and optionally restore the first `baseCount` series for single-station mode.
 * Does not rename base series (keeps e.g. "Durchschnitt" intact).
 */
export function resetChartSeriesForMode(chart, { vergleichMode, baseCount = 3, restoreBase } = {}) {
    if (!chart) return;

    // Remove only vergleich-* series. Never drop permanent connector series by index
    // (e.g. yearly series-temp must survive when baseCount is 3 for traffic-only hide).
    for (let i = chart.series.length - 1; i >= 0; i--) {
        const s = chart.series[i];
        const id = String(s.options?.id || s.userOptions?.id || '');
        if (id.startsWith('vergleich-')) {
            s.remove(false);
        }
    }

    if (vergleichMode) {
        // Hide only — never setData([]) on connector-bound series (breaks Dashboards binding
        // and leaves single-mode empty after switching back from Vergleich).
        for (let i = 0; i < Math.min(baseCount, chart.series.length); i++) {
            chart.series[i].update({
                visible: false,
                showInLegend: false,
                enableMouseTracking: false
            }, false);
        }
    } else {
        // Restore base series after Vergleich — single-mode paths then refine visibility
        for (let i = 0; i < Math.min(baseCount, chart.series.length); i++) {
            chart.series[i].update({
                visible: true,
                showInLegend: true,
                enableMouseTracking: true,
                point: { events: {} }
            }, false);
        }
        if (typeof restoreBase === 'function') {
            restoreBase(chart);
        }
    }
}

/**
 * Cross-highlight charts (and optional Grid) in Vergleich mode by matching point.x
 * (datetime/year) or the same category/row index.
 * Use when chart series are addSeries()-based (Dashboards connector highlight only
 * maps columnAssignment series, so Grid↔Vergleich chart sync needs this).
 * Returns a cleanup function.
 *
 * @param {Array} charts Highcharts chart instances or Dashboard chart components
 * @param {{ grid?: object }} [options] Optional Grid component (`type: 'Grid'`)
 */
export function bindVergleichHighlightSync(charts, options = {}) {
    const list = (charts || []).map(c => (c?.chart ? c.chart : c)).filter(Boolean);
    const gridApi = options.grid?.grid || (options.grid?.type === 'Grid' ? options.grid.grid : null)
        || (options.grid?.hoverRow ? options.grid : null);
    if (list.length < 1 && !gridApi) return () => {};
    if (list.length < 2 && !gridApi) return () => {};

    let syncing = false;
    let originalHoverRow = null;
    const HC = typeof Highcharts !== 'undefined' ? Highcharts : null;
    const eventRemovers = [];

    const clearChart = (chart) => {
        (chart.series || []).forEach(s => {
            (s.points || []).forEach(p => {
                if (p.state === 'hover') p.setState();
            });
        });
        chart.xAxis?.[0]?.hideCrosshair?.();
        chart.tooltip?.hide?.(0);
    };

    const clearGrid = () => {
        try {
            if (originalHoverRow) originalHoverRow(undefined);
            else gridApi?.hoverRow?.(undefined);
        } catch (_) { /* ignore */ }
    };

    const pointMatches = (p, x, idx) => {
        if (p == null) return false;
        if (x != null && p.x === x) return true;
        // Category charts (Stunde/Woche/Monat): same slot even if x differs slightly
        if (idx != null && p.index === idx) return true;
        return false;
    };

    const highlightChartsAt = (sourceChart, x, idx) => {
        list.forEach(target => {
            if (target === sourceChart) return;
            let first = null;
            const hovered = [];
            (target.series || []).forEach(s => {
                if (!s.visible || s.options?.enableMouseTracking === false) return;
                (s.points || []).forEach(p => {
                    const match = pointMatches(p, x, idx);
                    if (match) {
                        p.setState('hover');
                        hovered.push(p);
                        if (!first) first = p;
                    } else if (p.state === 'hover') {
                        p.setState();
                    }
                });
            });
            if (first && target.xAxis?.[0]) {
                target.xAxis[0].drawCrosshair(null, first);
            }
            if (hovered.length && target.tooltip) {
                try {
                    target.tooltip.refresh(hovered.length > 1 ? hovered : first);
                } catch (_) {
                    try { target.tooltip.refresh(first); } catch (__) { /* ignore */ }
                }
            }
        });
    };

    const highlightAt = (sourceChart, sourcePoint) => {
        const x = sourcePoint.x;
        const idx = sourcePoint.index;
        highlightChartsAt(sourceChart, x, idx);
        if (gridApi && idx != null) {
            try {
                if (originalHoverRow) originalHoverRow(idx);
                else gridApi.hoverRow(idx);
            } catch (_) { /* ignore */ }
        }
    };

    const trackableSeries = (s) => {
        if (!s || s.visible === false) return false;
        const id = String(s.options?.id || s.userOptions?.id || '');
        // Always include dynamically added Vergleich series
        if (id.startsWith('vergleich-')) return true;
        if (s.options?.enableMouseTracking === false) return false;
        return !!s.visible;
    };

    // Chart → Grid/other charts: prefer Highcharts.addEvent (survives better than point.events update)
    const attachChartHandlers = () => {
        list.forEach(chart => {
            (chart.series || []).forEach(s => {
                if (!trackableSeries(s)) return;
                if (HC?.addEvent) {
                    eventRemovers.push(HC.addEvent(s, 'mouseOver', function () {
                        const point = this.hoverPoint || this.points?.find(p => p.state === 'hover') || this.chart?.hoverPoint;
                        if (!point || syncing) return;
                        syncing = true;
                        try { highlightAt(chart, point); } finally { syncing = false; }
                    }));
                    eventRemovers.push(HC.addEvent(s, 'mouseOut', function () {
                        if (syncing) return;
                        list.forEach(c => { if (c !== chart) clearChart(c); });
                        clearGrid();
                    }));
                }
                // Also set point.events so category/column hover is covered
                try {
                    s.update({
                        point: {
                            events: {
                                mouseOver: function () {
                                    if (syncing) return;
                                    syncing = true;
                                    try { highlightAt(chart, this); } finally { syncing = false; }
                                },
                                mouseOut: function () {
                                    if (syncing) return;
                                    list.forEach(c => { if (c !== chart) clearChart(c); });
                                    clearGrid();
                                }
                            }
                        }
                    }, false);
                } catch (_) { /* ignore */ }
            });
            try { chart.redraw(false); } catch (_) { /* ignore */ }
        });
    };
    attachChartHandlers();

    // Grid → charts: wrap hoverRow so native Grid hover drives chart highlight
    if (gridApi && typeof gridApi.hoverRow === 'function' && !gridApi._vergleichHoverWrapped) {
        originalHoverRow = gridApi.hoverRow.bind(gridApi);
        gridApi._vergleichHoverWrapped = true;
        gridApi._vergleichOriginalHoverRow = originalHoverRow;
        gridApi.hoverRow = (rowIndex) => {
            originalHoverRow(rowIndex);
            if (syncing) return;
            if (rowIndex == null) {
                list.forEach(clearChart);
                return;
            }
            syncing = true;
            try {
                highlightChartsAt(null, rowIndex, rowIndex);
            } finally {
                syncing = false;
            }
        };
    } else if (gridApi?._vergleichOriginalHoverRow) {
        originalHoverRow = gridApi._vergleichOriginalHoverRow;
    }

    // Fallback DOM delegation (covers cases where hoverRow is not used)
    const gridRoot = gridApi?.contentWrapper || gridApi?.container || gridApi?.tableElement
        || gridApi?.viewport?.tableElement || null;
    const onGridOver = (e) => {
        if (syncing || !gridRoot) return;
        const tr = e.target?.closest?.('tr');
        if (!tr || !gridRoot.contains(tr)) return;
        const rows = gridApi.viewport?.rows || [];
        const row = rows.find(r => r.htmlElement === tr);
        let idx = row?.index;
        if (idx == null && tr.rowIndex != null) {
            // Subtract header row when present
            idx = Math.max(0, tr.rowIndex - (tr.parentElement?.tagName === 'TBODY' ? 0 : 1));
        }
        if (idx == null) return;
        syncing = true;
        try {
            highlightChartsAt(null, idx, idx);
            try { originalHoverRow ? originalHoverRow(idx) : gridApi.hoverRow?.(idx); } catch (_) { /* ignore */ }
        } finally {
            syncing = false;
        }
    };
    const onGridLeave = (e) => {
        if (syncing || !gridRoot) return;
        if (e.relatedTarget && gridRoot.contains(e.relatedTarget)) return;
        list.forEach(clearChart);
        clearGrid();
    };
    if (gridRoot) {
        gridRoot.addEventListener('mouseover', onGridOver);
        gridRoot.addEventListener('mouseleave', onGridLeave);
    }

    return () => {
        eventRemovers.forEach(remove => { try { remove(); } catch (_) { /* ignore */ } });
        if (gridRoot) {
            gridRoot.removeEventListener('mouseover', onGridOver);
            gridRoot.removeEventListener('mouseleave', onGridLeave);
        }
        if (gridApi?._vergleichHoverWrapped && gridApi._vergleichOriginalHoverRow) {
            gridApi.hoverRow = gridApi._vergleichOriginalHoverRow;
            delete gridApi._vergleichHoverWrapped;
            delete gridApi._vergleichOriginalHoverRow;
        }
        list.forEach(chart => {
            (chart.series || []).forEach(s => {
                try { s.update({ point: { events: {} } }, false); } catch (_) { /* ignore */ }
            });
            clearChart(chart);
        });
        clearGrid();
    };
}

/** Clear Vergleich hover handlers left on series (call when returning to single mode). */
export function clearVergleichHighlightSync(charts) {
    (charts || []).forEach(c => {
        const chart = c?.chart ? c.chart : c;
        if (!chart) return;
        (chart.series || []).forEach(s => {
            try { s.update({ point: { events: {} } }, false); } catch (_) { /* ignore */ }
        });
    });
}

/**
 * Enable/disable Highcharts Dashboards highlight sync without remounting
 * (avoids stuck loading cells from component.update({sync})).
 * Handles both `highlight: true` and `highlight: { enabled, ... }` configs.
 */
export function setDashboardHighlightSync(component, enabled) {
    if (!component?.sync) return;
    try {
        const cfg = component.sync.syncConfig;
        if (cfg) {
            const h = cfg.highlight;
            if (h && typeof h === 'object') {
                h.enabled = !!enabled;
            } else {
                // Boolean (or missing) form — never assign `.enabled` onto a primitive
                cfg.highlight = { enabled: !!enabled };
            }
        }
        if (enabled) {
            if (typeof component.sync.start === 'function') component.sync.start();
        } else if (typeof component.sync.stop === 'function') {
            component.sync.stop();
        }
    } catch (_) { /* ignore */ }
}

/**
 * Push data onto series by id. Used after Vergleich→single to recover charts whose
 * Dashboards connector binding was broken by an earlier setData([]).
 */
export function pushSeriesData(chart, seriesDataMap, redraw = false) {
    if (!chart || !seriesDataMap) return;
    Object.entries(seriesDataMap).forEach(([id, data]) => {
        const s = chart.get(id)
            || chart.series.find(ser => String(ser.options?.id || ser.userOptions?.id || '') === id);
        if (s && data !== undefined) {
            s.setData(data, false);
        }
    });
    if (redraw) chart.redraw();
}

/**
 * Zeitraum Navigator visibility for single vs Vergleich mode.
 * The selector (brush / handles) always stays visible. In Vergleich (`visible=false`)
 * only the mini traffic series inside it is hidden via `.vergleich-mode` CSS —
 * the range brush remains usable with intersection coverage as its domain.
 */
export function setTimeRangeSelectorVisible(visible) {
    const cell = document.getElementById('time-range-selector');
    if (cell) {
        const row = cell.closest('.highcharts-dashboards-row') || cell.parentElement;
        // Always show selector — clear any leftover inline display:none from older builds
        cell.style.removeProperty('display');
        if (row && row !== cell) row.style.removeProperty('display');
    }
    document.body.classList.toggle('vergleich-mode', !visible);
}

/**
 * Push domain data into the Zeitraum Navigator and sync brush extremes.
 * @param {object} navigatorComp Dashboard Navigator component or Highcharts chart
 * @param {Array} dailyTraffic [[ts, y], ...] (intersection placeholders ok in Vergleich)
 * @param {[number, number]} [timeRange]
 */
export function updateTimeRangeNavigator(navigatorComp, dailyTraffic, timeRange) {
    const chart = navigatorComp?.chart ? navigatorComp.chart : navigatorComp;
    if (!chart) return;
    if (chart.series?.[0] && Array.isArray(dailyTraffic)) {
        chart.series[0].setData(dailyTraffic, false);
    }
    if (timeRange?.length === 2 && chart.xAxis?.[0]) {
        const axis = chart.xAxis[0];
        const cur = axis.getExtremes?.() || {};
        if (cur.min !== timeRange[0] || cur.max !== timeRange[1]) {
            axis.setExtremes(timeRange[0], timeRange[1], false);
        }
    }
    chart.redraw();
}

/** Align [x,y] pairs onto a shared timestamp axis (null where missing). */
export function alignPairsToTags(pairs, tags) {
    const map = new Map();
    (pairs || []).forEach(p => {
        if (p != null && p[0] != null) map.set(Number(p[0]), p[1]);
    });
    return (tags || []).map(ts => [ts, map.has(ts) ? map.get(ts) : null]);
}

/**
 * Horizontal offset so multiple Vergleich scatter series sit side-by-side.
 * Default spacing 0.3 matches single-mode ri1/ri2 (±0.15) when count === 2.
 */
export function vergleichScatterOffset(index, count, spacing = 0.3) {
    if (!count || count <= 1) return 0;
    return (index - (count - 1) / 2) * spacing;
}

/**
 * Intersection of daily coverage across stations.
 * Only timestamps where every series has a non-null, non-zero value are kept.
 * Navigator series uses 1 as placeholder y so the brush domain is the intersection.
 */
export function intersectDailyCoverage(dailyTraffics) {
    const lists = (dailyTraffics || []).filter(d => Array.isArray(d) && d.length);
    if (!lists.length) {
        return { dailyTraffic: [], minDate: null, maxDate: null };
    }
    if (lists.length === 1) {
        const valid = lists[0].filter(([, v]) => v != null && v !== 0);
        const minDate = valid.length ? valid[0][0] : null;
        const maxDate = valid.length ? valid[valid.length - 1][0] : null;
        // Ensure sorted
        const sorted = [...lists[0]].sort((a, b) => a[0] - b[0]);
        const validSorted = sorted.filter(([, v]) => v != null && v !== 0);
        return {
            dailyTraffic: sorted,
            minDate: validSorted.length ? validSorted[0][0] : minDate,
            maxDate: validSorted.length ? validSorted[validSorted.length - 1][0] : maxDate
        };
    }

    const sets = lists.map(list => {
        const s = new Set();
        list.forEach(([ts, v]) => {
            if (v != null && v !== 0) s.add(ts);
        });
        return s;
    });
    let intersection = sets[0];
    for (let i = 1; i < sets.length; i++) {
        intersection = new Set([...intersection].filter(ts => sets[i].has(ts)));
    }
    const timestamps = [...intersection].sort((a, b) => a - b);
    const dailyTraffic = timestamps.map(ts => [ts, 1]);
    return {
        dailyTraffic,
        minDate: timestamps.length ? timestamps[0] : null,
        maxDate: timestamps.length ? timestamps[timestamps.length - 1] : null
    };
}

/** Clamp [start, end] into [minDate, maxDate], preserving duration when possible. */
export function clampTimeRangeToCoverage(timeRange, minDate, maxDate) {
    if (minDate == null || maxDate == null || !timeRange) return timeRange;
    let [start, end] = timeRange;
    const duration = Math.max(0, end - start);
    if (end > maxDate) {
        end = maxDate;
        start = end - duration;
    }
    if (start < minDate) {
        start = minDate;
        end = Math.min(maxDate, start + duration);
    }
    if (end > maxDate) end = maxDate;
    if (start > end) start = end;
    return [start, end];
}

/** Restore the dashed Durchschnitt line used on Woche/Monat DTV charts (single-zst only). */
export function restoreDurchschnittSeries(chart) {
    if (!chart) return;
    const s = chart.get('series-durchschnitt')
        || chart.series.find(ser => String(ser.options?.id || ser.userOptions?.id || '') === 'series-durchschnitt');
    if (!s) return;
    s.update({
        type: 'line',
        name: 'Durchschnitt',
        visible: true,
        showInLegend: true,
        marker: { enabled: false },
        color: '#333333',
        dashStyle: 'Dash',
        zIndex: 0
    }, false);
}

export async function updateExporting(
    _board, exporting, filename_prefix, type = '', zst = '', fzgtyp= '',
    timeRange = '', weekday = false, map = false, speed = ''
) {
    let typeFilename = type ? `_${type}` : '';
    let typeSubtitle = type === 'MIV' ? '(MIV)' : type === 'Velo' ? '(Velo)' :
        type === 'Fussgaenger' ? '(Fussgänger)' : '';

    // Determine if we're using speed classes or fzgtyp
    const speedList = Array.isArray(speed) ? speed : (speed ? [speed] : ['Total']);
    const fzgList = Array.isArray(fzgtyp) ? fzgtyp : (fzgtyp ? [fzgtyp] : ['Total']);
    
    const hasSpeedSelection = speedList.some(v => v && v !== 'Total');
    const hasFzgtypSelection = fzgList.some(v => v && v !== 'Total');
    
    // Use speed if selected, otherwise use fzgtyp
    const filterKeys = hasSpeedSelection ? speedList : fzgList;
    const filterLabels = hasSpeedSelection ? SPEED_LABELS : FZG_LABELS;
    const filterTypeName = hasSpeedSelection ? 'Geschwindigkeitsklassen' : (hasFzgtypSelection ? 'Fahrzeugtyp' : '');

    const cleaned = filterKeys.filter(v => v && v !== 'Total');
    const effective = cleaned.length ? cleaned : ['Total'];

    if (effective.length === 1 && effective[0] === 'Total') {
        // keep defaults (no extra filename/subtitle)
    } else {
        typeFilename = `_${effective.join('+')}`;
        typeSubtitle = `(${effective.map(k => filterLabels[k] || k).join(', ')})`;
    }

    const zstList = normalizeZsts(zst).length
        ? normalizeZsts(zst)
        : (zst && zst !== 'default_station' ? [String(zst)] : []);
    const zstFilename = zstList.length ? `_${zstList.join('+')}` : '';
    let zstSubtitle = '';
    if (zstList.length) {
        const parts = await Promise.all(zstList.map(async id => {
            const name = await getStationName(type, id);
            return name ? `${id} ${name}` : `${id}`;
        }));
        zstSubtitle = parts.join(' & ');
    }

    // time range
    let startFilename = '', endFilename = '', startSubtitle = '', endSubtitle = '';
    if (timeRange) {
        const startDate = new Date(timeRange[0]);
        const endDate   = new Date(timeRange[1]);
        const pad = n => String(n).padStart(2,'0');
        startFilename = `_${startDate.getFullYear()}-${pad(startDate.getMonth()+1)}-${pad(startDate.getDate())}`;
        endFilename   = `_${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}`;
        startSubtitle = `von ${pad(startDate.getDate())}.${pad(startDate.getMonth()+1)}.${startDate.getFullYear()}`;
        endSubtitle   = `bis ${pad(endDate.getDate())}.${pad(endDate.getMonth()+1)}.${endDate.getFullYear()}`;
    }

    // weekday flags
    let weekdayFilename = '', weekdaySubtitle = '';
    if (weekday) {
        const isMoFr = document.querySelector('#mo-fr')?.checked;
        const isSaSo = document.querySelector('#sa-so')?.checked;
        const param = isMoFr && isSaSo ? 'mo-so' : isMoFr ? 'mo-fr' : 'sa-so';
        weekdayFilename = param ? `_${param}` : '';
        weekdaySubtitle = param === 'mo-fr' ? '(Werktage)' : param === 'sa-so' ? '(Wochenenden)' : '';
    }

    exporting.update({
        filename: `${filename_prefix}${typeFilename}${zstFilename}${startFilename}${endFilename}${weekdayFilename}`,
        sourceWidth: 960,
        sourceHeight: 540,
        chartOptions: {
            subtitle: { text: `${zstSubtitle} ${typeSubtitle} ${startSubtitle} ${endSubtitle} ${weekdaySubtitle}`.trim() },
            credits: { enabled: false },
            mapView: {
                center: [7.62, 47.565],
                zoom: 12,
                projection: { name: 'WebMercator' }
            },
            legend: {
                className: 'map-legend-box'
            },
        },
        menuItemDefinitions: {
            printChart:   { text: 'Drucken' },
            downloadPNG:  { text: 'Bild - PNG' },
            downloadJPEG: { text: 'Bild - JPEG' },
            downloadPDF:  { text: 'Bild - PDF' },
            downloadSVG:  { text: 'Bild - SVG' },
            downloadCSV:  {
                text: 'Daten - CSV',
                onclick: function () {
                    const monthlyOverrideRows = filename_prefix === 'monthly-chart'
                        ? window.__vzMonthlyChartExportData?.rows
                        : null;
                    const weeklyOverrideRows = filename_prefix === 'weekly-chart'
                        ? window.__vzWeeklyChartExportData?.rows
                        : null;
                    const monthlyWeatherOverrideRows = filename_prefix === 'monthly-weather'
                        ? window.__vzMonthlyWeatherExportData?.rows
                        : null;
                    const rows = (Array.isArray(monthlyOverrideRows) && monthlyOverrideRows.length > 0)
                        ? monthlyOverrideRows
                        : (Array.isArray(weeklyOverrideRows) && weeklyOverrideRows.length > 0)
                            ? weeklyOverrideRows
                            : (Array.isArray(monthlyWeatherOverrideRows) && monthlyWeatherOverrideRows.length > 0)
                                ? monthlyWeatherOverrideRows
                        : (this.getDataRows(true) || []);
                    const isScatterExport = filename_prefix.includes('scatter-plot');
                    
                    const normalizedRows = (() => {
                        if (!isScatterExport) return rows;
                        const categories = this.xAxis?.[0]?.categories || [];
                        if (!Array.isArray(categories) || categories.length === 0) return rows;
                        return rows.map((row, idx) => {
                            if (!Array.isArray(row) || idx < 2) return row;
                            const x = row[0];
                            if (typeof x !== 'number' || Number.isNaN(x)) return row;
                            const catIndex = Math.round(x);
                            const label = categories[catIndex];
                            if (label === undefined) return row;
                            const next = [...row];
                            next[0] = label;
                            return next;
                        });
                    })();
                    const originalDownloadURL = this.downloadURL;
                    const fallbackDownloadURL = (dataURL, fileName) => {
                        // Prefer chart-provided download helper when available.
                        if (typeof originalDownloadURL === 'function') {
                            return originalDownloadURL.call(this, dataURL, fileName);
                        }
                        // Fallback for environments where chart.downloadURL is undefined.
                        const link = document.createElement('a');
                        link.href = dataURL;
                        link.download = fileName;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        return undefined;
                    };
                    this.downloadURL = function (dataURL, fileName) {
                        return fallbackDownloadURL(dataURL, fileName);
                    };
                    const itemDelimiter = this.options?.exporting?.csv?.itemDelimiter || ';';
                    const lineDelimiter = this.options?.exporting?.csv?.lineDelimiter || '\n';
                    const escapeCsv = (value) => {
                        if (value === null || value === undefined) return '';
                        const str = String(value);
                        if (str.includes('"') || str.includes(itemDelimiter) || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    };
                    const csvText = normalizedRows.map(r => r.map(escapeCsv).join(itemDelimiter)).join(lineDelimiter);
                    const csvDataUrl = `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csvText)}`;
                    const name = this.options?.exporting?.filename
                        || this.title?.textStr?.replace(/ /g, '-').toLowerCase()
                        || 'chart';
                    try {
                        this.downloadURL(csvDataUrl, `${name}.csv`);
                    } finally {
                        this.downloadURL = originalDownloadURL;
                    }
                }
            },
            downloadXLSX: {
                text: 'Daten - XLSX',
                onclick: function () {
                    const monthlyOverrideRows = filename_prefix === 'monthly-chart'
                        ? window.__vzMonthlyChartExportData?.rows
                        : null;
                    const weeklyOverrideRows = filename_prefix === 'weekly-chart'
                        ? window.__vzWeeklyChartExportData?.rows
                        : null;
                    const monthlyWeatherOverrideRows = filename_prefix === 'monthly-weather'
                        ? window.__vzMonthlyWeatherExportData?.rows
                        : null;
                    const exportRows = (Array.isArray(monthlyOverrideRows) && monthlyOverrideRows.length > 0)
                        ? monthlyOverrideRows
                        : (Array.isArray(weeklyOverrideRows) && weeklyOverrideRows.length > 0)
                            ? weeklyOverrideRows
                            : (Array.isArray(monthlyWeatherOverrideRows) && monthlyWeatherOverrideRows.length > 0)
                                ? monthlyWeatherOverrideRows
                        : (this.getDataRows(true) || []);
                    const isScatterExport = filename_prefix.includes('scatter-plot');
                    
                    const normalizedRows = (() => {
                        if (!isScatterExport) return exportRows;
                        const categories = this.xAxis?.[0]?.categories || [];
                        if (!Array.isArray(categories) || categories.length === 0) return exportRows;
                        return exportRows.map((row, idx) => {
                            if (!Array.isArray(row) || idx < 2) return row;
                            const x = row[0];
                            if (typeof x !== 'number' || Number.isNaN(x)) return row;
                            const catIndex = Math.round(x);
                            const label = categories[catIndex];
                            if (label === undefined) return row;
                            const next = [...row];
                            next[0] = label;
                            return next;
                        });
                    })();
                    const rows = normalizedRows.slice(1).map(r =>
                        r.map(c => ({ type: typeof c === 'number' ? 'number' : 'string', value: c }))
                    );
                    const name = this.options.exporting.filename
                        || this.title?.textStr?.replace(/ /g,'-').toLowerCase()
                        || 'chart';
                    window.zipcelx({ filename: name, sheet: { data: rows } });
                }
            }
        },
        buttons: {
            contextButton: {
                menuItems: [
                    'printChart',
                    'separator',
                    'downloadPNG',
                    // For the map, do not show JPEG, since it can't download the tiles
                    map ? '' : 'downloadJPEG',
                    'downloadPDF',
                    'downloadSVG',
                    'separator',
                    'downloadCSV',
                    'downloadXLSX'
                ],
            },
        }
    });
}

/**
 * Checks if only Mo-Fr (Monday-Friday) is selected in the weekday filter
 * @returns {boolean} True if only Mo-Fr is selected, false otherwise
 */
export function isOnlyMoFrSelected() {
    const moFrCheckbox = document.querySelector('#mo-fr');
    const saSoCheckbox = document.querySelector('#sa-so');
    if (!moFrCheckbox || !saSoCheckbox) {
        return false; // Default to false if checkboxes don't exist
    }
    return moFrCheckbox.checked && !saSoCheckbox.checked;
}

/**
 * Returns the appropriate label based on weekday selection
 * @param {string} defaultLabel - The default label (e.g., "DTV" or "Tagesverkehr")
 * @returns {string} The label to use (e.g., "DWV" or "Werktagesverkehr" if only Mo-Fr is selected)
 */
export function getTrafficLabel(defaultLabel) {
    if (isOnlyMoFrSelected()) {
        if (defaultLabel === 'DTV') return 'DWV';
        if (defaultLabel === 'Tagesverkehr') return 'Werktagesverkehr';
        if (defaultLabel.includes('DTV')) return defaultLabel.replace(/DTV/g, 'DWV');
        if (defaultLabel.includes('Tagesverkehr')) return defaultLabel.replace(/Tagesverkehr/g, 'Werktagesverkehr');
    }
    return defaultLabel;
}

function intersectArrays(lists) {
    if (!lists.length) return [];
    return lists.reduce((acc, list) => {
        const set = new Set((list || []).map(String));
        return acc.filter(v => set.has(String(v)));
    });
}

/** @deprecated Always-on trailing empty slot; kept as no-op for call-site compat. */
export function setZstTrailingEmpty(_value) {}

export function getZstTrailingEmpty() {
    return true;
}

export async function updateState(board, type, strtyp, zsts, fzgtyp, speed, timeRange, zaehlstellen, stationRows) {
    let zstList = normalizeZsts(zsts);
    // Backward compat: scalar zst / single stationRow
    if (!Array.isArray(stationRows) && stationRows) {
        stationRows = [stationRows];
    }

    if (zaehlstellen && Array.isArray(zaehlstellen) && zaehlstellen.length > 0) {
        zstList = populateZstDropdowns(zaehlstellen, zstList);
    } else if (!zstList.length) {
        return { zsts: ['default_station'], zst: 'default_station', fzgtyp: ['Total'], speed: ['Total'] };
    }

    const stations = type === 'MIV' ? await loadStations(type) : [];
    const resolvedRows = zstList.map(id => {
        const fromArg = (stationRows || []).find(r => r && String(r.Zst_id) === String(id));
        if (fromArg) return fromArg;
        return stations.find(r => String(r.Zst_id) === String(id)) || null;
    });

    let isMoFrSelected = true;
    let isSaSoSelected = true;
    if (document.querySelector('#mo-fr')){ // Check if the radio buttons exist
        isMoFrSelected = document.querySelector('#mo-fr').checked;
        isSaSoSelected = document.querySelector('#sa-so').checked;
    }
    const weekday_param = isMoFrSelected && isSaSoSelected ? 'mo-so' : isMoFrSelected ? 'mo-fr' : 'sa-so';

    // Normalize inputs
    fzgtyp = Array.isArray(fzgtyp) ? fzgtyp : (fzgtyp ? [fzgtyp] : ['Total']);
    speed = Array.isArray(speed) ? speed : (speed ? [speed] : ['Total']);

    // Check if speed or fzgtyp is active (not just 'Total')
    const hasSpeedSelection = speed.some(v => v && v !== 'Total');
    const hasFzgtypSelection = fzgtyp.some(v => v && v !== 'Total');

    // Make them mutually exclusive: if one is active, disable the other
    if (hasSpeedSelection && hasFzgtypSelection) {
        // If both are selected, prioritize speed and reset fzgtyp
        fzgtyp = ['Total'];
        document.getElementById('fzgtyp-buttons')?.replaceChildren();
    }

    if (type === 'MIV') {
        const rowsForFzg = resolvedRows.filter(Boolean);
        if (rowsForFzg.length) {
            const allowedLists = rowsForFzg.map(r => getAllowedFzgtypsForStation(r));
            const allowedFzgtyp = intersectArrays(allowedLists);
            const canUseFzgtyp = allowedFzgtyp.filter(k => k !== 'Total').length > 0;

            if (!canUseFzgtyp) {
                fzgtyp = ['Total'];
                document.getElementById('fzgtyp-buttons')?.replaceChildren();
                syncFzgtypUI(fzgtyp, [], false);
            } else {
                fzgtyp = renderFzgtypButtons(allowedFzgtyp, fzgtyp);
                const currentHasSpeedSelection = speed.some(v => v && v !== 'Total');
                syncFzgtypUI(fzgtyp, allowedFzgtyp, currentHasSpeedSelection);
            }
        } else {
            fzgtyp = ['Total'];
            document.getElementById('fzgtyp-buttons')?.replaceChildren();
            syncFzgtypUI(fzgtyp, [], false);
        }

        if (zstList.length) {
            const speedLists = await Promise.all(zstList.map(id => getAllowedSpeedClassesForStation(id)));
            const allowedSpeed = intersectArrays(speedLists);
            const canUseSpeed = allowedSpeed.length > 0;

            if (!canUseSpeed) {
                speed = ['Total'];
                document.getElementById('speed-buttons')?.replaceChildren();
                syncSpeedUI(speed, [], false);
            } else {
                speed = renderSpeedButtons(allowedSpeed, speed);
                const currentHasFzgtypSelection = fzgtyp.some(v => v && v !== 'Total');
                syncSpeedUI(speed, allowedSpeed, currentHasFzgtypSelection);
            }
        } else {
            speed = ['Total'];
            document.getElementById('speed-buttons')?.replaceChildren();
            syncSpeedUI(speed, [], false);
        }
    } else {
        fzgtyp = ['Total'];
        speed = ['Total'];
        document.getElementById('fzgtyp-buttons')?.replaceChildren();
        document.getElementById('speed-buttons')?.replaceChildren();
        syncFzgtypUI(fzgtyp, [], false);
        syncSpeedUI(speed, [], false);
    }

    updateUrlParams({
        traffic_type: type,
        zst_id: zstList.join(','),
        fzgtyp: fzgtyp.join(','),
        speed: speed.join(','),
        start_date: new Date(timeRange[0]).toISOString().split('T')[0],
        // params should give the feeling end-date is inclusive
        end_date: new Date(timeRange[1] - 24 * 3600 * 1000).toISOString().split('T')[0],
        weekday: weekday_param
    });
    updateDatePickers(timeRange[0], timeRange[1]);
    updateZeiteinheitSelection(board, timeRange);
    const zst = zstList[0] || 'default_station';
    return { zsts: zstList, zst, fzgtyp, speed };
}

function parseFzgtypParam(raw) {
    if (!raw) return ['Total'];
    const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : ['Total'];
}

function parseSpeedParam(raw) {
    if (!raw) return ['Total'];
    const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    return arr.length ? arr : ['Total'];
}

// Legacy SiteCodes that were renumbered in the traffic data but may still appear
// in bookmarks / README examples (e.g. 235 → 236 for A3-A35, Grenze CH-F).
const LEGACY_ZST_IDS = {
    '235': '236',
};

export function parseZstParam(raw) {
    if (!raw) return [];
    const seen = new Set();
    const out = [];
    raw.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        const mapped = LEGACY_ZST_IDS[String(id)] || id;
        if (!seen.has(mapped)) {
            seen.add(mapped);
            out.push(mapped);
        }
    });
    return out;
}

export function getStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const lastYear = new Date().getFullYear() - 1;
    const activeZsts = parseZstParam(params.get('zst_id'));
    const activeZst = activeZsts[0] || 'default_station';

    return {
        activeType: params.get('traffic_type') || 'MIV',
        activeStrtyp: 'Alle', // Always 'Alle' since strtyp filter is removed
        activeZst,
        activeZsts: activeZsts.length ? activeZsts : ['default_station'],
        activeFzgtyp: parseFzgtypParam(params.get('fzgtyp')), // <-- ARRAY NOW
        activeSpeed: parseSpeedParam(params.get('speed')), // <-- ARRAY NOW
        activeTimeRange: [
            Date.parse(params.get('start_date')) || Date.parse(`${lastYear}-01-01`),
            (Date.parse(params.get('end_date')) || Date.parse(`${lastYear}-12-31`)) + 24 * 3600 * 1000
        ],
        weekday: params.get('weekday') || 'mo-so'
    };
}

/**
 * Copy the current page query string onto every Ansicht navbar link.
 * Call early on load and again before navigation so multi zst_id survives Ansicht switches
 * even if updateBoard has not finished yet.
 */
export function syncNavbarLinksFromUrl() {
    const queryString = window.location.search; // e.g. '?traffic_type=MIV&zst_id=407%2C402&...'
    document.querySelectorAll('.navbar-links a.navbar-link').forEach(link => {
        let baseHref = link.getAttribute('href') || '';
        baseHref = baseHref.split('?')[0];
        // Active page often has href=""; keep it as "./" so query params still navigate correctly
        if (!baseHref) {
            baseHref = './';
        }
        link.setAttribute('href', baseHref + queryString);
    });
}

/** Patch selected query params, replaceState, and refresh navbar links immediately. */
export function patchUrlParams(params) {
    const url = new URL(window.location.href);
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key);
        }
    });
    history.replaceState({}, '', `${url.pathname}${url.search}`);
    syncNavbarLinksFromUrl();
}

function updateUrlParams(params) {
    patchUrlParams(params);
    initializeFromUrlParams();
}


/**
 * This function initializes the UI elements based on the current URL state.
 * It sets the proper filters, dropdown values, and radio button selections
 * so that the UI immediately reflects what is in the URL parameters.
 */
function initializeFromUrlParams() {
    const currentState = getStateFromUrl();

    // Set initial filter (Type)
    const filterRadio = document.querySelector(`#filter-buttons input[name="filter"][value="${currentState.activeType}"]`);
    if (filterRadio) {
        filterRadio.checked = true;
    }

    // Zaehlstelle dropdowns are synced by populateZstDropdowns during updateState.
    // Only sync primary if rows already exist (initial paint before first update).
    const primaryDropdown = document.getElementById('zaehlstellen-dropdown');
    if (primaryDropdown && currentState.activeZst && currentState.activeZsts.length === 1) {
        primaryDropdown.value = currentState.activeZst;
    }

    const selectedFzgtyp = currentState.activeFzgtyp || ['Total'];
    // if buttons already rendered, apply selection
    const fzgtypWrap = document.getElementById('fzgtyp-buttons');
    if (fzgtypWrap) {
        const set = new Set(selectedFzgtyp);
        [...fzgtypWrap.querySelectorAll('input[name="fzgtyp"]')].forEach(i => {
            i.checked = set.has(i.value);
        });
    }

    const selectedSpeed = currentState.activeSpeed || ['Total'];
    // if buttons already rendered, apply selection
    const speedWrap = document.getElementById('speed-buttons');
    if (speedWrap) {
        const set = new Set(selectedSpeed);
        [...speedWrap.querySelectorAll('input[name="speed"]')].forEach(i => {
            i.checked = set.has(i.value);
        });
    }
}

export function uncheckAllStrTyp() {
    const radios = document.querySelectorAll(`input[name="filter-strtyp"]`);
    radios.forEach(radio => {
        radio.checked = false;
    });
}


function updateDatePickers(min, max) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.value = new Date(min).toISOString().split('T')[0];
    // Datepicker should give the feeling end-date is inclusive
    endDateInput.value = new Date(max - 24 * 3600 * 1000).toISOString().split('T')[0];
}

// Helper function to clear "Zeitraum" selection
function updateZeiteinheitSelection(board, timeRange) {
    const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
    const dataMin = navigatorChart.xAxis[0].dataMin;
    const dataMax = navigatorChart.xAxis[0].dataMax;

    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        // Uncheck all radio buttons
        radio.checked = false;

        if (timeRange) {
            const [min, max] = timeRange;
            const minDate = new Date(min).toISOString().split('T')[0];
            const maxDate = new Date(max).toISOString().split('T')[0];

            switch (radio.value) {
                case '1 Tag':
                    if (max - min === 24 * 3600 * 1000) {
                        radio.checked = true;
                    }
                    break;
                case '1 Woche':
                    if (max - min === 7 * 24 * 3600 * 1000) {
                        radio.checked = true;
                    }
                    break;
                case '1 Monat':
                    // Match "YYYY-MM-DD" with one month difference
                    const maxDateParts = maxDate.split('-');
                    const year = parseInt(maxDateParts[0], 10);
                    const month = parseInt(maxDateParts[1], 10);
                    const day = maxDateParts[2];
                    const adjustedYear = month === 1 ? year - 1 : year;
                    const adjustedMonth = month === 1 ? 12 : (month - 1).toString().padStart(2, '0');
                    const monthRegex = new RegExp(`^${adjustedYear}-${adjustedMonth}-${day}$`);
                    if (monthRegex.test(minDate)) {
                        radio.checked = true;
                    }
                    break;
                case '1 Jahr':
                    // Match "YYYY-MM-DD" with one year difference
                    const yearRegex = new RegExp(`^${(parseInt(maxDate.split('-')[0], 10) - 1)}-${maxDate.split('-')[1]}-${maxDate.split('-')[2]}$`);
                    if (yearRegex.test(minDate)) {
                        radio.checked = true;
                    }
                    break;
                case 'Alles':
                    if (min <= dataMin && max >= dataMax) {
                        radio.checked = true;
                    }
                    break;
                default:
                    break;
            }
        }
    });
}

function updateStrassentypFilters(activeType) {
    // Mapping of `Verkehrsmittel` to allowed `Strassentyp` values
    const allowedStrassentyp = {
        'MIV': ['HLS', 'HVS', 'HSS', 'SOS'],
        'Velo': ['HVS', 'SOS', 'Andere'],
        'Fussgaenger': ['HVS', 'HSS', 'SOS', 'Andere']
    };

    const allowed = allowedStrassentyp[activeType] || [];

    document.querySelectorAll('.filter-options input[name="filter-strtyp"]').forEach(radio => {
        const label = radio.nextElementSibling; // Get the associated label
        if (allowed.includes(radio.value)) {
            radio.disabled = false; // Enable the button
            label.style.display = ''; // Show the label
        } else {
            radio.disabled = true; // Disable the button
            label.style.display = 'none'; // Hide the label
            radio.checked = false; // Uncheck if it's disabled
        }
    });
}

function getColorForStrTyp(strtypAbbrev) {
    const strtypColors = {
        "HLS": "#ffeb00",
        "HVS": "#ff0000",
        "HSS": "#4ce600",
        "SOS": "#0070ff",
        "Andere": "#71a903"
    };
    return strtypColors[strtypAbbrev] || "#FFFFFF"; // Default to white if not found
}

export function extractAbbreviation(strtypValue) {
    const match = strtypValue.match(/\((.*?)\)/);
    if (match) {
        return match[1]; // Returns the abbreviation inside parentheses
    } else {
        return strtypValue.trim(); // Return the trimmed string if no abbreviation
    }
}

export async function getFilteredZaehlstellen(_board, type, fzgtyp, speed = null) {
    // Normalize inputs
    const speedArray = Array.isArray(speed) ? speed : (speed ? [speed] : ['Total']);
    const fzgtypArray = Array.isArray(fzgtyp) ? fzgtyp : (fzgtyp ? [fzgtyp] : ['Total']);
    
    // Determine if we're using speed classes or fzgtyp
    // Check if speed has any non-Total selection
    const hasSpeedSelection = speedArray.some(v => v && v !== 'Total');
    const filterKeys = hasSpeedSelection ? speedArray : fzgtypArray;
    
    // Load appropriate data source
    // Use speed stations data only if speed is selected AND type is MIV
    const rows = (hasSpeedSelection && type === 'MIV') 
        ? await loadSpeedStations() 
        : await loadStations(type);
    
    const filterList = filterKeys.filter(v => v && v !== 'Total');
    const effectiveKeys = filterList.length > 0 ? filterList : ['Total'];

    return rows
        .filter(r => r.TrafficType === type && r.strtyp !== -1)
        .map(r => {
            // Check if station has any valid data for the selected filter keys
            let hasValidData = false;
            const val = effectiveKeys.reduce((sum, k) => {
                const v = r[k];
                // For 'Total', it should always be valid if it exists and is not -1
                // For other keys, check if value is valid
                if (k === 'Total') {
                    if (v !== -1 && v != null && !isNaN(v)) {
                        hasValidData = true;
                        return sum + v;
                    }
                } else {
                    if (v !== -1 && v != null && !isNaN(v)) {
                        hasValidData = true;
                        return sum + v;
                    }
                }
                return sum;
            }, 0);

            // If no valid data found for any of the selected keys, set to null (hides bubble)
            const finalVal = (!hasValidData || val === 0) ? null : val;

            const [latStr, lonStr] = String(r.geo_point_2d).split(',').map(s => s.trim());
            const strtypAbbrev = extractAbbreviation(r.strtyp);

            return {
                lat: parseFloat(latStr),
                lon: parseFloat(lonStr),
                name: String(r.name),
                id: r.Zst_id,
                type: r.TrafficType,
                strtyp: r.strtyp,
                color: getColorForStrTyp(strtypAbbrev),
                total: finalVal
            };
        });
}


export function readSelectedZstsFromDom() {
    const container = document.getElementById('zaehlstellen-container');
    if (!container) {
        const primary = document.getElementById('zaehlstellen-dropdown');
        return primary?.value ? [String(primary.value)] : [];
    }
    const values = [];
    container.querySelectorAll('select.zaehlstellen-select').forEach(sel => {
        const v = String(sel.value || '').trim();
        if (v && v !== '__placeholder__') values.push(v);
    });
    return [...new Set(values)];
}

function fillSelectOptions(select, zaehlstellen, selectedId, excludeIds, placeholderLabel) {
    select.innerHTML = '';
    if (placeholderLabel) {
        const ph = document.createElement('option');
        ph.value = '__placeholder__';
        ph.text = placeholderLabel;
        ph.disabled = false;
        select.add(ph);
    }
    const exclude = new Set((excludeIds || []).map(String).filter(id => String(id) !== String(selectedId)));
    (zaehlstellen || []).forEach(station => {
        if (exclude.has(String(station.id))) return;
        const option = document.createElement('option');
        option.value = station.id;
        option.text = `${station.id} ${station.name}`;
        select.add(option);
    });
    if (selectedId && selectedId !== '__placeholder__') {
        select.value = String(selectedId);
        if (select.value !== String(selectedId) && select.options.length > (placeholderLabel ? 1 : 0)) {
            // selected id not in list
            return null;
        }
    } else if (placeholderLabel) {
        select.value = '__placeholder__';
    }
    return select.value === '__placeholder__' ? null : select.value;
}

/**
 * Build / refresh primary + extra Zählstellen dropdowns.
 * Always shows one trailing empty "N. Zählstelle hinzufügen" slot.
 * × only on filled non-primary rows.
 * Returns the resolved list of selected station ids (never empty if zaehlstellen available).
 */
export function populateZstDropdowns(zaehlstellen, selectedZsts) {
    const container = document.getElementById('zaehlstellen-container');
    const available = Array.isArray(zaehlstellen) ? zaehlstellen : [];
    const availableIds = new Set(available.map(s => String(s.id)));

    let selected = normalizeZsts(selectedZsts).filter(id => availableIds.has(String(id)));
    if (!selected.length && available.length) {
        selected = [String(available[0].id)];
    }

    if (!container) {
        // Fallback: legacy single dropdown
        const dropdown = document.getElementById('zaehlstellen-dropdown');
        if (!dropdown) return selected.length ? selected : ['default_station'];
        fillSelectOptions(dropdown, available, selected[0], [], null);
        if (!dropdown.value && available.length) {
            selected = [String(available[0].id)];
            dropdown.value = selected[0];
        }
        return selected.length ? selected.map(String) : ['default_station'];
    }

    container.querySelectorAll('.zaehlstellen-row').forEach(row => row.remove());

    // Always: one row per selected station + one trailing empty slot
    const rowCount = selected.length + 1;

    for (let i = 0; i < rowCount; i++) {
        const isPrimary = i === 0;
        const isTrailingEmpty = i === selected.length;
        const selectedId = isTrailingEmpty ? null : selected[i];
        const excludeIds = selected.filter((_, idx) => idx !== i);

        const row = document.createElement('div');
        row.className = 'zaehlstellen-row';
        row.dataset.index = String(i);

        const selectWrap = document.createElement('div');
        selectWrap.className = 'custom-select';

        const select = document.createElement('select');
        select.className = 'zaehlstellen-select';
        select.dataset.index = String(i);
        if (isPrimary) {
            select.id = 'zaehlstellen-dropdown';
        } else {
            select.id = `zaehlstellen-dropdown-${i}`;
        }

        const placeholder = isTrailingEmpty || (!isPrimary && !selectedId)
            ? `${i + 1}. Zählstelle hinzufügen`
            : null;

        fillSelectOptions(select, available, selectedId, excludeIds, placeholder);

        selectWrap.appendChild(select);
        row.appendChild(selectWrap);

        // × only on non-primary rows that already have a selection
        if (!isPrimary && selectedId) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'zaehlstellen-remove-btn';
            removeBtn.setAttribute('aria-label', 'Zählstelle entfernen');
            removeBtn.dataset.index = String(i);
            removeBtn.textContent = '×';
            row.appendChild(removeBtn);
        }

        container.appendChild(row);
    }

    const resolved = [];
    container.querySelectorAll('select.zaehlstellen-select').forEach(sel => {
        const v = String(sel.value || '').trim();
        if (v && v !== '__placeholder__') resolved.push(v);
    });
    const finalSelected = resolved.length ? resolved : (available.length ? [String(available[0].id)] : ['default_station']);

    container.classList.toggle('zaehlstellen-container--multi', true);

    return finalSelected.map(String);
}

/** @deprecated Use populateZstDropdowns */
export function populateZstDropdown(zaehlstellen, currentZst, _strtyp) {
    const list = populateZstDropdowns(zaehlstellen, currentZst ? [currentZst] : []);
    return list[0];
}

export const FZG_LABELS = {
    Total: "Total",
    MR: "Motorrad",
    PW: "Personenwagen",
    "PW+": "Personenwagen mit Anhänger",
    Lief: "Lieferwagen",
    "Lief+": "Lieferwagen mit Anhänger",
    "Lief+Aufl.": "Lieferwagen mit Auflieger",
    LW: "Lastwagen",
    "LW+": "Lastwagen mit Anhänger",
    Sattelzug: "Sattelzug",
    Bus: "Bus",
    andere: "nicht klassifizierbare Fahrzeuge"
};

const FZG_KEYS = Object.keys(FZG_LABELS);

export function getAllowedFzgtypsForStation(stationRow) {
    if (!stationRow) return ['Total'];
    const allowed = FZG_KEYS.filter(k => stationRow[k] !== -1 && stationRow[k] != null);
    return allowed.includes('Total') ? allowed : ['Total', ...allowed];
}

export function renderFzgtypButtons(allowed, selected) {
    const wrap = document.getElementById('fzgtyp-buttons');
    if (!wrap) return ['Total'];

    // never render Total as a button
    const allowedRender = (allowed || ['Total']).filter(k => k !== 'Total');

    // normalize selection
    let sel = Array.isArray(selected) ? selected : [selected].filter(Boolean);

    // if URL contains Total, treat it as "no explicit selection"
    sel = sel.filter(v => v !== 'Total');

    // keep only allowed
    const allowedSet = new Set(allowedRender);
    sel = sel.filter(v => allowedSet.has(v));

    // build buttons (no Total)
    wrap.innerHTML = allowedRender.map(k => {
        const id = `fzgtyp-${String(k).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const label = FZG_LABELS[k] || k;
        const checked = sel.includes(k) ? 'checked' : '';
        return `
      <input type="checkbox" id="${id}" name="fzgtyp" value="${k}" ${checked}>
      <label for="${id}">${label}</label>
    `;
    }).join('');

    return sel.length ? sel : ['Total'];
}

export function getSelectedFzgtypsFromButtons() {
    const wrap = document.getElementById('fzgtyp-buttons');
    if (!wrap) return ['Total'];

    const vals = [...wrap.querySelectorAll('input[name="fzgtyp"]:checked')].map(i => i.value);
    return vals.length ? vals : ['Total'];
}

function normalizeFzgKeys(fzgtyp) {
    const list = Array.isArray(fzgtyp) ? fzgtyp : [fzgtyp];
    const cleaned = list.filter(v => v && v !== 'Total');
    return cleaned.length ? cleaned : ['Total'];
}

export function syncFzgtypUI(activeFzgtyp, allowedFzgtyps = [], isDisabled = false) {
    const group  = document.getElementById('fzgtyp-group');
    const openBtn = document.getElementById('fzgtyp-open');
    const panel   = document.getElementById('fzgtyp-panel');

    if (!group || !openBtn || !panel) return;

    const canFilter = Array.isArray(allowedFzgtyps) && allowedFzgtyps.length > 1;

    if (!canFilter) {
        // hide entire block + panel, hard reset button state/text
        // Use visibility instead of display to prevent layout jumping
        group.style.visibility = 'hidden';
        group.style.pointerEvents = 'none';
        group.style.height = '0';
        group.style.overflow = 'hidden';
        panel.classList.add('is-hidden');

        openBtn.classList.remove('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filtern`;
        return;
    }

    // show block
    group.style.visibility = '';
    group.style.pointerEvents = '';
    group.style.height = '';
    group.style.overflow = '';
    
    // Disable/enable based on isDisabled flag
    if (isDisabled) {
        openBtn.disabled = true;
        openBtn.style.opacity = '0.5';
        openBtn.style.cursor = 'not-allowed';
        // Close panel when disabled
        panel.classList.add('is-hidden');
        // Disable all checkboxes in the panel
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.disabled = true;
        });
        const labels = panel.querySelectorAll('label');
        labels.forEach(label => {
            label.style.opacity = '0.5';
            label.style.cursor = 'not-allowed';
        });
    } else {
        openBtn.disabled = false;
        openBtn.style.opacity = '';
        openBtn.style.cursor = '';
        // Enable all checkboxes in the panel
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.disabled = false;
        });
        const labels = panel.querySelectorAll('label');
        labels.forEach(label => {
            label.style.opacity = '';
            label.style.cursor = '';
        });
    }
    
    // Update button text based on selection, but don't control panel visibility
    const arr = Array.isArray(activeFzgtyp) ? activeFzgtyp : [activeFzgtyp];
    const hasSelection = arr.some(v => v && v !== 'Total');

    if (hasSelection) {
        openBtn.classList.add('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filter zurücksetzen`;
    } else {
        openBtn.classList.remove('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filtern`;
    }
    // Note: Panel visibility is now controlled by event listeners, not here
}

// Speed class constants and functions
export const SPEED_LABELS = {
    "<20": "< 20 km/h",
    "20-30": "20-30 km/h",
    "30-40": "30-40 km/h",
    "40-50": "40-50 km/h",
    "50-60": "50-60 km/h",
    "60-70": "60-70 km/h",
    "70-80": "70-80 km/h",
    "80-90": "80-90 km/h",
    "90-100": "90-100 km/h",
    "100-110": "100-110 km/h",
    "110-120": "110-120 km/h",
    "120-130": "120-130 km/h",
    ">130": "> 130 km/h"
};

const SPEED_KEYS = Object.keys(SPEED_LABELS);

export async function getAllowedSpeedClassesForStation(zst) {
    const speedStations = await loadSpeedStations();
    const stationRow = speedStations.find(r => String(r.Zst_id) === String(zst));
    if (!stationRow) return [];
    const allowed = SPEED_KEYS.filter(k => stationRow[k] !== -1 && stationRow[k] != null);
    return allowed.length > 0 ? allowed : [];
}

export function renderSpeedButtons(allowed, selected) {
    const wrap = document.getElementById('speed-buttons');
    if (!wrap) return ['Total'];

    // never render Total as a button
    const allowedRender = (allowed || []).filter(k => k !== 'Total');

    // normalize selection
    let sel = Array.isArray(selected) ? selected : [selected].filter(Boolean);

    // if URL contains Total, treat it as "no explicit selection"
    sel = sel.filter(v => v !== 'Total');

    // keep only allowed
    const allowedSet = new Set(allowedRender);
    sel = sel.filter(v => allowedSet.has(v));

    // build buttons (no Total)
    wrap.innerHTML = allowedRender.map(k => {
        const id = `speed-${String(k).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const label = SPEED_LABELS[k] || k;
        const checked = sel.includes(k) ? 'checked' : '';
        return `
      <input type="checkbox" id="${id}" name="speed" value="${k}" ${checked}>
      <label for="${id}">${label}</label>
    `;
    }).join('');

    return sel.length ? sel : ['Total'];
}

export function getSelectedSpeedClassesFromButtons() {
    const wrap = document.getElementById('speed-buttons');
    if (!wrap) return ['Total'];

    const vals = [...wrap.querySelectorAll('input[name="speed"]:checked')].map(i => i.value);
    return vals.length ? vals : ['Total'];
}

function normalizeSpeedKeys(speed) {
    const list = Array.isArray(speed) ? speed : [speed];
    const cleaned = list.filter(v => v && v !== 'Total');
    return cleaned.length ? cleaned : ['Total'];
}

export function syncSpeedUI(activeSpeed, allowedSpeedClasses = [], isDisabled = false) {
    const group  = document.getElementById('speed-group');
    const openBtn = document.getElementById('speed-open');
    const panel   = document.getElementById('speed-panel');

    if (!group || !openBtn || !panel) return;

    const canFilter = Array.isArray(allowedSpeedClasses) && allowedSpeedClasses.length > 0;

    if (!canFilter) {
        // hide entire block + panel, hard reset button state/text
        // Use visibility instead of display to prevent layout jumping
        group.style.visibility = 'hidden';
        group.style.pointerEvents = 'none';
        group.style.height = '0';
        group.style.overflow = 'hidden';
        panel.classList.add('is-hidden');

        openBtn.classList.remove('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filtern`;
        return;
    }

    // show block
    group.style.visibility = '';
    group.style.pointerEvents = '';
    group.style.height = '';
    group.style.overflow = '';
    
    // Disable/enable based on isDisabled flag
    if (isDisabled) {
        openBtn.disabled = true;
        openBtn.style.opacity = '0.5';
        openBtn.style.cursor = 'not-allowed';
        // Close panel when disabled
        panel.classList.add('is-hidden');
        // Disable all checkboxes in the panel
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.disabled = true;
        });
        const labels = panel.querySelectorAll('label');
        labels.forEach(label => {
            label.style.opacity = '0.5';
            label.style.cursor = 'not-allowed';
        });
    } else {
        openBtn.disabled = false;
        openBtn.style.opacity = '';
        openBtn.style.cursor = '';
        // Enable all checkboxes in the panel
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.disabled = false;
        });
        const labels = panel.querySelectorAll('label');
        labels.forEach(label => {
            label.style.opacity = '';
            label.style.cursor = '';
        });
    }
    
    // Update button text based on selection, but don't control panel visibility
    const arr = Array.isArray(activeSpeed) ? activeSpeed : [activeSpeed];
    const hasSelection = arr.some(v => v && v !== 'Total');

    if (hasSelection) {
        openBtn.classList.add('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filter zurücksetzen`;
    } else {
        openBtn.classList.remove('is-active');
        openBtn.innerHTML = `<img src="../img/filter.svg" class="filter-icon"> Filtern`;
    }
    // Note: Panel visibility is now controlled by event listeners, not here
}

export function filterToSelectedTimeRange(dailyDataRows, timeRange) {
    const [start, end] = timeRange;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Using Year and Month columns for filtering
    return dailyDataRows.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate && rowDate < endDate;
    });
}

export function extractDailyTraffic(stationRows, filterKeys) {
    const TrafficPerDay = {};
    let minDate = new Date('9999-12-31');
    let maxDate = new Date('0000-01-01');

    stationRows.forEach(row => {
        const dateTimestamp = new Date(row.Date);
        minDate = dateTimestamp < minDate ? dateTimestamp : minDate;
        maxDate = dateTimestamp > maxDate ? dateTimestamp : maxDate;

        // Convert date to ISO string for consistent key usage
        const dateKey = dateTimestamp.toISOString().split('T')[0]; // Use only the date part
        const keys = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
        const totalTraffic = keys.reduce((sum, k) => sum + (row[k] ?? 0), 0);

        if (!TrafficPerDay[dateKey]) {
            TrafficPerDay[dateKey] = null;
        }
        if (totalTraffic == null || isNaN(totalTraffic)) return;
        TrafficPerDay[dateKey] += totalTraffic;
    });

    // Convert TrafficPerDay to the required format
    const dailyTraffic = Object.entries(TrafficPerDay).map(([date, total]) => {
        return [Date.parse(date), total];
    });

    return {dailyTraffic, minDate, maxDate};
}

/**
 * Determines, for each day, whether all underlying hourly values are validiert.
 * Uses the `ValueApproved` column from the daily CSV:
 * - Daily files have 24 hourly values; `ValueApproved === 24` means fully validiert.
 * - If any row for a given date has `ValueApproved < 24`, the whole day is treated as not fully validiert.
 *
 * @param {Object[]} stationRows - CSV rows for a single counting station (daily file)
 * @returns {Array<[number, boolean]>} Array of `[timestamp, fullyApproved]` per date
 */
export function extractDailyApproval(stationRows) {
    const approvalPerDay = {};

    stationRows.forEach(row => {
        if (!row.Date) return;
        const dateTimestamp = new Date(row.Date);
        const dateKey = dateTimestamp.toISOString().split('T')[0];

        // Column in the CSV is called "ValuesApproved" (number of approved hourly values)
        const approved = row.ValuesApproved;

        if (approved == null || isNaN(approved)) return;

        if (!approvalPerDay[dateKey]) {
            approvalPerDay[dateKey] = {
                fullyApproved: approved >= 24,
                minApproved: approved,
                maxApproved: approved
            };
        } else {
            // If any contributing row for that date has less than 24 approved values,
            // the entire day should be flagged as not fully validiert.
            if (approved < 24) {
                approvalPerDay[dateKey].fullyApproved = false;
            }
            approvalPerDay[dateKey].minApproved = Math.min(approvalPerDay[dateKey].minApproved, approved);
            approvalPerDay[dateKey].maxApproved = Math.max(approvalPerDay[dateKey].maxApproved, approved);
        }
    });

    const result = Object.entries(approvalPerDay).map(([date, info]) => [
        Date.parse(date),
        info.fullyApproved
    ]);

    return result;
}

/**
 * Computes, per year and per direction, how many days are not fully validiert.
 * A day/direction is treated as not fully validiert if any row for that
 * Date + DirectionName has ValuesApproved < 24.
 *
 * @param {Object[]} stationRows - Daily CSV rows for a single counting station
 * @returns {{ byDirection: Record<string, Record<number, number>>, total: Record<number, number> }}
 */
export function computeYearlyUnapprovedDays(stationRows) {
    // First aggregate by (date, direction) so we don't double-count lanes
    const byDateDir = new Map();

    stationRows.forEach(row => {
        if (!row.Date || !row.DirectionName) return;
        const dateKey = row.Date;
        const dir = row.DirectionName;
        const key = `${dateKey}::${dir}`;

        const approved = row.ValuesApproved;
        if (approved == null || isNaN(approved)) return;

        const fullyApproved = approved >= 24;

        if (!byDateDir.has(key)) {
            byDateDir.set(key, fullyApproved);
        } else if (!fullyApproved) {
            // If any row is not fully approved, the whole day+direction is not approved
            byDateDir.set(key, false);
        }
    });

    const byDirection = {};
    const total = {};

    byDateDir.forEach((fullyApproved, key) => {
        const [dateStr, dir] = key.split('::');
        const year = new Date(dateStr).getFullYear();

        if (!byDirection[dir]) {
            byDirection[dir] = {};
        }
        if (!byDirection[dir][year]) {
            byDirection[dir][year] = 0;
        }
        if (!total[year]) {
            total[year] = 0;
        }

        if (!fullyApproved) {
            byDirection[dir][year] += 1;
            total[year] += 1;
        }
    });

    return { byDirection, total };
}


export function extractDailyWeatherData(weatherRows, minDate, maxDate) {
    const dailyTemp = [];
    const dailyPrec = [];
    const dailyTempRange = [];

    weatherRows.forEach(row => {
        const date = new Date(row.Date);
        if (date < minDate || date > maxDate) return;

        const timestamp = Date.parse(date);
        const temp = row.temp_c || null;
        const prec = row.prec_mm || 0;
        const tempMin = row.temp_min || null;
        const tempMax = row.temp_max || null;

        // Push individual values
        dailyTemp.push([timestamp, temp]);
        dailyPrec.push([timestamp, prec]);
        dailyTempRange.push([timestamp, tempMin, tempMax]); // Combine min and max into a range
    });

    return { dailyTemp, dailyPrec, dailyTempRange };
}

export function extractMonthlyTraffic(monthlyDataRows, filterKeys) {
    // Normalize keys - handle both fzgtyp and speed keys
    const list = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
    const keys = list.filter(v => v && v !== 'Total');
    const normalizedKeys = keys.length ? keys : ['Total'];
    
    const monthlyTraffic = {};

    monthlyDataRows.forEach(row => {
        const date = new Date(row.Year, row.Month);

        const total = normalizedKeys.reduce((sum, k) => sum + (row[k] ?? 0), 0);
        if (!total || isNaN(total)) return;

        const key = Date.parse(date); // stable key
        if (!monthlyTraffic[key]) monthlyTraffic[key] = 0;
        monthlyTraffic[key] += total;
    });

    return Object.entries(monthlyTraffic).map(([ts, total]) => [Number(ts), total]);
}

export function extractYearlyTraffic(stationRows, filterKeys) {
    const yearlyTraffic = {};
    let minYear = 9999;
    let maxYear = 0;
    const directionNames = new Set();

    stationRows.forEach(row => {
        const year = row.Year;
        const keyList = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
        const totalTraffic = keyList.reduce((sum, k) => {
            const v = row[k];
            return (v == null || v === -1 || isNaN(v)) ? sum : sum + v;
        }, 0);
        const numMeasures = row.NumMeasures;
        const directionName = row.DirectionName || 'Unknown';
        directionNames.add(directionName);

        if (!yearlyTraffic[year]) {
            yearlyTraffic[year] = {
                directions: {},
                allDirections: { total: 0, numMeasures: 0 }
            };
        }

        if (totalTraffic && !isNaN(totalTraffic)) {
            if (!yearlyTraffic[year].directions[directionName]) {
                yearlyTraffic[year].directions[directionName] = { total: 0, numMeasures: 0 };
            }

            yearlyTraffic[year].directions[directionName].total += totalTraffic;
            yearlyTraffic[year].directions[directionName].numMeasures = Math.max(yearlyTraffic[year].directions[directionName].numMeasures, numMeasures);

            yearlyTraffic[year].allDirections.total += totalTraffic;
            yearlyTraffic[year].allDirections.numMeasures = Math.max(yearlyTraffic[year].allDirections.numMeasures, numMeasures);

            minYear = Math.min(minYear, year);
            maxYear = Math.max(maxYear, year);
        }
    });

    const dailyAvgPerYearTotal = [];
    const dailyAvgPerYearByDirection = {};

    for (const dir of directionNames) {
        dailyAvgPerYearByDirection[dir] = [];
    }

    for (const year in yearlyTraffic) {
        const y = parseInt(year, 10);
        const baseDate = Date.UTC(y, 0, 1);

        // Track if any direction is null
        let hasNullInDirections = false;

        // Per direction
        for (const dir of directionNames) {
            const dirData = yearlyTraffic[year].directions[dir];
            const val = dirData && dirData.total > 0 ? dirData.total : null;

            // If we find a null in any direction, note it
            if (val === null) {
                hasNullInDirections = true;
            }
            dailyAvgPerYearByDirection[dir].push([baseDate, val]);
        }

        // If one direction is null, totalAll becomes null
        const totalAll = yearlyTraffic[year].allDirections.total;
        dailyAvgPerYearTotal.push([
            baseDate,
            hasNullInDirections ? null : (totalAll > 0 ? totalAll : null)
        ]);
    }


    // Sort arrays by date
    dailyAvgPerYearTotal.sort((a, b) => a[0] - b[0]);
    for (const dir in dailyAvgPerYearByDirection) {
        dailyAvgPerYearByDirection[dir].sort((a, b) => a[0] - b[0]);
    }

    // Number of days measured per year (for all directions)
    const numDaysPerYear = Object.entries(yearlyTraffic).map(([year, data]) => {
        const numDays = data.allDirections.numMeasures / 24;
        return [Date.UTC(year, 0, 1), numDays];
    });
    numDaysPerYear.sort((a, b) => a[0] - b[0]);

    // Number of days measured per year per direction
    const numDaysPerYearByDirection = {};
    for (const dir of directionNames) {
        numDaysPerYearByDirection[dir] = [];
    }

    for (const year in yearlyTraffic) {
        const y = parseInt(year, 10);
        const baseDate = Date.UTC(y, 0, 1);

        for (const dir of directionNames) {
            const dirData = yearlyTraffic[year].directions[dir];
            const numDays = dirData && dirData.numMeasures > 0 
                ? dirData.numMeasures / 24 
                : 0;
            numDaysPerYearByDirection[dir].push([baseDate, numDays]);
        }
    }

    // Sort per-direction arrays by date
    for (const dir in numDaysPerYearByDirection) {
        numDaysPerYearByDirection[dir].sort((a, b) => a[0] - b[0]);
    }

    return {
        dailyAvgPerYearTotal,
        dailyAvgPerYearByDirection,
        numDaysPerYear,
        numDaysPerYearByDirection,
        directionNames: Array.from(directionNames),
        minYear,
        maxYear
    };
}

export function extractYearlyTemperature(temperatureRows, minYear, maxYear) {
    const yearlyTemperature = [];

    temperatureRows.forEach(row => {
        const year = row.Year;
        if (year < minYear || year > maxYear) return;
        const temperature = row.temp_c;

        yearlyTemperature.push([Date.UTC(year, 0, 1), temperature]);
    });
    return yearlyTemperature;
}

export function compute7DayRollingAverage(data) {
    // data is an array of [date, total], sorted by date
    const result = [];
    const values = data.map(([date, total]) => ({ date: parseInt(date, 10), total }));

    // Sort the data by date
    values.sort((a, b) => a.date - b.date);

    for (let i = 0; i < values.length; i++) {
        let sum = 0;
        let count = 0;

        // Sum over the previous 7 days including current day
        for (let j = i; j >= 0 && j >= i - 6; j--) {
            if (values[j].total !== null && values[j].total !== undefined) {
                sum += values[j].total;
                count++;
            }
        }
        const average = count > 0 ? sum / count : null;
        result.push([values[i].date, average]);
    }
    return result;
}

export function mergeHourlyTables(tables) {
    const byKey = new Map();

    for (const rows of tables) {
        for (const r of rows) {
            const key = `${r.Date}#${r.DirectionName ?? ''}#${r.LaneName ?? ''}`;

            if (!byKey.has(key)) {
                // clone and zero out 0..23
                const base = { ...r };
                for (let h = 0; h < 24; h++) base[h] = 0;
                byKey.set(key, base);
            }

            const acc = byKey.get(key);
            for (let h = 0; h < 24; h++) {
                const v = r[h];
                if (v != null && v !== -1 && !isNaN(v)) acc[h] += v;
            }
        }
    }

    return [...byKey.values()];
}

/**
 * Aggregates hourly traffic data by date, direction, and hour.
 *
 * This function processes traffic data from multiple dates. It:
 * 1. Filters data based on whether the date falls on a weekday or weekend/holiday,
 *    depending on the flags `MoFr` (Monday-Friday) and `SaSo` (Saturday-Sunday).
 * 2. For each valid date, direction, and hour, it sums up the traffic counts.
 * 3. It then produces several useful data structures:
 *    - `aggregatedData`: An array of objects, each representing a single combination
 *      of date, hour, and direction, along with a total and the number of distinct days encountered.
 *    - `hourlyTotalsPerHourPerDirection`: An object where keys are directionNames and hours,
 *      and values are arrays of summed traffic counts from each date.
 *    - `hourlyTotalsPerHourTotal`: An object keyed by hour, holding arrays of summed total traffic counts (all directions) for each date.
 *    - `directionNames`: An array of all directions encountered.
 *
 * Data Structures:
 * - hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour] = [...values]
 * - hourlyTotalsPerHourTotalPerDate[dateStr][hour] = [...values]
 *
 * After processing:
 * - hourlyTotalsPerHourPerDirection[directionName][hour] = [sumForDate1, sumForDate2, ...]
 * - hourlyTotalsPerHourTotal[hour] = [sumForDate1, sumForDate2, ...]
 *
 * @param {Array} stationRows - Array of station rows, each containing a Date, a DirectionName, and 24 hourly traffic values.
 * @param {boolean} [MoFr=true] - Include Monday through Friday data.
 * @param {boolean} [SaSo=true] - Include Saturday and Sunday data.
 * @returns {Object} The result object with:
 *   - aggregatedData: Array of aggregated results (date, hour, direction, total, numberOfDays)
 *   - hourlyTotalsPerHourPerDirection: Hourly aggregated totals per direction, arrays of sums for each hour.
 *   - hourlyTotalsPerHourTotal: Hourly aggregated totals across all directions, arrays of sums for each hour.
 *   - directionNames: Array of all encountered direction names.
 */
/**
 * Whether the Verteilung (boxplot/scatter) section is currently expanded.
 */
export function isVerteilungOpen() {
    return !document.body.classList.contains('verteilung-collapsed');
}

/**
 * True when the selected time range exceeds the performance threshold for the view.
 * Stundenansicht: > 3 months; Wochen-/Monatsansicht: > 6 years.
 */
export function isZeitraumOverPerfThreshold(timeRange, viewMode) {
    if (!timeRange || timeRange.length < 2 || timeRange[0] == null || timeRange[1] == null) {
        return false;
    }
    const start = new Date(timeRange[0]);
    const end = new Date(timeRange[1]);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return false;
    }

    if (viewMode === 'hourly') {
        const threshold = new Date(start);
        threshold.setMonth(threshold.getMonth() + 3);
        return end > threshold;
    }

    if (viewMode === 'weekly' || viewMode === 'monthly') {
        const threshold = new Date(start);
        threshold.setFullYear(threshold.getFullYear() + 6);
        return end > threshold;
    }

    return false;
}

export function aggregateHourlyTraffic(stationRows, MoFr = true, SaSo = true, includeDistribution = true) {
    // Tracks totals for each unique (date, hour, direction) combination
    // Key format: "dateStr#hour#directionName"
    // { total: number, days: Set of dateStrs }
    const hourlyTraffic = {};
    const hourlyScatterPerDirection = {};
    const hourlyScatterTotal = {};

    // Temporaries for storing raw data before summation:
    // These keep arrays of values that we will sum up later.
    const hourlyTotalsPerHourPerDirectionPerDate = {};
    const hourlyTotalsPerHourTotalPerDate = {};

    // Final aggregated structures:
    // After summation, these will store arrays of sums (one element per date) indexed by hour.
    const hourlyTotalsPerHourPerDirection = {};
    const hourlyTotalsPerHourTotal = {};
    const directionNames = new Set();

    // Process each row of traffic data
    stationRows.forEach(row => {
        const dateStr = row.Date;
        const weekday = new Date(dateStr).getDay(); // Sunday=0, Monday=1, ..., Saturday=6

        // Check if the date fits the desired filter (Mo-Fr and/or Sa-So)
        const isValidDay =
            (MoFr && weekday >= 1 && weekday <= 5) ||
            (SaSo && (weekday === 0 || weekday === 6));

        // Only proceed if the day is valid
        if (isValidDay) {
            const directionName = row.DirectionName;

            // Loop through each hour of the day
            for (let hour = 0; hour < 24; hour++) {
                const total = parseFloat(row[hour] || null);

                // Skip if no valid traffic count
                if (!total || isNaN(total)) continue;

                // Create a unique key for this date, hour, and direction
                const key = `${hour}#${directionName}`;

                // Aggregate into hourlyTraffic (days = distinct calendar days, not lane-rows)
                if (!hourlyTraffic[key]) {
                    hourlyTraffic[key] = { total: 0, days: new Set() };
                }
                hourlyTraffic[key].total += total;
                hourlyTraffic[key].days.add(dateStr);
                directionNames.add(directionName);

                if (!includeDistribution) continue;

                // Build the direction-per-date-per-hour structure
                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName] = {};
                }
                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr] = {};
                }
                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour] = [];
                }
                hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour].push(total);

                // Build the total-per-date-per-hour structure
                if (!hourlyTotalsPerHourTotalPerDate[dateStr]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr] = {};
                }
                if (!hourlyTotalsPerHourTotalPerDate[dateStr][hour]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr][hour] = [];
                }
                hourlyTotalsPerHourTotalPerDate[dateStr][hour].push(total);
            }
        }
    });

    if (includeDistribution) {
    // Sum up the arrays of traffic values for each combination
    // For directions:
    for (const directionName in hourlyTotalsPerHourPerDirectionPerDate) {
        for (const dateStr in hourlyTotalsPerHourPerDirectionPerDate[directionName]) {
            if (!hourlyTotalsPerHourPerDirection[directionName]) {
                hourlyTotalsPerHourPerDirection[directionName] = {};
            }
            for (const hour in hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr]) {
                const values = hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour];
                const sum = values.reduce((acc, val) => acc + val, null);

                if (!hourlyTotalsPerHourPerDirection[directionName][hour]) {
                    hourlyTotalsPerHourPerDirection[directionName][hour] = [];
                }
                hourlyTotalsPerHourPerDirection[directionName][hour].push(sum);

                if (!hourlyScatterPerDirection[directionName]) {
                    hourlyScatterPerDirection[directionName] = {};
                }
                if (!hourlyScatterPerDirection[directionName][hour]) {
                    hourlyScatterPerDirection[directionName][hour] = [];
                }
                hourlyScatterPerDirection[directionName][hour].push({
                    date: Date.parse(dateStr),
                    value: sum
                });
            }
        }
    }

    // For totals (all directions combined):
    for (const dateStr in hourlyTotalsPerHourTotalPerDate) {
        for (const hour in hourlyTotalsPerHourTotalPerDate[dateStr]) {
            const values = hourlyTotalsPerHourTotalPerDate[dateStr][hour];
            const sum = values.reduce((acc, val) => acc + val, null);

            if (!hourlyTotalsPerHourTotal[hour]) {
                hourlyTotalsPerHourTotal[hour] = [];
            }
            hourlyTotalsPerHourTotal[hour].push(sum);

            if (!hourlyScatterTotal[hour]) {
                hourlyScatterTotal[hour] = [];
            }
            hourlyScatterTotal[hour].push({
                date: Date.parse(dateStr),
                value: sum
            });
        }
    }
    }

    // Convert `hourlyTraffic` into a more user-friendly array, `aggregatedData`
    const aggregatedData = Object.entries(hourlyTraffic).map(([key, data]) => {
        const [ hourStr, directionName] = key.split('#');
        const hour = parseInt(hourStr, 10);

        return {
            hour: Date.UTC(1970, 0, 1, hour),
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    // Return all the computed structures
    return {
        aggregatedData,
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames: Array.from(directionNames),
        hourlyScatterPerDirection,
        hourlyScatterTotal
    };
}


/**
 * Aggregates daily traffic data by weekday and direction, introducing per-date arrays before summation.
 *
 * Data Flow:
 * - First, filter the data by day type (Mo-Fr, Sa-So).
 * - For each valid entry, store raw daily values into per-direction and total structures,
 *   including new per-date structures:
 *   - dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday] = [values]
 *   - dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday] = [values]
 * - After all data is collected, sum each date's values and push them into:
 *   - dailyTotalsPerWeekdayPerDirection[directionName][weekday] (final per-direction sums)
 *   - dailyTotalsPerWeekdayTotal[weekday] (final total sums)
 *
 * Returns:
 *   - aggregatedData: array of objects with total traffic per weekday/direction and numberOfDays
 *   - directionNames: all encountered directions
 *   - dailyTotalsPerWeekdayPerDirection: final aggregated sums per direction and weekday (array of sums from each date)
 *   - dailyTotalsPerWeekdayTotal: final aggregated sums per weekday (array of sums from each date)
 *
 * @param {Array} stationRows - Array of data rows with {Date, DirectionName, fzgtyp}
 * @param {string} fzgtyp - Property name to access traffic values in stationRows.
 * @param {boolean} [MoFr=true] - Include Monday-Friday data
 * @param {boolean} [SaSo=true] - Include Saturday-Sunday data
 * @returns {Object}
 */
export function aggregateWeeklyTraffic(stationRows, filterKeys, MoFr = true, SaSo = true, includeDistribution = true) {
    const weeklyTraffic = {};
    const directionNames = new Set();

    // Temporary detailed structures to hold raw values before summation:
    const dailyTotalsPerWeekdayPerDirectionPerDate = {};
    const dailyTotalsPerWeekdayTotalPerDate = {};

    // Final aggregated structures (after summation):
    const dailyTotalsPerWeekdayPerDirection = {};
    const dailyTotalsPerWeekdayTotal = {};

    // Scatter data structure
    const dailyScatterPerWeekdayPerDirection = {};
    const dailyScatterPerWeekdayTotal = {};

    // Normalize keys - handle both fzgtyp and speed keys
    const list = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
    const keys = list.filter(v => v && v !== 'Total');
    const normalizedKeys = keys.length ? keys : ['Total'];

    stationRows.forEach(row => {
        const total = normalizedKeys.reduce((sum, k) => sum + (row[k] ?? 0), 0);
        // Skip row if no valid traffic count
        if (!total || isNaN(total)) return;
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const weekday = (date.getDay() + 6) % 7; // Monday=0 ... Sunday=6
        const directionName = row.DirectionName;

        const isWeekday = weekday >= 0 && weekday <= 4; // Mon-Fri
        const isWeekend = weekday === 5 || weekday === 6; // Sat-Sun

        // Filter by Mo-Fr / Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${weekday}#${directionName}`;

            if (!weeklyTraffic[key]) {
                weeklyTraffic[key] = { total: 0, days: new Set() };
            }
            weeklyTraffic[key].total += total;
            weeklyTraffic[key].days.add(dateStr);
            directionNames.add(directionName);

            if (!includeDistribution) return;

            // Collect raw data per direction per date and weekday
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName] = {};
            }
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr] = {};
            }
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday] = [];
            }
            dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday].push(total);


            // Collect raw data total per date and weekday
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday] = [];
            }
            dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday].push(total);
        }
    });

    if (includeDistribution) {
    // Now sum up the per-date arrays and push into final aggregated structures
    // For direction-level aggregation:
    for (const directionName in dailyTotalsPerWeekdayPerDirectionPerDate) {
        if (!dailyTotalsPerWeekdayPerDirection[directionName]) {
            dailyTotalsPerWeekdayPerDirection[directionName] = {};
        }
        for (const dateStr in dailyTotalsPerWeekdayPerDirectionPerDate[directionName]) {
            for (const weekday in dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr]) {
                const arr = dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday];
                const sum = arr.reduce((acc, val) => acc + val, null);

                if (!dailyTotalsPerWeekdayPerDirection[directionName][weekday]) {
                    dailyTotalsPerWeekdayPerDirection[directionName][weekday] = [];
                }
                dailyTotalsPerWeekdayPerDirection[directionName][weekday].push(sum);

                if (!dailyScatterPerWeekdayPerDirection[directionName]) {
                    dailyScatterPerWeekdayPerDirection[directionName] = {};
                }
                if (!dailyScatterPerWeekdayPerDirection[directionName][weekday]) {
                    dailyScatterPerWeekdayPerDirection[directionName][weekday] = [];
                }
                dailyScatterPerWeekdayPerDirection[directionName][weekday].push({
                    date: Date.parse(dateStr),
                    value: sum
                });
            }
        }
    }

    // For total-level aggregation:
    for (const dateStr in dailyTotalsPerWeekdayTotalPerDate) {
        for (const weekday in dailyTotalsPerWeekdayTotalPerDate[dateStr]) {
            const arr = dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday];
            const sum = arr.reduce((acc, val) => acc + val, null);

            if (!dailyTotalsPerWeekdayTotal[weekday]) {
                dailyTotalsPerWeekdayTotal[weekday] = [];
            }
            dailyTotalsPerWeekdayTotal[weekday].push(sum);

            if (!dailyScatterPerWeekdayTotal[weekday]) {
                dailyScatterPerWeekdayTotal[weekday] = [];
            }
            dailyScatterPerWeekdayTotal[weekday].push({
                date: Date.parse(dateStr),
                value: sum
            });
        }
    }
    }

    // Convert aggregated results into a more usable array
    const aggregatedData = Object.entries(weeklyTraffic).map(([key, data]) => {
        const [weekdayStr, directionName] = key.split('#');
        const weekday = parseInt(weekdayStr, 10);
        return {
            weekday,
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal,
        dailyScatterPerWeekdayPerDirection,
        dailyScatterPerWeekdayTotal
    };
}



/**
 * Aggregates daily traffic data by month and direction, introducing per-date arrays before summation.
 *
 * Data Flow:
 * - Filter data by day type (Mo-Fr, Sa-So).
 * - For each valid entry, store raw daily values into per-direction and total structures,
 *   including new per-date structures:
 *   - dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month] = [values]
 *   - dailyTotalsPerMonthTotalPerDate[dateStr][month] = [values]
 * - After collecting all data, sum each date's values and push them into:
 *   - dailyTotalsPerMonthPerDirection[directionName][month] (final per-direction sums)
 *   - dailyTotalsPerMonthTotal[month] (final total sums)
 *
 * @param {Array} stationRows - Array of data rows with {Date, DirectionName, fzgtyp}
 * @param {string} fzgtyp - Property name to access traffic values in stationRows.
 * @param {boolean} [MoFr=true] - Include Monday-Friday data
 * @param {boolean} [SaSo=true] - Include Saturday-Sunday data
 * @returns {Object}
 *   aggregatedData: Array of { month, directionName, total, numberOfDays }
 *   directionNames: Array of encountered directions
 *   dailyTotalsPerMonthPerDirection: final aggregated sums per direction and month (array of sums from each date)
 *   dailyTotalsPerMonthTotal: final aggregated sums per month (array of sums from each date)
 */
export function aggregateMonthlyTraffic(stationRows, filterKeys, MoFr = true, SaSo = true, includeDistribution = true) {
    const monthlyTraffic = {};
    const directionNames = new Set();

    // Temporary structures to hold raw daily values before summation:
    const dailyTotalsPerMonthPerDirectionPerDate = {};
    const dailyTotalsPerMonthTotalPerDate = {};

    // Final aggregated structures (after summation):
    const dailyTotalsPerMonthPerDirection = {};
    const dailyTotalsPerMonthTotal = {};

    // Scatter data structure
    const dailyScatterPerMonthPerDirection = {};

    // Normalize keys - handle both fzgtyp and speed keys
    const list = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
    const keys = list.filter(v => v && v !== 'Total');
    const normalizedKeys = keys.length ? keys : ['Total'];

    stationRows.forEach(row => {
        const total = normalizedKeys.reduce((sum, k) => sum + (row[k] ?? 0), 0);
        // Skip row if no valid traffic count
        if (!total || isNaN(total)) return;
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const month = date.getMonth(); // 0=January ... 11=December
        const weekday = date.getDay(); // Sunday=0 ... Saturday=6
        const directionName = row.DirectionName;

        const isWeekday = weekday >= 1 && weekday <= 5; // Monday to Friday
        const isWeekend = weekday === 0 || weekday === 6; // Sunday, Saturday

        // Filter by Mo-Fr and Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${month}#${directionName}`;

            if (!monthlyTraffic[key]) {
                monthlyTraffic[key] = { total: 0, days: new Set() };
            }
            monthlyTraffic[key].total += total;
            monthlyTraffic[key].days.add(dateStr);
            directionNames.add(directionName);

            if (!includeDistribution) return;

            // Collect raw data per direction per date and month
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName] = {};
            }
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr] = {};
            }
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month] = [];
            }
            dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month].push(total);

            // Collect raw data total per date and month
            if (!dailyTotalsPerMonthTotalPerDate[dateStr]) {
                dailyTotalsPerMonthTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerMonthTotalPerDate[dateStr][month]) {
                dailyTotalsPerMonthTotalPerDate[dateStr][month] = [];
            }
            dailyTotalsPerMonthTotalPerDate[dateStr][month].push(total);

        }
    });

    if (includeDistribution) {
    // Sum up per-date arrays for direction-level aggregation
    for (const directionName in dailyTotalsPerMonthPerDirectionPerDate) {
        if (!dailyTotalsPerMonthPerDirection[directionName]) {
            dailyTotalsPerMonthPerDirection[directionName] = {};
        }
        for (const dateStr in dailyTotalsPerMonthPerDirectionPerDate[directionName]) {
            for (const month in dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr]) {
                const arr = dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month];
                const sum = arr.reduce((acc, val) => acc + val, null);

                if (!dailyTotalsPerMonthPerDirection[directionName][month]) {
                    dailyTotalsPerMonthPerDirection[directionName][month] = [];
                }
                dailyTotalsPerMonthPerDirection[directionName][month].push(sum);

                if (!dailyScatterPerMonthPerDirection[directionName]) {
                    dailyScatterPerMonthPerDirection[directionName] = {};
                }
                if (!dailyScatterPerMonthPerDirection[directionName][month]) {
                    dailyScatterPerMonthPerDirection[directionName][month] = [];
                }
                dailyScatterPerMonthPerDirection[directionName][month].push({
                    date: Date.parse(dateStr),
                    value: sum
                });
            }
        }
    }

    // Sum up per-date arrays for total-level aggregation
    for (const dateStr in dailyTotalsPerMonthTotalPerDate) {
        for (const month in dailyTotalsPerMonthTotalPerDate[dateStr]) {
            const arr = dailyTotalsPerMonthTotalPerDate[dateStr][month];
            const sum = arr.reduce((acc, val) => acc + val, null);

            if (!dailyTotalsPerMonthTotal[month]) {
                dailyTotalsPerMonthTotal[month] = [];
            }
            dailyTotalsPerMonthTotal[month].push(sum);
        }
    }
    }

    // Convert aggregated results into a user-friendly array
    const aggregatedData = Object.entries(monthlyTraffic).map(([key, data]) => {
        const [monthStr, directionName] = key.split('#');
        const month = parseInt(monthStr, 10);
        return {
            month,
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerMonthPerDirection,
        dailyTotalsPerMonthTotal,
        dailyScatterPerMonthPerDirection
    };
}


/**
 * Aggregates monthly weather data from daily rows, filtered by the given time range.
 * - Temperature: Average of daily average temperatures per month
 * - Precipitation: Sum of all daily precipitation values per month
 * - Temperature Range: Minimum and maximum temperatures per month
 *
 * @param {Object[]} dailyTempRows - Array of row objects for daily data
 * @param {[number, number]} timeRange - Array with two timestamps [start, end]
 * @returns {Object} An object containing arrays monthlyTemperatures, monthlyPrecipitations,
 *                   and monthlyTempRanges (index 0 = January, ..., 11 = December)
 */
export function aggregateMonthlyWeather(dailyTempRows, timeRange) {
    const startDate = new Date(timeRange[0]);
    const endDate = new Date(timeRange[1]);

    // Initialize accumulators for temperature, precipitation, and ranges
    const monthlyTempsAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0, min: Infinity, max: -Infinity }));
    const monthlyPrecipAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));

    dailyTempRows.forEach(row => {
        // Parse the date from the row
        const date = new Date(row.Date);

        // Check if the date is within the specified time range
        if (date < startDate || date >= endDate) return;

        // Extract month index (0-based)
        const monthIndex = date.getMonth();

        // Parse temperature and precipitation
        const temp = parseFloat(row.temp_c);
        const precip = parseFloat(row.prec_mm);
        const tempMin = parseFloat(row.temp_min);
        const tempMax = parseFloat(row.temp_max);

        // Accumulate average temperature if valid
        if (!isNaN(temp)) {
            monthlyTempsAccum[monthIndex].sum += temp;
            monthlyTempsAccum[monthIndex].count += 1;
        }

        // Track minimum temperature for the month
        if (!isNaN(tempMin) && tempMin < monthlyTempsAccum[monthIndex].min) {
            monthlyTempsAccum[monthIndex].min = tempMin;
        }

        // Track maximum temperature for the month
        if (!isNaN(tempMax) && tempMax > monthlyTempsAccum[monthIndex].max) {
            monthlyTempsAccum[monthIndex].max = tempMax;
        }

        // Accumulate precipitation data if valid
        if (!isNaN(precip)) {
            monthlyPrecipAccum[monthIndex].sum += precip;
            monthlyPrecipAccum[monthIndex].count += 1;
        }
    });

    // Compute monthly average temperature (sum of daily averages / number of days with data)
    const monthlyTemperatures = monthlyTempsAccum.map(m => (m.count > 0 ? m.sum / m.count : null));

    // Compute monthly total precipitation (sum of daily precipitation values)
    const monthlyPrecipitations = monthlyPrecipAccum.map(m => (m.count > 0 ? m.sum : null));

    // Compute monthly temperature range (min and max temperatures)
    const monthlyTempRange = monthlyTempsAccum.map(m => (m.count > 0 ? [m.min, m.max] : [null, null]));
    return { monthlyTemperatures, monthlyTempRange, monthlyPrecipitations};
}


export function processHourlyBoxPlotData(
    hourlyTotalsPerHourPerDirection,
    hourlyTotalsPerHourTotal,
    directionNames,
    directionToRi,
    isSingleDirection
) {
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            const dataPerHour = hourlyTotalsPerHourPerDirection[direction];
            const boxPlotData = [];

            hours.forEach(hour => {
                const data = dataPerHour[hour];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    hours.forEach(hour => {
        const data = hourlyTotalsPerHourTotal[hour];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot',
        color: '#6f6f6f'
    });

    return seriesData;
}

export function processWeeklyBoxPlotData(
    dailyTotalsPerWeekdayPerDirection,
    dailyTotalsPerWeekdayTotal,
    weeklyDirectionNames,
    directionToRiWeekly,
    isSingleDirection
) {
    const weekdays = Array.from({ length: 7 }, (_, i) => i); // 0 to 6

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const dataPerWeekday = dailyTotalsPerWeekdayPerDirection[direction];
            const boxPlotData = [];

            weekdays.forEach(weekday => {
                const data = dataPerWeekday[weekday];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    weekdays.forEach(weekday => {
        const data = dailyTotalsPerWeekdayTotal[weekday];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot',
        color: '#6f6f6f'
    });

    return seriesData;
}

export function processMonthlyBoxPlotData(
    dailyTotalsPerMonthPerDirection,
    dailyTotalsPerMonthTotal,
    monthlyDirectionNames,
    directionToRiMonthly,
    isSingleDirection
) {
    const months = Array.from({ length: 12 }, (_, i) => i); // 0 to 11

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            const dataPerMonth = dailyTotalsPerMonthPerDirection[direction];
            const boxPlotData = [];

            months.forEach(month => {
                const data = dataPerMonth[month];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    months.forEach(month => {
        const data = dailyTotalsPerMonthTotal[month];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot',
        color: '#6f6f6f'
    });

    return seriesData;
}

function computeQuartiles(dataArray) {
    dataArray.sort((a, b) => a - b);
    const min = dataArray[0];
    const max = dataArray[dataArray.length - 1];
    const median = percentile(dataArray, 50);
    const q1 = percentile(dataArray, 25);
    const q3 = percentile(dataArray, 75);

    return [min, q1, median, q3, max];
}

function percentile(arr, p) {
    const index = (p / 100) * (arr.length - 1);
    if (Math.floor(index) === index) {
        return arr[index];
    } else {
        const i = Math.floor(index);
        const fraction = index - i;
        return arr[i] + (arr[i + 1] - arr[i]) * fraction;
    }
}

export const chartHelpConfigByContext = {
    hourly: {
        title: 'Boxplot und Streudiagramm – Stundenverkehr',
        addon: 'Was zeigen diese Darstellungen?',
        body: `
            <p>Beide Darstellungen zeigen, wie sich der Stundenverkehr über viele Tage verteilt.</p>
            <p><b>Boxplot</b> (pro Stunde):</p>
            <ul>
                <li>Jede Stunde hat einen eigenen Kasten.</li>
                <li>Die horizontale Linie in der Box ist der <b>Median</b>: In der Hälfte der Stunden war der Verkehr höher, in der anderen Hälfte tiefer.</li>
                <li>Die Box reicht vom <b>25%-Quantil</b> bis zum <b>75%-Quantil</b>:
                    Unter dem 25%-Quantil liegen 25% der Stunden, unter dem 75%-Quantil 75%.<br>
                    <b>Die mittleren 50% der Stundenwerte liegen somit in der Box.</b>
                </li>
                <li>Die „Fühler“ zeigen <b>Minimum</b> und <b>Maximum</b>.</li>
            </ul>
            <p><b>Streudiagramm</b> (pro Punkt):</p>
            <ul>
                <li>Jeder Punkt ist eine einzelne Messung: eine Stunde an einem bestimmten Tag.</li>
                <li>So sieht man, wie stark der Stundenverkehr von Tag zu Tag schwankt.</li>
                <li>Ungewöhnlich hohe oder tiefe Werte (Ausreisser) sind gut erkennbar.</li>
            </ul>
        `
    },
    weekly: {
        title: 'Boxplot und Streudiagramm – Wochentage',
        addon: 'Was zeigen diese Darstellungen?',
        body: `
            <p>Beide Darstellungen zeigen, wie sich der Tagesverkehr für jeden Wochentag verteilt.</p>
            <p><b>Boxplot</b> (pro Wochentag):</p>
            <ul>
                <li>Jeder Wochentag (Mo–So) hat einen eigenen Kasten.</li>
                <li>Die horizontale Linie in der Box ist der <b>Median</b>: An der Hälfte der Montage z.&nbsp;B. war der Verkehr höher, an der anderen Hälfte tiefer.</li>
                <li>Die Box reicht vom <b>25%-Quantil</b> bis zum <b>75%-Quantil</b>:
                    Unter dem 25%-Quantil liegen 25% der Tage, unter dem 75%-Quantil 75%.<br>
                    <b>Die mittleren 50% der Tage mit gleichem Wochentag liegen somit in der Box.</b>
                </li>
                <li>Die „Fühler“ zeigen <b>Minimum</b> und <b>Maximum</b> des Tagesverkehrs.</li>
            </ul>
            <p><b>Streudiagramm</b> (pro Punkt):</p>
            <ul>
                <li>Jeder Punkt ist eine Messung des Tagesverkehrs an einem bestimmten Datum.</li>
                <li>Die Punkte sind nach Wochentag gruppiert (z.&nbsp;B. alle Montage zusammen).</li>
                <li>Man sieht, wie ähnlich oder unterschiedlich sich die gleichen Wochentage verhalten und wo Ausreisser liegen.</li>
            </ul>
        `
    },
    monthly: {
        title: 'Boxplot und Streudiagramm – Monate',
        addon: 'Was zeigen diese Darstellungen?',
        body: `
            <p>Beide Darstellungen zeigen, wie sich der Tagesverkehr über die Monate eines Jahres verteilt.</p>
            <p><b>Boxplot</b> (pro Monat):</p>
            <ul>
                <li>Jeder Monat hat einen eigenen Kasten.</li>
                <li>Die horizontale Linie in der Box ist der <b>Median</b>: An der Hälfte der Tage im Monat war der Verkehr höher, an der anderen Hälfte tiefer.</li>
                <li>Die Box reicht vom <b>25%-Quantil</b> bis zum <b>75%-Quantil</b>:
                    Unter dem 25%-Quantil liegen 25% der Tage, unter dem 75%-Quantil 75%.<br>
                    <b>Die mittleren 50% aller Tage eines Monats liegen somit in der Box.</b>
                </li>
                <li>Die „Fühler“ zeigen <b>Minimum</b> und <b>Maximum</b>.</li>
            </ul>
            <p><b>Streudiagramm</b> (pro Punkt):</p>
            <ul>
                <li>Jeder Punkt ist eine Messung des Tagesverkehrs an einem bestimmten Datum.</li>
                <li>Die Punkte sind nach Monat gruppiert (Jan–Dez).</li>
                <li>So erkennt man saisonale Muster, Schwankungen und Ausreisser innerhalb der Monate.</li>
            </ul>
        `
    },
    generic: {
        title: 'Boxplot und Streudiagramm',
        addon: 'Kurz erklärt',
        body: `
            <p><b>Boxplot</b> zeigt Median, 25%-Quantil, 75%-Quantil, Minimum und Maximum –
            also die typische Spannweite der Werte. Die mittleren 50% liegen in der Box.</p>
            <p><b>Streudiagramm</b> zeigt jede einzelne Messung als Punkt und macht Schwankungen und Ausreisser sichtbar.</p>
        `
    }
};
