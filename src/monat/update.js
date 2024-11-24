import {
    getFilteredCountingStations,
    filterDailyDataRows,
    returnMonthlyDataRows,
    aggregateMonthlyTraffic,
    populateCountingStationDropdown
} from "../functions.js";

import { stunde, monate } from "../constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        filterSelection,
        timelineChart,
        filterSelection2,
        monthlyTable,
        monthlyDTVChart,
    ] = board.mountedComponents.map(c => c.component);

    const countingStationsData = await getFilteredCountingStations(board, type);
    const dailyData = await board.dataPool.getConnectorTable(`Daily Data`);
    let dailyDataRows = dailyData.getRowObjects();
    const monthlyData = await board.dataPool.getConnectorTable(`Monthly Data`);
    let monthlyDataRows = monthlyData.getRowObjects();
    let monthlyTraffic = await board.dataPool.getConnectorTable(`Monthly Traffic`);

    populateCountingStationDropdown(countingStationsData, countingStation)

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = returnMonthlyDataRows(monthlyDataRows);
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterDailyDataRows(dailyDataRows, timeRange);


    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;

    // Aggregate monthly traffic data for the selected counting station
    const { aggregatedData: aggregatedMonthlyTraffic, directionNames: monthlyDirectionNames } = aggregateMonthlyTraffic(filteredDailyDataRows, isMoFrSelected, isSaSoSelected);

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
}
