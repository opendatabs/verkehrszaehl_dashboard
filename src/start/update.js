import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateDailyTraffic,
    compute7DayRollingAverage,
    aggregateYearlyTrafficData,
    aggregateMonthlyTraffic,
    populateCountingStationDropdown
} from "../functions.js";

import { stunde, monate } from "../constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        filterSelection,
        worldMap,
        dtvChart,
        timelineChart,
        filterSelection2
    ] = board.mountedComponents.map(c => c.component);


    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficTable = await board.dataPool.getConnectorTable(`${type}-${countingStation}-hourly`);
    let countingTrafficRows = countingTrafficTable.getRowObjects();

    populateCountingStationDropdown(countingStationsData, countingStation)
    const groupedStationsData = {};
    countingStationsData.forEach(station => {
        if (!groupedStationsData[station.strtyp]) {
            groupedStationsData[station.strtyp] = [];
        }
        groupedStationsData[station.strtyp].push({
            lat: station.lat,
            lon: station.lon,
            name: station.name,
            id: station.id,
            type: station.type,
            strtyp: station.strtyp,
            z: station.total,
            color: station.color
        });
    });

    // Remove existing mapbubble series (except the base map series)
    while (worldMap.chart.series.length > 1) {
        worldMap.chart.series[worldMap.chart.series.length - 1].remove(false);
    }

    // Add new mapbubble series for each 'strtyp' category
    Object.keys(groupedStationsData).forEach(strtyp => {
        worldMap.chart.addSeries({
            stickyTracking: false,
            type: 'mapbubble',
            name: strtyp,
            data: groupedStationsData[strtyp],
            color: groupedStationsData[strtyp][0].color,
            minSize: 10,
            maxSize: '5%',
            showInLegend: true,
            tooltip: {
                useHTML: true, // Enable HTML in tooltip
                distance: 20,
                pointFormatter: function () {
                    let tooltipHtml = `<b>${this.id} ${this.name}</b><br>`;
                    tooltipHtml += `${this.type}<br><br>`;
                    tooltipHtml += `<b>Durchschnittlicher Tagesverkehr (DTV)</b><br>`;
                    tooltipHtml += `<b>${Highcharts.numberFormat(this.z, 0)}</b> Fzg. pro Tag<br><br>`;
                    return tooltipHtml;
                }
            },
            point: {
                events: {
                    click: async function (e) {
                        countingStation = e.point.id;
                        // Update the board with the selected station
                        await updateBoard(board, countingStation, true, type, timeRange);
                    }
                }
            }
        }, false); // Defer redraw
    });

    worldMap.chart.redraw();

    // Filter counting traffic rows by the given time range
    let filteredCountingTrafficRows = filterCountingTrafficRows(countingTrafficRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = aggregateDailyTraffic(countingTrafficRows);
    const rollingAverageData = compute7DayRollingAverage(aggregatedTrafficData);
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(aggregatedTrafficData);
    timelineChart.chart.series[1].setData(rollingAverageData);

    // Aggregate yearly traffic data for the selected counting station
    const aggregatedYearlyTrafficData = aggregateYearlyTrafficData(countingTrafficRows);
    // Update the DTV graph in the new chart
    dtvChart.chart.series[0].setData(aggregatedYearlyTrafficData);
}
