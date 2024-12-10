import {
    getFilteredZaehlstellen,
    updateState,
    getStateFromUrl,
    updateCredits,
    readCSV,
    extractYearlyTraffic,
    extractYearlyTemperature,
    extractDailyTraffic,
    compute7DayRollingAverage,
    extractDailyWeatherData
} from "../../src/functions.js";

export async function updateBoard(board, type, activeStrtyp, zst, fzgtyp, timeRange, newType) {
    const [
        , // filter-selection
        map,
        yearlyChart,
        availabilityChart,
        timelineChart,
        , // filter-selection-2
        tvChart,
        weatherChart
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    zst = updateState(type, activeStrtyp, zst, fzgtyp, timeRange, zaehlstellen);

    const groupedStationsData = {};
    zaehlstellen.forEach(station => {
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
    if (newType) {
        // Remove existing mapbubble series (except the base map series)
        while (map.chart.series.length > 1) {
            map.chart.series[map.chart.series.length - 1].remove(false);
        }

        // Add new mapbubble series for each 'strtyp' category
        Object.keys(groupedStationsData).forEach(strtyp => {
            map.chart.addSeries({
                stickyTracking: false,
                type: 'mapbubble',
                name: strtyp,
                data: groupedStationsData[strtyp],
                color: groupedStationsData[strtyp][0].color,
                visible: activeStrtyp === 'Alle' || strtyp.includes(activeStrtyp),
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
                            const currentState = getStateFromUrl();
                            zst = e.point.id;
                            // Update the board with the selected station
                            await updateBoard(
                                board,
                                currentState.activeType,
                                currentState.activeStrtyp,
                                zst,
                                currentState.activeFzgtyp,
                                currentState.activeTimeRange,
                                false
                            );
                        }
                    }
                }
            }, false); // Defer redraw
        });

        map.chart.redraw();

        // Update the credits text of yearlyChart, availabilityChart and tvChart
        updateCredits(yearlyChart.chart.credits, type);
        updateCredits(availabilityChart.chart.credits, type);
        updateCredits(tvChart.chart.credits, type);

    }else{
        // Update the map with the new data
        map.chart.series.forEach(series => {
            series.data.forEach(point => {
                point.update({
                    visible: activeStrtyp === 'Alle' || point.strtyp.includes(activeStrtyp)
                })
            });
        });
    }

    map.chart.series.forEach(series => {
        series.data.forEach(point => {
            point.update({
                selected: point.id === zst
            })
        });
    });

    // Get the heat map data for the selected counting station
    const dailyDataRows = await readCSV(`../data/${type}/${zst}_daily.csv`);
    const yearlyDataRows = await readCSV(`../data/${type}/${zst}_yearly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    const yearlyTempRows = await readCSV(`../data/weather/weather_yearly.csv`);

    // Aggregate yearly traffic data for the selected counting station
    const {dailyAvgPerYear, numDaysPerYear, minYear, maxYear} = extractYearlyTraffic(yearlyDataRows,
        fzgtyp);
    const dailyAvgTempPerYear = extractYearlyTemperature(yearlyTempRows, minYear, maxYear);
    // Update the DTV graph in the new chart
    yearlyChart.chart.series[0].setData(dailyAvgPerYear);
    yearlyChart.chart.series[1].setData(dailyAvgTempPerYear);
    yearlyChart.chart.series[1].setVisible(type === 'Velo', true);
    availabilityChart.chart.series[0].setData(numDaysPerYear);


    // Aggregate daily traffic data for the selected counting station
    const {dailyTraffic, minDate, maxDate} = extractDailyTraffic(dailyDataRows, fzgtyp);
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(dailyTraffic);

    const rollingAvg = compute7DayRollingAverage(dailyTraffic);
    tvChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    tvChart.chart.series[0].setData(dailyTraffic);
    tvChart.chart.series[1].setData(rollingAvg);


    const { dailyTemp, dailyPrec, dailyTempRange } = extractDailyWeatherData(dailyTempRows, minDate, maxDate);

    weatherChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    weatherChart.chart.series[0].setData(dailyPrec);
    weatherChart.chart.series[1].setData(dailyTempRange);
    weatherChart.chart.series[2].setData(dailyTemp);
}
