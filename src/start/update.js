import {
    getFilteredCountingStations,
    extractDailyTraffic,
    compute7DayRollingAverage,
    extractYearlyTraffic,
    populateCountingStationDropdown,
    updateDatePickers,
    updateUrlParams,
    readCSV
} from "../functions.js";

export async function updateBoard(board, countingStation, newData, type, timeRange, activeStrtyp=null) {
    const [
        filterSelection,
        map,
        dtvChart,
        timelineChart,
        filterSelection2,
        tvChart
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
    populateCountingStationDropdown(countingStationsData, countingStation, activeStrtyp)
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
    while (map.chart.series.length > 1) {
        map.chart.series[map.chart.series.length - 1].remove(false);
    }

    // Add new mapbubble series for each 'strtyp' category
    Object.keys(groupedStationsData).forEach(strtyp => {
        if (!activeStrtyp || strtyp.includes(activeStrtyp)) {
            map.chart.addSeries({
                stickyTracking: false,
                type: 'mapbubble',
                name: strtyp,
                data: groupedStationsData[strtyp],
                color: groupedStationsData[strtyp][0].color,
                minSize: 10,
                maxSize: '5%',
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
        }
    });

    map.chart.redraw();

    // Get the heat map data for the selected counting station
    const dailyDataRows = await readCSV(`./data/${type}/${countingStation}_daily.csv`);
    const yearlyDataRows = await readCSV(`./data/${type}/${countingStation}_yearly.csv`);

    // Aggregate yearly traffic data for the selected counting station
    const {dailyAvgPerYear, numDaysPerYear} = extractYearlyTraffic(yearlyDataRows);
    // Update the DTV graph in the new chart
    dtvChart.chart.series[0].setData(dailyAvgPerYear);
    dtvChart.chart.series[1].setData(numDaysPerYear);

    // Aggregate daily traffic data for the selected counting station
    const dailyTraffic = extractDailyTraffic(dailyDataRows);
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(dailyTraffic);

    const rollingAvg = compute7DayRollingAverage(dailyTraffic);
    tvChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    tvChart.chart.series[0].setData(dailyTraffic);
    tvChart.chart.series[1].setData(rollingAvg);
}
