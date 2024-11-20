import {
    getFilteredCountingStations,
    filterCountingTrafficRows,
    aggregateDailyTraffic,
    aggregateYearlyTrafficData,
    aggregateHourlyTraffic,
    aggregateMonthlyTraffic,
    aggregateWeeklyTraffic,
    populateCountingStationDropdown
} from "./Functions.js";

import { stunde, monate } from "./Constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        timelineChart,
        filterSelection,
        filterSelection2,
        worldMap,
        dtvChart,
        hourlyTable,
        hourlyDTVGraph,
        hourlyDonutChart,
        monthlyTable,
        monthlyDTVChart,
        weeklyChart,
    ] = board.mountedComponents.map(c => c.component);


    const countingStationsData = await getFilteredCountingStations(board, type);
    const countingTrafficTable = await board.dataPool.getConnectorTable(`${type}-${countingStation}-hourly`);
    let hourlyTraffic = await board.dataPool.getConnectorTable(`Hourly Traffic`);
    let monthlyTraffic = await board.dataPool.getConnectorTable(`Monthly Traffic`);
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
    // Update the traffic graph in the time range selector
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    // Aggregate yearly traffic data for the selected counting station
    const aggregatedYearlyTrafficData = aggregateYearlyTrafficData(countingTrafficRows);
    // Update the DTV graph in the new chart
    dtvChart.chart.series[0].setData(aggregatedYearlyTrafficData);

    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;

    // Get the aggregated data and direction names
    const { aggregatedData: aggregatedHourlyTraffic, directionNames: directionNames } = aggregateHourlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

    // Map direction names to ri1, ri2, etc.
    const directionToRi = {};
    directionNames.forEach((direction, index) => {
        directionToRi[direction] = `ri${index + 1}`;
    });

    // Process DTV (Mo-So)
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

    // Aggregate monthly traffic data for the selected counting station
    const { aggregatedData: aggregatedMonthlyTraffic, directionNames: monthlyDirectionNames } = aggregateMonthlyTraffic(filteredCountingTrafficRows, isMoFrSelected, isSaSoSelected);

    // Map direction names to ri1, ri2, etc.
    const directionToRiMonthly = {};
    monthlyDirectionNames.forEach((direction, index) => {
        directionToRiMonthly[direction] = `ri${index + 1}`;
    });

    // Process DTV (Monthly)
    const dtv_monthly_totals = {};
    for (let i = 0; i < 12; i++) {
        dtv_monthly_totals[i] = {};
        monthlyDirectionNames.forEach(direction => {
            dtv_monthly_totals[i][directionToRiMonthly[direction]] = null;
        });
    }

    aggregatedMonthlyTraffic.forEach(item => {
        const month = item.month; // Month index (0-11)
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiMonthly[direction];

        if (ri !== undefined) {
            dtv_monthly_totals[month][ri] = total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build DTV columns for monthly data
    let dtv_ri_columns_monthly = {};
    monthlyDirectionNames.forEach(direction => {
        dtv_ri_columns_monthly[`dtv_${directionToRiMonthly[direction]}`] = [];
    });

    let dtv_total_monthly = [];
    let dtv_abweichung = [];

    let dtv_total_direction_totals_monthly = {};
    monthlyDirectionNames.forEach(direction => {
        dtv_total_direction_totals_monthly[directionToRiMonthly[direction]] = null;
    });

    let dtv_total_total_monthly = 0;
    let num_months_measured = 0;

    for (let i = 0; i < 12; i++) {
        let month_total = null;
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            const value = dtv_monthly_totals[i][ri];
            dtv_ri_columns_monthly[`dtv_${ri}`].push(value);
            if (value !== null) {
                dtv_total_direction_totals_monthly[ri] += value;
                month_total += value;
            }
        });
        if (month_total !== null) {
            dtv_total_monthly.push(month_total);
            dtv_total_total_monthly += month_total;
            num_months_measured++;
        }else{
            dtv_total_monthly.push(null);
        }
    }

    // Compute dtv_abweichung (Deviation from average)
    const average_dtv_total_monthly = dtv_total_total_monthly / num_months_measured;
    dtv_abweichung = dtv_total_monthly.map(value => {
        if (value === null) {
            return null;
        }
        return (value / average_dtv_total_monthly) * 100;
    });
    // Build columns for the Monthly Traffic Connector
    const columnsMonthly = {
        'monat': monate,
        ...dtv_ri_columns_monthly,
        'dtv_total': dtv_total_monthly,
        'dtv_abweichung': dtv_abweichung
    };
    monthlyTraffic.setColumns(columnsMonthly);

    // Aggregate weekly traffic data for the selected counting station
    if (type === 'MIV') {
        const aggregatedWeeklyTraffic = aggregateWeeklyTraffic(filteredCountingTrafficRows);
        console.log(aggregatedWeeklyTraffic);
        // Update the weekly traffic graph in the new chart
        weeklyChart.chart.series[0].setData(
            aggregatedWeeklyTraffic.map(item => item.total) // Extract just the total traffic values for PW
        );
    }
}
