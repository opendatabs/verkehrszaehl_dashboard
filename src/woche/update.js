import {
    getFilteredCountingStations,
    filterDailyDataRows,
    extractDailyTraffic,
    aggregateWeeklyTraffic,
    populateCountingStationDropdown,
    updateDatePickers,
    updateUrlParams,
    processWeeklyBoxPlotData,
    readCSV
} from "../functions.js";

import { wochentage } from "../constants.js";

export async function updateBoard(board, countingStation, newData, type, timeRange) {
    const [
        filterSelection,
        timelineChart,
        filterSelection2,
        weeklyTable,
        weeklyDTVChart,
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
        weekday: weekday_param
    });
    updateDatePickers(timeRange[0], timeRange[1]);

    const countingStationsData = await getFilteredCountingStations(board, type);
    populateCountingStationDropdown(countingStationsData, countingStation);

    const dailyDataRows = await readCSV(`./data/${type}/${countingStation}_daily.csv`);
    let weeklyTraffic = await board.dataPool.getConnectorTable(`Weekly Traffic`);

    // Filter counting traffic rows by the given time range
    let filteredDailyDataRows = filterDailyDataRows(dailyDataRows, timeRange);

    // Aggregate daily traffic data for the selected counting station
    const aggregatedTrafficData = extractDailyTraffic(dailyDataRows);
    timelineChart.chart.series[0].setData(aggregatedTrafficData);

    // Aggregate weekly traffic data for the selected counting station
    const {
        aggregatedData: dailyAvgPerWeekday,
        directionNames: weeklyDirectionNames,
        dailyTotalsPerWeekdayTotal,
        dailyTotalsPerWeekdayPerDirection
    } = aggregateWeeklyTraffic(filteredDailyDataRows, isMoFrSelected, isSaSoSelected);

    // Map direction names to ri1, ri2, etc.
    const directionToRiWeekly = {};
    weeklyDirectionNames.forEach((direction, index) => {
        directionToRiWeekly[direction] = `ri${index + 1}`;
    });

    // Process DTV (Weekly)
    const dtv_weekly_totals = {};
    for (let i = 0; i < 7; i++) {
        dtv_weekly_totals[i] = {};
        weeklyDirectionNames.forEach(direction => {
            dtv_weekly_totals[i][directionToRiWeekly[direction]] = null;
        });
    }

    dailyAvgPerWeekday.forEach(item => {
        const weekday = item.weekday; // Weekday index (0-6)
        const direction = item.directionName;
        const total = item.total;
        const numberOfDays = item.numberOfDays;

        const ri = directionToRiWeekly[direction];

        if (ri !== undefined) {
            dtv_weekly_totals[weekday][ri] = total / numberOfDays;
        } else {
            console.error(`Unknown direction ${direction}`);
        }
    });

    // Build DTV columns for weekly data
    let dtv_ri_columns_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        dtv_ri_columns_weekly[`dtv_${directionToRiWeekly[direction]}`] = [];
    });

    let dtv_total_weekly = [];
    let dtv_abweichung = [];

    let dtv_total_direction_totals_weekly = {};
    weeklyDirectionNames.forEach(direction => {
        dtv_total_direction_totals_weekly[directionToRiWeekly[direction]] = 0;
    });

    let dtv_total_total_weekly = 0;
    let num_weekdays_measured = 0;

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
        if (value === null) {
            return null;
        }
        return (value / average_dtv_total_weekly) * 100;
    });

    // Build columns for the Weekly Traffic Connector
    const columnsWeekly = {
        'wochentag': wochentage,
        ...dtv_ri_columns_weekly,
        'dtv_total': dtv_total_weekly,
        'dtv_abweichung': dtv_abweichung
    };
    weeklyTraffic.setColumns(columnsWeekly);

    // Update the boxplot
    const boxPlotData = processWeeklyBoxPlotData(dailyTotalsPerWeekdayPerDirection, dailyTotalsPerWeekdayTotal);
    boxPlot.chart.series.forEach((series, index) => {
        series.setData(boxPlotData[index].data);
    });
}
