import {
    getFilteredZaehlstellen,
    loadStations,
    updateState,
    updateCredits,
    readCSV,
    filterToSelectedTimeRange,
    extractDailyTraffic,
    extractDailyApproval,
    aggregateWeeklyTraffic,
    processWeeklyBoxPlotData,
    updateExporting
} from "../../src/functions.js";
import { wochentage } from "../../src/constants.js";

export async function updateBoard(board, type, strtyp, zst, fzgtyp, speed, timeRange, newType, newZst= false) {
    const [
        , // filter-selection
        , // filter-section-fzgtyp
        , // filter-section-speed
        , // filter-selection-2 (dayrange buttons)
        timelineChart,
        , // warning-box-section
        weeklyTable,
        weeklyDTVChart,
        , // filter-section-3
        boxPlot,
        scatterChart,
        boxPlotGesamt,
        scatterPlotGesamt,
    ] = board.mountedComponents.map(c => c.component);

    const zaehlstellen = await getFilteredZaehlstellen(board, type, fzgtyp);
    const lastZst = zst;
    
    // Ensure we have a valid zst before loading station data
    if ((!zst || zst === 'default_station') && zaehlstellen && zaehlstellen.length > 0) {
        zst = zaehlstellen[0].id;
    }
    
    const stationRow = (await loadStations(type)).find(r => String(r.Zst_id) === String(zst));
    const next = await updateState(board, type, strtyp, zst, fzgtyp, speed, timeRange, zaehlstellen, stationRow);
    zst = next.zst;
    fzgtyp = next.fzgtyp;
    speed = next.speed;
    newZst = newZst || lastZst !== zst;

    // Determine if we're using speed classes or fzgtyp
    const hasSpeedSelection = speed && speed.some(v => v && v !== 'Total');
    const dataType = hasSpeedSelection ? 'MIV_Speed' : type;
    const filterKeys = hasSpeedSelection ? speed : fzgtyp;

    if (newType) {
        // Update the credits text of weeklyTable, weeklyDTVChart and boxPlot
        updateCredits(weeklyTable.grid.credits, type);
        updateCredits(weeklyDTVChart.chart.credits, type);
        updateCredits(boxPlot.chart.credits, type);
        updateCredits(scatterChart.chart.credits, type);
        updateCredits(boxPlotGesamt.chart.credits, type);
        updateCredits(scatterPlotGesamt.chart.credits, type);
    }

    const dailyDataRows = await readCSV(`../data/${dataType}/${zst}_daily.csv`);
    let weeklyTraffic = await board.dataPool.connectors['Weekly Traffic'].getTable()

    // Check for unapproved days in the current time range
    const dailyApproval = extractDailyApproval(dailyDataRows);
    const approvalMap = new Map(dailyApproval.map(([ts, fullyApproved]) => [ts, fullyApproved]));
    const hasUnapprovedDays = dailyApproval.some(([ts, fullyApproved]) => 
        ts >= timeRange[0] && ts <= timeRange[1] && fullyApproved === false
    );
    
    // Show/hide warning box and update link
    const warningBoxContainer = document.getElementById('warning-box-container');
    if (warningBoxContainer) {
        warningBoxContainer.style.display = hasUnapprovedDays ? 'flex' : 'none';
        if (hasUnapprovedDays) {
            // Update the link to preserve current URL parameters
            const queryString = window.location.search;
            const startViewLink = `../start/${queryString}`;
            const link = warningBoxContainer.querySelector('a');
            if (link) {
                link.href = startViewLink;
            }
            
            // Set up close button handler
            const closeButton = document.getElementById('warning-box-close');
            if (closeButton) {
                closeButton.onclick = () => {
                    warningBoxContainer.style.display = 'none';
                };
            }
        }
    }

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterToSelectedTimeRange(dailyDataRows, timeRange);

    if (newZst) {
        const {dailyTraffic} = extractDailyTraffic(dailyDataRows, filterKeys);
        timelineChart.chart.series[0].setData(dailyTraffic);
    }

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    // Aggregate weekly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerWeekday,
        directionNames: weeklyDirectionNames,
        dailyTotalsPerWeekdayTotal,
        dailyTotalsPerWeekdayPerDirection,
        dailyScatterPerWeekdayPerDirection,
        dailyScatterPerWeekdayTotal
    } = aggregateWeeklyTraffic(filteredDailyDataRows, filterKeys, isMoFrSelected, isSaSoSelected);


    const isSingleDirection = weeklyDirectionNames.length < 2;
    const totalLabel = isSingleDirection ? weeklyDirectionNames[0] : 'Gesamtquerschnitt';

    // Toggle Anzeige: Richtungen / Gesamtquerschnitt
    const scopeGroup       = document.getElementById('chart-scope-group');
    const scopeDirections  = document.getElementById('chart-scope-directions');
    const scopeGesamt      = document.getElementById('chart-scope-gesamt');

    if (scopeGroup && scopeDirections && scopeGesamt) {
        if (isSingleDirection) {
            // No point in showing Richtungen vs Gesamtquerschnitt -> hide group, force Gesamt
            scopeGroup.style.display = 'none';
            scopeGesamt.checked = true;
        } else {
            scopeGroup.style.display = '';
            // If neither is selected for some reason, default to Richtungen
            if (!scopeDirections.checked && !scopeGesamt.checked) {
                scopeDirections.checked = true;
            }
        }
        // Update chart visibility based on current toggle state
        if (window.applyChartTypeAndScopeVisibility) {
            window.applyChartTypeAndScopeVisibility();
        }
    }

    // Map direction names to ri1, ri2, etc.
    const directionToRiWeekly = {};
    weeklyDirectionNames.forEach((direction, index) => {
        directionToRiWeekly[direction] = `ri${index + 1}`;
    });

    // Reset the columns of weeklyTraffic Connector
    weeklyTraffic.setColumns({});

    // Initialize dtv_weekly_totals
    const dtv_weekly_totals = {};
    for (let i = 0; i < 7; i++) {
        dtv_weekly_totals[i] = {};
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            dtv_weekly_totals[i][ri] = null;
        });
    }

    // Build DTV columns for weekly data
    let dtv_ri_columns_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        const ri = directionToRiWeekly[direction];
        dtv_ri_columns_weekly[`dtv_${ri}`] = [];
    });

    let dtv_total_weekly = [];
    let dtv_abweichung;

    let dtv_total_direction_totals_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        const ri = directionToRiWeekly[direction];
        dtv_total_direction_totals_weekly[ri] = null;
    });

    let dtv_total_total_weekly = 0;
    let num_weekdays_measured = 0;

    // Populate dtv_weekly_totals
    dailyAvgPerWeekday.forEach(item => {
        const weekday = item.weekday;
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiWeekly[direction];

        if (ri) {
            dtv_weekly_totals[weekday][ri] += total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build dtv_ri_columns_weekly and dtv_total_weekly
    for (let i = 0; i < 7; i++) {
        let weekday_total = 0;
        let anyData = false;
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const value = dtv_weekly_totals[i][ri];
            dtv_ri_columns_weekly[`dtv_${ri}`].push(value);
            if (value !== null && value !== undefined) {
                dtv_total_direction_totals_weekly[ri] += value;
                weekday_total += value;
                anyData = true;
            }
        });
        if (anyData) {
            dtv_total_weekly.push(weekday_total);
            dtv_total_total_weekly += weekday_total;
            num_weekdays_measured++;
        } else {
            dtv_total_weekly.push(null);
        }
    }

    // Compute dtv_abweichung (Deviation from average)
    const average_dtv_total_weekly = dtv_total_total_weekly / num_weekdays_measured;
    dtv_abweichung = dtv_total_weekly.map(value => {
        if (value) {
            return (value / average_dtv_total_weekly) * 100;
        }
        return null;
    });

    // Build columns for the Weekly Traffic Connector
    const columnsWeekly = {
        'wochentag': wochentage
    };

    if (!isSingleDirection) {
        Object.assign(columnsWeekly, dtv_ri_columns_weekly);
    }

    Object.assign(columnsWeekly, {
        'dtv_total': dtv_total_weekly,
        'average_dtv_total': Array(7).fill(average_dtv_total_weekly),
        'dtv_abweichung': dtv_abweichung
    });

    weeklyTraffic.setColumns(columnsWeekly);

    // Build the DataGrid columns dynamically
    let dataGridColumnsWeekly = [
        {
            id: 'wochentag',
            header: {
                format: 'Wochentag'
            }
        }
    ];

    if (!isSingleDirection) {
        // Add columns for each direction
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            dataGridColumnsWeekly.push({
                id: `dtv_${ri}`,
                header: {
                    format: direction  // Use actual direction name
                },
                cells: {
                    formatter: function () {
                        return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : '';
                    }
                }
            });
        });
    }

    // Add total and deviation columns
    dataGridColumnsWeekly.push(
        {
            id: 'dtv_total',
            header: {
                format: totalLabel
            },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 0)}` : '';
                }
            }
        },
        {
            id: 'dtv_abweichung',
            header: {
                format: 'Abw. vom Durchschnitt'
            },
            cells: {
                formatter: function () {
                    return this.value ? `${Highcharts.numberFormat(this.value, 1)}%` : '';
                }
            }
        }
    );

    // Update the DataGrid columns
    if (isSingleDirection) {
        weeklyTable.grid.update({
            header: [
                {
                    columnId: "wochentag",
                },
                {
                    format: "Durchschnittlicher Tagesverkehr",
                    columns: [
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsWeekly
        });
    } else {
        weeklyTable.grid.update({
            header: [
                {
                    columnId: "wochentag",
                },
                {
                    format: "Durchschnittlicher Tagesverkehr",
                    columns: [
                        "dtv_ri1",
                        "dtv_ri2",
                        "dtv_total",
                        "dtv_abweichung"
                    ]
                }
            ],
            columns: dataGridColumnsWeekly
        });
    }

    // Update the weekly table data
    if (isSingleDirection) {
        weeklyDTVChart.chart.series[0].update({
            name: 'Richtung 1',
            visible: false,
            showInLegend: false
        });
        weeklyDTVChart.chart.series[1].update({
            name: 'Richtung 2',
            visible: false,
            showInLegend: false
        });
    } else {
        weeklyDTVChart.chart.series[0].update({
            name: weeklyDirectionNames[0],
            visible: true,
            showInLegend: true
        });
        weeklyDTVChart.chart.series[1].update({
            name: weeklyDirectionNames[1],
            visible: true,
            showInLegend: true
        });
    }

    weeklyDTVChart.chart.series[2].update({
        name: totalLabel,
    });

    // Process box plot data
    const boxPlotDataWeekly = processWeeklyBoxPlotData(
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal,
        weeklyDirectionNames,
        directionToRiWeekly,
        isSingleDirection
    );

    const directionSeriesWeekly = boxPlotDataWeekly.filter(s => s.id !== 'series-gesamt');
    const totalSeriesWeekly     = boxPlotDataWeekly.find(s => s.id === 'series-gesamt');

    // Clear both charts
    while (boxPlot.chart.series.length > 0) {
        boxPlot.chart.series[0].remove(false);
    }
    while (boxPlotGesamt.chart.series.length > 0) {
        boxPlotGesamt.chart.series[0].remove(false);
    }

    // Richtungen chart
    if (!isSingleDirection) {
        directionSeriesWeekly.forEach(series => {
            boxPlot.chart.addSeries(series, false);
        });
    }

    // Gesamtchart
    if (totalSeriesWeekly) {
        totalSeriesWeekly.name = totalLabel;
        boxPlotGesamt.chart.addSeries(totalSeriesWeekly, false);
    }

    boxPlot.chart.redraw();
    boxPlotGesamt.chart.redraw();

    // --- Update weekly scatter chart ---
    // Remove existing series from scatter chart
    while (scatterChart.chart.series.length > 0) {
        scatterChart.chart.series[0].remove(false);
    }

    if (!isSingleDirection) {
        // Two directions: use horizontal offset so they appear side by side per weekday
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const dirScatter = dailyScatterPerWeekdayPerDirection[direction] || {};
            const approvedPoints = [];
            const unapprovedPoints = [];

            const offset = ri === 'ri1' ? -0.15 : 0.15;
            const baseColor = ri === 'ri1' ? '#007a2f' : '#008ac3';

            for (let weekday = 0; weekday < 7; weekday++) {
                const arr = dirScatter[weekday] || [];
                arr.forEach(p => {
                    const isApproved = approvalMap.get(p.date) !== false;
                    const point = {
                        x: weekday + offset, // shifted position
                        y: p.value,
                        date: p.date
                    };
                    if (isApproved) {
                        approvedPoints.push(point);
                    } else {
                        unapprovedPoints.push(point);
                    }
                });
            }

            // Add approved series
            if (approvedPoints.length > 0) {
                scatterChart.chart.addSeries({
                    type: 'scatter',
                    name: `${direction} (validiert)`,
                    data: approvedPoints,
                    color: baseColor
                }, false);
            }

            // Add unapproved series
            if (unapprovedPoints.length > 0) {
                scatterChart.chart.addSeries({
                    type: 'scatter',
                    name: `${direction} (nicht validiert)`,
                    data: unapprovedPoints,
                    color: baseColor,
                    marker: {
                        lineColor: '#FFBB1A',
                        lineWidth: 2
                    }
                }, false);
            }
        });
    } else {
        // Only one direction: center points on the weekday and use grey color
        const direction = weeklyDirectionNames[0];
        const dirScatter = dailyScatterPerWeekdayPerDirection[direction] || {};
        const approvedPoints = [];
        const unapprovedPoints = [];

        for (let weekday = 0; weekday < 7; weekday++) {
            const arr = dirScatter[weekday] || [];
            arr.forEach(p => {
                const isApproved = approvalMap.get(p.date) !== false;
                const point = {
                    x: weekday,
                    y: p.value,
                    date: p.date
                };
                if (isApproved) {
                    approvedPoints.push(point);
                } else {
                    unapprovedPoints.push(point);
                }
            });
        }

        // Add approved series
        if (approvedPoints.length > 0) {
            scatterChart.chart.addSeries({
                type: 'scatter',
                name: `${direction} (validiert)`,
                data: approvedPoints,
                color: '#6f6f6f' // grey for single direction
            }, false);
        }

        // Add unapproved series
        if (unapprovedPoints.length > 0) {
            scatterChart.chart.addSeries({
                type: 'scatter',
                name: `${direction} (nicht validiert)`,
                data: unapprovedPoints,
                color: '#6f6f6f',
                marker: {
                    lineColor: '#FFBB1A',
                    lineWidth: 2
                }
            }, false);
        }
    }

    scatterChart.chart.redraw();

    // --- Gesamtquerschnitt scatter chart ---
    while (scatterPlotGesamt.chart.series.length > 0) {
        scatterPlotGesamt.chart.series[0].remove(false);
    }

    const gesamtApprovedPoints = [];
    const gesamtUnapprovedPoints = [];
    if (dailyScatterPerWeekdayTotal) {
        for (let weekday = 0; weekday < 7; weekday++) {
            const arr = dailyScatterPerWeekdayTotal[weekday] || [];
            arr.forEach(p => {
                const isApproved = approvalMap.get(p.date) !== false;
                const point = {
                    x: weekday,
                    y: p.value,
                    date: p.date
                };
                if (isApproved) {
                    gesamtApprovedPoints.push(point);
                } else {
                    gesamtUnapprovedPoints.push(point);
                }
            });
        }
    }

    // Add approved series
    if (gesamtApprovedPoints.length > 0) {
        scatterPlotGesamt.chart.addSeries({
            type: 'scatter',
            name: `${totalLabel} (validiert)`,
            data: gesamtApprovedPoints,
            color: '#6f6f6f'
        }, false);
    }

    // Add unapproved series
    if (gesamtUnapprovedPoints.length > 0) {
        scatterPlotGesamt.chart.addSeries({
            type: 'scatter',
            name: `${totalLabel} (nicht validiert)`,
            data: gesamtUnapprovedPoints,
            color: '#6f6f6f',
            marker: {
                lineColor: '#FFBB1A',
                lineWidth: 2
            }
        }, false);
    }

    scatterPlotGesamt.chart.redraw();

    // Update exporting options
    await updateExporting(board, weeklyDTVChart.chart.exporting, 'weekly-chart', type, zst, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlot.chart.exporting, 'weekly-box-plot', type, zst, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterChart.chart.exporting, 'weekly-scatter-plot', type, zst, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, boxPlotGesamt.chart.exporting, 'weekly-box-plot-gesamt', type, zst, fzgtyp, timeRange, true, false, speed);
    await updateExporting(board, scatterPlotGesamt.chart.exporting, 'weekly-scatter-plot-gesamt', type, zst, fzgtyp, timeRange, true, false, speed);
}
