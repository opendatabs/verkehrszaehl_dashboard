import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    filterToSelectedTimeRange,
    extractDailyTraffic,
    extractDailyApproval,
    aggregateWeeklyTraffic,
    processWeeklyBoxPlotData,
    updateExporting,
    getTrafficLabel,
    isVerteilungOpen,
    isZeitraumOverPerfThreshold,
    normalizeZsts,
    setZstTrailingEmpty,
    vergleichColor,
    resetChartSeriesForMode,
    restoreDurchschnittSeries,
    vergleichScatterOffset,
    getStationName,
    intersectDailyCoverage,
    clampTimeRangeToCoverage
} from "../../src/functions.js";
import { wochentage } from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zstsInput, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        , // filter-selection-2 (dayrange buttons)
        timelineChart,
        weeklyTable,
        weeklyDTVChart,
        , // filter-section-3
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterPlotGesamt,
    ] = board.mountedComponents.map(c => c.component);

    let zsts = normalizeZsts(zstsInput);
    // Do not clear multi-ZST on newType — page load uses newType=true.
    // Verkehrsmittel change already passes a single-zst list from the filter listener.

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    const lastZstsKey = zsts.join(',');
    
    if (!zsts.length && zaehlstellen && zaehlstellen.length > 0) {
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

    // Determine if we're using speed classes or fzgtyp
    const hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    const dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    const filterKeys = hasSpeedSelection ? speed : fzgtyp;

    if (newType) {
        // Update the credits text of weeklyTable, weeklyDTVChart and boxPlot
        updateCredits(weeklyTable.grid.credits, type);
        updateCredits(weeklyDTVChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterPlotGesamt.chart.credits, type);
    }

    if (zsts.length > 1) {
        await updateBoardVergleichWeekly({
            board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
            timelineChart, weeklyTable, weeklyDTVChart, boxPlot, scatterChart, boxPlotGesamt, scatterPlotGesamt, zaehlstellen
        });
        return;
    }

    resetChartSeriesForMode(weeklyDTVChart.chart, { vergleichMode: false, baseCount: 4 });
    restoreDurchschnittSeries(weeklyDTVChart.chart);

    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    let weeklyTraffic = await board.dataPool.connectors['Weekly Traffic'].getTable()

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
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'weekly')
            ? 'inline-flex'
            : 'none';
    }

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    if (newZst) {
        const {dailyTraffic} = extractDailyTraffic(dailyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(dailyTraffic);
    }

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();
    // Aggregate weekly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerWeekday,
        directionNames: weeklyDirectionNames,
        dailyTotalsPerWeekdayTotal,
        dailyTotalsPerWeekdayPerDirection,
        dailyScatterPerWeekdayPerDirection,
        dailyScatterPerWeekdayTotal
    } = aggregateWeeklyTraffic(filteredDailyDataRows, filterKeys, isMoFrSelected, isSaSoSelected, includeDistribution);


    const isSingleDirection = weeklyDirectionNames.length < 2;
    const totalLabel = isSingleDirection ? weeklyDirectionNames[0] : 'Gesamtquerschnitt';

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

    // Map direction names to ri1, ri2, etc.
    const directionToRiWeekly = {};
    weeklyDirectionNames.forEach((direction, index) => {
        directionToRiWeekly[direction] = `ri${index + 1}`;
    });

    // Reset the columns of weeklyTraffic Connector
    weeklyTraffic.setColumns({});

    // Initialize dtv_weekly_totals
    const dtv_weekly_totals = {};
    for (let i = 0; i < 7; i++) {
        dtv_weekly_totals[i] = {};
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            dtv_weekly_totals[i][ri] = null;
        });
    }

    // Build DTV columns for weekly data
    let dtv_ri_columns_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        const ri = directionToRiWeekly[direction];
        dtv_ri_columns_weekly[`dtv_${ri}`] = [];
    });

    let dtv_total_weekly = [];
    let dtv_abweichung;

    let dtv_total_direction_totals_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        const ri = directionToRiWeekly[direction];
        dtv_total_direction_totals_weekly[ri] = null;
    });

    let dtv_total_total_weekly = 0;
    let num_weekdays_measured = 0;

    // Populate dtv_weekly_totals
    dailyAvgPerWeekday.forEach(item => {
        const weekday = item.weekday;
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiWeekly[direction];

        if (ri) {
            dtv_weekly_totals[weekday][ri] += total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build dtv_ri_columns_weekly and dtv_total_weekly
    for (let i = 0; i < 7; i++) {
        let weekday_total = 0;
        let anyData = false;
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const value = dtv_weekly_totals[i][ri];
            dtv_ri_columns_weekly[`dtv_${ri}`].push(value);
            if (value !== null && value !== undefined) {
                dtv_total_direction_totals_weekly[ri] += value;
                weekday_total += value;
                anyData = true;
            }
        });
        if (anyData) {
            dtv_total_weekly.push(weekday_total);
            dtv_total_total_weekly += weekday_total;
            num_weekdays_measured++;
        } else {
            dtv_total_weekly.push(null);
        }
    }

    // Compute dtv_abweichung (Deviation from average)
    const average_dtv_total_weekly = dtv_total_total_weekly / num_weekdays_measured;
    dtv_abweichung = dtv_total_weekly.map(value => {
        if (value) {
            return (value / average_dtv_total_weekly) * 100;
        }
        return null;
    });

    // Build columns for the Weekly Traffic Connector
    const columnsWeekly = {
        'wochentag': wochentage
    };

    if (!isSingleDirection) {
        Object.assign(columnsWeekly, dtv_ri_columns_weekly);
    }

    Object.assign(columnsWeekly, {
        'dtv_total': dtv_total_weekly,
        'average_dtv_total': Array(7).fill(average_dtv_total_weekly),
        'dtv_abweichung': dtv_abweichung
    });
    window.__vzWeeklyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [
            !isSingleDirection
                ? ['Wochentag', weeklyDirectionNames[0], weeklyDirectionNames[1], totalLabel, 'Durchschnitt']
                : ['Wochentag', totalLabel, 'Durchschnitt'],
            !isSingleDirection
                ? ['Wochentag', weeklyDirectionNames[0], weeklyDirectionNames[1], totalLabel, 'Durchschnitt']
                : ['Wochentag', totalLabel, 'Durchschnitt'],
            ...wochentage.map((day, i) => (
                !isSingleDirection
                    ? [day, dtv_ri_columns_weekly.dtv_ri1?.[i] ?? null, dtv_ri_columns_weekly.dtv_ri2?.[i] ?? null, dtv_total_weekly?.[i] ?? null, average_dtv_total_weekly ?? null]
                    : [day, dtv_total_weekly?.[i] ?? null, average_dtv_total_weekly ?? null]
            ))
        ]
    };

    weeklyTraffic.setColumns(columnsWeekly);

    // Build the DataGrid columns dynamically
    let dataGridColumnsWeekly = [
        {
            id: 'wochentag',
            header: {
                format: 'Wochentag'
            }
        }
    ];

    if (!isSingleDirection) {
        // Add columns for each direction
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            dataGridColumnsWeekly.push({
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

    // Add total and deviation columns
    dataGridColumnsWeekly.push(
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
            id: 'dtv_abweichung',
            header: {
                format: 'Abw. vom Durchschnitt'
            },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 1)}%` : '';
                }
            }
        }
    );

    // Update the DataGrid columns
    const tagesverkehrLabel = getTrafficLabel('Durchschnittlicher Tagesverkehr');
    if (isSingleDirection) {
        weeklyTable.grid.update({
            header: [
                {
                    columnId: "wochentag",
                },
                {
                    format: tagesverkehrLabel,
                    columns: [
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsWeekly
        });
    } else {
        weeklyTable.grid.update({
            header: [
                {
                    columnId: "wochentag",
                },
                {
                    format: tagesverkehrLabel,
                    columns: [
                        "dtv_ri1",
                        "dtv_ri2",
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsWeekly
        });
    }

    // Update the weekly table data
    if (isSingleDirection) {
        weeklyDTVChart.chart.series[0].update({
            name: 'Richtung 1',
            visible: false,
            showInLegend: false
        });
        weeklyDTVChart.chart.series[1].update({
            name: 'Richtung 2',
            visible: false,
            showInLegend: false
        });
    } else {
        weeklyDTVChart.chart.series[0].update({
            name: weeklyDirectionNames[0],
            visible: true,
            showInLegend: true
        });
        weeklyDTVChart.chart.series[1].update({
            name: weeklyDirectionNames[1],
            visible: true,
            showInLegend: true
        });
    }

    weeklyDTVChart.chart.series[2].update({
        name: totalLabel,
    });
    
    // Update chart title and axis labels based on weekday selection
    const dtvLabel = getTrafficLabel('DTV');
    const tagesverkehrLabelShort = getTrafficLabel('Tagesverkehr');
    weeklyDTVChart.chart.update({
        title: {
            text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel}) nach Wochentag`
        },
        yAxis: {
            title: {
                text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel})`
            }
        }
    }, false);
    
    // Update box plot and scatter chart titles and axis labels
    if (boxPlot) {
        boxPlot.chart.update({
            title: {
                text: `Verteilung des ${tagesverkehrLabelShort}s nach Wochentag`
            },
            yAxis: {
                title: {
                    text: tagesverkehrLabelShort
                }
            }
        }, false);
    }
    
    if (scatterChart) {
        scatterChart.chart.update({
            title: {
                text: `Einzelmessungen ${tagesverkehrLabelShort} nach Wochentag`
            },
            yAxis: {
                title: {
                    text: `${tagesverkehrLabelShort} (Einzelmessungen)`
                }
            }
        }, false);
    }
    
    if (boxPlotGesamt) {
        boxPlotGesamt.chart.update({
            title: {
                text: `Verteilung des ${tagesverkehrLabelShort}s – Gesamtquerschnitt`
            },
            yAxis: {
                title: {
                    text: tagesverkehrLabelShort
                }
            }
        }, false);
    }
    
    if (scatterPlotGesamt) {
        scatterPlotGesamt.chart.update({
            title: {
                text: `Einzelmessungen ${tagesverkehrLabelShort} – Gesamtquerschnitt`
            },
            yAxis: {
                title: {
                    text: `${tagesverkehrLabelShort} (Einzelmessungen)`
                }
            }
        }, false);
    }

    // Process box plot data
    if (includeDistribution) {
    const boxPlotDataWeekly = processWeeklyBoxPlotData(
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal,
        weeklyDirectionNames,
        directionToRiWeekly,
        isSingleDirection
    );

    const directionSeriesWeekly = boxPlotDataWeekly.filter(s => s.id !== 'series-gesamt');
    const totalSeriesWeekly     = boxPlotDataWeekly.find(s => s.id === 'series-gesamt');

    // Clear both charts
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }
    while (boxPlotGesamt.chart.series.length > 0) {
        boxPlotGesamt.chart.series[0].remove(false);
    }

    // Richtungen chart
    if (!isSingleDirection) {
        directionSeriesWeekly.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    }

    // Gesamtchart
    if (totalSeriesWeekly) {
        totalSeriesWeekly.name = totalLabel;
        boxPlotGesamt.chart.addSeries(totalSeriesWeekly, false);
    }

    boxPlot.chart.redraw();
    boxPlotGesamt.chart.redraw();

    // --- Update weekly scatter chart ---
    // Remove existing series from scatter chart
    while (scatterChart.chart.series.length > 0) {
        scatterChart.chart.series[0].remove(false);
    }

    if (!isSingleDirection) {
        // Two directions: use horizontal offset so they appear side by side per weekday
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const dirScatter = dailyScatterPerWeekdayPerDirection[direction] || {};
            const allPoints = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;
            const baseColor = ri === 'ri1' ? '#007a2f' : '#008ac3';

            for (let weekday = 0; weekday < 7; weekday++) {
                const arr = dirScatter[weekday] || [];
                arr.forEach(p => {
                    const point = {
                        x: weekday + offset, // shifted position
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

                for (let weekday = 0; weekday < 7; weekday++) {
                    const arr = dirScatter[weekday] || [];
                    arr.forEach(p => {
                        const isApproved = approvalMap.get(p.date) !== false;
                        const point = {
                            x: weekday + offset,
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
        // Only one direction: center points on the weekday and use grey color
        const direction = weeklyDirectionNames[0];
        const dirScatter = dailyScatterPerWeekdayPerDirection[direction] || {};
        const allPoints = [];

        for (let weekday = 0; weekday < 7; weekday++) {
            const arr = dirScatter[weekday] || [];
            arr.forEach(p => {
                const point = {
                    x: weekday,
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
                    color: '#6f6f6f' // grey for single direction
                }, false);
            }
        } else {
            // Split into approved/unapproved when not using speed classes
            const approvedPoints = [];
            const unapprovedPoints = [];

            for (let weekday = 0; weekday < 7; weekday++) {
                const arr = dirScatter[weekday] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: weekday,
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
                    color: '#6f6f6f' // grey for single direction
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

    // --- Gesamtquerschnitt scatter chart ---
    while (scatterPlotGesamt.chart.series.length > 0) {
        scatterPlotGesamt.chart.series[0].remove(false);
    }

    if (hasSpeedSelection) {
        // When speed classes are selected, skip validation logic and show all points
        const gesamtAllPoints = [];
        if (dailyScatterPerWeekdayTotal) {
            for (let weekday = 0; weekday < 7; weekday++) {
                const arr = dailyScatterPerWeekdayTotal[weekday] || [];
                arr.forEach(p => {
                    const point = {
                        x: weekday,
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
        if (dailyScatterPerWeekdayTotal) {
            for (let weekday = 0; weekday < 7; weekday++) {
                const arr = dailyScatterPerWeekdayTotal[weekday] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: weekday,
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

    await updateExporting(board, boxPlot.chart.exporting, 'weekly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChart.chart.exporting, 'weekly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'weekly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterPlotGesamt.chart.exporting, 'weekly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    // Update exporting options
    await updateExporting(board, weeklyDTVChart.chart.exporting, 'weekly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
}

async function updateBoardVergleichWeekly({
    board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
    timelineChart, weeklyTable, weeklyDTVChart, boxPlot, scatterChart, boxPlotGesamt, scatterPlotGesamt, zaehlstellen
}) {
    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();
    const nameById = new Map((zaehlstellen || []).map(s => [String(s.id), s.name]));

    const dailyRowsById = {};
    await Promise.all(zsts.map(async id => {
        dailyRowsById[id] = await readCSV(`../data/${dataType}/${id}_daily.csv`);
    }));
    const dailyTraffics = zsts.map(id => extractDailyTraffic(dailyRowsById[id], filterKeys).dailyTraffic);
    const coverage = intersectDailyCoverage(dailyTraffics);
    if (coverage.minDate != null && coverage.maxDate != null) {
        timeRange = clampTimeRangeToCoverage(timeRange, coverage.minDate, coverage.maxDate);
    }
    if (newZst || coverage.dailyTraffic.length) {
        timelineChart.chart.series[0].setData(coverage.dailyTraffic);
    }

    const stationResults = await Promise.all(zsts.map(async (id, index) => {
        const dailyDataRows = dailyRowsById[id];
        const dailyApproval = extractDailyApproval(dailyDataRows);
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        const filtered = filterToSelectedTimeRange(dailyDataRows, timeRange);
        const {
            aggregatedData,
            dailyTotalsPerWeekdayTotal,
            dailyScatterPerWeekdayTotal
        } = aggregateWeeklyTraffic(filtered, filterKeys, isMoFrSelected, isSaSoSelected, includeDistribution);

        const byWeekday = {};
        aggregatedData.forEach(item => {
            if (!byWeekday[item.weekday]) byWeekday[item.weekday] = { total: 0, numberOfDays: item.numberOfDays };
            byWeekday[item.weekday].total += item.total;
            byWeekday[item.weekday].numberOfDays = item.numberOfDays;
        });
        const dtv_total = [];
        let sum = 0;
        let n = 0;
        for (let i = 0; i < 7; i++) {
            const entry = byWeekday[i];
            const mean = entry && entry.numberOfDays ? entry.total / entry.numberOfDays : null;
            dtv_total.push(mean);
            if (mean != null) { sum += mean; n++; }
        }
        const label = nameById.has(String(id))
            ? `${id} ${nameById.get(String(id))}`
            : `${id} ${await getStationName(type, id)}`;

        return {
            id: String(id),
            label,
            color: vergleichColor(index),
            dailyDataRows,
            approvalMap,
            dtv_total,
            avg: n ? sum / n : null,
            dailyTotalsPerWeekdayTotal,
            dailyScatterPerWeekdayTotal,
            hasUnapproved: !hasSpeedSelection && dailyApproval.some(([ts, fullyApproved]) =>
                ts >= timeRange[0] && ts <= timeRange[1] && fullyApproved === false
            )
        };
    }));

    const timeRangeWarning = document.querySelector('.time-range-warning');
    if (timeRangeWarning) {
        timeRangeWarning.style.display = stationResults.some(r => r.hasUnapproved) ? 'inline-flex' : 'none';
    }
    const timeRangePerfWarning = document.querySelector('.time-range-perf-warning');
    if (timeRangePerfWarning) {
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'weekly') ? 'inline-flex' : 'none';
    }

    const scopeGroup = document.getElementById('chart-scope-group');
    const scopeGesamt = document.getElementById('chart-scope-gesamt');
    if (scopeGroup && scopeGesamt) {
        scopeGroup.style.display = 'none';
        scopeGesamt.checked = true;
        if (window.applyChartTypeAndScopeVisibility) window.applyChartTypeAndScopeVisibility();
    }

    const weeklyTraffic = await board.dataPool.connectors['Weekly Traffic'].getTable();

    const columns = { wochentag: wochentage };
    stationResults.forEach((r, i) => { columns[`dtv_zst_${i}`] = r.dtv_total; });
    // Clear single-mode connector columns (incl. Durchschnitt) so they stay hidden
    columns.dtv_ri1 = Array(7).fill(null);
    columns.dtv_ri2 = Array(7).fill(null);
    columns.dtv_total = Array(7).fill(null);
    columns.average_dtv_total = Array(7).fill(null);
    columns.dtv_abweichung = Array(7).fill(null);
    weeklyTraffic.setColumns(columns);

    window.__vzWeeklyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [
            ['Wochentag', ...stationResults.map(r => r.label)],
            ['Wochentag', ...stationResults.map(r => r.label)],
            ...wochentage.map((day, i) => [
                day,
                ...stationResults.map(r => r.dtv_total[i] ?? null)
            ])
        ]
    };

    // No Abw. vom Durchschnitt in Vergleich — not meaningful across stations
    const tagesverkehrLabel = getTrafficLabel('Durchschnittlicher Tagesverkehr');
    weeklyTable.grid.update({
        header: [
            { columnId: 'wochentag' },
            {
                format: tagesverkehrLabel,
                columns: stationResults.map((_, i) => `dtv_zst_${i}`)
            }
        ],
        columns: [
            { id: 'wochentag', header: { format: 'Wochentag' } },
            ...stationResults.map((r, i) => ({
                id: `dtv_zst_${i}`,
                header: { format: r.label },
                cells: { formatter() { return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : ''; } }
            }))
        ]
    });

    // baseCount 4 includes series-durchschnitt (ri1, ri2, gesamt, durchschnitt)
    resetChartSeriesForMode(weeklyDTVChart.chart, { vergleichMode: true, baseCount: 4 });
    stationResults.forEach(r => {
        weeklyDTVChart.chart.addSeries({
            id: `vergleich-${r.id}`,
            name: r.label,
            type: 'column',
            data: r.dtv_total,
            color: r.color,
            visible: true,
            showInLegend: true
        }, false);
    });
    weeklyDTVChart.chart.redraw();

    if (includeDistribution) {
        while (boxPlot.chart.series.length > 0) boxPlot.chart.series[0].remove(false);
        while (scatterChart.chart.series.length > 0) scatterChart.chart.series[0].remove(false);
        while (boxPlotGesamt.chart.series.length > 0) boxPlotGesamt.chart.series[0].remove(false);
        while (scatterPlotGesamt.chart.series.length > 0) scatterPlotGesamt.chart.series[0].remove(false);

        const nStations = stationResults.length;
        stationResults.forEach((r, index) => {
            const offset = vergleichScatterOffset(index, nStations);
            const boxPlotData = processWeeklyBoxPlotData({}, r.dailyTotalsPerWeekdayTotal, [], {}, true);
            const totalSeries = boxPlotData.find(s => s.id === 'series-gesamt');
            if (totalSeries) {
                boxPlotGesamt.chart.addSeries({
                    ...totalSeries,
                    id: `vergleich-box-${r.id}`,
                    name: r.label,
                    color: r.color
                }, false);
            }
            const all = [];
            const approved = [];
            const unapproved = [];
            if (r.dailyScatterPerWeekdayTotal) {
                for (let wd = 0; wd < 7; wd++) {
                    (r.dailyScatterPerWeekdayTotal[wd] || []).forEach(p => {
                        const point = { x: wd + offset, y: p.value, date: p.date };
                        all.push(point);
                        if (r.approvalMap.get(p.date) !== false) approved.push(point);
                        else unapproved.push(point);
                    });
                }
            }
            if (hasSpeedSelection) {
                if (all.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}`, name: r.label, data: all, color: r.color
                    }, false);
                }
            } else {
                if (approved.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}`, name: r.label, data: approved, color: r.color
                    }, false);
                }
                if (unapproved.length) {
                    scatterPlotGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}-nv`, name: `${r.label} (nicht validiert)`,
                        data: unapproved, color: r.color, marker: { lineColor: '#FFBB1A', lineWidth: 2 }
                    }, false);
                }
            }
        });
        boxPlot.chart.redraw();
        scatterChart.chart.redraw();
        boxPlotGesamt.chart.redraw();
        scatterPlotGesamt.chart.redraw();
        await updateExporting(board, boxPlot.chart.exporting, 'weekly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChart.chart.exporting, 'weekly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, boxPlotGesamt.chart.exporting, 'weekly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterPlotGesamt.chart.exporting, 'weekly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    await updateExporting(board, weeklyDTVChart.chart.exporting, 'weekly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
}
