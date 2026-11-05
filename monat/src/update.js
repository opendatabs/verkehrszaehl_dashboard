import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    extractMonthlyTraffic,
    filterToSelectedTimeRange,
    extractDailyApproval,
    aggregateMonthlyTraffic,
    aggregateMonthlyWeather,
    processMonthlyBoxPlotData,
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
    clampTimeRangeToCoverage,
    extractDailyTraffic,
    setTimeRangeSelectorVisible,
    updateTimeRangeNavigator,
    pushSeriesData,
    bindVergleichHighlightSync,
    clearVergleichHighlightSync,
    setDashboardHighlightSync
} from "../../src/functions.js";
import {monate} from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zstsInput, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        , // filter-selection-2 (dayrange buttons)
        timelineChart,
        monthlyTable,
        monthlyDTVChart,
        monthlyWeatherChart,
        , //filter-section-3
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterChartGesamt
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
        // Update the credits of monthlyTable, monthlyDTVChart, monthlyWeatherChart and boxPlot
        updateCredits(monthlyTable.grid.credits, type);
        updateCredits(monthlyDTVChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterChartGesamt.chart.credits, type);
    }

    if (zsts.length > 1) {
        setTimeRangeSelectorVisible(false);
        await updateBoardVergleichMonthly({
            board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
            timelineChart, monthlyTable, monthlyDTVChart, monthlyWeatherChart,
            boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt, zaehlstellen
        });
        return;
    }

    setTimeRangeSelectorVisible(true);
    if (monthlyDTVChart?._vergleichSyncCleanup) {
        monthlyDTVChart._vergleichSyncCleanup();
        monthlyDTVChart._vergleichSyncCleanup = null;
    }
    clearVergleichHighlightSync([monthlyDTVChart, monthlyWeatherChart]);
    setDashboardHighlightSync(monthlyTable, true);
    setDashboardHighlightSync(monthlyDTVChart, true);
    setDashboardHighlightSync(monthlyWeatherChart, true);
    resetChartSeriesForMode(monthlyDTVChart.chart, { vergleichMode: false, baseCount: 4 });
    restoreDurchschnittSeries(monthlyDTVChart.chart);

    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    const monthlyDataRows = await readCSV(`../data/${dataType}/${zst}_monthly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    let monthlyTraffic = await board.dataPool.connectors['Monthly Traffic'].getTable()

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
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'monthly')
            ? 'inline-flex'
            : 'none';
    }

    if (newZst) {
        const aggregatedTrafficData = extractMonthlyTraffic(monthlyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(aggregatedTrafficData);
    }

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();
    // Aggregate monthly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerMonth,
        directionNames: monthlyDirectionNames,
        dailyTotalsPerMonthTotal,
        dailyTotalsPerMonthPerDirection,
        dailyScatterPerMonthPerDirection
    } = aggregateMonthlyTraffic(filteredDailyDataRows, filterKeys, isMoFrSelected, isSaSoSelected, includeDistribution);

    const isSingleDirection = monthlyDirectionNames.length < 2;
    const totalLabel = isSingleDirection ? monthlyDirectionNames[0] : 'Gesamtquerschnitt';

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
    const directionToRiMonthly = {};
    monthlyDirectionNames.forEach((direction, index) => {
        directionToRiMonthly[direction] = `ri${index + 1}`;
    });

    // Reset the columns of monthlyTraffic Connector
    monthlyTraffic.setColumns({});

    // Initialize dtv_monthly_totals
    const dtv_monthly_totals = {};
    for (let i = 0; i < 12; i++) {
        dtv_monthly_totals[i] = {};
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            dtv_monthly_totals[i][ri] = null;
        });
    }

    // Build DTV columns for monthly data
    let dtv_ri_columns_monthly = {};
    monthlyDirectionNames.forEach(direction => {
        const ri = directionToRiMonthly[direction];
        dtv_ri_columns_monthly[`dtv_${ri}`] = [];
    });

    let dtv_total_monthly = [];
    let dtv_abweichung;

    let dtv_total_direction_totals_monthly = {};
    monthlyDirectionNames.forEach(direction => {
        const ri = directionToRiMonthly[direction];
        dtv_total_direction_totals_monthly[ri] = null;
    });

    let dtv_total_total_monthly = 0;
    let num_months_measured = 0;

    // Populate dtv_monthly_totals
    dailyAvgPerMonth.forEach(item => {
        const month = item.month; // Month index (0-11)
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiMonthly[direction];

        if (ri !== undefined) {
            dtv_monthly_totals[month][ri] += total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build dtv_ri_columns_monthly and dtv_total_monthly
    for (let i = 0; i < 12; i++) {
        let month_total = 0;
        let anyData = false;
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            const value = dtv_monthly_totals[i][ri];
            dtv_ri_columns_monthly[`dtv_${ri}`].push(value);
            if (value) {
                dtv_total_direction_totals_monthly[ri] += value;
                month_total += value;
                anyData = true;
            }
        });
        if (anyData) {
            dtv_total_monthly.push(month_total);
            dtv_total_total_monthly += month_total;
            num_months_measured++;
        } else {
            dtv_total_monthly.push(null);
        }
    }

    // Compute dtv_abweichung (Deviation from average)
    const average_dtv_total_monthly = dtv_total_total_monthly / num_months_measured;
    dtv_abweichung = dtv_total_monthly.map(value => {
        if (value) {
            return (value / average_dtv_total_monthly) * 100;
        }
        return null;
    });

    // Build columns for the Monthly Traffic Connector
    const columnsMonthly = {
        'monat': monate
    };

    if (!isSingleDirection) {
        Object.assign(columnsMonthly, dtv_ri_columns_monthly);
    }

    Object.assign(columnsMonthly, {
        'dtv_total': dtv_total_monthly,
        'average_dtv_total': Array(12).fill(average_dtv_total_monthly),
        'dtv_abweichung': dtv_abweichung
    });

    // Keep a fresh monthly-chart export snapshot to avoid stale export rows.
    const monthlyExportHeader = !isSingleDirection
        ? ['Monat', monthlyDirectionNames[0], monthlyDirectionNames[1], totalLabel, 'Durchschnitt']
        : ['Monat', totalLabel, 'Durchschnitt'];
    const monthlyExportDataRows = monate.map((monthName, i) => {
        if (!isSingleDirection) {
            return [
                monthName,
                dtv_ri_columns_monthly.dtv_ri1?.[i] ?? null,
                dtv_ri_columns_monthly.dtv_ri2?.[i] ?? null,
                dtv_total_monthly?.[i] ?? null,
                average_dtv_total_monthly ?? null
            ];
        }
        return [
            monthName,
            dtv_total_monthly?.[i] ?? null,
            average_dtv_total_monthly ?? null
        ];
    });
    window.__vzMonthlyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [monthlyExportHeader, monthlyExportHeader, ...monthlyExportDataRows]
    };

    const { monthlyTemperatures, monthlyTempRange, monthlyPrecipitations } = aggregateMonthlyWeather(dailyTempRows, timeRange);
    window.__vzMonthlyWeatherExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [
            ['Monat', 'Temperaturspanne', 'Durchschnittstemperatur', 'Niederschlagssumme'],
            ['Monat', 'Temperaturspanne', 'Durchschnittstemperatur', 'Niederschlagssumme'],
            ...monate.map((month, i) => [
                month,
                monthlyTempRange?.[i] ?? [null, null],
                monthlyTemperatures?.[i] ?? null,
                monthlyPrecipitations?.[i] ?? null
            ])
        ]
    };

    Object.assign(columnsMonthly, {
        'monthly_temp': monthlyTemperatures,
        'monthly_temp_range': monthlyTempRange.map(([min, max]) => ({ low: min, high: max })),
        'monthly_precip': monthlyPrecipitations
    });

    monthlyTraffic.setColumns(columnsMonthly);
    // Recover DTV/weather series if Vergleich previously broke connector binding
    pushSeriesData(monthlyDTVChart.chart, {
        'series-ri1': columnsMonthly.dtv_ri1 || Array(12).fill(null),
        'series-ri2': columnsMonthly.dtv_ri2 || Array(12).fill(null),
        'series-gesamt': columnsMonthly.dtv_total,
        'series-durchschnitt': columnsMonthly.average_dtv_total
    }, true);
    pushSeriesData(monthlyWeatherChart.chart, {
        'temperatur-series': columnsMonthly.monthly_temp,
        'temperatur-range-series': columnsMonthly.monthly_temp_range,
        'niederschlag-series': columnsMonthly.monthly_precip
    }, true);

    // Build the DataGrid columns dynamically
    let dataGridColumnsMonthly = [
        {
            id: 'monat',
            header: {
                format: 'Monat'
            }
        }
    ];

    if (!isSingleDirection) {
        // Add columns for each direction
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            dataGridColumnsMonthly.push({
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
    dataGridColumnsMonthly.push(
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
        monthlyTable.grid.update({
            header: [
                {
                    columnId: "monat",
                },
                {
                    format: tagesverkehrLabel,
                    columns: [
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsMonthly
        });
    } else {
        monthlyTable.grid.update({
            header: [
                {
                    columnId: "monat",
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
            columns: dataGridColumnsMonthly
        });
    }

    // Update the monthly DTV chart
    if (isSingleDirection) {
        monthlyDTVChart.chart.series[0].update({
            name: 'Richtung 1',
            visible: false,
            showInLegend: false
        });
        monthlyDTVChart.chart.series[1].update({
            name: 'Richtung 2',
            visible: false,
            showInLegend: false
        });
    } else {
        monthlyDTVChart.chart.series[0].update({
            name: monthlyDirectionNames[0],
            visible: true,
            showInLegend: true
        });
        monthlyDTVChart.chart.series[1].update({
            name: monthlyDirectionNames[1],
            visible: true,
            showInLegend: true
        });
    }
    if (monthlyDTVChart.chart.series[2]) {
        monthlyDTVChart.chart.series[2].update({
            name: totalLabel,
            visible: true,
            showInLegend: true
        }, false);
    }
    
    // Update chart title and axis labels based on weekday selection
    const dtvLabel = getTrafficLabel('DTV');
    const tagesverkehrLabelShort = getTrafficLabel('Tagesverkehr');
    monthlyDTVChart.chart.update({
        title: {
            text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel}) nach Monat`
        },
        yAxis: {
            title: {
                text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel})`
            }
        }
    }, false);
    monthlyDTVChart.chart.redraw();
    monthlyWeatherChart?.chart?.redraw();
    
    // Update box plot and scatter chart titles and axis labels
    if (boxPlot) {
        boxPlot.chart.update({
            title: {
                text: `Verteilung des ${tagesverkehrLabelShort}s nach Monat`
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
                text: `Einzelmessungen ${tagesverkehrLabelShort} nach Monat`
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
    
    if (scatterChartGesamt) {
        scatterChartGesamt.chart.update({
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
    const boxPlotDataMonthly = processMonthlyBoxPlotData(
        dailyTotalsPerMonthPerDirection,
        dailyTotalsPerMonthTotal,
        monthlyDirectionNames,
        directionToRiMonthly,
        isSingleDirection
    );

    // Split into direction series & total series
    const directionSeriesMonthly = boxPlotDataMonthly.filter(s => s.id !== 'series-gesamt');
    const totalSeriesMonthly     = boxPlotDataMonthly.find(s => s.id === 'series-gesamt');

    // Clear both charts
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }
    while (boxPlotGesamt.chart.series.length > 0) {
        boxPlotGesamt.chart.series[0].remove(false);
    }

    // Richtungen-Chart: only directions, only if multiple directions
    if (!isSingleDirection) {
        directionSeriesMonthly.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    }

    // Gesamt-Chart: always show total series (renamed)
    if (totalSeriesMonthly) {
        totalSeriesMonthly.name = totalLabel;
        boxPlotGesamt.chart.addSeries(totalSeriesMonthly, false);
    }

    boxPlot.chart.redraw();
    boxPlotGesamt.chart.redraw();

    // --- Update monthly scatter chart (Einzelmessungen, keine Gesamtquerschnitt-Serie) ---
    // Remove existing series from scatter chart
    while (scatterChart.chart.series.length > 0) {
        scatterChart.chart.series[0].remove(false);
    }

    if (!isSingleDirection && monthlyDirectionNames.length > 0) {
        // Two directions: use horizontal offset so they appear side by side per month
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            const dirScatter = dailyScatterPerMonthPerDirection[direction] || {};
            const allPoints = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;
            const baseColor = ri === 'ri1' ? '#007a2f' : '#008ac3';

            for (let month = 0; month < 12; month++) {
                const arr = dirScatter[month] || [];
                arr.forEach(p => {
                    const point = {
                        x: month + offset, // shifted position
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

                for (let month = 0; month < 12; month++) {
                    const arr = dirScatter[month] || [];
                    arr.forEach(p => {
                        const isApproved = approvalMap.get(p.date) !== false;
                        const point = {
                            x: month + offset,
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
    } else if (monthlyDirectionNames.length > 0) {
        // Only one direction: center points on the month and use grey color
        const direction = monthlyDirectionNames[0];
        const dirScatter = dailyScatterPerMonthPerDirection[direction] || {};
        const allPoints = [];

        for (let month = 0; month < 12; month++) {
            const arr = dirScatter[month] || [];
            arr.forEach(p => {
                const point = {
                    x: month,
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

            for (let month = 0; month < 12; month++) {
                const arr = dirScatter[month] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: month,
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

    // --- Update monthly Gesamtquerschnitt scatter chart ---
    while (scatterChartGesamt.chart.series.length > 0) {
        scatterChartGesamt.chart.series[0].remove(false);
    }

    if (monthlyDirectionNames.length > 0) {
        if (hasSpeedSelection) {
            // When speed classes are selected, skip validation logic and show all points
            const gesamtAllPoints = [];

            for (let month = 0; month < 12; month++) {
                const totalsByDate = new Map();

                // Sum over directions per date
                monthlyDirectionNames.forEach(direction => {
                    const dirScatter = dailyScatterPerMonthPerDirection[direction] || {};
                    const arr = dirScatter[month] || [];
                    arr.forEach(p => {
                        const key = p.date;
                        const prev = totalsByDate.get(key) || 0;
                        totalsByDate.set(key, prev + p.value);
                    });
                });

                for (const [date, total] of totalsByDate.entries()) {
                    const point = {
                        x: month,
                        y: total,
                        date
                    };
                    gesamtAllPoints.push(point);
                }
            }

            if (gesamtAllPoints.length > 0) {
                scatterChartGesamt.chart.addSeries({
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

            for (let month = 0; month < 12; month++) {
                const totalsByDate = new Map();

                // Sum over directions per date
                monthlyDirectionNames.forEach(direction => {
                    const dirScatter = dailyScatterPerMonthPerDirection[direction] || {};
                    const arr = dirScatter[month] || [];
                    arr.forEach(p => {
                        const key = p.date;
                        const prev = totalsByDate.get(key) || 0;
                        totalsByDate.set(key, prev + p.value);
                    });
                });

                for (const [date, total] of totalsByDate.entries()) {
                    const isApproved = approvalMap.get(date) !== false;
                    const point = {
                        x: month,
                        y: total,
                        date
                    };
                    if (isApproved) {
                        gesamtApprovedPoints.push(point);
                    } else {
                        gesamtUnapprovedPoints.push(point);
                    }
                }
            }

            // Add approved series
            if (gesamtApprovedPoints.length > 0) {
                scatterChartGesamt.chart.addSeries({
                    type: 'scatter',
                    name: totalLabel,
                    data: gesamtApprovedPoints,
                    color: '#6f6f6f'
                }, false);
            }

            // Add unapproved series
            if (gesamtUnapprovedPoints.length > 0) {
                scatterChartGesamt.chart.addSeries({
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
    }

    scatterChartGesamt.chart.redraw();

    await updateExporting(board, boxPlot.chart.exporting, 'box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChart.chart.exporting, 'monthly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'monthly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChartGesamt.chart.exporting, 'monthly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    // Update exporting options
    await updateExporting(board, monthlyDTVChart.chart.exporting, 'monthly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, monthlyWeatherChart.chart.exporting, 'monthly-weather', '', '', '', timeRange);
}

async function updateBoardVergleichMonthly({
    board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeys,
    timelineChart, monthlyTable, monthlyDTVChart, monthlyWeatherChart,
    boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt, zaehlstellen
}) {
    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const includeDistribution = isVerteilungOpen();
    const nameById = new Map((zaehlstellen || []).map(s => [String(s.id), s.name]));
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);

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
    if (newZst || coverage.dailyTraffic.length) {
        updateTimeRangeNavigator(timelineChart, coverage.dailyTraffic, timeRange);
    }

    const stationResults = await Promise.all(zsts.map(async (id, index) => {
        const dailyDataRows = dailyRowsById[id];
        const monthlyDataRows = await readCSV(`../data/${dataType}/${id}_monthly.csv`);
        const dailyApproval = extractDailyApproval(dailyDataRows);
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        const filtered = filterToSelectedTimeRange(dailyDataRows, timeRange);
        const {
            aggregatedData,
            directionNames,
            dailyTotalsPerMonthTotal,
            dailyScatterPerMonthPerDirection
        } = aggregateMonthlyTraffic(filtered, filterKeys, isMoFrSelected, isSaSoSelected, includeDistribution);

        const byMonth = {};
        aggregatedData.forEach(item => {
            if (!byMonth[item.month]) byMonth[item.month] = { total: 0, numberOfDays: item.numberOfDays };
            byMonth[item.month].total += item.total;
            byMonth[item.month].numberOfDays = item.numberOfDays;
        });
        const dtv_total = [];
        for (let i = 0; i < 12; i++) {
            const entry = byMonth[i];
            const mean = entry && entry.numberOfDays ? entry.total / entry.numberOfDays : null;
            dtv_total.push(mean);
        }

        // Build Gesamt scatter by summing directions per date
        const dailyScatterPerMonthTotal = {};
        for (let month = 0; month < 12; month++) {
            const totalsByDate = new Map();
            directionNames.forEach(direction => {
                const arr = (dailyScatterPerMonthPerDirection[direction] || {})[month] || [];
                arr.forEach(p => {
                    totalsByDate.set(p.date, (totalsByDate.get(p.date) || 0) + p.value);
                });
            });
            dailyScatterPerMonthTotal[month] = [...totalsByDate.entries()].map(([date, value]) => ({ date, value }));
        }

        const label = nameById.has(String(id))
            ? `${id} ${nameById.get(String(id))}`
            : `${id} ${await getStationName(type, id)}`;

        return {
            id: String(id),
            label,
            color: vergleichColor(index),
            dailyDataRows,
            monthlyDataRows,
            approvalMap,
            dtv_total,
            dailyTotalsPerMonthTotal,
            dailyScatterPerMonthTotal,
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
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'monthly') ? 'inline-flex' : 'none';
    }

    const scopeGroup = document.getElementById('chart-scope-group');
    const scopeGesamt = document.getElementById('chart-scope-gesamt');
    if (scopeGroup && scopeGesamt) {
        scopeGroup.style.display = 'none';
        scopeGesamt.checked = true;
        if (window.applyChartTypeAndScopeVisibility) window.applyChartTypeAndScopeVisibility();
    }

    // Weather stays shared (not station-specific) — keep on connector for sync with DTV categories
    const { monthlyTemperatures, monthlyTempRange, monthlyPrecipitations } =
        aggregateMonthlyWeather(dailyTempRows, timeRange);

    const monthlyTraffic = await board.dataPool.connectors['Monthly Traffic'].getTable();

    const columns = { monat: monate };
    stationResults.forEach((r, i) => { columns[`dtv_zst_${i}`] = r.dtv_total; });
    // Clear single-mode connector columns (incl. Durchschnitt) so they stay hidden
    columns.dtv_ri1 = Array(12).fill(null);
    columns.dtv_ri2 = Array(12).fill(null);
    columns.dtv_total = Array(12).fill(null);
    columns.average_dtv_total = Array(12).fill(null);
    columns.dtv_abweichung = Array(12).fill(null);
    columns.monthly_temp = monthlyTemperatures;
    columns.monthly_temp_range = (monthlyTempRange || []).map(([min, max]) => ({ low: min, high: max }));
    columns.monthly_precip = monthlyPrecipitations;
    monthlyTraffic.setColumns(columns);
    // Ensure weather stays populated even if connector binding was broken earlier
    pushSeriesData(monthlyWeatherChart.chart, {
        'temperatur-series': columns.monthly_temp,
        'temperatur-range-series': columns.monthly_temp_range,
        'niederschlag-series': columns.monthly_precip
    });
    // Weather must stay trackable for DTV↔Wetter sync
    ['temperatur-series', 'temperatur-range-series', 'niederschlag-series'].forEach(id => {
        const s = monthlyWeatherChart.chart?.get(id)
            || monthlyWeatherChart.chart?.series?.find(ser => String(ser.options?.id || '') === id);
        if (s) s.update({ visible: true, enableMouseTracking: true }, false);
    });

    window.__vzMonthlyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [
            ['Monat', ...stationResults.map(r => r.label)],
            ['Monat', ...stationResults.map(r => r.label)],
            ...monate.map((m, i) => [
                m,
                ...stationResults.map(r => r.dtv_total[i] ?? null)
            ])
        ]
    };

    // No Abw. vom Durchschnitt in Vergleich — not meaningful across stations
    const tagesverkehrLabel = getTrafficLabel('Durchschnittlicher Tagesverkehr');
    monthlyTable.grid.update({
        header: [
            { columnId: 'monat' },
            {
                format: tagesverkehrLabel,
                columns: stationResults.map((_, i) => `dtv_zst_${i}`)
            }
        ],
        columns: [
            { id: 'monat', header: { format: 'Monat' } },
            ...stationResults.map((r, i) => ({
                id: `dtv_zst_${i}`,
                header: { format: r.label },
                cells: { formatter() { return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : ''; } }
            }))
        ]
    });

    // baseCount 4 includes series-durchschnitt (ri1, ri2, gesamt, durchschnitt)
    resetChartSeriesForMode(monthlyDTVChart.chart, { vergleichMode: true, baseCount: 4 });
    stationResults.forEach(r => {
        monthlyDTVChart.chart.addSeries({
            id: `vergleich-${r.id}`,
            name: r.label,
            type: 'column',
            data: r.dtv_total,
            color: r.color,
            visible: true,
            showInLegend: true
        }, false);
    });
    // Dashboards connector sync cannot match addSeries Vergleich columns — use custom index sync
    setDashboardHighlightSync(monthlyTable, false);
    setDashboardHighlightSync(monthlyDTVChart, false);
    setDashboardHighlightSync(monthlyWeatherChart, false);

    monthlyDTVChart.chart.redraw();
    monthlyWeatherChart?.chart?.redraw();

    if (includeDistribution) {
        while (boxPlot.chart.series.length > 0) boxPlot.chart.series[0].remove(false);
        while (scatterChart.chart.series.length > 0) scatterChart.chart.series[0].remove(false);
        while (boxPlotGesamt.chart.series.length > 0) boxPlotGesamt.chart.series[0].remove(false);
        while (scatterChartGesamt.chart.series.length > 0) scatterChartGesamt.chart.series[0].remove(false);

        const nStations = stationResults.length;
        stationResults.forEach((r, index) => {
            const offset = vergleichScatterOffset(index, nStations);
            const boxPlotData = processMonthlyBoxPlotData({}, r.dailyTotalsPerMonthTotal, [], {}, true);
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
            if (r.dailyScatterPerMonthTotal) {
                for (let m = 0; m < 12; m++) {
                    (r.dailyScatterPerMonthTotal[m] || []).forEach(p => {
                        const point = { x: m + offset, y: p.value, date: p.date };
                        all.push(point);
                        if (r.approvalMap.get(p.date) !== false) approved.push(point);
                        else unapproved.push(point);
                    });
                }
            }
            if (hasSpeedSelection) {
                if (all.length) {
                    scatterChartGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}`, name: r.label, data: all, color: r.color
                    }, false);
                }
            } else {
                if (approved.length) {
                    scatterChartGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}`, name: r.label, data: approved, color: r.color
                    }, false);
                }
                if (unapproved.length) {
                    scatterChartGesamt.chart.addSeries({
                        type: 'scatter', id: `vergleich-scatter-${r.id}-nv`, name: `${r.label} (nicht validiert)`,
                        data: unapproved, color: r.color, marker: { lineColor: '#FFBB1A', lineWidth: 2 }
                    }, false);
                }
            }
        });
        boxPlot.chart.redraw();
        scatterChart.chart.redraw();
        boxPlotGesamt.chart.redraw();
        scatterChartGesamt.chart.redraw();
        await updateExporting(board, boxPlot.chart.exporting, 'box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChart.chart.exporting, 'monthly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, boxPlotGesamt.chart.exporting, 'monthly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChartGesamt.chart.exporting, 'monthly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    await updateExporting(board, monthlyDTVChart.chart.exporting, 'monthly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, monthlyWeatherChart.chart.exporting, 'monthly-weather', '', '', '', timeRange);

    // Sync Grid ↔ DTV ↔ Wetter after exporting/connector churn
    if (monthlyDTVChart._vergleichSyncCleanup) monthlyDTVChart._vergleichSyncCleanup();
    monthlyDTVChart._vergleichSyncCleanup = bindVergleichHighlightSync(
        [monthlyDTVChart, monthlyWeatherChart],
        { grid: monthlyTable }
    );
}
