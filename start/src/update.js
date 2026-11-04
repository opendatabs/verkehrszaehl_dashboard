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
    updateExporting,
    getTrafficLabel,
    normalizeZsts,
    setZstTrailingEmpty,
    vergleichColor,
    resetChartSeriesForMode,
    alignPairsToTags,
    getStationName,
    intersectDailyCoverage,
    clampTimeRangeToCoverage
} from "../../src/functions.js";

export async function updateBoard(board, type, activeStrtyp, zstsInput, fzgtyp, speed, timeRange, newType, newZst) {
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

    let zsts = normalizeZsts(zstsInput);
    // Do not clear multi-ZST on newType — page load uses newType=true for credits/map.
    // Verkehrsmittel change already passes a single-zst list from the filter listener.

    // Determine if we're using speed classes or fzgtyp (before updateState to get correct zaehlstellen)
    let hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    let dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    let filterKeys = hasSpeedSelection ? speed : fzgtyp;
    let shouldShowUnapproved = !hasSpeedSelection;
    
    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp, speed);
    const lastZstsKey = zsts.join(',');
    
    if (!zsts.length && zaehlstellen && zaehlstellen.length > 0) {
        zsts = [String(zaehlstellen[0].id)];
    }
    
    const stations = await loadStations(type);
    const stationRows = zsts.map(id => stations.find(r => String(r.Zst_id) === String(id))).filter(Boolean);
    const next = await updateState(board, type, activeStrtyp, zsts, fzgtyp, speed, timeRange, zaehlstellen, stationRows);
    zsts = next.zsts;
    fzgtyp = next.fzgtyp;
    speed = next.speed;
    newZst = newZst || lastZstsKey !== zsts.join(',');
    const zst = zsts[0];
    const stationRow = stationRows[0] || stations.find(r => String(r.Zst_id) === String(zst));

    hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    filterKeys = hasSpeedSelection ? speed : fzgtyp;
    shouldShowUnapproved = !hasSpeedSelection;
    
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
                        const dtvLabel = getTrafficLabel('DTV');
                        const tagesverkehrLabel = getTrafficLabel('Tagesverkehr');
                        let tooltipHtml = `<b>${this.id} ${this.name}</b><br><br>`;
                        tooltipHtml += `<b>Durchschnittlicher ${tagesverkehrLabel} (${dtvLabel})</b><br>`;
                        tooltipHtml += `<i>über alle vorhandenen Messungen</i><br>`;
                        tooltipHtml += `<b>${Highcharts.numberFormat(this.z, 0)}</b><br><br>`;
                        return tooltipHtml;
                    }
                },
                point: {
                    events: {
                        click: async function (e) {
                            const currentState = getStateFromUrl();
                            const clickedId = String(e.point.id);
                            let nextZsts = normalizeZsts(currentState.activeZsts || [currentState.activeZst]);
                            if (nextZsts.includes(clickedId)) {
                                if (nextZsts.length > 1) {
                                    nextZsts = nextZsts.filter(id => id !== clickedId);
                                }
                                // never allow empty selection
                            } else {
                                nextZsts = [...nextZsts, clickedId];
                            }
                            setZstTrailingEmpty(nextZsts.length >= 2);
                            await updateBoard(
                                board,
                                currentState.activeType,
                                currentState.activeStrtyp,
                                nextZsts,
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

    const zstSet = new Set(zsts.map(String));
    map.chart.series.forEach(series => {
        series.data.forEach(point => {
            point.update({
                selected: zstSet.has(String(point.id))
            });
        });
    });

    if (zsts.length > 1) {
        await updateBoardVergleichStart({
            board, type, activeStrtyp, zsts, fzgtyp, speed, timeRange, newZst, newType,
            hasSpeedSelection, dataType, filterKeys, shouldShowUnapproved,
            map, yearlyChart, availabilityChart, timelineChart, tvChart, weatherChart,
            navigatorComponent, zaehlstellen
        });
        return;
    }

    resetChartSeriesForMode(yearlyChart.chart, { vergleichMode: false, baseCount: 4 });
    resetChartSeriesForMode(availabilityChart.chart, { vergleichMode: false, baseCount: 4 });
    resetChartSeriesForMode(tvChart.chart, { vergleichMode: false, baseCount: 3 });
    // Restore stacked columns after Vergleich mode
    availabilityChart.chart.update({
        plotOptions: { column: { stacking: 'normal' } }
    }, false);
    // Restore Dashboards highlight sync; drop Vergleich hover hooks (no component.update — that sticks loading)
    clearVergleichTvWeatherHover(tvChart, weatherChart);
    setDashboardHighlightSync(tvChart, true);
    setDashboardHighlightSync(weatherChart, true);

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
            let newMax = newestDataPoint[0];
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
            await updateState(board, type, activeStrtyp, zsts, fzgtyp, speed, timeRange, zaehlstellen, stationRows);
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
            // Initialize ri2 as empty array for single direction
            dtv_ri2 = [];
            avail_ri2 = [];
        }

        // Set columns in the Yearly Traffic connector
        let yearlyTraffic = await board.dataPool.connectors['Yearly Traffic'].getTable();
        yearlyTraffic.setColumns({});

        // Build columns
        const yearsColumn = yearTimestamps.map(ts => new Date(ts).getFullYear());
        
        // Filter out future years - only show years that are in the past (strictly less than current year)
        const currentYear = new Date().getFullYear();
        const pastYearIndices = yearsColumn.map((year, idx) => year < currentYear ? idx : -1).filter(idx => idx !== -1);
        
        // Filter all arrays to only include past years
        const filterArray = (arr) => pastYearIndices.map(idx => arr[idx]);
        
        const filteredYearTimestamps = filterArray(yearTimestamps);
        const filteredYearsColumn = filterArray(yearsColumn);
        const filteredDtvTotal = filterArray(dtv_total);
        const filteredAvailTotal = filterArray(avail_total);
        const filteredTemp = filterArray(temp);
        const filteredDtvRi1 = filterArray(dtv_ri1);
        const filteredDtvRi2 = filterArray(dtv_ri2);
        const filteredAvailRi1 = filterArray(avail_ri1);
        const filteredAvailRi2 = filterArray(avail_ri2);

        // Compute number of nicht validierte Tage per year, per direction and total
        const dir1 = directionNames[0];
        const dir2 = directionNames[1];

        const avail_ri1_unapproved = dir1
            ? filteredYearsColumn.map(year => {
                // For single direction, fall back to total if direction-specific data not available
                const dirValue = yearlyUnapproved.byDirection[dir1]?.[year];
                if (dirValue !== undefined) {
                    return dirValue;
                }
                // Fallback to total for single direction cases
                return isSingleDirection ? (yearlyUnapproved.total[year] || 0) : 0;
            })
            : filteredYearsColumn.map(() => 0);

        const avail_ri2_unapproved = dir2
            ? filteredYearsColumn.map(year => (yearlyUnapproved.byDirection[dir2]?.[year] || 0))
            : filteredYearsColumn.map(() => 0);

        const avail_total_unapproved = filteredYearsColumn.map(year => yearlyUnapproved.total[year] || 0);

        // Approved days are total measured days minus unapproved days
        const avail_ri1_approved = filteredAvailRi1.length
            ? filteredAvailRi1.map((days, idx) => (days || 0) - (avail_ri1_unapproved[idx] || 0))
            : (isSingleDirection && filteredAvailTotal.length
                ? filteredAvailTotal.map((days, idx) => (days || 0) - (avail_ri1_unapproved[idx] || 0))
                : []);

        const avail_ri2_approved = filteredAvailRi2.length
            ? filteredAvailRi2.map((days, idx) => (days || 0) - (avail_ri2_unapproved[idx] || 0))
            : [];

        const avail_total_approved = filteredAvailTotal.map((days, idx) => (days || 0) - (avail_total_unapproved[idx] || 0));

        // When speed classes are selected, set unapproved data to null arrays to preserve sync structure
        const avail_ri1_unapproved_final = shouldShowUnapproved ? avail_ri1_unapproved : filteredYearsColumn.map(() => null);
        const avail_ri2_unapproved_final = shouldShowUnapproved ? avail_ri2_unapproved : filteredYearsColumn.map(() => null);
        const avail_total_unapproved_final = shouldShowUnapproved ? avail_total_unapproved : filteredYearsColumn.map(() => null);

        // For single direction, ensure ri2 columns have 0 data (not null) to keep series visible for sync
        // Using 0 instead of null ensures the series has valid data points for the sync mechanism
        // In a stacked column chart, 0-height columns won't be visible anyway
        const avail_ri2_approved_final = isSingleDirection 
            ? filteredYearsColumn.map(() => 0) 
            : avail_ri2_approved;
        const avail_ri2_unapproved_final_single = isSingleDirection 
            ? filteredYearsColumn.map(() => 0) 
            : avail_ri2_unapproved_final;

        const yearlyColumns = {
            'year': filteredYearsColumn,
            'dtv_ri1': filteredDtvRi1,
            'dtv_ri2': filteredDtvRi2,
            'dtv_total': filteredDtvTotal,
            'temp': filteredTemp,
            'avail_ri1_approved': avail_ri1_approved,
            'avail_ri1_unapproved': avail_ri1_unapproved_final,
            'avail_ri2_approved': avail_ri2_approved_final,
            'avail_ri2_unapproved': avail_ri2_unapproved_final_single,
            'avail_total_approved': avail_total_approved,
            'avail_total_unapproved': avail_total_unapproved_final
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

        // Force redraw of yearlyChart to ensure sync mechanism is updated
        yearlyChart.chart.redraw();

        // Add series to availabilityChart:
        // Use real direction names and handle the single-direction case.
        const dirLabel1 = directionNames[0] || 'Richtung 1';
        const dirLabel2 = directionNames[1] || 'Richtung 2';

        // When speed classes are selected, skip unvalidated data logic
        // Keep series visible but hidden from legend to preserve sync structure

        if (isSingleDirection) {
            // Only one direction measured: show a single stack with that direction's name
            // Use same color as yearly chart (#6f6f6f) for single direction
            availabilityChart.chart.series[0].update({
                name: dirLabel1, // Remove "(validiert)" label
                visible: true,
                showInLegend: true,
                color: '#6f6f6f'
            });
            availabilityChart.chart.series[1].update({
                name: `${dirLabel1} (nicht validiert)`,
                visible: true, // Keep visible for sync, but data will be null
                showInLegend: shouldShowUnapproved
            });

            // For single direction, keep series[2] and series[3] visible but with null data
            // This ensures yearlyChart series[2] (total) can sync with availabilityChart series[2]
            // The data is already set to null in yearlyColumns above
            // Keep them fully visible (not opacity 0) so sync mechanism works properly
            if (availabilityChart.chart.series[2]) {
                availabilityChart.chart.series[2].update({
                    visible: true, // Keep visible for sync alignment
                    showInLegend: false
                    // Don't set opacity or enableMouseTracking - let them be normal for sync to work
                });
            }
            if (availabilityChart.chart.series[3]) {
                availabilityChart.chart.series[3].update({
                    visible: true, // Keep visible for sync alignment
                    showInLegend: false
                    // Don't set opacity or enableMouseTracking - let them be normal for sync to work
                });
            }
        } else {
            // Two directions: label each stack with its actual direction name
            // Reset colors to original (green for ri1, blue for ri2)
            availabilityChart.chart.series[0].update({
                name: dirLabel1, // Remove "(validiert)" label
                visible: true,
                showInLegend: true,
                color: '#007a2f'
            });
            availabilityChart.chart.series[1].update({
                name: `${dirLabel1} (nicht validiert)`,
                visible: true, // Keep visible for sync, but data will be null
                showInLegend: shouldShowUnapproved
            });

            if (availabilityChart.chart.series[2]) {
                availabilityChart.chart.series[2].update({
                    name: dirLabel2, // Remove "(validiert)" label
                    visible: true,
                    showInLegend: true,
                    color: '#008ac3'
                    // Reset any opacity or enableMouseTracking that might have been set for single direction
                });
            }
            if (availabilityChart.chart.series[3]) {
                availabilityChart.chart.series[3].update({
                    name: `${dirLabel2} (nicht validiert)`,
                    visible: true, // Keep visible for sync, but data will be null
                    showInLegend: shouldShowUnapproved
                    // Reset any opacity or enableMouseTracking that might have been set for single direction
                });
            }
        }

        // Force redraw of availabilityChart to ensure sync mechanism is updated
        availabilityChart.chart.redraw();

        // Use the already extracted daily traffic data
        const dailyTraffic = extractedDailyTraffic;
        const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
        let dailyTrafficConnector = await board.dataPool.connectors['Daily Traffic'].getTable()

        // Update timelineChart, tvChart, weatherChart
        timelineChart.chart.series[0].setData(dailyTraffic);

        const rollingAvg = compute7DayRollingAverage(dailyTraffic);
        const { dailyTemp, dailyPrec, dailyTempRange } = extractDailyWeatherData(dailyTempRows, minDate, maxDate);

        // Compute which days are not fully validiert (ValuesApproved < 24 in any row)
        // Create scatter data as [x, y] pairs for days that are not fully approved
        // When speed classes are selected, skip unvalidated data logic
        const unapprovedScatterData = hasSpeedSelection ? [] : dailyTraffic
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
            // When speed classes are selected, hide the unapproved series
            if (hasSpeedSelection) {
                unapprovedSeries.setData([], false);
                unapprovedSeries.update({
                    visible: false,
                    showInLegend: false
                }, false);
            } else {
                unapprovedSeries.setData(unapprovedScatterData, false);
                unapprovedSeries.update({
                    visible: true,
                    showInLegend: true
                }, false);
            }
            tvChart.chart.redraw();
        } else {
            console.warn('series-unapproved not found on tvChart (no suitable fallback)');
        }
    } else {
        // When speed selection changes but station doesn't, still update series visibility and data
        // Update availability chart: set unapproved data to null when speed is selected
        const shouldShowUnapproved = !hasSpeedSelection;
        
        // Get the yearly traffic connector to update unapproved data
        let yearlyTraffic = await board.dataPool.connectors['Yearly Traffic'].getTable();
        const currentColumns = yearlyTraffic.getColumns();
        const yearsColumn = currentColumns.year || [];
        
        // Update unapproved columns with null values when speed is selected
        const avail_ri1_unapproved_final = shouldShowUnapproved 
            ? (currentColumns.avail_ri1_unapproved || []) 
            : yearsColumn.map(() => null);
        const avail_ri2_unapproved_final = shouldShowUnapproved 
            ? (currentColumns.avail_ri2_unapproved || []) 
            : yearsColumn.map(() => null);
        const avail_total_unapproved_final = shouldShowUnapproved 
            ? (currentColumns.avail_total_unapproved || []) 
            : yearsColumn.map(() => null);
        
        yearlyTraffic.setColumns({
            'avail_ri1_unapproved': avail_ri1_unapproved_final,
            'avail_ri2_unapproved': avail_ri2_unapproved_final,
            'avail_total_unapproved': avail_total_unapproved_final
        });
        
        // Update series legend visibility (keep series visible for sync)
        if (availabilityChart.chart.series[1]) {
            availabilityChart.chart.series[1].update({
                visible: true, // Keep visible for sync
                showInLegend: shouldShowUnapproved
            }, false);
        }
        if (availabilityChart.chart.series[3]) {
            availabilityChart.chart.series[3].update({
                visible: true, // Keep visible for sync
                showInLegend: shouldShowUnapproved
            }, false);
        }
        availabilityChart.chart.redraw();

        // Update tv-chart unapproved series visibility
        const allSeries = tvChart.chart.series || [];
        let unapprovedSeries = allSeries.find(s =>
            s.id === 'series-unapproved' ||
            s.options?.id === 'series-unapproved' ||
            s.userOptions?.id === 'series-unapproved'
        );

        if (!unapprovedSeries && allSeries.length >= 3) {
            unapprovedSeries = allSeries[2];
        }

        if (unapprovedSeries) {
            if (hasSpeedSelection) {
                unapprovedSeries.setData([], false);
                unapprovedSeries.update({
                    visible: false,
                    showInLegend: false
                }, false);
            } else {
                // Recompute unapproved scatter data
                const dailyApproval = extractDailyApproval(dailyDataRows);
                const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
                const unapprovedScatterData = extractedDailyTraffic
                    .map(([ts, value]) => {
                        const fullyApproved = approvalMap.get(ts);
                        if (value != null && value !== 0 && fullyApproved === false) {
                            return [ts, value];
                        }
                        return null;
                    })
                    .filter(item => item !== null);
                unapprovedSeries.setData(unapprovedScatterData, false);
                unapprovedSeries.update({
                    visible: true,
                    showInLegend: true
                }, false);
            }
            tvChart.chart.redraw();
        }
    }

    tvChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);
    weatherChart.chart.xAxis[0].setExtremes(timeRange[0], timeRange[1]);

    // Update exporting options (map title is only added in exporting, not in the live chart)
    await updateExporting(board, map.chart.exporting, 'map', type, '', fzgtyp, '', false, true, speed);
    await updateExporting(board, yearlyChart.chart.exporting, 'yearly-chart', type, zsts, fzgtyp, '', false, false, speed);
    await updateExporting(board, availabilityChart.chart.exporting, 'availability-chart', type, zsts, fzgtyp, '', false, false, speed);
    await updateExporting(board, tvChart.chart.exporting, 'daily-chart', type, zsts, fzgtyp, timeRange, false, false, speed);
    await updateExporting(board, weatherChart.chart.exporting, 'weather-chart', '', '', '', timeRange);
}

