import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    extractMonthlyTraffic,
    filterToSelectedTimeRange,
    extractDailyApproval,
    aggregateYearlyTraffic,
    processYearlyBoxPlotData,
    getYearsInTimeRange,
    updateExporting,
    getTrafficLabel,
    getDayFilter,
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

/** Years are dynamic categories (one per year in the time range) on all year charts. */
function setYearCategories(charts, yearLabels) {
    charts.forEach(c => {
        c?.chart?.xAxis?.[0]?.setCategories(yearLabels, false);
    });
}

export async function updateBoard(board, type, strtyp, zstsInput, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        , // filter-selection-2 (dayrange buttons)
        timelineChart,
        yearlyTable,
        yearlyDTVChart,
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
    // Data columns per Zählstelle (Fahrzeugtypen are summed differently when Zählstellentypen are mixed)
    const filterKeysForZst = id => (hasSpeedSelection ? speed : next.fzgtypKeysByZst?.[String(id)]) || filterKeys;

    if (newType) {
        // Update the credits of yearlyTable, yearlyDTVChart and boxPlot
        updateCredits(yearlyTable.grid.credits, type);
        updateCredits(yearlyDTVChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterChartGesamt.chart.credits, type);
    }

    if (zsts.length > 1) {
        setTimeRangeSelectorVisible(false);
        await updateBoardVergleichYearly({
            board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeysForZst,
            timelineChart, yearlyTable, yearlyDTVChart,
            boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt, zaehlstellen
        });
        return;
    }

    setTimeRangeSelectorVisible(true);
    if (yearlyDTVChart?._vergleichSyncCleanup) {
        yearlyDTVChart._vergleichSyncCleanup();
        yearlyDTVChart._vergleichSyncCleanup = null;
    }
    clearVergleichHighlightSync([yearlyDTVChart]);
    setDashboardHighlightSync(yearlyTable, true);
    setDashboardHighlightSync(yearlyDTVChart, true);
    resetChartSeriesForMode(yearlyDTVChart.chart, { vergleichMode: false, baseCount: 4 });
    restoreDurchschnittSeries(yearlyDTVChart.chart);

    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    const monthlyDataRows = await readCSV(`../data/${dataType}/${zst}_monthly.csv`);
    let yearlyTraffic = await board.dataPool.connectors['Yearly Traffic'].getTable()

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
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'yearly')
            ? 'inline-flex'
            : 'none';
    }

    if (newZst) {
        const aggregatedTrafficData = extractMonthlyTraffic(monthlyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(aggregatedTrafficData);
    }

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    // One category per year in the selected time range
    const years = getYearsInTimeRange(timeRange);
    const numYears = years.length;
    const yearLabels = years.map(String);
    setYearCategories([yearlyDTVChart, boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt], yearLabels);

    const dayFilter = getDayFilter();
    const includeDistribution = isVerteilungOpen();
    // Aggregate yearly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerYear,
        directionNames: yearlyDirectionNames,
        dailyTotalsPerYearTotal,
        dailyTotalsPerYearPerDirection,
        dailyScatterPerYearPerDirection
    } = aggregateYearlyTraffic(filteredDailyDataRows, filterKeys, years, dayFilter, includeDistribution);

    const isSingleDirection = yearlyDirectionNames.length < 2;
    const totalLabel = isSingleDirection ? yearlyDirectionNames[0] : 'Gesamtquerschnitt';

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
    const directionToRiYearly = {};
    yearlyDirectionNames.forEach((direction, index) => {
        directionToRiYearly[direction] = `ri${index + 1}`;
    });

    // Reset the columns of yearlyTraffic Connector
    yearlyTraffic.setColumns({});

    // Initialize dtv_yearly_totals
    const dtv_yearly_totals = {};
    for (let i = 0; i < numYears; i++) {
        dtv_yearly_totals[i] = {};
        yearlyDirectionNames.forEach(direction => {
            const ri = directionToRiYearly[direction];
            dtv_yearly_totals[i][ri] = null;
        });
    }

    // Build DTV columns for yearly data
    let dtv_ri_columns_yearly = {};
    yearlyDirectionNames.forEach(direction => {
        const ri = directionToRiYearly[direction];
        dtv_ri_columns_yearly[`dtv_${ri}`] = [];
    });

    let dtv_total_yearly = [];
    let dtv_abweichung;

    let dtv_total_direction_totals_yearly = {};
    yearlyDirectionNames.forEach(direction => {
        const ri = directionToRiYearly[direction];
        dtv_total_direction_totals_yearly[ri] = null;
    });

    let dtv_total_total_yearly = 0;
    let num_years_measured = 0;

    // Populate dtv_yearly_totals
    dailyAvgPerYear.forEach(item => {
        const year = item.year; // Index into years
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiYearly[direction];

        if (ri !== undefined) {
            dtv_yearly_totals[year][ri] += total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build dtv_ri_columns_yearly and dtv_total_yearly
    for (let i = 0; i < numYears; i++) {
        let year_total = 0;
        let anyData = false;
        yearlyDirectionNames.forEach(direction => {
            const ri = directionToRiYearly[direction];
            const value = dtv_yearly_totals[i][ri];
            dtv_ri_columns_yearly[`dtv_${ri}`].push(value);
            if (value) {
                dtv_total_direction_totals_yearly[ri] += value;
                year_total += value;
                anyData = true;
            }
        });
        if (anyData) {
            dtv_total_yearly.push(year_total);
            dtv_total_total_yearly += year_total;
            num_years_measured++;
        } else {
            dtv_total_yearly.push(null);
        }
    }

    // Compute dtv_abweichung (Deviation from average)
    const average_dtv_total_yearly = dtv_total_total_yearly / num_years_measured;
    dtv_abweichung = dtv_total_yearly.map(value => {
        if (value) {
            return (value / average_dtv_total_yearly) * 100;
        }
        return null;
    });

    // Build columns for the Yearly Traffic Connector
    const columnsYearly = {
        'jahr': yearLabels
    };

    if (!isSingleDirection) {
        Object.assign(columnsYearly, dtv_ri_columns_yearly);
    }

    Object.assign(columnsYearly, {
        'dtv_total': dtv_total_yearly,
        'average_dtv_total': Array(numYears).fill(average_dtv_total_yearly),
        'dtv_abweichung': dtv_abweichung
    });

    // Keep a fresh yearly-chart export snapshot to avoid stale export rows.
    const yearlyExportHeader = !isSingleDirection
        ? ['Jahr', yearlyDirectionNames[0], yearlyDirectionNames[1], totalLabel, 'Durchschnitt']
        : ['Jahr', totalLabel, 'Durchschnitt'];
    const yearlyExportDataRows = yearLabels.map((yearName, i) => {
        if (!isSingleDirection) {
            return [
                yearName,
                dtv_ri_columns_yearly.dtv_ri1?.[i] ?? null,
                dtv_ri_columns_yearly.dtv_ri2?.[i] ?? null,
                dtv_total_yearly?.[i] ?? null,
                average_dtv_total_yearly ?? null
            ];
        }
        return [
            yearName,
            dtv_total_yearly?.[i] ?? null,
            average_dtv_total_yearly ?? null
        ];
    });
    window.__vzYearlyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [yearlyExportHeader, yearlyExportHeader, ...yearlyExportDataRows]
    };

    yearlyTraffic.setColumns(columnsYearly);
    // Recover DTV series if Vergleich previously broke connector binding
    pushSeriesData(yearlyDTVChart.chart, {
        'series-ri1': columnsYearly.dtv_ri1 || Array(numYears).fill(null),
        'series-ri2': columnsYearly.dtv_ri2 || Array(numYears).fill(null),
        'series-gesamt': columnsYearly.dtv_total,
        'series-durchschnitt': columnsYearly.average_dtv_total
    }, true);

    // Build the DataGrid columns dynamically
    let dataGridColumnsYearly = [
        {
            id: 'jahr',
            header: {
                format: 'Jahr'
            }
        }
    ];

    if (!isSingleDirection) {
        // Add columns for each direction
        yearlyDirectionNames.forEach(direction => {
            const ri = directionToRiYearly[direction];
            dataGridColumnsYearly.push({
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
    dataGridColumnsYearly.push(
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
        yearlyTable.grid.update({
            header: [
                {
                    columnId: "jahr",
                },
                {
                    format: tagesverkehrLabel,
                    columns: [
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsYearly
        });
    } else {
        yearlyTable.grid.update({
            header: [
                {
                    columnId: "jahr",
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
            columns: dataGridColumnsYearly
        });
    }

    // Update the yearly DTV chart
    if (isSingleDirection) {
        yearlyDTVChart.chart.series[0].update({
            name: 'Richtung 1',
            visible: false,
            showInLegend: false
        });
        yearlyDTVChart.chart.series[1].update({
            name: 'Richtung 2',
            visible: false,
            showInLegend: false
        });
    } else {
        yearlyDTVChart.chart.series[0].update({
            name: yearlyDirectionNames[0],
            visible: true,
            showInLegend: true
        });
        yearlyDTVChart.chart.series[1].update({
            name: yearlyDirectionNames[1],
            visible: true,
            showInLegend: true
        });
    }
    if (yearlyDTVChart.chart.series[2]) {
        yearlyDTVChart.chart.series[2].update({
            name: totalLabel,
            visible: true,
            showInLegend: true
        }, false);
    }
    
    // Update chart title and axis labels based on weekday selection
    const dtvLabel = getTrafficLabel('DTV');
    const tagesverkehrLabelShort = getTrafficLabel('Tagesverkehr');
    yearlyDTVChart.chart.update({
        title: {
            text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel}) nach Jahr`
        },
        yAxis: {
            title: {
                text: `Durchschnittlicher ${tagesverkehrLabelShort} (${dtvLabel})`
            }
        }
    }, false);
    yearlyDTVChart.chart.redraw();
    
    // Update box plot and scatter chart titles and axis labels
    if (boxPlot) {
        boxPlot.chart.update({
            title: {
                text: `Verteilung des ${tagesverkehrLabelShort}s nach Jahr`
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
                text: `Einzelmessungen ${tagesverkehrLabelShort} nach Jahr`
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
    const boxPlotDataYearly = processYearlyBoxPlotData(
        dailyTotalsPerYearPerDirection,
        dailyTotalsPerYearTotal,
        yearlyDirectionNames,
        directionToRiYearly,
        isSingleDirection,
        numYears
    );

    // Split into direction series & total series
    const directionSeriesYearly = boxPlotDataYearly.filter(s => s.id !== 'series-gesamt');
    const totalSeriesYearly     = boxPlotDataYearly.find(s => s.id === 'series-gesamt');

    // Clear both charts
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }
    while (boxPlotGesamt.chart.series.length > 0) {
        boxPlotGesamt.chart.series[0].remove(false);
    }

    // Richtungen-Chart: only directions, only if multiple directions
    if (!isSingleDirection) {
        directionSeriesYearly.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    }

    // Gesamt-Chart: always show total series (renamed)
    if (totalSeriesYearly) {
        totalSeriesYearly.name = totalLabel;
        boxPlotGesamt.chart.addSeries(totalSeriesYearly, false);
    }

    boxPlot.chart.redraw();
    boxPlotGesamt.chart.redraw();

    // --- Update yearly scatter chart (Einzelmessungen, keine Gesamtquerschnitt-Serie) ---
    // Remove existing series from scatter chart
    while (scatterChart.chart.series.length > 0) {
        scatterChart.chart.series[0].remove(false);
    }

    if (!isSingleDirection && yearlyDirectionNames.length > 0) {
        // Two directions: use horizontal offset so they appear side by side per year
        yearlyDirectionNames.forEach(direction => {
            const ri = directionToRiYearly[direction];
            const dirScatter = dailyScatterPerYearPerDirection[direction] || {};
            const allPoints = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;
            const baseColor = ri === 'ri1' ? '#007a2f' : '#008ac3';

            for (let year = 0; year < numYears; year++) {
                const arr = dirScatter[year] || [];
                arr.forEach(p => {
                    const point = {
                        x: year + offset, // shifted position
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

                for (let year = 0; year < numYears; year++) {
                    const arr = dirScatter[year] || [];
                    arr.forEach(p => {
                        const isApproved = approvalMap.get(p.date) !== false;
                        const point = {
                            x: year + offset,
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
    } else if (yearlyDirectionNames.length > 0) {
        // Only one direction: center points on the year and use grey color
        const direction = yearlyDirectionNames[0];
        const dirScatter = dailyScatterPerYearPerDirection[direction] || {};
        const allPoints = [];

        for (let year = 0; year < numYears; year++) {
            const arr = dirScatter[year] || [];
            arr.forEach(p => {
                const point = {
                    x: year,
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

            for (let year = 0; year < numYears; year++) {
                const arr = dirScatter[year] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: year,
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

    // --- Update yearly Gesamtquerschnitt scatter chart ---
    while (scatterChartGesamt.chart.series.length > 0) {
        scatterChartGesamt.chart.series[0].remove(false);
    }

    if (yearlyDirectionNames.length > 0) {
        if (hasSpeedSelection) {
            // When speed classes are selected, skip validation logic and show all points
            const gesamtAllPoints = [];

            for (let year = 0; year < numYears; year++) {
                const totalsByDate = new Map();

                // Sum over directions per date
                yearlyDirectionNames.forEach(direction => {
                    const dirScatter = dailyScatterPerYearPerDirection[direction] || {};
                    const arr = dirScatter[year] || [];
                    arr.forEach(p => {
                        const key = p.date;
                        const prev = totalsByDate.get(key) || 0;
                        totalsByDate.set(key, prev + p.value);
                    });
                });

                for (const [date, total] of totalsByDate.entries()) {
                    const point = {
                        x: year,
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

            for (let year = 0; year < numYears; year++) {
                const totalsByDate = new Map();

                // Sum over directions per date
                yearlyDirectionNames.forEach(direction => {
                    const dirScatter = dailyScatterPerYearPerDirection[direction] || {};
                    const arr = dirScatter[year] || [];
                    arr.forEach(p => {
                        const key = p.date;
                        const prev = totalsByDate.get(key) || 0;
                        totalsByDate.set(key, prev + p.value);
                    });
                });

                for (const [date, total] of totalsByDate.entries()) {
                    const isApproved = approvalMap.get(date) !== false;
                    const point = {
                        x: year,
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

    await updateExporting(board, boxPlot.chart.exporting, 'yearly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChart.chart.exporting, 'yearly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'yearly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChartGesamt.chart.exporting, 'yearly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    // Update exporting options
    await updateExporting(board, yearlyDTVChart.chart.exporting, 'yearly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);
}

async function updateBoardVergleichYearly({
    board, type, zsts, fzgtyp, speed, timeRange, newZst, hasSpeedSelection, dataType, filterKeysForZst,
    timelineChart, yearlyTable, yearlyDTVChart,
    boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt, zaehlstellen
}) {
    const dayFilter = getDayFilter();
    const includeDistribution = isVerteilungOpen();
    const nameById = new Map((zaehlstellen || []).map(s => [String(s.id), s.name]));

    const dailyRowsById = {};
    await Promise.all(zsts.map(async id => {
        dailyRowsById[id] = await readCSV(`../data/${dataType}/${id}_daily.csv`);
    }));
    const dailyTraffics = zsts.map(id => extractDailyTraffic(dailyRowsById[id], filterKeysForZst(id)).dailyTraffic);
    const coverage = intersectDailyCoverage(dailyTraffics);
    if (coverage.minDate != null && coverage.maxDate != null) {
        timeRange = clampTimeRangeToCoverage(timeRange, coverage.minDate, coverage.maxDate);
    }
    // Keep Zeitraum selector; domain = intersection coverage (series line hidden via CSS)
    if (newZst || coverage.dailyTraffic.length) {
        updateTimeRangeNavigator(timelineChart, coverage.dailyTraffic, timeRange);
    }

    // One category per year in the (clamped) time range
    const years = getYearsInTimeRange(timeRange);
    const numYears = years.length;
    const yearLabels = years.map(String);
    setYearCategories([yearlyDTVChart, boxPlot, scatterChart, boxPlotGesamt, scatterChartGesamt], yearLabels);

    const stationResults = await Promise.all(zsts.map(async (id, index) => {
        const dailyDataRows = dailyRowsById[id];
        const monthlyDataRows = await readCSV(`../data/${dataType}/${id}_monthly.csv`);
        const dailyApproval = extractDailyApproval(dailyDataRows);
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        const filtered = filterToSelectedTimeRange(dailyDataRows, timeRange);
        const {
            aggregatedData,
            directionNames,
            dailyTotalsPerYearTotal,
            dailyScatterPerYearPerDirection
        } = aggregateYearlyTraffic(filtered, filterKeysForZst(id), years, dayFilter, includeDistribution);

        const byYear = {};
        aggregatedData.forEach(item => {
            if (!byYear[item.year]) byYear[item.year] = { total: 0, numberOfDays: item.numberOfDays };
            byYear[item.year].total += item.total;
            byYear[item.year].numberOfDays = item.numberOfDays;
        });
        const dtv_total = [];
        for (let i = 0; i < numYears; i++) {
            const entry = byYear[i];
            const mean = entry && entry.numberOfDays ? entry.total / entry.numberOfDays : null;
            dtv_total.push(mean);
        }

        // Build Gesamt scatter by summing directions per date
        const dailyScatterPerYearTotal = {};
        for (let year = 0; year < numYears; year++) {
            const totalsByDate = new Map();
            directionNames.forEach(direction => {
                const arr = (dailyScatterPerYearPerDirection[direction] || {})[year] || [];
                arr.forEach(p => {
                    totalsByDate.set(p.date, (totalsByDate.get(p.date) || 0) + p.value);
                });
            });
            dailyScatterPerYearTotal[year] = [...totalsByDate.entries()].map(([date, value]) => ({ date, value }));
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
            dailyTotalsPerYearTotal,
            dailyScatterPerYearTotal,
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
        timeRangePerfWarning.style.display = isZeitraumOverPerfThreshold(timeRange, 'yearly') ? 'inline-flex' : 'none';
    }

    const scopeGroup = document.getElementById('chart-scope-group');
    const scopeGesamt = document.getElementById('chart-scope-gesamt');
    if (scopeGroup && scopeGesamt) {
        scopeGroup.style.display = 'none';
        scopeGesamt.checked = true;
        if (window.applyChartTypeAndScopeVisibility) window.applyChartTypeAndScopeVisibility();
    }

    const yearlyTraffic = await board.dataPool.connectors['Yearly Traffic'].getTable();

    const columns = { jahr: yearLabels };
    stationResults.forEach((r, i) => { columns[`dtv_zst_${i}`] = r.dtv_total; });
    // Clear single-mode connector columns (incl. Durchschnitt) so they stay hidden
    columns.dtv_ri1 = Array(numYears).fill(null);
    columns.dtv_ri2 = Array(numYears).fill(null);
    columns.dtv_total = Array(numYears).fill(null);
    columns.average_dtv_total = Array(numYears).fill(null);
    columns.dtv_abweichung = Array(numYears).fill(null);
    yearlyTraffic.setColumns(columns);

    window.__vzYearlyChartExportData = {
        timeRangeStart: timeRange?.[0] ?? null,
        timeRangeEnd: timeRange?.[1] ?? null,
        rows: [
            ['Jahr', ...stationResults.map(r => r.label)],
            ['Jahr', ...stationResults.map(r => r.label)],
            ...yearLabels.map((y, i) => [
                y,
                ...stationResults.map(r => r.dtv_total[i] ?? null)
            ])
        ]
    };

    // No Abw. vom Durchschnitt in Vergleich — not meaningful across stations
    const tagesverkehrLabel = getTrafficLabel('Durchschnittlicher Tagesverkehr');
    yearlyTable.grid.update({
        header: [
            { columnId: 'jahr' },
            {
                format: tagesverkehrLabel,
                columns: stationResults.map((_, i) => `dtv_zst_${i}`)
            }
        ],
        columns: [
            { id: 'jahr', header: { format: 'Jahr' } },
            ...stationResults.map((r, i) => ({
                id: `dtv_zst_${i}`,
                header: { format: r.label },
                cells: { formatter() { return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : ''; } }
            }))
        ]
    });

    // baseCount 4 includes series-durchschnitt (ri1, ri2, gesamt, durchschnitt)
    resetChartSeriesForMode(yearlyDTVChart.chart, { vergleichMode: true, baseCount: 4 });
    stationResults.forEach(r => {
        yearlyDTVChart.chart.addSeries({
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
    setDashboardHighlightSync(yearlyTable, false);
    setDashboardHighlightSync(yearlyDTVChart, false);

    yearlyDTVChart.chart.redraw();

    if (includeDistribution) {
        while (boxPlot.chart.series.length > 0) boxPlot.chart.series[0].remove(false);
        while (scatterChart.chart.series.length > 0) scatterChart.chart.series[0].remove(false);
        while (boxPlotGesamt.chart.series.length > 0) boxPlotGesamt.chart.series[0].remove(false);
        while (scatterChartGesamt.chart.series.length > 0) scatterChartGesamt.chart.series[0].remove(false);

        const nStations = stationResults.length;
        stationResults.forEach((r, index) => {
            const offset = vergleichScatterOffset(index, nStations);
            const boxPlotData = processYearlyBoxPlotData({}, r.dailyTotalsPerYearTotal, [], {}, true, numYears);
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
            if (r.dailyScatterPerYearTotal) {
                for (let year = 0; year < numYears; year++) {
                    (r.dailyScatterPerYearTotal[year] || []).forEach(p => {
                        const point = { x: year + offset, y: p.value, date: p.date };
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
        await updateExporting(board, boxPlot.chart.exporting, 'yearly-box-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChart.chart.exporting, 'yearly-scatter-plot', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, boxPlotGesamt.chart.exporting, 'yearly-box-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
        await updateExporting(board, scatterChartGesamt.chart.exporting, 'yearly-scatter-plot-gesamt', type, zsts, fzgtyp, timeRange, true, false, speed);
    }

    await updateExporting(board, yearlyDTVChart.chart.exporting, 'yearly-chart', type, zsts, fzgtyp, timeRange, true, false, speed);

    // Sync Grid ↔ DTV after exporting/connector churn
    if (yearlyDTVChart._vergleichSyncCleanup) yearlyDTVChart._vergleichSyncCleanup();
    yearlyDTVChart._vergleichSyncCleanup = bindVergleichHighlightSync(
        [yearlyDTVChart],
        {
            grid: yearlyTable,
            columnSeries: Object.fromEntries(stationResults.map((r, i) => [`dtv_zst_${i}`, `vergleich-${r.id}`]))
        }
    );
}
