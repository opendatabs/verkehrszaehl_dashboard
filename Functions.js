import {zweckColors} from "./Constants.js";

function getColorForZweck(zweck) {
    // Example to get the first category's color or a default color
    const defaultColor = "#FFFFFF"; // White for undefined categories
    const categories = zweck.split('+');
    for (const category of categories) {
        if (zweckColors[category]) {
            return zweckColors[category]; // Return the color of the first matched category
        }
    }
    return defaultColor; // Return default color if no match found
}

export function setupSynchronization(chart1, chart2) {
    const series1 = chart1.series;
    const series2 = chart2.series;
    console.log(series1, series2);

    // Set up event handlers on series of chart1
    series1.forEach(function (s1) {
        s1.update({
            events: {
                mouseOver: function () {
                    console.log(s1)
                    const s2 = series2.find(s => s.name === s1.name);
                    if (s2) {
                        s2.setState('hover');
                    }
                },
                mouseOut: function () {
                    const s2 = series2.find(s => s.name === s1.name);
                    if (s2) {
                        s2.setState('');
                    }
                }
            }
        }, false);
    });

    // Set up event handlers on series of chart2
    series2.forEach(function (s2) {
        s2.update({
            events: {
                mouseOver: function () {
                    const s1 = series1.find(s => s.name === s2.name);
                    if (s1) {
                        s1.setState('hover');
                    }
                },
                mouseOut: function () {
                    const s1 = series1.find(s => s.name === s2.name);
                    if (s1) {
                        s1.setState('');
                    }
                }
            }
        }, false);
    });
}


export function filterCountingTrafficRows(countingTrafficRows, timeRange) {
    const [start, end] = timeRange;
    return countingTrafficRows.filter(row => {
        const timestamp = new Date(row.DateTimeFrom).getTime(); // Using 'DateTimeFrom' column for filtering
        return timestamp >= start && timestamp <= end;
    });
}

export async function getFilteredCountingStations(board, type) {
    const countingStationsTable = await board.dataPool.getConnectorTable('Counting Stations');
    const countingStationRows = countingStationsTable.getRowObjects();
    // Filter rows for 'Dauerzaehlstelle'
    const filteredStations = countingStationRows.filter(row => row.ZWECK.includes(type)).map(row => {
        return {
            lat: parseFloat(row['Geo Point'].split(',')[0]),
            lon: parseFloat(row['Geo Point'].split(',')[1]),
            name: row.NAME,
            id: row.ID_ZST,
            zweck: row.ZWECK,
            color: getColorForZweck(row.ZWECK), // Assign a color based on ZWECK
        };
    });

    return filteredStations;
}


export function aggregateDailyTraffic(stationRows) {
    // Aggregate traffic data per day
    const dailyTraffic = {};
    stationRows.forEach(row => {
        // Convert the timestamp to a Date object
        const timestampInMillis = parseInt(row.DateTimeFrom, 10); // Convert to an integer
        const dateObject = new Date(timestampInMillis);

        // Extract the date string in the format YYYY-MM-DD
        const date = dateObject.toISOString().split('T')[0];

        const totalTraffic = parseInt(row.Total, 10);

        if (!dailyTraffic[date]) {
            dailyTraffic[date] = totalTraffic;
        } else {
            dailyTraffic[date] += totalTraffic;
        }
    });

    // Convert the object into an array suitable for Highcharts
    return Object.entries(dailyTraffic).map(([date, total]) => {
        return [Date.parse(date), total];
    });
}


export function aggregateYearlyTrafficData(stationRows) {
    // Structure to hold yearly traffic data
    const yearlyTraffic = {};

    // Aggregate data by year
    stationRows.forEach(row => {
        // Parse the timestamp and extract the year
        const timestampInMillis = parseInt(row.DateTimeFrom, 10);
        const dateObject = new Date(timestampInMillis);
        const year = dateObject.getFullYear();

        // Initialize year entry if not present
        if (!yearlyTraffic[year]) {
            yearlyTraffic[year] = { total: 0, days: new Set() };
        }

        // Add to the total traffic and count unique days
        yearlyTraffic[year].total += parseInt(row.Total, 10);
        yearlyTraffic[year].days.add(dateObject.toISOString().split('T')[0]);
    });

    // Calculate average traffic per day per year
    return Object.entries(yearlyTraffic).map(([year, data]) => {
        const dailyAverage = data.total / data.days.size;
        return [Date.UTC(year, 0, 1), dailyAverage];
    });
}

