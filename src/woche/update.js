import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateYearlyTrafficData,
    aggregateMonthlyTraffic,
    aggregateWeeklyTraffic,
    populateCountingStationDropdown
} from "../functions.js";

import { stunde, monate } from "../constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        filterSelection,
        timelineChart,
        filterSelection2,
        weeklyChart,
    ] = board.mountedComponents.map(c => c.component);

    const countingStationsData = await getFilteredCountingStations(board, type);
    const dailyData = await board.dataPool.getConnectorTable(`Daily Data`);
    let dailyDataRows = dailyData.getRowObjects();

    populateCountingStationDropdown(countingStationsData, countingStation)

    const filteredCountingTrafficRows = filterCountingTrafficRows(dailyDataRows, timeRange);

    const aggregatedWeeklyTraffic = aggregateWeeklyTraffic(filteredCountingTrafficRows);
    // Update the weekly traffic graph in the new chart
    weeklyChart.chart.series[0].setData(
        aggregatedWeeklyTraffic.map(item => item.total) // Extract just the total traffic values for PW
    );
}
