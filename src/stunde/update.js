import {
    readCSV,
    filterToSelectedTimeRange,
    extractDailyTraffic,
    aggregateHourlyTraffic,
    populateCountingStationDropdown,
    getFilteredCountingStations,
    updateUrlParams,
    updateDatePickers,
    processHourlyBoxPlotData
} from "../functions.js";

import { stunde, monate } from "../constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        filterSelection,
        timelineChart,
        filterSelection2,
        hourlyTable,
        hourlyDTVGraph,
        hourlyDonutChart,
        boxPlot
    ] = board.mountedComponents.map(c => c.component);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;

    const weekday_param = isMoFrSelected && isSaSoSelected ? 'mo-so' : isMoFrSelected ? 'mo-fr' : 'sa-so';

    updateUrlParams({
        traffic_type: type,
        zst_id: countingStation,
        start_date: new Date(timeRange[0]).toISOString().split('T')[0],
        end_date: new Date(timeRange[1]).toISOString().split('T')[0],
        weekday: weekday_param
    });
    updateDatePickers(timeRange[0], timeRange[1]);

    const countingStationsData = await getFilteredCountingStations(board, type);
    populateCountingStationDropdown(countingStationsData, countingStation);

    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);

    const hourlyDataRows = await readCSV(`./data/${type}/${countingStation}_Total_hourly.csv`);
    const dailyDataRows = await readCSV(`./data/${type}/${countingStation}_daily.csv`);

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterToSelectedTimeRange(hourlyDataRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = extractDailyTraffic(dailyDataRows);
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    // Get the aggregated data and direction names
    const {
        aggregatedData: aggregatedHourlyTraffic,
        hourlyTotalsPerHourPerDirection: hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal: hourlyTotalsPerHourTotal,
        directionNames: directionNames
    } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

    const isSingleDirection = directionNames.length === 1;

    // Map direction names to ri1, ri2, etc.
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
            dtv_hourly_totals[i][ri] = 0;
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
    let dtv_anteil = [];
    let dtv_total_direction_totals = {};
    directionNames.forEach(direction => {
        const ri = directionToRi[direction];
        dtv_total_direction_totals[ri] = 0;
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
                    format: '{value:.0f}'
                }
            });
        });
    }

    // Add total and percentage columns
    dataGridColumns.push(
        {
            id: 'dtv_total',
            header: {
                format: 'Gesamtquerschnitt'
            },
            cells: {
                format: '{value:.0f}'
            }
        },
        {
            id: 'dtv_anteil',
            header: {
                format: 'Anteil Std. am Tag'
            },
            cells: {
                format: '{value:.1f} %'
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

    // Remove all existing series
    while (hourlyDTVGraph.chart.series.length > 0) {
        hourlyDTVGraph.chart.series[0].remove(false);
    }

    // Re-add series based on the current directions
    if (!isSingleDirection) {
        // Add series for each direction
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            hourlyDTVGraph.chart.addSeries({
                id: `series-${ri}`,
                name: direction,
                data: dtv_ri_columns[`dtv_${ri}`],
                marker: {
                    symbol: 'circle',
                    enabled: false
                }
            }, false);
        });
    }

    // Always add the total series
    hourlyDTVGraph.chart.addSeries({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: dtv_total,
        marker: {
            symbol: 'circle',
            enabled: false
        }
    }, false);

    // Build the new columnAssignment
    let columnAssignment = [];

    // If there are multiple directions, include them in the assignment
    if (!isSingleDirection) {
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            columnAssignment.push({
                seriesId: `series-${ri}`,
                data: `dtv_${ri}`
            });
        });
    }

    // Always include the total series
    columnAssignment.push({
        seriesId: 'series-gesamt',
        data: 'dtv_total'
    });

    hourlyDTVGraph.connectorHandlers[0].updateOptions({
        columnAssignment: columnAssignment
    });

    // Redraw the chart after adding all series
    hourlyDTVGraph.chart.redraw();

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
        hourlyDonutChart.chart.series[0].points.forEach(function(point) {
            point.firePointEvent('mouseOut');
        });
    } else {
        // Set the data to display Gesamtquerschnitt as a full circle
        const total = dtv_total_total;
        hourlyDonutChart.chart.series[0].setData([
            {
                name: 'Gesamtquerschnitt',
                y: total
            }
        ]);

        // Update the center label
        if (hourlyDonutChart.chart.lbl) {
            hourlyDonutChart.chart.lbl.attr({
                text: `Gesamtquerschnitt:<br/>${Highcharts.numberFormat(total, 0, '.', ' ')} Fzg. pro Tag<br/>%`
            });
        }
        hourlyDonutChart.chart.series[0].points.forEach(function(point) {
            point.firePointEvent('mouseOut');
        });
    }

    // Process box plot data
    const boxPlotData = processHourlyBoxPlotData(hourlyTotalsPerHourPerDirection, hourlyTotalsPerHourTotal, directionNames, directionToRi, isSingleDirection);

    // Remove all existing series
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }

    // Add series based on current directions
    if (!isSingleDirection) {
        boxPlotData.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    } else {
        // Only add the total series
        const totalSeries = boxPlotData.find(series => series.id === 'series-gesamt');
        if (totalSeries) {
            boxPlot.chart.addSeries(totalSeries, false);
        }
    }

    // Redraw the chart after adding all series
    boxPlot.chart.redraw();
}