export const createSeries = (directionNames) => {
    const series = [{
        name: 'Gesamtquerschnitt',
        data: [] // Placeholder data, to be updated dynamically
    }];

    directionNames.forEach(direction => {
        series.push({
            name: direction,
            data: [] // Placeholder data, to be updated dynamically
        });
    });

    return series;
};

export const updateSeriesData = (chart, seriesIndex, data) => {
    if (chart && chart.series && chart.series[seriesIndex]) {
        chart.series[seriesIndex].setData(data);
    } else {
        console.error(`Series at index ${seriesIndex} does not exist in the chart`);
    }
};

export function aggregateHourlyTraffic(stationRows, MoFr = true, SaSo = true) {
    const hourlyTrafficMoFr = {};
    const directionNames = new Set(); // To track unique direction names

    // Aggregate data by hour and lane for Monday to Friday
    stationRows.forEach(row => {
        const hour = parseInt(row.HourFrom, 10);
        const totalTraffic = parseInt(row.Total, 10);
        const weekday = row.Weekday;
        const directionName = row.DirectionName;

        if (MoFr && weekday >= 0 && weekday <= 4) {
            if (!hourlyTrafficMoFr[hour]) {
                hourlyTrafficMoFr[hour] = {};
            }
            if (!hourlyTrafficMoFr[hour][directionName]) {
                hourlyTrafficMoFr[hour][directionName] = 0;
            }
            hourlyTrafficMoFr[hour][directionName] += totalTraffic;
            directionNames.add(directionName); // Add to the direction set
        }
        if (SaSo && weekday >= 5 && weekday <= 6) {
            if (!hourlyTrafficMoFr[hour]) {
                hourlyTrafficMoFr[hour] = {};
            }
            if (!hourlyTrafficMoFr[hour][directionName]) {
                hourlyTrafficMoFr[hour][directionName] = 0;
            }
            hourlyTrafficMoFr[hour][directionName] += totalTraffic;
            directionNames.add(directionName); // Add to the direction set
        }
    });

    // Convert to desired format
    const aggregatedData = Object.entries(hourlyTrafficMoFr).map(([hour, directions]) => {
        return Object.entries(directions).map(([direction, total]) => {
            return {
                hour: Date.UTC(1970, 0, 1, hour),
                directionName: direction,
                total: total
            };
        });
    }).flat();

    return { aggregatedData, directionNames: Array.from(directionNames) };
}


function calculateHourlyShare(totalHourlyTraffic, totalDailyTraffic) {
    return totalHourlyTraffic / totalDailyTraffic * 100;
}


export function updateHourlyDataGrid(hourlyTable, aggregatedHourlyTrafficMoFr, aggregatedHourlyTrafficMoSo) {
    // Initialize an empty object with arrays for each column
    const tableData = {
        time: [],
        dtv_richtung1: [],
        dtv_richtung2: [],
        dtv_total: [],
        dwv_richtung1: [],
        dwv_richtung2: [],
        dwv_total: []
    };

    // Iterate over each hour to populate the arrays
    for (let hour = 0; hour < 24; hour++) {
        // Format the hour and initialize totals for the current hour
        const formattedHour = Highcharts.dateFormat('%H:%M', Date.UTC(1970, 0, 1, hour));
        let dtv_richtung1 = 0, dtv_richtung2 = 0, dtv_total = 0;
        let dwv_richtung1 = 0, dwv_richtung2 = 0, dwv_total = 0;

        // Find Mo-Fr (DWV) data for the current hour
        const itemMoFr = aggregatedHourlyTrafficMoFr.find(item => new Date(item.hour).getUTCHours() === hour);
        // Find Mo-So (DTV) data for the current hour
        const itemMoSo = aggregatedHourlyTrafficMoSo.find(item => new Date(item.hour).getUTCHours() === hour);

        // Assign Mo-So (DTV) values based on direction prefix
        if (itemMoSo) {
            if (itemMoSo.directionName.startsWith('1')) {
                dtv_richtung1 = itemMoSo.total;
            } else if (itemMoSo.directionName.startsWith('2')) {
                dtv_richtung2 = itemMoSo.total;
            }
            dtv_total = dtv_richtung1 + dtv_richtung2;
        }

        // Assign Mo-Fr (DWV) values based on direction prefix
        if (itemMoFr) {
            if (itemMoFr.directionName.startsWith('1')) {
                dwv_richtung1 = itemMoFr.total;
            } else if (itemMoFr.directionName.startsWith('2')) {
                dwv_richtung2 = itemMoFr.total;
            }
            dwv_total = dwv_richtung1 + dwv_richtung2;
        }

        // Populate the arrays in the tableData dictionary for each hour
        tableData.time.push(formattedHour);
        tableData.dtv_richtung1.push(dtv_richtung1);
        tableData.dtv_richtung2.push(dtv_richtung2);
        tableData.dtv_total.push(dtv_total);
        tableData.dwv_richtung1.push(dwv_richtung1);
        tableData.dwv_richtung2.push(dwv_richtung2);
        tableData.dwv_total.push(dwv_total);
    }
    console.log(hourlyTable);
    console.log(tableData); // For debugging to ensure correct structure

    // Update the DataGrid with the processed table data
    hourlyTable.dataGrid.update(tableData);
}



