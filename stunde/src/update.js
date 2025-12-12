import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    uncheckAllStrTyp,
    updateCredits,
    readCSV,
    mergeHourlyTables,
    filterToSelectedTimeRange,
    extractDailyTraffic,
    aggregateHourlyTraffic,
    processHourlyBoxPlotData,
    updateExporting
} from "../../src/functions.js";
import {stunde} from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zst, fzgtyp, timeRange, newType, newZst= false) {
    const [
        , //filter-selection
        , // filter-section-fzgtyp
        timelineChart,
        , //filter-selection-2
        hourlyTable,
        hourlyDTVChart,
        hourlyDonutChart,
        , // filter-section-3
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterPlotGesamt
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    const lastZst = zst;
    const stationRow = (await loadStations(type)).find(r => String(r.Zst_id) === String(zst));
    const next = updateState(board, type, strtyp, zst, fzgtyp, timeRange, zaehlstellen, stationRow);
    zst = next.zst;
    fzgtyp = next.fzgtyp;
    newZst = newZst || lastZst !== zst;

    if (newType) {
        uncheckAllStrTyp();

        // Update the credits text
        updateCredits(hourlyTable.grid.credits, type);
        updateCredits(hourlyDTVChart.chart.credits, type);
        updateCredits(hourlyDonutChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterPlotGesamt.chart.credits, type);
    }

    let hourlyTraffic = await board.dataPool.connectors['Hourly Traffic'].getTable()

    const fzgList = Array.isArray(fzgtyp) ? fzgtyp : [fzgtyp];
    const keys = fzgList.filter(v => v && v !== 'Total');
    const effective = keys.length ? keys : ['Total'];

    const tables = await Promise.all(
        effective.map(k => readCSV(`../data/${type}/${zst}_${k}_hourly.csv`))
    );

    // merge by Date + DirectionName (+ LaneName if you have it)
    const hourlyDataRows = mergeHourlyTables(tables);
    const dailyDataRows = await readCSV(`../data/${type}/${zst}_daily.csv`);

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterToSelectedTimeRange(hourlyDataRows, timeRange);


    if (newZst) {
        const {dailyTraffic} = extractDailyTraffic(dailyDataRows, fzgtyp);
        timelineChart.chart.series[0].setData(dailyTraffic);
    }

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    // Get the aggregated data and direction names
    const {
        aggregatedData: aggregatedHourlyTraffic,
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames,
        hourlyScatterPerDirection,
        hourlyScatterTotal
    } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

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
                    format: "Durchschnittlicher Tagesverkehr",
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
                    format: "Durchschnittlicher Tagesverkehr",
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
        name: totalLabel
    });

    // Update the donut chart
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
            hourlyDonutChart.chart.lbl.attr({
                text: `${totalLabel}:<br/>${Highcharts.numberFormat(total, 0)} pro Tag<br/>%`
            });
        }
        hourlyDonutChart.chart.series[0].points.forEach(function(point) {
            point.firePointEvent('mouseOut');
        });
    }

    // Process box plot data
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
            const points = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;

            for (let hour = 0; hour < 24; hour++) {
                const arr = dirScatter[hour] || [];
                arr.forEach(p => {
                    points.push({
                        x: hour + offset,  // shifted position
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
    } else {
        // Only one direction: use gray and no horizontal split
        const direction = directionNames[0];
        const dirScatter = hourlyScatterPerDirection[direction] || {};
        const points = [];

        for (let hour = 0; hour < 24; hour++) {
            const arr = dirScatter[hour] || [];
            arr.forEach(p => {
                points.push({
                    x: hour,
                    y: p.value,
                    date: p.date
                });
            });
        }

        scatterChart.chart.addSeries({
            type: 'scatter',
            name: direction,
            data: points,
            color: '#6f6f6f'
        }, false);
    }

    scatterChart.chart.redraw();

    // --- Update Gesamtquerschnitt scatter chart ---
    while (scatterPlotGesamt.chart.series.length > 0) {
        scatterPlotGesamt.chart.series[0].remove(false);
    }

    const gesamtPoints = [];
    if (hourlyScatterTotal) {
        for (let hour = 0; hour < 24; hour++) {
            const arr = hourlyScatterTotal[hour] || [];
            arr.forEach(p => {
                gesamtPoints.push({
                    x: hour,
                    y: p.value,
                    date: p.date
                });
            });
        }
    }

    scatterPlotGesamt.chart.addSeries({
        type: 'scatter',
        name: totalLabel,
        data: gesamtPoints,
        color: '#6f6f6f'
    }, false);

    scatterPlotGesamt.chart.redraw();

    // Update exporting options
    await updateExporting(board, hourlyDTVChart.chart.exporting, 'hourly-chart', type, zst, fzgtyp, timeRange, true);
    await updateExporting(board, hourlyDonutChart.chart.exporting, 'hourly-donut', type, zst, fzgtyp, timeRange, true);
    await updateExporting(board, boxPlot.chart.exporting, 'hourly-box-plot', type, zst, fzgtyp, timeRange, true);
    await updateExporting(board, scatterChart.chart.exporting, 'hourly-scatter-plot', type, zst, fzgtyp, timeRange, true);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'hourly-box-plot-gesamt', type, zst, fzgtyp, timeRange, true);
    await updateExporting(board, scatterPlotGesamt.chart.exporting, 'hourly-scatter-plot-gesamt', type, zst, fzgtyp, timeRange, true);
}
