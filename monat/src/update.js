import {
    getFilteredZaehlstellen,
    updateState,
    toggleFahrzeugtypDropdown,
    uncheckAllStrTyp,
    updateCredits,
    readCSV,
    extractMonthlyTraffic,
    filterToSelectedTimeRange,
    aggregateMonthlyTraffic,
    aggregateMonthlyWeather,
    processMonthlyBoxPlotData
} from "../../src/functions.js";
import {monate} from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zst, fzgtyp, timeRange, newType) {
    const [
        , // filter-selection
        timelineChart,
        , //filter-selection-2
        monthlyTable,
        monthlyDTVChart,
        monthlyWeatherChart,
        boxPlot
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    zst = updateState(type, strtyp, zst, fzgtyp, timeRange, zaehlstellen);
    fzgtyp = toggleFahrzeugtypDropdown(type, fzgtyp);

    if (newType) {
        uncheckAllStrTyp();
        strtyp = 'Alle';

        // Update the credits of monthlyTable, monthlyDTVChart, monthlyWeatherChart and boxPlot
        updateCredits(monthlyTable.dataGrid.credits, type);
        updateCredits(monthlyDTVChart.chart.credits, type);
        updateCredits(monthlyWeatherChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
    }

    const dailyDataRows = await readCSV(`../data/${type}/${zst}_daily.csv`);
    const monthlyDataRows = await readCSV(`../data/${type}/${zst}_monthly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    let monthlyTraffic = await board.dataPool.getConnectorTable(`Monthly Traffic`);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = extractMonthlyTraffic(monthlyDataRows, fzgtyp);
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    // Aggregate monthly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerMonth,
        directionNames: monthlyDirectionNames,
        dailyTotalsPerMonthTotal,
        dailyTotalsPerMonthPerDirection
    } = aggregateMonthlyTraffic(filteredDailyDataRows, fzgtyp, isMoFrSelected, isSaSoSelected);

    const isSingleDirection = monthlyDirectionNames.length === 1;
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
    console.log(monthlyTemperatures, monthlyTempRange, monthlyPrecipitations);

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
                    format: '{value:.0f}'
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
        monthlyTable.dataGrid.update({
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
        monthlyTable.dataGrid.update({
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

    // Remove all existing series
    while (monthlyDTVChart.chart.series.length > 0) {
        monthlyDTVChart.chart.series[0].remove(false);
    }

    // Re-add series based on the current directions
    if (!isSingleDirection) {
        // Add series for each direction
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            monthlyDTVChart.chart.addSeries({
                id: `series-${ri}`,
                name: direction,
                data: dtv_ri_columns_monthly[`dtv_${ri}`],
                marker: {
                    enabled: false
                },
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
            }, false);
        });
    }

    // Always add the total series with updated label
    monthlyDTVChart.chart.addSeries({
        id: 'series-gesamt',
        name: totalLabel,
        data: dtv_total_monthly,
        marker: {
            enabled: false
        },
        color: '#6f6f6f'
    }, false);
    // Add "Durchschnitt" series in the background
    monthlyDTVChart.chart.addSeries({
        id: 'series-durchschnitt',
        type: 'line',
        name: 'Durchschnitt',
        data: Array(12).fill(average_dtv_total_monthly),
        marker: {
            enabled: false
        },
        color: '#333333',
        dashStyle: 'Dash', // Dashed line for differentiation
        zIndex: 0, // Ensure this is drawn behind other series
    }, false);

    // Build the new columnAssignment
    let columnAssignmentMonthly = [];

    if (!isSingleDirection) {
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            columnAssignmentMonthly.push({
                seriesId: `series-${ri}`,
                data: `dtv_${ri}`
            });
        });
    }

    // Always include the total series and the average series
    columnAssignmentMonthly.push({
        seriesId: 'series-gesamt',
        data: 'dtv_total'
    });
    columnAssignmentMonthly.push({
        seriesId: 'series-durchschnitt',
        data: 'average_dtv_total'
    });

    // Update the connector's columnAssignment
    monthlyDTVChart.connectorHandlers[0].updateOptions({
        id: 'Monthly Traffic',
        columnAssignment: columnAssignmentMonthly
    });

    // Redraw the chart after adding all series
    monthlyDTVChart.chart.redraw();

    // Process box plot data
    const boxPlotDataMonthly = processMonthlyBoxPlotData(
        dailyTotalsPerMonthPerDirection,
        dailyTotalsPerMonthTotal,
        monthlyDirectionNames,
        directionToRiMonthly,
        isSingleDirection
    );

    // Remove all existing series
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }

    // Add series based on current directions
    if (!isSingleDirection) {
        boxPlotDataMonthly.forEach(series => {
            // Rename total series if found
            if (series.id === 'series-gesamt') {
                series.name = totalLabel;
            }
            boxPlot.chart.addSeries(series, false);
        });
    } else {
        // Only add the total series, rename it accordingly
        const totalSeries = boxPlotDataMonthly.find(series => series.id === 'series-gesamt');
        if (totalSeries) {
            totalSeries.name = totalLabel;
            boxPlot.chart.addSeries(totalSeries, false);
        }
    }

    // Redraw the chart after adding all series
    boxPlot.chart.redraw();
}
