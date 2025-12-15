import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    getStateFromUrl,
    updateCredits,
    readCSV,
    extractYearlyTraffic,
    extractYearlyTemperature,
    extractDailyTraffic,
    extractDailyApproval,
    computeYearlyUnapprovedDays,
    compute7DayRollingAverage,
    extractDailyWeatherData,
    updateExporting
} from "../../src/functions.js";

export async function updateBoard(board, type, activeStrtyp, zst, fzgtyp, speed, timeRange, newType, newZst) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        map,
        yearlyChart,
        availabilityChart,
        , // filter-selection-2 (dayrange buttons)
        timelineChart,
        tvChart,
        weatherChart
    ] = board.mountedComponents.map(c => c.component);
    
    // Get the time-range-selector (Navigator) component
    const navigatorComponent = board.mountedComponents.find(c => c.cell.id === 'time-range-selector')?.component;

    // Determine if we're using speed classes or fzgtyp (before updateState to get correct zaehlstellen)
    const hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    const dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    const filterKeys = hasSpeedSelection ? speed : fzgtyp;
    
    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp, speed);
    const lastZst = zst;
    
    // Ensure we have a valid zst before loading station data
    // If zst is invalid, updateState will fix it, but we need zaehlstellen first
    if ((!zst || zst === 'default_station') && zaehlstellen && zaehlstellen.length > 0) {
        zst = zaehlstellen[0].id;
    }
    
    const stationRow = (await loadStations(type)).find(r => String(r.Zst_id) === String(zst));
    const next = await updateState(board, type, activeStrtyp, zst, fzgtyp, speed, timeRange, zaehlstellen, stationRow);
    zst = next.zst;
    fzgtyp = next.fzgtyp;
    speed = next.speed;
    newZst = newZst || lastZst !== zst;
    
    // Recalculate zaehlstellen with updated filters to get correct DTV values for the map
    const updatedZaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp, speed);
    
    const groupedStationsData = {};
    updatedZaehlstellen.forEach(station => {
        // Only include stations with valid DTV data (null means no data for selected filters)
        if (station.total === null) return;
        
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
                name: `${strtyp}`,
                data: groupedStationsData[strtyp],
                color: groupedStationsData[strtyp][0].color,
                visible: true, // Always show all series since strtyp filter is removed
                minSize: 10,
                maxSize: '5%',
                tooltip: {
                    useHTML: true,
                    distance: 20,
                    pointFormatter: function () {
                        let tooltipHtml = `<b>${this.id} ${this.name}</b><br><br>`;
                        tooltipHtml += `<b>Durchschnittlicher Tagesverkehr (DTV)</b><br>`;
                        tooltipHtml += `<i>über alle vorhandenen Messungen</i><br>`;
                        tooltipHtml += `<b>${Highcharts.numberFormat(this.z, 0)}</b><br><br>`;
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
                                currentState.activeSpeed,
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

        map.chart.mapView.setView([7.62, 47.56], 13);

    } else {
        // Update DTV values when filters change (fzgtyp or speed) or when station changes
        // Update existing series with new data
        map.chart.series.forEach((series, seriesIndex) => {
            if (seriesIndex === 0) return; // Skip base map series
            
            const strtyp = series.name;
            const newData = groupedStationsData[strtyp] || [];
            const newDataIds = new Set(newData.map(p => p.id));
            
            // Update each point with new DTV value or hide it if not in newData
            series.data.forEach((point) => {
                const newPoint = newData.find(p => p.id === point.id);
                if (newPoint) {
                    // Update with new DTV value
                    point.update({
                        z: newPoint.z
                    }, false);
                } else if (newDataIds.size > 0) {
                    // Hide point if it's not in the new data (no data for selected filters)
                    point.update({
                        z: null
                    }, false);
                }
            });
        });
        map.chart.redraw();
    }

    map.chart.series.forEach(series => {
        series.data.forEach(point => {
            point.update({
                selected: point.id === zst
            });
        });
    });

    // Get the data for the selected counting station
    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    const yearlyDataRows = await readCSV(`../data/${dataType}/${zst}_yearly.csv`);
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    const yearlyTempRows = await readCSV(`../data/weather/weather_yearly.csv`);

    // Always extract daily traffic data to update time-range-selector
    // This is needed whenever ZST, fzgtyp, or speed changes
    const {dailyTraffic: extractedDailyTraffic, minDate, maxDate} = extractDailyTraffic(dailyDataRows, filterKeys);
    
    // Update time-range-selector series data whenever configuration changes
    // Highcharts will automatically update dataMin/dataMax when series data changes
    if (navigatorComponent && navigatorComponent.chart) {
        const navigatorChart = navigatorComponent.chart;
        if (navigatorChart.series && navigatorChart.series.length > 0) {
            navigatorChart.series[0].setData(extractedDailyTraffic, false);
            navigatorChart.redraw();
        }
    }
    
    // Check if there's data in the current time range, if not, find newest data with same duration
    const hasDataInRange = extractedDailyTraffic.some(([ts, value]) => 
        ts >= timeRange[0] && ts <= timeRange[1] && value != null && value !== 0
    );
    
    let timeRangeChanged = false;
    if (!hasDataInRange && extractedDailyTraffic.length > 0) {
        // Find valid data points (non-null, non-zero)
        const validDataPoints = extractedDailyTraffic
            .filter(([ts, value]) => value != null && value !== 0);
        
        if (validDataPoints.length > 0) {
            // Find the newest data point
            const newestDataPoint = validDataPoints.sort((a, b) => b[0] - a[0])[0];
            const rangeDuration = timeRange[1] - timeRange[0];
            const newMax = newestDataPoint[0];
            let newMin = newMax - rangeDuration;
            
            // Ensure newMin doesn't go before the first available data point
            const firstDataPoint = validDataPoints.sort((a, b) => a[0] - b[0])[0];
            if (newMin < firstDataPoint[0]) {
                newMin = firstDataPoint[0];
                // Adjust newMax to maintain duration if possible, otherwise use newest point
                const adjustedMax = newMin + rangeDuration;
                if (adjustedMax <= newestDataPoint[0]) {
                    // We can maintain the duration
                    newMax = adjustedMax;
                } else {
                    // Can't maintain duration, use newest point as max
                    newMax = newestDataPoint[0];
                }
            }
            
            // Update timeRange to jump to newest data with same duration
            timeRange = [newMin, newMax];
            timeRangeChanged = true;
            
            // Update navigator extremes
            if (navigatorComponent && navigatorComponent.chart) {
                navigatorComponent.chart.xAxis[0].setExtremes(newMin, newMax);
            }
            
            // Update URL params and date pickers to reflect the new time range
            // We need to call updateState again with the new timeRange to update URL and UI
            await updateState(board, type, activeStrtyp, zst, fzgtyp, speed, timeRange, zaehlstellen, stationRow);
        }
    }

    if (newZst){
        // Precompute daily approval flags from daily data
        const dailyApproval = extractDailyApproval(dailyDataRows);
        const yearlyUnapproved = computeYearlyUnapprovedDays(dailyDataRows);

        // Extract total yearly traffic and temperature
        const {dailyAvgPerYearTotal, dailyAvgPerYearByDirection, numDaysPerYear, numDaysPerYearByDirection, directionNames, minYear, maxYear} = extractYearlyTraffic(yearlyDataRows, filterKeys);
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
            avail_ri1 = numDaysPerYearByDirection[directionNames[0]].map(item => item[1]);

            dtv_ri2 = dailyAvgPerYearByDirection[directionNames[1]].map(item => item[1]);
            avail_ri2 = numDaysPerYearByDirection[directionNames[1]].map(item => item[1]);
        } else {
            // For single direction, use total values for ri1
            dtv_ri1 = dtv_total;
            avail_ri1 = avail_total;
        }

        // Set columns in the Yearly Traffic connector
        let yearlyTraffic = await board.dataPool.connectors['Yearly Traffic'].getTable();
        yearlyTraffic.setColumns({});

        // Build columns
        const yearsColumn = yearTimestamps.map(ts => new Date(ts).getFullYear());

        // Compute number of nicht plausibilisierte Tage per year, per direction and total
        const dir1 = directionNames[0];
        const dir2 = directionNames[1];

        const avail_ri1_unapproved = dir1
            ? yearsColumn.map(year => {
                // For single direction, fall back to total if direction-specific data not available
                const dirValue = yearlyUnapproved.byDirection[dir1]?.[year];
                if (dirValue !== undefined) {
                    return dirValue;
                }
                // Fallback to total for single direction cases
                return isSingleDirection ? (yearlyUnapproved.total[year] || 0) : 0;
            })
            : yearsColumn.map(() => 0);

        const avail_ri2_unapproved = dir2
            ? yearsColumn.map(year => (yearlyUnapproved.byDirection[dir2]?.[year] || 0))
            : yearsColumn.map(() => 0);

        const avail_total_unapproved = yearsColumn.map(year => yearlyUnapproved.total[year] || 0);

        // Approved days are total measured days minus unapproved days
        const avail_ri1_approved = avail_ri1.length
            ? avail_ri1.map((days, idx) => (days || 0) - (avail_ri1_unapproved[idx] || 0))
            : (isSingleDirection && avail_total.length
                ? avail_total.map((days, idx) => (days || 0) - (avail_ri1_unapproved[idx] || 0))
                : []);

        const avail_ri2_approved = avail_ri2.length
            ? avail_ri2.map((days, idx) => (days || 0) - (avail_ri2_unapproved[idx] || 0))
            : [];

        const avail_total_approved = avail_total.map((days, idx) => (days || 0) - (avail_total_unapproved[idx] || 0));

        const yearlyColumns = {
            'year': yearsColumn,
            'dtv_ri1': dtv_ri1,
            'dtv_ri2': dtv_ri2,
            'dtv_total': dtv_total,
            'temp': temp,
            'avail_ri1_approved': avail_ri1_approved,
            'avail_ri1_unapproved': avail_ri1_unapproved,
            'avail_ri2_approved': avail_ri2_approved,
            'avail_ri2_unapproved': avail_ri2_unapproved,
            'avail_total_approved': avail_total_approved,
            'avail_total_unapproved': avail_total_unapproved
        };

        yearlyTraffic.setColumns(yearlyColumns);

        // Add series to yearlyChart
        if (isSingleDirection) {
            yearlyChart.chart.series[0].update({
                name: 'Richtung 1',
                visible: false,
                showInLegend: false
            });
            yearlyChart.chart.series[1].update({
                name: 'Richtung 2',
                visible: false,
                showInLegend: false
            });
        } else {
            yearlyChart.chart.series[0].update({
                name: directionNames[0],
                visible: true,
                showInLegend: true
            });
            yearlyChart.chart.series[1].update({
                name: directionNames[1],
                visible: true,
                showInLegend: true
            });
        }

        yearlyChart.chart.series[2].update({
            name: totalLabel,
        });

        // Add series to availabilityChart:
        // Use real direction names and handle the single-direction case.
        const dirLabel1 = directionNames[0] || 'Richtung 1';
        const dirLabel2 = directionNames[1] || 'Richtung 2';

        if (isSingleDirection) {
            // Only one direction measured: show a single stack with that direction's name
            // Use same color as yearly chart (#6f6f6f) for single direction
            availabilityChart.chart.series[0].update({
                name: `${dirLabel1} (plausibilisiert)`,
                visible: true,
                showInLegend: true,
                color: '#6f6f6f'
            });
            availabilityChart.chart.series[1].update({
                name: `${dirLabel1} (nicht plausibilisiert)`,
                visible: true,
                showInLegend: true
            });

            // Hide second direction stacks
            if (availabilityChart.chart.series[2]) {
                availabilityChart.chart.series[2].update({
                    visible: false,
                    showInLegend: false
                });
            }
            if (availabilityChart.chart.series[3]) {
                availabilityChart.chart.series[3].update({
                    visible: false,
                    showInLegend: false
                });
            }
        } else {
            // Two directions: label each stack with its actual direction name
            // Reset colors to original (green for ri1, blue for ri2)
            availabilityChart.chart.series[0].update({
                name: `${dirLabel1} (plausibilisiert)`,
                visible: true,
                showInLegend: true,
                color: '#007a2f'
            });
            availabilityChart.chart.series[1].update({
                name: `${dirLabel1} (nicht plausibilisiert)`,
                visible: true,
                showInLegend: true
            });

            if (availabilityChart.chart.series[2]) {
                availabilityChart.chart.series[2].update({
                    name: `${dirLabel2} (plausibilisiert)`,
                    visible: true,
                    showInLegend: true,
                    color: '#008ac3'
                });
            }
            if (availabilityChart.chart.series[3]) {
                availabilityChart.chart.series[3].update({
                    name: `${dirLabel2} (nicht plausibilisiert)`,
                    visible: true,
                    showInLegend: true
                });
            }
        }

        // Use the already extracted daily traffic data
        const dailyTraffic = extractedDailyTraffic;
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        let dailyTrafficConnector = await board.dataPool.connectors['Daily Traffic'].getTable()

        // Update timelineChart, tvChart, weatherChart
        timelineChart.chart.series[0].setData(dailyTraffic);

        const rollingAvg = compute7DayRollingAverage(dailyTraffic);
        const { dailyTemp, dailyPrec, dailyTempRange } = extractDailyWeatherData(dailyTempRows, minDate, maxDate);

        // Compute which days are not fully plausibilisiert (ValuesApproved < 24 in any row)
        // Create scatter data as [x, y] pairs for days that are not fully approved
        const unapprovedScatterData = dailyTraffic
            .map(([ts, value]) => {
                const fullyApproved = approvalMap.get(ts);
                // Only include points where we have traffic data and it's not fully approved
                if (value != null && value !== 0 && fullyApproved === false) {
                    return [ts, value];
                }
                return null;
            })
            .filter(item => item !== null);

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

        // Set scatter data directly on the existing scatter series
        const allSeries = tvChart.chart.series || [];
        let unapprovedSeries = allSeries.find(s =>
            s.id === 'series-unapproved' ||
            s.options?.id === 'series-unapproved' ||
            s.userOptions?.id === 'series-unapproved'
        );

        // Fallback: assume the 3rd series is the unapproved scatter if ids aren't wired through
        if (!unapprovedSeries && allSeries.length >= 3) {
            unapprovedSeries = allSeries[2];
            console.warn('series-unapproved not found by id, using series[2] as fallback', {
                fallbackName: unapprovedSeries.name,
                fallbackId: unapprovedSeries.id,
                fallbackOptionsId: unapprovedSeries.options?.id
            });
        }

        if (unapprovedSeries) {
            unapprovedSeries.setData(unapprovedScatterData, false);
            tvChart.chart.redraw();
        } else {
            console.warn('series-unapproved not found on tvChart (no suitable fallback)');
        }
    }

    tvChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    weatherChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);

    // Update exporting options (map title is only added in exporting, not in the live chart)
    await updateExporting(board, map.chart.exporting, 'map', type, '', fzgtyp, '', false, true, speed);
    await updateExporting(board, yearlyChart.chart.exporting, 'yearly-chart', type, zst, fzgtyp, '', false, false, speed);
    await updateExporting(board, availabilityChart.chart.exporting, 'availability-chart', type, zst, fzgtyp, '', false, false, speed);
    await updateExporting(board, tvChart.chart.exporting, 'daily-chart', type, zst, fzgtyp, timeRange, false, false, speed);
    await updateExporting(board, weatherChart.chart.exporting, 'weather-chart', '', '', '', timeRange);
}