export function aggregateMonthlyTrafficMoFr(stationRows) {
    // Structure to hold monthly traffic data for Monday to Friday
    const monthlyTrafficMoFr = Array.from({ length: 12 }, () => 0);

    // Aggregate data by month for Monday to Friday
    stationRows.forEach(row => {
        const timestampInMillis = parseInt(row.DateTimeFrom, 10);
        const dateObject = new Date(timestampInMillis);
        const month = dateObject.getMonth();
        const totalTraffic = parseInt(row.Total, 10);
        const weekday = row.Weekday;

        if (weekday >= 1 && weekday <= 5) {
            monthlyTrafficMoFr[month] += totalTraffic;
        }
    });

    // Convert monthly traffic data to the desired format
    return monthlyTrafficMoFr.map((total, month) => {
        return [Date.UTC(1970, month, 1), total];
    });
}

export function aggregateMonthlyTrafficMoSo(stationRows) {
    // Structure to hold monthly traffic data for Monday to Sunday
    const monthlyTrafficMoSo = Array.from({ length: 12 }, () => 0);

    // Aggregate data by month for Monday to Sunday
    stationRows.forEach(row => {
        const timestampInMillis = parseInt(row.DateTimeFrom, 10);
        const dateObject = new Date(timestampInMillis);
        const month = dateObject.getMonth();
        const totalTraffic = parseInt(row.Total, 10);

        monthlyTrafficMoSo[month] += totalTraffic;
    });

    // Convert monthly traffic data to the desired format
    return monthlyTrafficMoSo.map((total, month) => {
        return [Date.UTC(1970, month, 1), total];
    });
}

export function aggregateWeeklyTrafficPW(stationRows) {
    // Structure to hold traffic data for each weekday (0: Monday, 6: Sunday)
    const weeklyTrafficPW = Array.from({ length: 7 }, () => 0);

    // Aggregate data by weekday (0 = Monday, ..., 6 = Sunday)
    stationRows.forEach(row => {
        const weekday = parseInt(row.Weekday, 10); // Weekday is zero-based
        const trafficPW = parseInt(row.PW, 10); // Personenwagen (PW) field

        // Add the traffic data to the respective weekday
        if (weekday >= 0 && weekday < 7) {
            weeklyTrafficPW[weekday] += trafficPW;
        }
    });

    // Map weekday numbers (0-6) to the respective days in German (Mo, Di, etc.)
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Convert weekly traffic data to the desired format for Highcharts
    return weeklyTrafficPW.map((total, index) => {
        return {
            day: weekdays[index],
            total: total
        };
    });
}

export function aggregateWeeklyTrafficLW(stationRows) {
    // Structure to hold traffic data for each weekday (0: Monday, 6: Sunday)
    const weeklyTrafficLW = Array.from({ length: 7 }, () => 0);

    // Aggregate data by weekday (0 = Monday, ..., 6 = Sunday)
    stationRows.forEach(row => {
        const weekday = parseInt(row.Weekday, 10); // Weekday is zero-based
        const trafficLW = parseInt(row.LW, 10); // Lastwagen (LW) field

        // Add the traffic data to the respective weekday
        if (weekday >= 0 && weekday < 7) {
            weeklyTrafficLW[weekday] += trafficLW;
        }
    });

    // Map weekday numbers (0-6) to the respective days in German (Mo, Di, etc.)
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Convert weekly traffic data to the desired format for Highcharts
    return weeklyTrafficLW.map((total, index) => {
        return {
            day: weekdays[index],
            total: total
        };
    });
}
