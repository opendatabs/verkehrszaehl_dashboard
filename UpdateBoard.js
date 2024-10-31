import {
    getFilteredCountingStations,
    getFilteredCountingTrafficData,
    aggregateDailyTraffic,
    aggregateYearlyTrafficData,
    updateSeriesData,
    aggregateHourlyTrafficMoFr,
    aggregateHourlyTrafficMoSo,
    aggregateMonthlyTrafficMoFr,
    aggregateMonthlyTrafficMoSo,
    aggregateWeeklyTrafficPW,
    aggregateWeeklyTrafficLW,
} from "./Functions.js";

export async function updateBoard(board, countingStation, newData, type='Velo') {
    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficData = await getFilteredCountingTrafficData(board, countingStation);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = aggregateDailyTraffic(countingTrafficData);
    // Update the traffic graph in the time range selector
    const timelineChart = board.mountedComponents[0].component.chart;
    timelineChart.series[0].setData(aggregatedTrafficData);

    const map = board.mountedComponents[2].component.chart.series[1];
    map.setData(countingStationsData.map(station => ({
        lat: station.lat,
        lon: station.lon,
        name: station.name,
        zweck: station.zweck,
        color: station.color
    })));

    // Aggregate yearly traffic data for the selected counting station
    const aggregatedYearlyTrafficData = aggregateYearlyTrafficData(countingTrafficData);
    // Update the DTV graph in the new chart
    const dtvChart = board.mountedComponents[3].component.chart;
    dtvChart.series[0].setData(aggregatedYearlyTrafficData);

    // Step 3: Aggregate hourly data (DTV for Mo-Su and DWV for Mo-Fr)
    const { aggregatedData: aggregatedHourlyTrafficMoFr, directionNames: directionNamesMoFr } = aggregateHourlyTrafficMoFr(countingTrafficData);
    const { aggregatedData: aggregatedHourlyTrafficMoSo, directionNames: directionNamesMoSo } = aggregateHourlyTrafficMoSo(countingTrafficData);

    // Update hourly DTV chart
    const hourlyDtvChart = board.mountedComponents[5].component.chart;
    hourlyDtvChart.series.forEach((series, index) => {
        updateSeriesData(hourlyDtvChart, index, aggregatedHourlyTrafficMoSo[directionNamesMoSo[index]]);
    });

    // Update hourly DWV chart
    const hourlyDwvChart = board.mountedComponents[4].component.chart;
    hourlyDwvChart.series.forEach((series, index) => {
        updateSeriesData(hourlyDwvChart, index, aggregatedHourlyTrafficMoFr[directionNamesMoFr[index]]);
    });

    // Step 4: Aggregate and update monthly data (Mo-Fr and Mo-Su)
    const aggregatedMonthlyTrafficMoFr = aggregateMonthlyTrafficMoFr(countingTrafficData);
    const aggregatedMonthlyTrafficMoSo = aggregateMonthlyTrafficMoSo(countingTrafficData);

    const monthlyDtvChart = board.mountedComponents[6].component.chart;
    monthlyDtvChart.series[0].setData(aggregatedMonthlyTrafficMoSo);

    const monthlyDwvChart = board.mountedComponents[7].component.chart;
    monthlyDwvChart.series[0].setData(aggregatedMonthlyTrafficMoFr);

    // Step 5: Aggregate and update weekly traffic data (PW and LW)
    const aggregatedWeeklyTrafficPW = aggregateWeeklyTrafficPW(countingTrafficData);
    const aggregatedWeeklyTrafficLW = aggregateWeeklyTrafficLW(countingTrafficData);

    const weeklyPwChart = board.mountedComponents[8].component.chart;
    weeklyPwChart.series[0].setData(
        aggregatedWeeklyTrafficPW.map(item => item.total)
    );

    const weeklyLwChart = board.mountedComponents[9].component.chart;
    weeklyLwChart.series[0].setData(
        aggregatedWeeklyTrafficLW.map(item => item.total)
    );
}
