import {
    getFilteredZaehlstellen,
    updateState,
    toggleFahrzeugtypDropdown,
    updateCredits,
    readCSV,
    filterToSelectedTimeRange,
    extractDailyAveragePerKalenderwoche,
    aggregateWeeklyTraffic,
    processWeeklyBoxPlotData,
} from "../../src/functions.js";
import { wochentage } from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zst, fzgtyp, timeRange, newType) {
    const [
        , // filter-selection
        timelineChart,
        , // filter-selection-2
        weeklyTable,
        weeklyDTVChart,
        boxPlot
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    zst = updateState(type, strtyp, zst, fzgtyp, timeRange, zaehlstellen);
    fzgtyp = toggleFahrzeugtypDropdown(type, fzgtyp);

    if (newType) {
        // Update the credits text of weeklyTable, weeklyDTVChart and boxPlot
        updateCredits(weeklyTable.dataGrid.credits, type);
        updateCredits(weeklyDTVChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
    }

    const dailyDataRows = await readCSV(`../data/${type}/${zst}_daily.csv`);
    let weeklyTraffic = await board.dataPool.getConnectorTable(`Weekly Traffic`);

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = extractDailyAveragePerKalenderwoche(dailyDataRows, fzgtyp);
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    // Aggregate weekly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerWeekday,
        directionNames: weeklyDirectionNames,
        dailyTotalsPerWeekdayTotal,
        dailyTotalsPerWeekdayPerDirection
    } = aggregateWeeklyTraffic(filteredDailyDataRows, fzgtyp, isMoFrSelected, isSaSoSelected);

    const isSingleDirection = weeklyDirectionNames.length === 1;
    const totalLabel = isSingleDirection ? weeklyDirectionNames[0] : 'Gesamtquerschnitt';

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
                    format: '{value:.0f}'
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
                format: '{value:.0f}'
            }
        },
        {
            id: 'dtv_abweichung',
            header: {
                format: 'Abw. vom Durchschnitt'
            },
            cells: {
                format: '{value:.1f} %'
            }
        }
    );

    // Update the DataGrid columns
    if (isSingleDirection) {
        weeklyTable.dataGrid.update({
            header: [
                {
                    columnId: "wochentag",
                },
                {
                    format: "Durchschnittlicher Tagesverkehr",
                    columns: [
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsWeekly
        });
    } else {
        weeklyTable.dataGrid.update({
            header: [
                {
                    columnId: "wochentag",
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
            columns: dataGridColumnsWeekly
        });
    }

    // Remove all existing series
    while (weeklyDTVChart.chart.series.length > 0) {
        weeklyDTVChart.chart.series[0].remove(false);
    }

    // Re-add series based on the current directions
    if (!isSingleDirection) {
        // Add series for each direction
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            weeklyDTVChart.chart.addSeries({
                id: `series-${ri}`,
                name: direction,
                data: dtv_ri_columns_weekly[`dtv_${ri}`],
                marker: {
                    enabled: false
                },
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            }, false);
        });
    }

    // Always add the total series
    weeklyDTVChart.chart.addSeries({
        id: 'series-gesamt',
        name: totalLabel,
        data: dtv_total_weekly,
        marker: {
            enabled: false
        },
        color: '#6f6f6f'
    }, false);
    // Add "Durchschnitt" series in the background
    weeklyDTVChart.chart.addSeries({
        id: 'series-durchschnitt',
        type: 'line',
        name: 'Durchschnitt',
        data: Array(7).fill(average_dtv_total_weekly),
        marker: {
            enabled: false
        },
        color: '#333333',
        dashStyle: 'Dash', // Dashed line for differentiation
        zIndex: 0, // Ensure this is drawn behind other series
    }, false);

    // Build the new columnAssignment
    let columnAssignmentWeekly = [];

    if (!isSingleDirection) {
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            columnAssignmentWeekly.push({
                seriesId: `series-${ri}`,
                data: `dtv_${ri}`
            });
        });
    }

    // Always include the total series and the average series
    columnAssignmentWeekly.push({
        seriesId: 'series-gesamt',
        data: 'dtv_total'
    });
    columnAssignmentWeekly.push({
        seriesId: 'series-durchschnitt',
        data: 'average_dtv_total'
    });

    // Update the connector's columnAssignment
    weeklyDTVChart.connectorHandlers[0].updateOptions({
        columnAssignment: columnAssignmentWeekly
    });

    // Redraw the chart after adding all series
    weeklyDTVChart.chart.redraw();

    // Process box plot data
    const boxPlotDataWeekly = processWeeklyBoxPlotData(
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal,
        weeklyDirectionNames,
        directionToRiWeekly,
        isSingleDirection
    );

    // Remove all existing series
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }

    // Add series based on current directions
    if (!isSingleDirection) {
        boxPlotDataWeekly.forEach(series => {
            // Rename total series if found
            if (series.id === 'series-gesamt') {
                series.name = totalLabel;
            }
            boxPlot.chart.addSeries(series, false);
        });
    } else {
        // Only add the total series, rename it accordingly
        const totalSeries = boxPlotDataWeekly.find(series => series.id === 'series-gesamt');
        if (totalSeries) {
            totalSeries.name = totalLabel;
            boxPlot.chart.addSeries(totalSeries, false);
        }
    }

    // Redraw the chart after adding all series
    boxPlot.chart.redraw();
}
