import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateDailyTraffic,
    aggregateYearlyTrafficData,
    createSeries,
    updateSeriesData,
    aggregateHourlyTrafficMoFr,
    aggregateHourlyTrafficMoSo,
    aggregateMonthlyTrafficMoFr,
    aggregateMonthlyTrafficMoSo,
    aggregateWeeklyTrafficPW,
    aggregateWeeklyTrafficLW
} from "./Functions.js";

// Updated updateBoard function
export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficTable = await board.dataPool.getConnectorTable(`${type}-${countingStation}`);
    let countingTrafficRows = countingTrafficTable.getRowObjects();

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterCountingTrafficRows(countingTrafficRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = aggregateDailyTraffic(countingTrafficRows);
    // Update the traffic graph in the time range selector
    const timelineChart = board.mountedComponents[0].component.chart;
    timelineChart.series[0].setData(aggregatedTrafficData);

    const map = board.mountedComponents[2].component.chart.series[1];
    map.setData(countingStationsData.map(station => ({
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
    const dtvChart = board.mountedComponents[3].component.chart;
    dtvChart.series[0].setData(aggregatedYearlyTrafficData);

    // Step 2: Get the aggregated data and direction names
    const { aggregatedData: aggregatedHourlyTrafficMoFr, directionNames: directionNamesMoFr } = aggregateHourlyTrafficMoFr(filteredCountingTrafficRows);
    const { aggregatedData: aggregatedHourlyTrafficMoSo, directionNames: directionNamesMoSo } = aggregateHourlyTrafficMoSo(filteredCountingTrafficRows);

    // Initialize series objects dynamically
    const seriesMoFr = {
        'Gesamtquerschnitt': {},
    };
    const seriesMoSo = {
        'Gesamtquerschnitt': {},
    };

    // Add series for each direction dynamically
    directionNamesMoFr.forEach(direction => {
        seriesMoFr[direction] = [];
    });
    directionNamesMoSo.forEach(direction => {
        seriesMoSo[direction] = [];
    });

    // Populate the data for Mo-Fr (DWV)
    aggregatedHourlyTrafficMoFr.forEach(item => {
        if (seriesMoFr[item.directionName]) {
            seriesMoFr[item.directionName].push([item.hour, item.total]);
        }

        // Sum the traffic for both lanes under the same hour
        if (!seriesMoFr['Gesamtquerschnitt'][item.hour]) {
            seriesMoFr['Gesamtquerschnitt'][item.hour] = 0;
        }
        seriesMoFr['Gesamtquerschnitt'][item.hour] += item.total;
    });

    // Convert "Gesamtquerschnitt" object into an array of [hour, total] format
    const gesamtquerschnittMoFr = Object.entries(seriesMoFr['Gesamtquerschnitt']).map(([hour, total]) => [parseInt(hour), total]);

    // Populate the data for Mo-So (DTV)
    aggregatedHourlyTrafficMoSo.forEach(item => {
        if (seriesMoSo[item.directionName]) {
            seriesMoSo[item.directionName].push([item.hour, item.total]);
        }

        // Sum the traffic for both lanes under the same hour
        if (!seriesMoSo['Gesamtquerschnitt'][item.hour]) {
            seriesMoSo['Gesamtquerschnitt'][item.hour] = 0;
        }
        seriesMoSo['Gesamtquerschnitt'][item.hour] += item.total;
    });

    // Convert "Gesamtquerschnitt" object into an array of [hour, total] format
    const gesamtquerschnittMoSo = Object.entries(seriesMoSo['Gesamtquerschnitt']).map(([hour, total]) => [parseInt(hour), total]);

    //  Update the Highcharts configuration dynamically with the new series

    // Update the DTV chart series (hourly-dtv-graph):
    board.mountedComponents[5].component.chart.update({
        series: createSeries(directionNamesMoSo) // Dynamically create series based on the direction names
    }, true); // The second parameter ensures a smooth update without a full chart redraw

    // Update the DWV chart series (hourly-dwv-graph):
    board.mountedComponents[4].component.chart.update({
        series: createSeries(directionNamesMoFr)
    }, true); // Smooth update

    // Now safely update the data after ensuring the series exist

    // For DWV (Mo-Fr)
    updateSeriesData(board.mountedComponents[4].component.chart, 0, gesamtquerschnittMoFr);
    directionNamesMoFr.forEach((direction, index) => {
        updateSeriesData(board.mountedComponents[4].component.chart, index + 1, seriesMoFr[direction]);
    });

    // For DTV (Mo-So)
    updateSeriesData(board.mountedComponents[5].component.chart, 0, gesamtquerschnittMoSo);
    directionNamesMoSo.forEach((direction, index) => {
        updateSeriesData(board.mountedComponents[5].component.chart, index + 1, seriesMoSo[direction]);
    });

    // Aggregate monthly traffic data for the selected counting station
    const aggregatedMonthlyTrafficMoFr = aggregateMonthlyTrafficMoFr(filteredCountingTrafficRows);
    const aggregatedMonthlyTrafficMoSo = aggregateMonthlyTrafficMoSo(filteredCountingTrafficRows);

    // Update the monthly traffic graph in the new chart
    const monthlyMoSoChart = board.mountedComponents[6].component.chart;
    monthlyMoSoChart.series[0].setData(aggregatedMonthlyTrafficMoSo);

    const monthlyMoFrChart = board.mountedComponents[7].component.chart;
    monthlyMoFrChart.series[0].setData(aggregatedMonthlyTrafficMoFr);

    // Aggregate weekly traffic data for the selected counting station
    if (type === 'MIV') {
        const aggregatedWeeklyTrafficPW = aggregateWeeklyTrafficPW(filteredCountingTrafficRows);
        const aggregatedWeeklyTrafficLW = aggregateWeeklyTrafficLW(filteredCountingTrafficRows);

        // Update the weekly traffic graph in the new chart
        const weeklyPWChart = board.mountedComponents[8].component.chart;
        weeklyPWChart.series[0].setData(
            aggregatedWeeklyTrafficPW.map(item => item.total) // Extract just the total traffic values for PW
        );

        const weeklyLWChart = board.mountedComponents[9].component.chart;
        weeklyLWChart.series[0].setData(
            aggregatedWeeklyTrafficLW.map(item => item.total) // Extract just the total traffic values for LW
        );
    }
}