async function updateBoardVergleichStart({
    board, type, activeStrtyp, zsts, fzgtyp, speed, timeRange, newZst, newType,
    hasSpeedSelection, dataType, filterKeys, shouldShowUnapproved,
    map, yearlyChart, availabilityChart, timelineChart, tvChart, weatherChart,
    navigatorComponent, zaehlstellen
}) {
    const nameById = new Map((zaehlstellen || []).map(s => [String(s.id), s.name]));
    const dailyTempRows = await readCSV(`../data/weather/weather_daily.csv`);
    const yearlyTempRows = await readCSV(`../data/weather/weather_yearly.csv`);

    const stationResults = await Promise.all(zsts.map(async (id, index) => {
        const dailyDataRows = await readCSV(`../data/${dataType}/${id}_daily.csv`);
        const yearlyDataRows = await readCSV(`../data/${dataType}/${id}_yearly.csv`);
        const { dailyTraffic, minDate, maxDate } = extractDailyTraffic(dailyDataRows, filterKeys);
        const { dailyAvgPerYearTotal, numDaysPerYear, minYear, maxYear } =
            extractYearlyTraffic(yearlyDataRows, filterKeys);
        const name = nameById.has(String(id))
            ? nameById.get(String(id))
            : await getStationName(type, id);
        // Compact legend/tooltip label to avoid cramped Jahres chart labels
        const label = name ? `${id} ${name}` : String(id);
        return {
            id: String(id),
            label,
            color: vergleichColor(index),
            dailyDataRows,
            dailyTraffic,
            minDate,
            maxDate,
            dailyAvgPerYearTotal,
            numDaysPerYear,
            minYear,
            maxYear
        };
    }));

    // Navigator domain = intersection of days where ALL selected stations have data
    const coverage = intersectDailyCoverage(stationResults.map(r => r.dailyTraffic));
    if (coverage.minDate != null && coverage.maxDate != null) {
        timeRange = clampTimeRangeToCoverage(timeRange, coverage.minDate, coverage.maxDate);
        await updateState(board, type, activeStrtyp, zsts, fzgtyp, speed, timeRange, zaehlstellen, null);
    }

    if (navigatorComponent?.chart?.series?.[0]) {
        navigatorComponent.chart.series[0].setData(coverage.dailyTraffic, false);
        navigatorComponent.chart.redraw();
        if (coverage.minDate != null && coverage.maxDate != null) {
            setAxisExtremesIfChanged(navigatorComponent.chart.xAxis[0], timeRange[0], timeRange[1]);
        }
    }

    if (newType) {
        updateCredits(yearlyChart.chart.credits, type);
        updateCredits(availabilityChart.chart.credits, type);
        updateCredits(tvChart.chart.credits, type);
    }

    // Yearly: hide only traffic series (0–2); keep temperature (series-temp) intact
    resetChartSeriesForMode(yearlyChart.chart, { vergleichMode: true, baseCount: 3 });
    // Availability has 4 stacked direction series
    resetChartSeriesForMode(availabilityChart.chart, { vergleichMode: true, baseCount: 4 });
    resetChartSeriesForMode(tvChart.chart, { vergleichMode: true, baseCount: 3 });

    // Disable stacking for Vergleich columns on availability chart
    availabilityChart.chart.update({
        plotOptions: { column: { stacking: undefined } }
    }, false);

    // Shared datetime axis for TV + weather — only the selected Zeitraum (not full history)
    const weatherMin = new Date(timeRange[0]);
    const weatherMax = new Date(timeRange[1] - 24 * 3600 * 1000);
    const { dailyTemp, dailyPrec, dailyTempRange } = extractDailyWeatherData(
        dailyTempRows,
        weatherMin,
        weatherMax
    );
    const weatherTags = dailyTemp.map(item => item[0]);

    // Single-mode connector uses calendar years (2019, 2020, …) as x — not UTC ms.
    const toYearPoints = (pairs) => (pairs || []).map(([ts, v]) => [new Date(ts).getFullYear(), v]);

    stationResults.forEach(r => {
        yearlyChart.chart.addSeries({
            id: `vergleich-year-${r.id}`,
            name: r.label,
            type: 'line',
            data: toYearPoints(r.dailyAvgPerYearTotal),
            color: r.color,
            visible: true,
            showInLegend: true,
            marker: { symbol: 'circle', enabled: false },
            dataLabels: { enabled: false }
        }, false);
        availabilityChart.chart.addSeries({
            id: `vergleich-avail-${r.id}`,
            name: r.label,
            type: 'column',
            data: toYearPoints(r.numDaysPerYear),
            color: r.color,
            visible: true,
            showInLegend: true,
            stacking: undefined,
            dataLabels: { enabled: false }
        }, false);
        tvChart.chart.addSeries({
            id: `vergleich-daily-${r.id}`,
            name: r.label,
            type: 'line',
            // Same x timestamps as weather connector → hover sync works
            data: alignPairsToTags(r.dailyTraffic, weatherTags),
            color: r.color,
            visible: true,
            showInLegend: true,
            marker: { symbol: 'circle', enabled: false },
            dataLabels: { enabled: false },
            connectNulls: false
        }, false);
    });

    // Restore shared yearly temperature on secondary axis (also as calendar years)
    const minYear = Math.min(...stationResults.map(r => r.minYear).filter(y => y && y < 9999));
    const maxYear = Math.max(...stationResults.map(r => r.maxYear).filter(y => y > 0));
    const yearlyTemp = extractYearlyTemperature(yearlyTempRows, minYear, maxYear);
    const tempSeries = yearlyChart.chart.get('series-temp')
        || yearlyChart.chart.series.find(s => String(s.options?.id || '') === 'series-temp');
    if (tempSeries) {
        tempSeries.setData(toYearPoints(yearlyTemp), false);
        tempSeries.update({
            visible: true,
            showInLegend: true,
            name: 'Durchschnittstemperatur',
            marker: { symbol: 'circle', enabled: false }
        }, false);
    }

    // Weather shares Daily Traffic connector with tv-chart — keep tag axis identical
    const dailyTrafficConnector = await board.dataPool.connectors['Daily Traffic'].getTable();
    dailyTrafficConnector.setColumns({
        tag: weatherTags,
        tv_gesamt: weatherTags.map(() => null),
        tv_rolling: weatherTags.map(() => null),
        temperatur: dailyTemp.map(item => item[1]),
        niederschlag: dailyPrec.map(item => item[1]),
        temperatur_min: dailyTempRange.map(item => item[1]),
        temperatur_max: dailyTempRange.map(item => item[2])
    });

    // Keep hidden base TV series off mouse/sync tracking after connector refresh
    ['series-gesamt', 'series-rolling', 'series-unapproved'].forEach(id => {
        const s = tvChart.chart.get(id)
            || tvChart.chart.series.find(ser => String(ser.options?.id || '') === id);
        if (s) {
            s.update({
                visible: false,
                showInLegend: false,
                enableMouseTracking: false
            }, false);
        }
    });

    // Dashboards connector highlight-sync hangs in Vergleich (TV series are not connector-bound).
    // Stop sync via API (never component.update — that leaves cells stuck in loading).
    setDashboardHighlightSync(tvChart, false);
    setDashboardHighlightSync(weatherChart, false);

    yearlyChart.chart.redraw();
    availabilityChart.chart.redraw();
    tvChart.chart.redraw();
    weatherChart.chart.redraw();

    bindVergleichTvWeatherHover(tvChart, weatherChart);

    if (timelineChart?.chart?.series?.[0]) {
        timelineChart.chart.series[0].setData(coverage.dailyTraffic);
    }

    // Only set extremes when they actually change — avoids afterSetExtremes → updateBoard loops
    setAxisExtremesIfChanged(tvChart.chart?.xAxis?.[0], timeRange[0], timeRange[1]);
    setAxisExtremesIfChanged(weatherChart.chart?.xAxis?.[0], timeRange[0], timeRange[1]);

    // Clear any leftover Dashboards loading spinner on these cells
    clearDashboardCellLoading(tvChart);
    clearDashboardCellLoading(weatherChart);

    await updateExporting(board, map.chart.exporting, 'map', type, '', fzgtyp, '', false, true, speed);
    await updateExporting(board, yearlyChart.chart.exporting, 'yearly-chart', type, zsts, fzgtyp, '', false, false, speed);
    await updateExporting(board, availabilityChart.chart.exporting, 'availability-chart', type, zsts, fzgtyp, '', false, false, speed);
    await updateExporting(board, tvChart.chart.exporting, 'daily-chart', type, zsts, fzgtyp, timeRange, false, false, speed);
    await updateExporting(board, weatherChart.chart.exporting, 'weather-chart', '', '', '', timeRange);
}

