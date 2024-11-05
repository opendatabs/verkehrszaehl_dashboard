import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateDailyTraffic,
    aggregateYearlyTrafficData,
    createSeries,
    updateSeriesData,
    aggregateHourlyTrafficMoFr,
    aggregateHourlyTrafficMoSo,
    updateHourlyDataGrid,
    aggregateMonthlyTrafficMoFr,
    aggregateMonthlyTrafficMoSo,
    aggregateWeeklyTrafficPW,
    aggregateWeeklyTrafficLW
} from "./Functions.js";

// Updated updateBoard function
export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficTable = await board.dataPool.getConnectorTable(`${type}-${countingStation}`);
    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);
    let countingTrafficRows = countingTrafficTable.getRowObjects();

    const [
        timelineChart,
        filterSelection,
        worldMap,
        dtvChart,
        hourlyTable,
        hourlyDTVGraph,
        hourlyDWVGraph,
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

    // Get the aggregated data and direction names
    const { aggregatedData: aggregatedHourlyTrafficMoFr, directionNames: directionNamesMoFr } = aggregateHourlyTrafficMoFr(filteredCountingTrafficRows);
    const { aggregatedData: aggregatedHourlyTrafficMoSo, directionNames: directionNamesMoSo } = aggregateHourlyTrafficMoSo(filteredCountingTrafficRows);

    // Prepare data for the Connector
    const stunde = [];
    for (let i = 0; i < 24; i++) {
        stunde.push(i.toString().padStart(2, '0') + ':00');
    }
    stunde.push('Total', '%');

    // Map direction names to ri1, ri2, etc.
    const directionToRi = {};
    directionNamesMoSo.forEach((direction, index) => {
        directionToRi[direction] = `ri${index + 1}`;
    });

    // Process DTV (Mo-So)
    const dtv_hourly_totals = {};
    for (let i = 0; i < 24; i++) {
        dtv_hourly_totals[i] = {};
        directionNamesMoSo.forEach(direction => {
            dtv_hourly_totals[i][directionToRi[direction]] = 0;
        });
    }

    aggregatedHourlyTrafficMoSo.forEach(item => {
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
    directionNamesMoSo.forEach(direction => {
        dtv_ri_columns[`dtv_${directionToRi[direction]}`] = [];
    });

    let dtv_total = [];
    let dtv_anteil = [];

    let dtv_total_direction_totals = {};
    directionNamesMoSo.forEach(direction => {
        dtv_total_direction_totals[directionToRi[direction]] = 0;
    });

    let dtv_total_total = 0;

    for (let i = 0; i < 24; i++) {
        let hour_total = 0;
        directionNamesMoSo.forEach(direction => {
            const ri = directionToRi[direction];
            const value = dtv_hourly_totals[i][ri];
            dtv_ri_columns[`dtv_${ri}`].push(value);
            dtv_total_direction_totals[ri] += value;
            hour_total += value;
        });
        dtv_total.push(hour_total);
        dtv_total_total += hour_total;
    }

    // Add 'Total' and '%' rows for DTV
    directionNamesMoSo.forEach(direction => {
        const ri = directionToRi[direction];
        dtv_ri_columns[`dtv_${ri}`].push(dtv_total_direction_totals[ri], '=B25/D25*100');
    });

    dtv_total.push(dtv_total_total, '');

    // Compute dtv_anteil
    dtv_anteil = dtv_total.slice(0, 24).map(value => (value / dtv_total_total) * 100);
    dtv_anteil.push(100, '');

    // Process DWV (Mo-Fr) similarly
    const directionToRi_DWV = {};
    directionNamesMoFr.forEach((direction, index) => {
        directionToRi_DWV[direction] = `ri${index + 1}`;
    });

    const dwv_hourly_totals = {};
    for (let i = 0; i < 24; i++) {
        dwv_hourly_totals[i] = {};
        directionNamesMoFr.forEach(direction => {
            dwv_hourly_totals[i][directionToRi_DWV[direction]] = 0;
        });
    }

    aggregatedHourlyTrafficMoFr.forEach(item => {
        const date = new Date(item.hour);
        const hour = date.getUTCHours();
        const direction = item.directionName;
        const total = item.total;

        const ri = directionToRi_DWV[direction];

        if (ri !== undefined) {
            dwv_hourly_totals[hour][ri] += total;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build DWV columns
    let dwv_ri_columns = {};
    directionNamesMoFr.forEach(direction => {
        dwv_ri_columns[`dwv_${directionToRi_DWV[direction]}`] = [];
    });

    let dwv_total = [];
    let dwv_anteil = [];

    let dwv_total_direction_totals = {};
    directionNamesMoFr.forEach(direction => {
        dwv_total_direction_totals[directionToRi_DWV[direction]] = 0;
    });

    let dwv_total_total = 0;

    for (let i = 0; i < 24; i++) {
        let hour_total = 0;
        directionNamesMoFr.forEach(direction => {
            const ri = directionToRi_DWV[direction];
            const value = dwv_hourly_totals[i][ri];
            dwv_ri_columns[`dwv_${ri}`].push(value);
            dwv_total_direction_totals[ri] += value;
            hour_total += value;
        });
        dwv_total.push(hour_total);
        dwv_total_total += hour_total;
    }

    // Add 'Total' and '%' rows for DWV
    directionNamesMoFr.forEach(direction => {
        const ri = directionToRi_DWV[direction];
        dwv_ri_columns[`dwv_${ri}`].push(dwv_total_direction_totals[ri], '=F25/H25*100');
    });

    dwv_total.push(dwv_total_total, '');

    // Compute dwv_anteil
    dwv_anteil = dwv_total.slice(0, 24).map(value => (value / dwv_total_total) * 100);
    dwv_anteil.push(100, '');

    // Build columns for the Connector
    const columns = {
        'stunde': stunde,
        'dtv_total': dtv_total,
        'dtv_anteil': dtv_anteil,
        'dwv_total': dwv_total,
        'dwv_anteil': dwv_anteil,
        ...dtv_ri_columns,
        ...dwv_ri_columns
    };

    // Update the Connector with the new columns
    hourlyTraffic.setColumns(columns);


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
