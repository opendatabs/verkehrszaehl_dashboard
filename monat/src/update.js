import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    extractMonthlyTraffic,
    filterToSelectedTimeRange,
    aggregateMonthlyTraffic,
    aggregateMonthlyWeather,
    processMonthlyBoxPlotData,
    updateExporting
} from "../../src/functions.js";
import {monate} from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zst, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        timelineChart,
        , //filter-selection-2
        monthlyTable,
        monthlyDTVChart,
        monthlyWeatherChart,
        , //filter-section-3 (HTML)
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterChartGesamt
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    const lastZst = zst;
    
    // Ensure we have a valid zst before loading station data
    if ((!zst || zst === 'default_station') && zaehlstellen && zaehlstellen.length > 0) {
        zst = zaehlstellen[0].id;
    }
    
    const stationRow = (await loadStations(type)).find(r => String(r.Zst_id) === String(zst));
    const next = await updateState(board, type, strtyp, zst, fzgtyp, speed, timeRange, zaehlstellen, stationRow);
    zst = next.zst;
    fzgtyp = next.fzgtyp;
    speed = next.speed;
    newZst = newZst || lastZst !== zst;

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

    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    const monthlyDataRows = await readCSV(`../data/${dataType}/${zst}_monthly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    let monthlyTraffic = await board.dataPool.connectors['Monthly Traffic'].getTable()

    if (newZst) {
        const aggregatedTrafficData = extractMonthlyTraffic(monthlyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(aggregatedTrafficData);
    }

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    // Aggregate monthly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerMonth,
        directionNames: monthlyDirectionNames,
        dailyTotalsPerMonthTotal,
        dailyTotalsPerMonthPerDirection,
        dailyScatterPerMonthPerDirection
    } = aggregateMonthlyTraffic(filteredDailyDataRows, filterKeys, isMoFrSelected, isSaSoSelected);

    const isSingleDirection = monthlyDirectionNames.length < 2;
    const totalLabel = isSingleDirection ? monthlyDirectionNames[0] : 'Gesamtquerschnitt';

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

    const { monthlyTemperatures, monthlyTempRange, monthlyPrecipitations } = aggregateMonthlyWeather(dailyTempRows, timeRange);

    Object.assign(columnsMonthly, {
        'monthly_temp': monthlyTemperatures,
        'monthly_temp_range': monthlyTempRange.map(([min, max]) => ({ low: min, high: max })),
        'monthly_precip': monthlyPrecipitations
    });

    monthlyTraffic.setColumns(columnsMonthly);

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
    if (isSingleDirection) {
        monthlyTable.grid.update({
            header: [
                {
                    columnId: "monat",
                },
                {
                    format: "Durchschnittlicher Tagesverkehr",
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
                    format: "Durchschnittlicher Tagesverkehr",
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

    // Process box plot data
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
            const points = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;

            for (let month = 0; month < 12; month++) {
                const arr = dirScatter[month] || [];
                arr.forEach(p => {
                    points.push({
                        x: month + offset, // shifted position
                        y: p.value,
                        date: p.date
                    });
                });
            }

            scatterChart.chart.addSeries({
                type: 'scatter',
                name: direction,
                data: points,
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            }, false);
        });
    } else if (monthlyDirectionNames.length > 0) {
        // Only one direction: center points on the month and use grey color
        const direction = monthlyDirectionNames[0];
        const dirScatter = dailyScatterPerMonthPerDirection[direction] || {};
        const points = [];

        for (let month = 0; month < 12; month++) {
            const arr = dirScatter[month] || [];
            arr.forEach(p => {
                points.push({
                    x: month,
                    y: p.value,
                    date: p.date
                });
            });
        }

        scatterChart.chart.addSeries({
            type: 'scatter',
            name: direction,
            data: points,
            color: '#6f6f6f' // grey for single direction
        }, false);
    }

    scatterChart.chart.redraw();

    // --- Update monthly Gesamtquerschnitt scatter chart ---
    while (scatterChartGesamt.chart.series.length > 0) {
        scatterChartGesamt.chart.series[0].remove(false);
    }

    if (monthlyDirectionNames.length > 0) {
        const gesamtPoints = [];

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
                gesamtPoints.push({
                    x: month,
                    y: total,
                    date
                });
            }
        }

        scatterChartGesamt.chart.addSeries({
            type: 'scatter',
            name: totalLabel,
            data: gesamtPoints,
            color: '#6f6f6f'
        }, false);
    }

    scatterChartGesamt.chart.redraw();

    // Update exporting options
    await updateExporting(board, monthlyDTVChart.chart.exporting, 'monthly-chart', type, zst, filterKeys, timeRange, true);
    await updateExporting(board, monthlyWeatherChart.chart.exporting, 'monthly-weather', '', '', '', timeRange);
    await updateExporting(board, boxPlot.chart.exporting, 'box-plot', type, zst, filterKeys, timeRange, true);
    await updateExporting(board, scatterChart.chart.exporting, 'monthly-scatter-plot', type, zst, filterKeys, timeRange, true);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'monthly-box-plot-gesamt', type, zst, filterKeys, timeRange, true);
    await updateExporting(board, scatterChartGesamt.chart.exporting, 'monthly-scatter-plot-gesamt', type, zst, filterKeys, timeRange, true);
}
