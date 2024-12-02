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
        weekday: weekday_param});
    updateDatePickers(timeRange[0], timeRange[1]);

    const countingStationsData = await getFilteredCountingStations(board, type);
    populateCountingStationDropdown(countingStationsData, countingStation);

    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);

    const hourlyDataRows = await readCSV(`./data/${type}/${countingStation}_Total_hourly.csv`);
    const dailyDataRows = await readCSV(`./data/${type}/${countingStation}_daily.csv`);

    console.log(hourlyDataRows);

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

    // Map direction names to ri1, ri2, etc.
    const directionToRi = {};
    directionNames.forEach((direction, index) => {
        directionToRi[direction] = `ri${index + 1}`;
    });

    // Process DTV
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
        const numberOfDays = item.numberOfDays;

        const ri = directionToRi[direction];

        if (ri !== undefined) {
            dtv_hourly_totals[hour][ri] += total / numberOfDays;
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
        'dtv_anteil': dtv_anteil
    };
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
    hourlyDonutChart.chart.series[0].points.forEach(function(point) {
        point.firePointEvent('mouseOut');
    });

    // Update the box plot
    const boxPlotData = processHourlyBoxPlotData(hourlyTotalsPerHourPerDirection, hourlyTotalsPerHourTotal, directionNames);
    boxPlot.chart.series[0].setData(boxPlotData[0].data);
    boxPlot.chart.series[1].setData(boxPlotData[1].data);
    boxPlot.chart.series[2].setData(boxPlotData[2].data);
}
