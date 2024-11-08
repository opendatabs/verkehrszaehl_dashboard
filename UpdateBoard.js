import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateDailyTraffic,
    aggregateYearlyTrafficData,
    createSeries,
    updateSeriesData,
    aggregateHourlyTraffic,
    updateHourlyDataGrid,
    aggregateMonthlyTrafficMoFr,
    aggregateMonthlyTrafficMoSo,
    aggregateWeeklyTrafficPW,
    aggregateWeeklyTrafficLW
} from "./Functions.js";

import { stunde } from "./Constants.js";

// Updated updateBoard function
export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficTable = await board.dataPool.getConnectorTable(`${type}-${countingStation}`);
    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);
    let countingTrafficRows = countingTrafficTable.getRowObjects();

    const [
        timelineChart,
        filterSelection,
        filterSelection2,
        worldMap,
        dtvChart,
        hourlyTable,
        hourlyDTVGraph,
        hourlyDonutChart,
        hourlyPercentageChart,
        monthlyMoSoChart,
        monthlyMoFrChart,
        weeklyPWChart,
        weeklyLWChart
    ] = board.mountedComponents.map(c => c.component);

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterCountingTrafficRows(countingTrafficRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = aggregateDailyTraffic(countingTrafficRows);
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    worldMap.chart.series[1].setData(countingStationsData.map(station => ({
        lat: station.lat,
        lon: station.lon,
        name: station.name,
        id: station.id,
        zweck: station.zweck,
        color: station.color
    })));

    // Aggregate yearly traffic data for the selected counting station
    const aggregatedYearlyTrafficData = aggregateYearlyTrafficData(countingTrafficRows);
    // Update the DTV graph in the new chart
    dtvChart.chart.series[0].setData(aggregatedYearlyTrafficData);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    console.log('isMoFrSelected', isMoFrSelected);

    // Get the aggregated data and direction names
    const { aggregatedData: aggregatedHourlyTraffic, directionNames: directionNames } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

    // Map direction names to ri1, ri2, etc.
    const directionToRi = {};
    directionNames.forEach((direction, index) => {
        directionToRi[direction] = `ri${index + 1}`;
    });

    // Process DTV (Mo-So)
    const dtv_hourly_totals = {};
    for (let i = 0; i < 24; i++) {
        dtv_hourly_totals[i] = {};
        directionNames.forEach(direction => {
            dtv_hourly_totals[i][directionToRi[direction]] = 0;
        });
    }

    aggregatedHourlyTraffic.forEach(item => {
        const date = new Date(item.hour);
        const hour = date.getUTCHours();
        const direction = item.directionName;
        const total = item.total;

        const ri = directionToRi[direction];

        if (ri !== undefined) {
            dtv_hourly_totals[hour][ri] += total;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build DTV columns
    let dtv_ri_columns = {};
    directionNames.forEach(direction => {
        dtv_ri_columns[`dtv_${directionToRi[direction]}`] = [];
    });

    let dtv_total = [];
    let dtv_anteil = [];

    let dtv_total_direction_totals = {};
    directionNames.forEach(direction => {
        dtv_total_direction_totals[directionToRi[direction]] = 0;
    });

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
    dtv_anteil = dtv_total.slice(0, 24).map(value => (value / dtv_total_total) * 100);

    // Build columns for the Connector
    const columns = {
        'stunde': stunde,
        ...dtv_ri_columns,
        'dtv_total': dtv_total,
        'dtv_anteil': dtv_anteil,
    };

    // Update the Connector with the new columns
    hourlyTraffic.setColumns(columns);

    const directionTotals = directionNames.map(direction => {
        const ri = directionToRi[direction];
        return {
            name: direction,
            y: dtv_total_direction_totals[ri] // Total traffic for this direction
        };
    });

    // Update the hourly donut chart in the new chart
    hourlyDonutChart.chart.series[0].setData(directionTotals);

    // Aggregate monthly traffic data for the selected counting station
    const aggregatedMonthlyTrafficMoFr = aggregateMonthlyTrafficMoFr(filteredCountingTrafficRows);
    const aggregatedMonthlyTrafficMoSo = aggregateMonthlyTrafficMoSo(filteredCountingTrafficRows);

    // Update the monthly traffic graph in the new chart
    monthlyMoSoChart.chart.series[0].setData(aggregatedMonthlyTrafficMoSo);
    monthlyMoFrChart.chart.series[0].setData(aggregatedMonthlyTrafficMoFr);

    // Aggregate weekly traffic data for the selected counting station
    if (type === 'MIV') {
        const aggregatedWeeklyTrafficPW = aggregateWeeklyTrafficPW(filteredCountingTrafficRows);
        const aggregatedWeeklyTrafficLW = aggregateWeeklyTrafficLW(filteredCountingTrafficRows);

        // Update the weekly traffic graph in the new chart
        weeklyPWChart.chart.series[0].setData(
            aggregatedWeeklyTrafficPW.map(item => item.total) // Extract just the total traffic values for PW
        );
        weeklyLWChart.chart.series[0].setData(
            aggregatedWeeklyTrafficLW.map(item => item.total) // Extract just the total traffic values for LW
        );
    }
}
