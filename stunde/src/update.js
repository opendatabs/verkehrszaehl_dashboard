import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    mergeHourlyTables,
    filterToSelectedTimeRange,
    extractDailyTraffic,
    extractDailyApproval,
    aggregateHourlyTraffic,
    processHourlyBoxPlotData,
    updateExporting,
    getTrafficLabel,
    isVerteilungOpen,
    isZeitraumOverPerfThreshold,
    normalizeZsts,
    setZstTrailingEmpty,
    vergleichColor,
    resetChartSeriesForMode,
    vergleichScatterOffset,
    getStationName,
    intersectDailyCoverage,
    clampTimeRangeToCoverage,
    setTimeRangeSelectorVisible,
    updateTimeRangeNavigator,
    pushSeriesData,
    clearVergleichHighlightSync,
    bindVergleichHighlightSync,
    setDashboardHighlightSync
} from "../../src/functions.js";
import {stunde} from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zstsInput, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , //filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        , //filter-selection-2 (dayrange buttons)
        timelineChart,
        hourlyTable,
        hourlyDTVChart,
        hourlyDonutChart,
        , // filter-section-3
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterPlotGesamt
    ] = board.mountedComponents.map(c => c.component);

    // Determine if we're using speed classes (skip unvalidated data logic if so)
    let hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');

    let zsts = normalizeZsts(zstsInput);
    // Do not clear multi-ZST on newType — page load uses newType=true.
    // Verkehrsmittel change already passes a single-zst list from the filter listener.

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    const lastZstsKey = zsts.join(',');
    
    // Ensure we have a valid zst before loading station data
    if ((!zsts.length) && zaehlstellen && zaehlstellen.length > 0) {
        zsts = [String(zaehlstellen[0].id)];
    }
    
    const stations = await loadStations(type);
    const stationRows = zsts.map(id => stations.find(r => String(r.Zst_id) === String(id))).filter(Boolean);
    const next = await updateState(board, type, strtyp, zsts, fzgtyp, speed, timeRange, zaehlstellen, stationRows);
    zsts = next.zsts;
    fzgtyp = next.fzgtyp;
    speed = next.speed;
    newZst = newZst || lastZstsKey !== zsts.join(',');
    const zst = zsts[0];

    // Update hasSpeedSelection after speed might have changed
    hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    const dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    const filterKeys = hasSpeedSelection ? speed : fzgtyp;

    if (newType) {
        // Update the credits text
        updateCredits(hourlyTable.grid.credits, type);
        updateCredits(hourlyDTVChart.chart.credits, type);
        updateCredits(hourlyDonutChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterPlotGesamt.chart.credits, type);
    }

    if (zsts.length > 1) {
        setTimeRangeSelectorVisible(false);
        await updateBoardVergleichHourly({
            board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
            timelineChart, hourlyTable, hourlyDTVChart, hourlyDonutChart,
            boxPlot, scatterChart, boxPlotGesamt, scatterPlotGesamt, zaehlstellen
        });
        return;
    }

    // --- Single-station path (unchanged behavior) ---
    setTimeRangeSelectorVisible(true);
    if (hourlyDTVChart?._vergleichSyncCleanup) {
        hourlyDTVChart._vergleichSyncCleanup();
        hourlyDTVChart._vergleichSyncCleanup = null;
    }
    clearVergleichHighlightSync([hourlyDTVChart]);
    setDashboardHighlightSync(hourlyTable, true);
    setDashboardHighlightSync(hourlyDTVChart, true);
    resetChartSeriesForMode(hourlyDTVChart.chart, { vergleichMode: false, baseCount: 3 });

    let hourlyTraffic = await board.dataPool.connectors['Hourly Traffic'].getTable()

    const filterList = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
    const keys = filterList.filter(v => v && v !== 'Total');
    const effective = keys.length ? keys : ['Total'];

    const tables = await Promise.all(
        effective.map(k => readCSV(`../data/${dataType}/${zst}_${k}_hourly.csv`))
    );

    // merge by Date + DirectionName (+ LaneName if you have it)
    const hourlyDataRows = mergeHourlyTables(tables);
    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);

    // Check for unapproved days in the current time range
    const dailyApproval = extractDailyApproval(dailyDataRows);
    const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
    const hasUnapprovedDays = !hasSpeedSelection && dailyApproval.some(([ts, fullyApproved]) => 
        ts >= timeRange[0] && ts <= timeRange[1] && fullyApproved === false
    );
    
    // Show/hide warning icon (skip when speed classes are selected)
    const timeRangeWarning = document.querySelector('.time-range-warning');
    if (timeRangeWarning) {
        timeRangeWarning.style.display = hasUnapprovedDays ? 'inline-flex' : 'none';
    }

    const timeRangePerfWarning = document.querySelector('.time-range-perf-warning');
    if (timeRangePerfWarning) {
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'hourly')
            ? 'inline-flex'
            : 'none';
    }

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterToSelectedTimeRange(hourlyDataRows, timeRange);


    if (newZst) {
        const {dailyTraffic} = extractDailyTraffic(dailyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(dailyTraffic);
    }

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();
    // Get the aggregated data and direction names
    const {
        aggregatedData: aggregatedHourlyTraffic,
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames,
        hourlyScatterPerDirection,
        hourlyScatterTotal
    } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected, includeDistribution);

    const isSingleDirection = directionNames.length < 2;
    // Set total label depending on whether it's a single direction or multiple
    const totalLabel = isSingleDirection ? directionNames[0] : 'Gesamtquerschnitt';

    // Toggle Anzeige: Richtungen / Gesamtquerschnitt
    const scopeGroup       = document.getElementById('chart-scope-group');
    const scopeDirections  = document.getElementById('chart-scope-directions');
    const scopeGesamt      = document.getElementById('chart-scope-gesamt');

    if (scopeGroup && scopeDirections && scopeGesamt) {
        if (isSingleDirection) {
            // No point in showing Richtungen vs Gesamtquerschnitt -> hide group, force Gesamt
            scopeGroup.style.display = 'none';
            scopeGesamt.checked = true;
        } else {
            scopeGroup.style.display = '';
            // If neither is selected for some reason, default to Richtungen
            if (!scopeDirections.checked && !scopeGesamt.checked) {
                scopeDirections.checked = true;
            }
        }
        // Update chart visibility based on current toggle state
        if (window.applyChartTypeAndScopeVisibility) {
            window.applyChartTypeAndScopeVisibility();
        }
    }

    // Map direction names to ri1 and ri2 (if there are two directions)
    const directionToRi = {};
    directionNames.forEach((direction, index) => {
        directionToRi[direction] = `ri${index + 1}`;
    });

    // Initialize dtv_hourly_totals
    const dtv_hourly_totals = {};
    for (let i = 0; i < 24; i++) {
        dtv_hourly_totals[i] = {};
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            dtv_hourly_totals[i][ri] = null;
        });
    }

    // Build DTV columns
    let dtv_ri_columns = {};
    directionNames.forEach(direction => {
        const ri = directionToRi[direction];
        dtv_ri_columns[`dtv_${ri}`] = [];
    });

    // Initialize totals
    let dtv_total = [];
    let dtv_anteil;
    let dtv_total_direction_totals = {};
    directionNames.forEach(direction => {
        const ri = directionToRi[direction];
        dtv_total_direction_totals[ri] = null;
    });

    // Populate dtv_hourly_totals
    aggregatedHourlyTraffic.forEach(item => {
        const date = new Date(item.hour);
        const hour = date.getUTCHours();
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRi[direction];

        if (ri !== undefined) {
            dtv_hourly_totals[hour][ri] += total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build dtv_ri_columns
    let dtv_total_total = 0;
    for (let i = 0; i < 24; i++) {
        let hour_total = null;
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            const value = dtv_hourly_totals[i][ri];
            dtv_ri_columns[`dtv_${ri}`].push(value);
            if(value){
                dtv_total_direction_totals[ri] += value;
                hour_total += value;
            }
        });
        dtv_total.push(hour_total);
        if (hour_total) dtv_total_total += hour_total;
    }

    // Compute dtv_anteil
    dtv_anteil = dtv_total.map(value => (value / dtv_total_total) * 100);

    // Reset the columns of hourlyTraffic Connector
    hourlyTraffic.setColumns({});

    // Build columns for the Connector
    const columns = {
        'stunde': stunde
    };

    // Only include direction columns if there are multiple directions
    if (!isSingleDirection) {
        Object.assign(columns, dtv_ri_columns);
    }

    Object.assign(columns, {
        'dtv_total': dtv_total,
        'dtv_anteil': dtv_anteil
    });

    hourlyTraffic.setColumns(columns);
    // Recover DTV series if Vergleich previously broke connector binding
    pushSeriesData(hourlyDTVChart.chart, {
        'series-ri1': columns.dtv_ri1 || Array(24).fill(null),
        'series-ri2': columns.dtv_ri2 || Array(24).fill(null),
        'series-gesamt': columns.dtv_total
    }, true);

    // Build the DataGrid columns dynamically
    let dataGridColumns = [
        {
            id: 'stunde',
            header: {
                format: 'Stunden'
            }
        }
    ];

    if (!isSingleDirection) {
        // Add columns for each direction
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            dataGridColumns.push({
                id: `dtv_${ri}`,
                header: {
                    format: direction  // Use actual direction name
                },
                cells: {
                    formatter: function () {
                        return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : '';
                    }
                }
            });
        });
    }

    // Add total and percentage columns
    dataGridColumns.push(
        {
            id: 'dtv_total',
            header: {
                format: totalLabel
            },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : '';
                }
            }
        },
        {
            id: 'dtv_anteil',
            header: {
                format: 'Anteil Std. am Tag'
            },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 1)}%` : '';
                }
            }
        }
    );

    if(isSingleDirection) {
        hourlyTable.grid.update({
            header: [
                {
                    columnId: "stunde",
                },
                {
                    format: "Durchschnittlicher Stundenverkehr",
                    columns: [
                        "dtv_total",
                        "dtv_anteil"
                    ]
                }
            ],
            columns: dataGridColumns
        });
    } else {
        hourlyTable.grid.update({
            header: [
                {
                    columnId: "stunde",
                },
                {
                    format: "Durchschnittlicher Stundenverkehr",
                    columns: [
                        "dtv_ri1",
                        "dtv_ri2",
                        "dtv_total",
                        "dtv_anteil"
                    ]
                }
            ],
            columns: dataGridColumns
        });
    }

    // Re-add series based on the current directions
    if (isSingleDirection) {
        hourlyDTVChart.chart.series[0].update({
            name: 'Richtung 1',
            visible: false,
            showInLegend: false
        });
        hourlyDTVChart.chart.series[1].update({
            name: 'Richtung 2',
            visible: false,
            showInLegend: false
        });
    } else {
        hourlyDTVChart.chart.series[0].update({
            name: directionNames[0],
            visible: true,
            showInLegend: true
        });
        hourlyDTVChart.chart.series[1].update({
            name: directionNames[1],
            visible: true,
            showInLegend: true
        });
    }
    hourlyDTVChart.chart.series[2].update({
        name: totalLabel,
        visible: true,
        showInLegend: true
    });

    // Update the donut chart (reset any Vergleich multi-pie layout first)
    const dtvLabel = getTrafficLabel('DTV');
    const tagesverkehrLabel = getTrafficLabel('Tagesverkehr');
    resetDonutToSingle(hourlyDonutChart.chart);

    // Update chart title
    hourlyDonutChart.chart.update({
        title: {
            text: `Anteil der Verkehrsrichtungen am ${tagesverkehrLabel}`
        }
    }, false);
    
    // Update dataLabels formatter
    hourlyDonutChart.chart.series[0].update({
        dataLabels: {
            formatter: function () {
                return `<span style="color:${this.point.color}">\u25CF</span> ${this.point.name} <br/> 
                <b>${dtvLabel}: ${Highcharts.numberFormat(this.y, 0)}</b> (${Highcharts.numberFormat(this.percentage, 1)}%)`;
            }
        }
    }, false);
    
    // Update point event handlers
    hourlyDonutChart.chart.series[0].points.forEach(point => {
        point.update({
            events: {
                mouseOver: function() {
                    var chart = this.series.chart;
                    if (chart.lbl) {
                        var formattedValue = Highcharts.numberFormat(this.y, 0);
                        var formattedPercentage = Highcharts.numberFormat(this.percentage, 1);
                        chart.lbl.attr({
                            text: this.name + ':<br/>' + dtvLabel + ': ' + formattedValue + '<br/>' + formattedPercentage + '%'
                        });
                    }
                },
                mouseOut: function() {
                    var chart = this.series.chart;
                    var total = 0;
                    chart.series[0].data.forEach(function(p) {
                        total += p.y;
                    });
                    var formattedTotal = Highcharts.numberFormat(total, 0);
                    if (chart.lbl) {
                        chart.lbl.attr({
                            text: 'Gesamtquerschnitt:<br/>' + dtvLabel + ': ' + formattedTotal + '<br/>'
                        });
                    }
                }
            }
        }, false);
    });
    
    if (!isSingleDirection) {
        // Update the donut chart data with directions
        const directionTotals = directionNames.map(direction => {
            const ri = directionToRi[direction];
            return {
                name: direction,
                y: dtv_total_direction_totals[ri]
            };
        });
        hourlyDonutChart.chart.series[0].setData(directionTotals);
        hourlyDonutChart.chart.series[0].points[0].update({
            color: '#007a2f'
        });
        hourlyDonutChart.chart.series[0].points[1].update({
            color: '#008ac3'
        });
        const chartContainer = document.querySelector('#container');
        chartContainer.style.setProperty('--highcharts-color-0', '#007a2f');
        chartContainer  .style.setProperty('--highcharts-color-1', '#008ac3');
        
        // Update center label for multiple directions
        if (hourlyDonutChart.chart.lbl) {
            const total = directionTotals.reduce((sum, d) => sum + d.y, 0);
            hourlyDonutChart.chart.lbl.attr({
                text: `Gesamtquerschnitt:<br/>${dtvLabel}: ${Highcharts.numberFormat(total, 0)}<br/>`
            });
        }
        
        hourlyDonutChart.chart.series[0].points.forEach(function(point) {
            point.firePointEvent('mouseOut');
        });
    } else {
        // Set the data to display the single direction total as a full circle
        const total = dtv_total_total;
        hourlyDonutChart.chart.series[0].setData([
            {
                name: totalLabel,
                y: total
            }
        ]);
        hourlyDonutChart.chart.series[0].points[0].update({
            color: '#6f6f6f'
        });
        const chartContainer = document.querySelector('#container');
        chartContainer.style.setProperty('--highcharts-color-0', '#6f6f6f');

        // Update the center label
        if (hourlyDonutChart.chart.lbl) {
            const dtvLabel = getTrafficLabel('DTV');
            hourlyDonutChart.chart.lbl.attr({
                text: `${totalLabel}:<br/>${dtvLabel}: ${Highcharts.numberFormat(total, 0)}<br/>%`
            });
        }
        hourlyDonutChart.chart.series[0].points.forEach(function(point) {
            point.firePointEvent('mouseOut');
        });
    }

    // Process box plot data
    if (includeDistribution) {
    const boxPlotData = processHourlyBoxPlotData(
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames,
        directionToRi,
        isSingleDirection
    );

    // Split into direction series & total series
    const directionSeries = boxPlotData.filter(s => s.id !== 'series-gesamt');
    const totalSeries     = boxPlotData.find(s => s.id === 'series-gesamt');

    // Clear both charts
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }
    while (boxPlotGesamt.chart.series.length > 0) {
        boxPlotGesamt.chart.series[0].remove(false);
    }

    // Directions chart: only ri1/ri2, only when we have multiple directions
    if (!isSingleDirection) {
        directionSeries.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    }

    // Gesamt chart: always show total series (renamed)
    if (totalSeries) {
        totalSeries.name = totalLabel;
        boxPlotGesamt.chart.addSeries(totalSeries, false);
    }

    boxPlot.chart.redraw();
    boxPlotGesamt.chart.redraw();

    // --- Update scatter chart with per-measurement points (no Gesamtquerschnitt) ---
    // Remove existing series
    while (scatterChart.chart.series.length > 0) {
        scatterChart.chart.series[0].remove(false);
    }

    if (!isSingleDirection) {
        // Two directions: offset them horizontally so they appear side by side
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            const dirScatter = hourlyScatterPerDirection[direction] || {};
            const allPoints = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;
            const baseColor = ri === 'ri1' ? '#007a2f' : '#008ac3';

            for (let hour = 0; hour < 24; hour++) {
                const arr = dirScatter[hour] || [];
                arr.forEach(p => {
                    const point = {
                        x: hour + offset,  // shifted position
                        y: p.value,
                        date: p.date
                    };
                    allPoints.push(point);
                });
            }

            // When speed classes are selected, skip validation logic and show all points
            if (hasSpeedSelection) {
                if (allPoints.length > 0) {
                    scatterChart.chart.addSeries({
                        type: 'scatter',
                        name: direction,
                        data: allPoints,
                        color: baseColor
                    }, false);
                }
            } else {
                // Split into approved/unapproved when not using speed classes
                const approvedPoints = [];
                const unapprovedPoints = [];

                for (let hour = 0; hour < 24; hour++) {
                    const arr = dirScatter[hour] || [];
                    arr.forEach(p => {
                        const isApproved = approvalMap.get(p.date) !== false;
                        const point = {
                            x: hour + offset,
                            y: p.value,
                            date: p.date
                        };
                        if (isApproved) {
                            approvedPoints.push(point);
                        } else {
                            unapprovedPoints.push(point);
                        }
                    });
                }

                // Add approved series
                if (approvedPoints.length > 0) {
                    scatterChart.chart.addSeries({
                        type: 'scatter',
                        name: direction,
                        data: approvedPoints,
                        color: baseColor
                    }, false);
                }

                // Add unapproved series
                if (unapprovedPoints.length > 0) {
                    scatterChart.chart.addSeries({
                        type: 'scatter',
                        name: `${direction} (nicht validiert)`,
                        data: unapprovedPoints,
                        color: baseColor,
                        marker: {
                            lineColor: '#FFBB1A',
                            lineWidth: 2
                        }
                    }, false);
                }
            }
        });
    } else {
        // Only one direction: use gray and no horizontal split
        const direction = directionNames[0];
        const dirScatter = hourlyScatterPerDirection[direction] || {};
        const allPoints = [];

        for (let hour = 0; hour < 24; hour++) {
            const arr = dirScatter[hour] || [];
            arr.forEach(p => {
                const point = {
                    x: hour,
                    y: p.value,
                    date: p.date
                };
                allPoints.push(point);
            });
        }

        // When speed classes are selected, skip validation logic and show all points
        if (hasSpeedSelection) {
            if (allPoints.length > 0) {
                scatterChart.chart.addSeries({
                    type: 'scatter',
                    name: direction,
                    data: allPoints,
                    color: '#6f6f6f'
                }, false);
            }
        } else {
            // Split into approved/unapproved when not using speed classes
            const approvedPoints = [];
            const unapprovedPoints = [];

            for (let hour = 0; hour < 24; hour++) {
                const arr = dirScatter[hour] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: hour,
                        y: p.value,
                        date: p.date
                    };
                    if (isApproved) {
                        approvedPoints.push(point);
                    } else {
                        unapprovedPoints.push(point);
                    }
                });
            }

            // Add approved series
            if (approvedPoints.length > 0) {
                scatterChart.chart.addSeries({
                    type: 'scatter',
                    name: direction,
                    data: approvedPoints,
                    color: '#6f6f6f'
                }, false);
            }

            // Add unapproved series
            if (unapprovedPoints.length > 0) {
                scatterChart.chart.addSeries({
                    type: 'scatter',
                    name: `${direction} (nicht validiert)`,
                    data: unapprovedPoints,
                    color: '#6f6f6f',
                    marker: {
                        lineColor: '#FFBB1A',
                        lineWidth: 2
                    }
                }, false);
            }
        }
    }

    scatterChart.chart.redraw();

    // --- Update Gesamtquerschnitt scatter chart ---
    while (scatterPlotGesamt.chart.series.length > 0) {
        scatterPlotGesamt.chart.series[0].remove(false);
    }

    if (hasSpeedSelection) {
        // When speed classes are selected, skip validation logic and show all points
        const gesamtAllPoints = [];
        if (hourlyScatterTotal) {
            for (let hour = 0; hour < 24; hour++) {
                const arr = hourlyScatterTotal[hour] || [];
                arr.forEach(p => {
                    const point = {
                        x: hour,
                        y: p.value,
                        date: p.date
                    };
                    gesamtAllPoints.push(point);
                });
            }
        }

        if (gesamtAllPoints.length > 0) {
            scatterPlotGesamt.chart.addSeries({
                type: 'scatter',
                name: totalLabel,
                data: gesamtAllPoints,
                color: '#6f6f6f'
            }, false);
        }
    } else {
        // Split into approved/unapproved when not using speed classes
        const gesamtApprovedPoints = [];
        const gesamtUnapprovedPoints = [];
        if (hourlyScatterTotal) {
            for (let hour = 0; hour < 24; hour++) {
                const arr = hourlyScatterTotal[hour] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: hour,
                        y: p.value,
                        date: p.date
                    };
                    if (isApproved) {
                        gesamtApprovedPoints.push(point);
                    } else {
                        gesamtUnapprovedPoints.push(point);
                    }
                });
            }
        }

        // Add approved series
        if (gesamtApprovedPoints.length > 0) {
            scatterPlotGesamt.chart.addSeries({
                type: 'scatter',
                name: totalLabel,
                data: gesamtApprovedPoints,
                color: '#6f6f6f'
            }, false);
        }

        // Add unapproved series
        if (gesamtUnapprovedPoints.length > 0) {
            scatterPlotGesamt.chart.addSeries({
                type: 'scatter',
                name: `${totalLabel} (nicht validiert)`,
                data: gesamtUnapprovedPoints,
                color: '#6f6f6f',
                marker: {
                    lineColor: '#FFBB1A',
                    lineWidth: 2
                }
            }, false);
        }
    }

    scatterPlotGesamt.chart.redraw();

    await updateExporting(board, boxPlot.chart.exporting, 'hourly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChart.chart.exporting, 'hourly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'hourly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterPlotGesamt.chart.exporting, 'hourly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    // Update exporting options
    await updateExporting(board, hourlyDTVChart.chart.exporting, 'hourly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, hourlyDonutChart.chart.exporting, 'hourly-donut', type, zsts, fzgtyp, timeRange, true, false, speed);
}

async function updateBoardVergleichHourly({
    board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
    timelineChart, hourlyTable, hourlyDTVChart, hourlyDonutChart,
    boxPlot, scatterChart, boxPlotGesamt, scatterPlotGesamt, zaehlstellen
}) {
    const filterList = Array.isArray(filterKeys) ? filterKeys : [filterKeys];
    const keys = filterList.filter(v => v && v !== 'Total');
    const effective = keys.length ? keys : ['Total'];
    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();

    const nameById = new Map((zaehlstellen || []).map(s => [String(s.id), s.name]));

    // Coverage intersection first, then aggregate within the clamped range
    const dailyRowsById = {};
    await Promise.all(zsts.map(async id => {
        dailyRowsById[id] = await readCSV(`../data/${dataType}/${id}_daily.csv`);
    }));
    const dailyTraffics = zsts.map(id => extractDailyTraffic(dailyRowsById[id], filterKeys).dailyTraffic);
    const coverage = intersectDailyCoverage(dailyTraffics);
    if (coverage.minDate != null && coverage.maxDate != null) {
        timeRange = clampTimeRangeToCoverage(timeRange, coverage.minDate, coverage.maxDate);
    }
    // Keep Zeitraum selector; domain = intersection coverage (series line hidden via CSS)
    updateTimeRangeNavigator(timelineChart, coverage.dailyTraffic, timeRange);

    const stationResults = await Promise.all(zsts.map(async (id, index) => {
        const tables = await Promise.all(
            effective.map(k => readCSV(`../data/${dataType}/${id}_${k}_hourly.csv`))
        );
        const hourlyDataRows = mergeHourlyTables(tables);
        const dailyDataRows = dailyRowsById[id];
        const dailyApproval = extractDailyApproval(dailyDataRows);
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        const filtered = filterToSelectedTimeRange(hourlyDataRows, timeRange);
        const { aggregatedData, hourlyTotalsPerHourTotal, hourlyScatterTotal, directionNames } =
            aggregateHourlyTraffic(filtered, isMoFrSelected, isSaSoSelected, includeDistribution);

        const byHour = {};
        const byHourDir = {};
        aggregatedData.forEach(item => {
            const hour = new Date(item.hour).getUTCHours();
            if (!byHour[hour]) byHour[hour] = { total: 0, numberOfDays: item.numberOfDays };
            byHour[hour].total += item.total;
            byHour[hour].numberOfDays = item.numberOfDays;

            const dir = item.directionName;
            if (!byHourDir[dir]) byHourDir[dir] = {};
            if (!byHourDir[dir][hour]) {
                byHourDir[dir][hour] = { total: 0, numberOfDays: item.numberOfDays };
            }
            byHourDir[dir][hour].total += item.total;
            byHourDir[dir][hour].numberOfDays = item.numberOfDays;
        });
        const dtv_total = [];
        let dayTotal = 0;
        for (let h = 0; h < 24; h++) {
            const entry = byHour[h];
            const mean = entry && entry.numberOfDays ? entry.total / entry.numberOfDays : null;
            dtv_total.push(mean);
            if (mean) dayTotal += mean;
        }

        // Per-direction day totals for a single-mode-style donut per station
        const directionColors = ['#007a2f', '#008ac3'];
        const directionPieData = (directionNames || []).map((dir, di) => {
            let sum = 0;
            for (let h = 0; h < 24; h++) {
                const e = byHourDir[dir]?.[h];
                if (e && e.numberOfDays) sum += e.total / e.numberOfDays;
            }
            return {
                name: dir,
                y: sum,
                color: directionNames.length < 2 ? '#6f6f6f' : directionColors[di % directionColors.length]
            };
        });

        const label = nameById.has(String(id))
            ? `${id} ${nameById.get(String(id))}`
            : `${id} ${await getStationName(type, id)}`;

        return {
            id: String(id),
            index,
            label,
            color: vergleichColor(index),
            dailyDataRows,
            approvalMap,
            dtv_total,
            dayTotal,
            directionPieData,
            hourlyTotalsPerHourTotal,
            hourlyScatterTotal,
            hasUnapproved: !hasSpeedSelection && dailyApproval.some(([ts, fullyApproved]) =>
                ts >= timeRange[0] && ts <= timeRange[1] && fullyApproved === false
            )
        };
    }));

    const hasUnapprovedDays = stationResults.some(r => r.hasUnapproved);
    const timeRangeWarning = document.querySelector('.time-range-warning');
    if (timeRangeWarning) {
        timeRangeWarning.style.display = hasUnapprovedDays ? 'inline-flex' : 'none';
    }
    const timeRangePerfWarning = document.querySelector('.time-range-perf-warning');
    if (timeRangePerfWarning) {
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'hourly')
            ? 'inline-flex'
            : 'none';
    }

    // Force Gesamt scope
    const scopeGroup = document.getElementById('chart-scope-group');
    const scopeGesamt = document.getElementById('chart-scope-gesamt');
    if (scopeGroup && scopeGesamt) {
        scopeGroup.style.display = 'none';
        scopeGesamt.checked = true;
        if (window.applyChartTypeAndScopeVisibility) {
            window.applyChartTypeAndScopeVisibility();
        }
    }

    // Table + connector columns (no Anteil Std. am Tag in Vergleich — not meaningful across stations)
    const hourlyTraffic = await board.dataPool.connectors['Hourly Traffic'].getTable();
    const columns = { stunde };
    stationResults.forEach((r, i) => {
        columns[`dtv_zst_${i}`] = r.dtv_total;
    });
    // Clear single-mode connector columns so leftover series stay empty
    columns.dtv_ri1 = Array(24).fill(null);
    columns.dtv_ri2 = Array(24).fill(null);
    columns.dtv_total = Array(24).fill(null);
    columns.dtv_anteil = Array(24).fill(null);
    hourlyTraffic.setColumns(columns);

    const dataGridColumns = [
        { id: 'stunde', header: { format: 'Stunden' } },
        ...stationResults.map((r, i) => ({
            id: `dtv_zst_${i}`,
            header: { format: r.label },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : '';
                }
            }
        }))
    ];
    hourlyTable.grid.update({
        header: [
            { columnId: 'stunde' },
            {
                format: 'Durchschnittlicher Stundenverkehr',
                columns: stationResults.map((_, i) => `dtv_zst_${i}`)
            }
        ],
        columns: dataGridColumns
    });

    // Line chart: hide base series, add one per station (same style as single-mode lines: no markers)
    resetChartSeriesForMode(hourlyDTVChart.chart, { vergleichMode: true, baseCount: 3 });
    stationResults.forEach((r) => {
        hourlyDTVChart.chart.addSeries({
            id: `vergleich-${r.id}`,
            name: r.label,
            type: 'line',
            data: r.dtv_total,
            color: r.color,
            visible: true,
            showInLegend: true,
            marker: {
                symbol: 'circle',
                enabled: false
            }
        }, false);
    });
    // Connector highlight cannot map dtv_zst_* grid columns → addSeries Vergleich series
    setDashboardHighlightSync(hourlyTable, false);
    setDashboardHighlightSync(hourlyDTVChart, false);
    hourlyDTVChart.chart.redraw();

    // Donuts: one single-mode-style Richtung-donut per Zählstelle (side by side)
    renderVergleichDonuts(hourlyDonutChart.chart, stationResults);

    // Verteilung: only Gesamt charts, one series per station; clear Richtungen charts
    if (includeDistribution) {
        while (boxPlot.chart.series.length > 0) boxPlot.chart.series[0].remove(false);
        while (scatterChart.chart.series.length > 0) scatterChart.chart.series[0].remove(false);
        while (boxPlotGesamt.chart.series.length > 0) boxPlotGesamt.chart.series[0].remove(false);
        while (scatterPlotGesamt.chart.series.length > 0) scatterPlotGesamt.chart.series[0].remove(false);

        const nStations = stationResults.length;
        stationResults.forEach((r, index) => {
            const offset = vergleichScatterOffset(index, nStations);
            const boxPlotData = processHourlyBoxPlotData(
                {},
                r.hourlyTotalsPerHourTotal,
                [],
                {},
                true
            );
            const totalSeries = boxPlotData.find(s => s.id === 'series-gesamt');
            if (totalSeries) {
                boxPlotGesamt.chart.addSeries({
                    ...totalSeries,
                    id: `vergleich-box-${r.id}`,
                    name: r.label,
                    color: r.color
                }, false);
            }

            const gesamtApproved = [];
            const gesamtUnapproved = [];
            const gesamtAll = [];
            if (r.hourlyScatterTotal) {
                for (let hour = 0; hour < 24; hour++) {
                    (r.hourlyScatterTotal[hour] || []).forEach(p => {
                        const point = { x: hour + offset, y: p.value, date: p.date };
                        gesamtAll.push(point);
                        if (r.approvalMap.get(p.date) !== false) gesamtApproved.push(point);
                        else gesamtUnapproved.push(point);
                    });
                }
            }
            if (hasSpeedSelection) {
                if (gesamtAll.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter',
                        id: `vergleich-scatter-${r.id}`,
                        name: r.label,
                        data: gesamtAll,
                        color: r.color
                    }, false);
                }
            } else {
                if (gesamtApproved.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter',
                        id: `vergleich-scatter-${r.id}`,
                        name: r.label,
                        data: gesamtApproved,
                        color: r.color
                    }, false);
                }
                if (gesamtUnapproved.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter',
                        id: `vergleich-scatter-${r.id}-nv`,
                        name: `${r.label} (nicht validiert)`,
                        data: gesamtUnapproved,
                        color: r.color,
                        marker: { lineColor: '#FFBB1A', lineWidth: 2 }
                    }, false);
                }
            }
        });

        boxPlot.chart.redraw();
        scatterChart.chart.redraw();
        boxPlotGesamt.chart.redraw();
        scatterPlotGesamt.chart.redraw();

        await updateExporting(board, boxPlot.chart.exporting, 'hourly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChart.chart.exporting, 'hourly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, boxPlotGesamt.chart.exporting, 'hourly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterPlotGesamt.chart.exporting, 'hourly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    await updateExporting(board, hourlyDTVChart.chart.exporting, 'hourly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, hourlyDonutChart.chart.exporting, 'hourly-donut', type, zsts, fzgtyp, timeRange, true, false, speed);

    // Bind after exporting/connector churn so point handlers are not wiped
    if (hourlyDTVChart._vergleichSyncCleanup) hourlyDTVChart._vergleichSyncCleanup();
    hourlyDTVChart._vergleichSyncCleanup = bindVergleichHighlightSync(
        [hourlyDTVChart],
        { grid: hourlyTable }
    );
}

const DONUT_SINGLE_HEIGHT = 450;
const DONUT_STACK_BREAKPOINT = 700;
/** Extra px between Zählstelle title and donut top edge */
const DONUT_LABEL_GAP_PX = 22;

/** Row layout for Vergleich donuts: array of rows, each row = station indices. */
function getVergleichDonutRows(n, stacked) {
    if (n <= 1) return [[0]];
    if (stacked) {
        return Array.from({ length: n }, (_, i) => [i]);
    }
    switch (n) {
        case 2: return [[0, 1]];
        case 3: return [[0, 1, 2]];
        case 4: return [[0, 1], [2, 3]];
        case 5: return [[0, 1], [2, 3, 4]]; // 2 then 3
        case 6: return [[0, 1, 2], [3, 4, 5]];
        default: {
            const rows = [];
            for (let i = 0; i < n; i += 3) {
                rows.push(Array.from({ length: Math.min(3, n - i) }, (_, j) => i + j));
            }
            return rows;
        }
    }
}

/**
 * Centers + size for each donut.
 * Single-row sits mid-plot (not too low); multi-row gets enough height so rows stay in frame.
 */
function layoutVergleichDonuts(n, stacked) {
    const rows = getVergleichDonutRows(n, stacked);
    const numRows = rows.length;
    const maxCols = Math.max(...rows.map(r => r.length));

    // Diameter as % of plot — leave headroom for the Zählstelle title above each pie
    const sizePct = stacked
        ? 48
        : numRows === 1
            ? Math.min(40, Math.floor(78 / maxCols))
            : Math.min(34, Math.floor(72 / maxCols));

    // Chart height must fit every row inside the Dashboards cell
    const rowPx = stacked ? 270 : (numRows === 1 ? 400 : 360);
    const height = stacked
        ? Math.max(DONUT_SINGLE_HEIGHT, 40 + n * rowPx)
        : Math.max(DONUT_SINGLE_HEIGHT, 40 + numRows * rowPx);

    const centers = new Array(n);
    rows.forEach((row, rowIdx) => {
        const cols = row.length;
        const startOffset = (maxCols - cols) / 2; // center short rows (e.g. 2 above 3)
        const rowTop = rowIdx / numRows;
        const rowH = 1 / numRows;
        // Title band ~18% of row, donut center in lower part of remaining space
        const centerY = (rowTop + rowH * 0.58) * 100;
        row.forEach((stationIdx, colIdx) => {
            const x = ((startOffset + colIdx + 0.5) / maxCols) * 100;
            centers[stationIdx] = {
                center: [`${x}%`, `${centerY}%`],
                size: `${sizePct}%`
            };
        });
    });
    return { centers, sizePct, numRows, height };
}

/** Keep Dashboards cell height in sync with chart so multi-row donuts are not clipped. */
function syncDonutCellHeight(chart, height) {
    const cell = document.getElementById('hourly-donut-chart');
    if (cell) {
        cell.style.height = `${height}px`;
        cell.style.minHeight = `${height}px`;
        cell.style.overflow = 'visible';
    }
    const component = chart.container?.closest('.highcharts-dashboards-component');
    if (component) {
        component.style.height = `${height}px`;
        component.style.minHeight = `${height}px`;
    }
    const content = chart.container?.closest('.highcharts-dashboards-component-content');
    if (content) {
        content.style.height = `${height}px`;
        content.style.minHeight = `${height}px`;
    }
}

/** Restore donut to a single centered pie (single-ZST mode). */
function resetDonutToSingle(chart) {
    if (!chart) return;
    if (chart.vergleichDonutLabels) {
        chart.vergleichDonutLabels.forEach(lbl => lbl.destroy());
        chart.vergleichDonutLabels = null;
    }
    chart.vergleichDonutStations = null;
    if (chart.vergleichDonutResizeBound && chart.container) {
        window.removeEventListener('resize', chart.vergleichDonutResizeBound);
        chart.vergleichDonutResizeBound = null;
    }
    while (chart.series.length > 1) {
        chart.series[chart.series.length - 1].remove(false);
    }
    if (chart.series[0]) {
        chart.series[0].update({
            center: ['50%', '50%'],
            size: '75%',
            showInLegend: false,
            name: 'Anzahl',
            dataLabels: { enabled: true }
        }, false);
    }
    // Single mode uses center label + dataLabels, not tooltips
    chart.update({
        chart: { height: DONUT_SINGLE_HEIGHT },
        tooltip: { enabled: false }
    }, false);
    syncDonutCellHeight(chart, DONUT_SINGLE_HEIGHT);
    if (chart.lbl) {
        chart.lbl.show();
    }
}

/**
 * One Richtung-donut per Zählstelle: Zählstelle label just above, clean donut, details in tooltip.
 * Grid: 2→2×1, 3→3×1, 4→2×2, 5→2+3, 6→3×2; stacks vertically on narrow screens.
 */
function renderVergleichDonuts(chart, stationResults) {
    if (!chart || !stationResults?.length) return;

    const dtvLabel = getTrafficLabel('DTV');
    const tagesverkehrLabel = getTrafficLabel('Tagesverkehr');
    const n = stationResults.length;
    const stacked = (chart.chartWidth || chart.container?.clientWidth || 900) < DONUT_STACK_BREAKPOINT;
    const { centers, height } = layoutVergleichDonuts(n, stacked);

    chart.vergleichDonutStations = stationResults;
    chart.vergleichDonutStacked = stacked;

    chart.update({
        chart: { height },
        title: { text: `Anteil der Verkehrsrichtungen am ${tagesverkehrLabel}` },
        tooltip: {
            enabled: true,
            useHTML: true,
            borderRadius: 8,
            padding: 10,
            style: { fontSize: '14px', lineHeight: '1.4' },
            formatter: function () {
                return `<b>${this.series.name}</b><br/>`
                    + `<span style="color:${this.point.color}">\u25CF</span> ${this.point.name}<br/>`
                    + `${dtvLabel}: <b>${Highcharts.numberFormat(this.y, 0)}</b>`
                    + ` (${Highcharts.numberFormat(this.percentage, 1)}%)`;
            }
        }
    }, false);
    syncDonutCellHeight(chart, height);

    if (chart.vergleichDonutLabels) {
        chart.vergleichDonutLabels.forEach(lbl => lbl.destroy());
    }
    chart.vergleichDonutLabels = [];

    while (chart.series.length > 0) {
        chart.series[0].remove(false);
    }
    if (chart.lbl) chart.lbl.hide();

    stationResults.forEach((r, i) => {
        const pieData = (r.directionPieData && r.directionPieData.length)
            ? r.directionPieData
            : [{ name: r.label, y: r.dayTotal || 0, color: '#6f6f6f' }];
        const layout = centers[i];

        chart.addSeries({
            type: 'pie',
            id: `vergleich-donut-${r.id}`,
            name: r.label,
            center: layout.center,
            size: layout.size,
            innerSize: '70%',
            showInLegend: false,
            data: pieData,
            dataLabels: { enabled: false },
            enableMouseTracking: true
        }, false);
    });

    chart.redraw();
    // setSize after redraw so Dashboards picks up the new cell height
    if (typeof chart.setSize === 'function') {
        chart.setSize(undefined, height, false);
    }
    syncDonutCellHeight(chart, height);
    placeVergleichDonutLabels(chart, stationResults, centers, stacked);

    // Re-layout on breakpoint cross (desktop grid ↔ mobile stack)
    if (!chart.vergleichDonutResizeBound) {
        let resizeTimer = null;
        chart.vergleichDonutResizeBound = () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const stations = chart.vergleichDonutStations;
                if (!stations?.length) return;
                const nowStacked = (chart.chartWidth || chart.container?.clientWidth || 900) < DONUT_STACK_BREAKPOINT;
                if (nowStacked === chart.vergleichDonutStacked) {
                    const layout = layoutVergleichDonuts(stations.length, nowStacked);
                    chart.update({ chart: { height: layout.height } }, false);
                    syncDonutCellHeight(chart, layout.height);
                    stations.forEach((_, i) => {
                        const s = chart.series[i];
                        if (s) {
                            s.update({
                                center: layout.centers[i].center,
                                size: layout.centers[i].size
                            }, false);
                        }
                    });
                    chart.redraw();
                    placeVergleichDonutLabels(chart, stations, layout.centers, nowStacked);
                    return;
                }
                renderVergleichDonuts(chart, stations);
            }, 150);
        };
        window.addEventListener('resize', chart.vergleichDonutResizeBound);
    }
}

function placeVergleichDonutLabels(chart, stationResults, centers, stacked) {
    if (chart.vergleichDonutLabels) {
        chart.vergleichDonutLabels.forEach(lbl => lbl.destroy());
    }
    const n = stationResults.length;
    chart.vergleichDonutLabels = stationResults.map((r, i) => {
        const maxLen = stacked ? 36 : (n >= 5 ? 18 : n >= 3 ? 24 : 34);
        const labelText = r.label.length > maxLen ? `${r.label.slice(0, maxLen - 1)}…` : r.label;
        const layout = centers[i];
        const cxPct = parseFloat(layout.center[0]) / 100;
        const cyPct = parseFloat(layout.center[1]) / 100;
        const sizePct = parseFloat(layout.size) / 100;
        // Highcharts pie size is relative to the smaller plot dimension
        const donutRadiusPx = Math.min(chart.plotWidth, chart.plotHeight) * sizePct * 0.5;
        const x = chart.plotLeft + chart.plotWidth * cxPct;
        const donutCenterY = chart.plotTop + chart.plotHeight * cyPct;
        const y = donutCenterY - donutRadiusPx - DONUT_LABEL_GAP_PX;
        return chart.renderer
            .text(labelText, x, Math.max(chart.plotTop + 14, y), false)
            .attr({ align: 'center', zIndex: 10 })
            .css({
                fontSize: stacked || n <= 2 ? '14px' : (n >= 5 ? '12px' : '13px'),
                fontWeight: 'bold',
                textAlign: 'center',
                color: '#333'
            })
            .add();
    });
}
