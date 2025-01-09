import {
    getFilteredZaehlstellen,
    updateState,
    toggleFahrzeugtypDropdown,
    uncheckAllStrTyp,
    updateCredits,
    readCSV,
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
        timelineChart,
        , //filter-selection-2
        hourlyTable,
        hourlyDTVChart,
        hourlyDonutChart,
        boxPlot
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    zst = updateState(type, strtyp, zst, fzgtyp, timeRange, zaehlstellen);
    fzgtyp = toggleFahrzeugtypDropdown(type, fzgtyp);

    if (newType) {
        uncheckAllStrTyp();

        // Update the credits text of hourlyTable, hourlyDTVGraph, hourlyDonutChart and boxPlot
        updateCredits(hourlyTable.dataGrid.credits, type);
        updateCredits(hourlyDTVChart.chart.credits, type);
        updateCredits(hourlyDonutChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
    }

    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);

    const hourlyDataRows = await readCSV(`../data/${type}/${zst}_${fzgtyp}_hourly.csv`);
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
        hourlyTotalsPerHourPerDirection: hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal: hourlyTotalsPerHourTotal,
        directionNames: directionNames
    } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

    const isSingleDirection = directionNames.length < 2;
    // Set total label depending on whether it's a single direction or multiple
    const totalLabel = isSingleDirection ? directionNames[0] : 'Gesamtquerschnitt';

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
        let hour_total = 0;
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            const value = dtv_hourly_totals[i][ri];
            dtv_ri_columns[`dtv_${ri}`].push(value);
            dtv_total_direction_totals[ri] += value;
            hour_total += value;
        });
        dtv_total.push(hour_total);
        dtv_total_total += hour_total;
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
        hourlyTable.dataGrid.update({
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
        hourlyTable.dataGrid.update({
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
    const boxPlotData = processHourlyBoxPlotData(hourlyTotalsPerHourPerDirection, hourlyTotalsPerHourTotal, directionNames, directionToRi, isSingleDirection);

    // Remove all existing series from boxPlot
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }

    // Add series based on current directions
    if (!isSingleDirection) {
        // For multiple directions, add all series as is
        boxPlotData.forEach(series => {
            // If this is the total series, rename it
            if (series.id === 'series-gesamt') {
                series.name = totalLabel;
            }
            boxPlot.chart.addSeries(series, false);
        });
    } else {
        // Only add the total series, renamed appropriately
        const totalSeries = boxPlotData.find(series => series.id === 'series-gesamt');
        if (totalSeries) {
            totalSeries.name = totalLabel;
            boxPlot.chart.addSeries(totalSeries, false);
        }
    }

    // Redraw the box plot after adding all series
    boxPlot.chart.redraw();

    // Update exporting options
    await updateExporting(board, hourlyDTVChart.chart.exporting, 'hourly-chart', type, zst, timeRange, true);
    await updateExporting(board, hourlyDonutChart.chart.exporting, 'hourly-donut', type, zst, timeRange, true);
    await updateExporting(board, boxPlot.chart.exporting, 'hourly-box-plot', type, zst, timeRange, true);
}