/** Enable/disable component highlight sync without remounting (avoids stuck loading cells). */
function setDashboardHighlightSync(component, enabled) {
    if (!component?.sync) return;
    try {
        if (component.sync.syncConfig?.highlight) {
            component.sync.syncConfig.highlight.enabled = !!enabled;
        }
        if (enabled) {
            if (typeof component.sync.start === 'function') component.sync.start();
        } else if (typeof component.sync.stop === 'function') {
            component.sync.stop();
        }
    } catch (_) { /* ignore */ }
    clearDashboardCellLoading(component);
}

function clearDashboardCellLoading(component) {
    try {
        component?.cell?.setLoadingState?.(false);
    } catch (_) { /* ignore */ }
}

function setAxisExtremesIfChanged(axis, min, max) {
    if (!axis || min == null || max == null) return;
    const curMin = axis.min;
    const curMax = axis.max;
    if (curMin === min && curMax === max) return;
    // Allow tiny float noise without retriggering
    if (Math.abs(curMin - min) < 1 && Math.abs(curMax - max) < 1) return;
    axis.setExtremes(min, max);
}

function clearChartHoverStates(chart) {
    if (!chart) return;
    (chart.series || []).forEach(s => {
        (s.points || []).forEach(p => {
            if (p.state === 'hover') p.setState();
        });
    });
    chart.xAxis?.[0]?.hideCrosshair?.();
}

