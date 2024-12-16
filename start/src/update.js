import {
    getFilteredZaehlstellen,
    updateState,
    toggleFahrzeugtypDropdown,
    getStateFromUrl,
    uncheckAllStrTyp,
    updateCredits,
    readCSV,
    extractYearlyTraffic,
    extractYearlyTemperature,
    extractDailyTraffic,
    compute7DayRollingAverage,
    extractDailyWeatherData
} from "../../src/functions.js";

export async function updateBoard(board, type, activeStrtyp, zst, fzgtyp, timeRange, newType, newZst) {
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
    const lastZst = zst;
    zst = updateState(type, activeStrtyp, zst, fzgtyp, timeRange, zaehlstellen);
    newZst = newZst || lastZst !== zst;
    fzgtyp = toggleFahrzeugtypDropdown(type, fzgtyp);

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
        uncheckAllStrTyp();
        activeStrtyp = 'Alle';

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
                    useHTML: true,
                    distance: 20,
                    pointFormatter: function () {
                        let tooltipHtml = `<b>${this.id} ${this.name}</b><br>`;
                        tooltipHtml += `${this.type}<br><br>`;
                        tooltipHtml += `<b>Durchschnittlicher Tagesverkehr (DTV)</b><br>`;
                        tooltipHtml += `<b>${Highcharts.numberFormat(this.z, 0,  '.', "'")}</b><br><br>`;
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
                                false,
                                true
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

    } else {
        // Update the map with the new data
        map.chart.series.forEach(series => {
            series.data.forEach(point => {
                point.update({
                    visible: activeStrtyp === 'Alle' || point.strtyp.includes(activeStrtyp)
                });
            });
        });
    }

    map.chart.series.forEach(series => {
        series.data.forEach(point => {
            point.update({
                selected: point.id === zst
            });
        });
    });

    // Get the data for the selected counting station
    const dailyDataRows = await readCSV(`../data/${type}/${zst}_daily.csv`);
    const yearlyDataRows = await readCSV(`../data/${type}/${zst}_yearly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    const yearlyTempRows = await readCSV(`../data/weather/weather_yearly.csv`);

    if (newZst){
        // Extract total yearly traffic and temperature
        const {dailyAvgPerYearTotal, dailyAvgPerYearByDirection, numDaysPerYear, directionNames, minYear, maxYear} = extractYearlyTraffic(yearlyDataRows, fzgtyp);
        const dailyAvgTempPerYear = extractYearlyTemperature(yearlyTempRows, minYear, maxYear);

        // Determine directions present
        const isSingleDirection = directionNames.length <= 1;
        const totalLabel = isSingleDirection ? (directionNames[0] || 'Gesamt') : 'Gesamtquerschnitt';

        // If we have multiple directions, we must re-aggregate by direction
        // If single direction, just use dailyAvgPerYear and numDaysPerYear as total
        let dtv_ri1 = [];
        let dtv_ri2 = [];
        let dtv_total;
        let temp;
        let avail_ri1 = [];
        let avail_ri2 = [];
        let avail_total;
        let yearTimestamps;

        dtv_total = dailyAvgPerYearTotal.map(item => item[1]);
        avail_total = numDaysPerYear.map(item => item[1]);
        yearTimestamps = dailyAvgPerYearTotal.map(item => item[0]);
        temp = dailyAvgTempPerYear.map(item => item[1]);

        if (!isSingleDirection) {
            dtv_ri1 = dailyAvgPerYearByDirection[directionNames[0]].map(item => item[1]);
            avail_ri1 = numDaysPerYear.map(item => item[1]);

            dtv_ri2 = dailyAvgPerYearByDirection[directionNames[1]].map(item => item[1]);
            avail_ri2 = numDaysPerYear.map(item => item[1]);
        }

        // Set columns in the Yearly Traffic connector
        let yearlyTraffic = await board.dataPool.getConnectorTable('Yearly Traffic');
        yearlyTraffic.setColumns({});

        // Build columns
        const yearsColumn = yearTimestamps.map(ts => new Date(ts).getFullYear());

        const yearlyColumns = {
            'year': yearsColumn,
            'dtv_total': dtv_total,
            'temp': temp,
            'avail_total': avail_total
        };

        if (!isSingleDirection) {
            yearlyColumns['dtv_ri1'] = dtv_ri1;
            yearlyColumns['dtv_ri2'] = dtv_ri2;
            yearlyColumns['avail_ri1'] = avail_ri1;
            yearlyColumns['avail_ri2'] = avail_ri2;
        }

        yearlyTraffic.setColumns(yearlyColumns);

        // Update the columnAssignment for the Yearly Traffic connector
        let yearlyColumnAssignment = [];
        if (!isSingleDirection) {
            yearlyColumnAssignment.push(
                { seriesId: 'series-ri1', data: ['year', 'dtv_ri1'] },
                { seriesId: 'series-ri2', data: ['year', 'dtv_ri2'] }
            );
        }
        yearlyColumnAssignment.push(
            { seriesId: 'series-gesamt', data: ['year', 'dtv_total'] },
            { seriesId: 'series-temp', data: ['year', 'temp'] }
        );
        yearlyChart.connectorHandlers[0].updateOptions({
            id: 'Yearly Traffic',
            columnAssignment: yearlyColumnAssignment
        });

        let availabilityColumnAssignment = [];
        if (!isSingleDirection) {
            availabilityColumnAssignment.push(
                { seriesId: 'avail-ri1', data: ['year', 'avail_ri1'] },
                { seriesId: 'avail-ri2', data: ['year', 'avail_ri2'] }
            );
        }
        availabilityColumnAssignment.push({ seriesId: 'avail-gesamt', data: ['year', 'avail_total'] });

        availabilityChart.connectorHandlers[0].updateOptions({
            id: 'Yearly Traffic',
            columnAssignment: availabilityColumnAssignment
        });

        // Remove all existing series and re-add them
        while (yearlyChart.chart.series.length > 0) {
            yearlyChart.chart.series[0].remove(false);
        }
        while (availabilityChart.chart.series.length > 0) {
            availabilityChart.chart.series[0].remove(false);
        }

        // Add series to yearlyChart
        if (isSingleDirection) {
            yearlyChart.chart.addSeries({
                id: 'series-gesamt',
                name: totalLabel,
                data: dtv_total,
                marker: {
                    symbol: 'circle',
                    enabled: false
                },
                color: '#6f6f6f'
            }, false);
        } else {
            yearlyChart.chart.addSeries({
                id: 'series-ri1',
                name: directionNames[0],
                data: dtv_ri1,
                marker: {
                    symbol: 'circle',
                    enabled: false
                },
                color: '#007a2f'
            }, false);
            yearlyChart.chart.addSeries({
                id: 'series-ri2',
                name: directionNames[1],
                data: dtv_ri2,
                marker: {
                    symbol: 'circle',
                    enabled: false
                },
                color: '#008ac3'
            }, false);
            yearlyChart.chart.addSeries({
                id: 'series-gesamt',
                name: totalLabel,
                data: dtv_total,
                marker: {
                    symbol: 'circle',
                    enabled: false
                },
                color: '#6f6f6f'
            }, false);
        }

        yearlyChart.chart.addSeries({
            id: 'series-temp',
            name: 'Durchschnittstemperatur',
            dashStyle: 'Dash',
            data: temp,
            yAxis: 1,
            marker: {
                symbol: 'circle',
                enabled: false
            },
            color: '#8B2223'
        }, false);

        yearlyChart.chart.redraw();

        // Add series to availabilityChart
        if (isSingleDirection) {
            availabilityChart.chart.addSeries({
                id: 'avail-gesamt',
                name: totalLabel,
                data: avail_total,
                color: '#6f6f6f'
            }, false);
        } else {
            availabilityChart.chart.addSeries({
                id: 'avail-ri1',
                name: directionNames[0],
                data: avail_ri1,
                color: '#007a2f'
            }, false);
            availabilityChart.chart.addSeries({
                id: 'avail-ri2',
                name: directionNames[1],
                data: avail_ri2,
                color: '#008ac3'
            }, false);
            availabilityChart.chart.addSeries({
                id: 'avail-gesamt',
                name: totalLabel,
                data: avail_total,
                color: '#6f6f6f'
            }, false);
        }
        availabilityChart.chart.redraw();
    }

    // Aggregate daily traffic data for the selected counting station (for timeline, tvChart and weather)
    const {dailyTraffic, minDate, maxDate} = extractDailyTraffic(dailyDataRows, fzgtyp);
    let dailyTrafficConnector = await board.dataPool.getConnectorTable('Daily Traffic');

    // Update timelineChart, tvChart, weatherChart
    timelineChart.chart.series[0].setData(dailyTraffic);

    const rollingAvg = compute7DayRollingAverage(dailyTraffic);
    const { dailyTemp, dailyPrec, dailyTempRange } = extractDailyWeatherData(dailyTempRows, minDate, maxDate);

    // Update the columnAssignment for the Daily Traffic connector
    dailyTrafficConnector.setColumns({
        'tag': dailyTraffic.map(item => item[0]),
        'tv_gesamt': dailyTraffic.map(item => item[1]),
        'tv_rolling': rollingAvg.map(item => item[1]),
        'temperatur': dailyTemp.map(item => item[1]),
        'niederschlag': dailyPrec.map(item => item[1]),
        'temperatur_min': dailyTempRange.map(item => item[1]),
        'temperatur_max': dailyTempRange.map(item => item[2])
    });

    tvChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    weatherChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
}