function clearVergleichTvWeatherHover(tvComponent, weatherComponent) {
    [tvComponent?.chart, weatherComponent?.chart].forEach(chart => {
        if (!chart) return;
        (chart.series || []).forEach(s => {
            s.update({ point: { events: {} } }, false);
        });
        clearChartHoverStates(chart);
    });
}

/** Cross-highlight TV ↔ weather by shared datetime x (Vergleich mode). */
function bindVergleichTvWeatherHover(tvComponent, weatherComponent) {
    const tv = tvComponent?.chart;
    const weather = weatherComponent?.chart;
    if (!tv || !weather) return;

    let syncing = false;

    const highlightAt = (targetChart, x) => {
        let first = null;
        (targetChart.series || []).forEach(s => {
            if (!s.visible || s.options?.enableMouseTracking === false) return;
            (s.points || []).forEach(p => {
                if (p.x === x) {
                    p.setState('hover');
                    if (!first) first = p;
                } else if (p.state === 'hover') {
                    p.setState();
                }
            });
        });
        if (first && targetChart.xAxis?.[0]) {
            targetChart.xAxis[0].drawCrosshair(null, first);
        }
    };

    const attach = (sourceChart, targetChart) => {
        (sourceChart.series || []).forEach(s => {
            if (!s.visible || s.options?.enableMouseTracking === false) return;
            s.update({
                point: {
                    events: {
                        mouseOver: function () {
                            if (syncing) return;
                            syncing = true;
                            try {
                                highlightAt(targetChart, this.x);
                            } finally {
                                syncing = false;
                            }
                        },
                        mouseOut: function () {
                            if (syncing) return;
                            clearChartHoverStates(targetChart);
                        }
                    }
                }
            }, false);
        });
    };

    attach(tv, weather);
    attach(weather, tv);
    tv.redraw();
    weather.redraw();
}
