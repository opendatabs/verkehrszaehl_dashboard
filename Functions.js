function getColorForStrTyp(strtypAbbrev) {
    const strtypColors = {
        "HLS": "#ffeb00",
        "HVS": "#ff0000",
        "HSS": "#4ce600",
        "SOS": "#0070ff",
        "Andere": "#71a903"
    };
    return strtypColors[strtypAbbrev] || "#FFFFFF"; // Default to white if not found
}

export function extractAbbreviation(strtypValue) {
    const match = strtypValue.match(/\((.*?)\)/);
    if (match) {
        return match[1]; // Returns the abbreviation inside parentheses
    } else {
        return strtypValue.trim(); // Return the trimmed string if no abbreviation
    }
}

export async function getFilteredCountingStations(board, type) {
    let countingStationsTable = await board.dataPool.getConnectorTable(`${type}-Standorte`);
    const countingStationRows = countingStationsTable.getRowObjects();

    return countingStationRows
        .filter(row => row.TrafficType === type)
        .map(row => {
            const strtypAbbrev = extractAbbreviation(row.strtyp);

            // Base data point
            const dataPoint = {
                lat: parseFloat(row['geo_point_2d'].split(',')[0]),
                lon: parseFloat(row['geo_point_2d'].split(',')[1]),
                name: String(row.name),
                id: row.Zst_id,
                type: row.TrafficType,
                strtyp: row.strtyp,
                color: getColorForStrTyp(strtypAbbrev),
                total: row.Total
            };
            return dataPoint;
        });
}


export function populateCountingStationDropdown(countingStationsData, selectedStationId) {
    const dropdown = document.getElementById('counting-station-dropdown');
    dropdown.innerHTML = ''; // Clear existing options

    // First, add all options to the dropdown
    countingStationsData.forEach(station => {
        const option = document.createElement('option');
        option.value = station.id;
        option.text = `${station.id} ${station.name}`;
        dropdown.add(option);
    });

    // Then, set the selected option
    let optionFound = false;
    for (let i = 0; i < dropdown.options.length; i++) {
        if (String(dropdown.options[i].value) === String(selectedStationId)) {
            dropdown.selectedIndex = i;
            optionFound = true;
            break;
        }
    }

    // If no matching option is found, you can set a default or handle the case
    if (!optionFound) {
        console.warn(`Selected station ID ${selectedStationId} not found in dropdown options.`);
    }
}


export function filterCountingTrafficRows(countingTrafficRows, timeRange) {
    const [start, end] = timeRange;
    return countingTrafficRows.filter(row => {
        const timestamp = new Date(row.DateTimeFrom).getTime(); // Using 'DateTimeFrom' column for filtering
        return timestamp >= start && timestamp <= end;
    });
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
    const hourlyTraffic = {};
    const directionNames = new Set(); // To track unique direction names

    stationRows.forEach(row => {
        const hour = parseInt(row.HourFrom, 10);
        const totalTraffic = parseInt(row.Total, 10);
        const weekday = row.Weekday;
        const directionName = row.DirectionName;
        const date = new Date(row.Timestamp || row.Date).toISOString().split('T')[0]; // Get date in 'YYYY-MM-DD' format

        // Filter by selected weekdays
        if (
            (MoFr && weekday >= 0 && weekday <= 4) ||
            (SaSo && weekday >= 5 && weekday <= 6)
        ) {
            const key = `${hour}#${directionName}`;
            if (!hourlyTraffic[key]) {
                hourlyTraffic[key] = {
                    total: 0,
                    dates: new Set()
                };
            }
            hourlyTraffic[key].total += totalTraffic;
            hourlyTraffic[key].dates.add(date); // Keep track of dates with data
            directionNames.add(directionName);
        }
    });

    // Compute average traffic per hour per direction
    const aggregatedData = Object.entries(hourlyTraffic).map(([key, data]) => {
        const [hourStr, directionName] = key.split('#');
        const hour = parseInt(hourStr, 10);
        const numberOfDays = data.dates.size;

        return {
            hour: Date.UTC(1970, 0, 1, hour),
            directionName,
            total: data.total,
            numberOfDays
        };
    });

    return { aggregatedData, directionNames: Array.from(directionNames) };
}


function calculateHourlyShare(totalHourlyTraffic, totalDailyTraffic) {
    return totalHourlyTraffic / totalDailyTraffic * 100;
}


export function aggregateMonthlyTraffic(stationRows, MoFr = true, SaSo = true) {
    const monthlyTraffic = {};
    const directionNames = new Set();

    stationRows.forEach(row => {
        const timestampInMillis = parseInt(row.DateTimeFrom, 10);
        const dateObject = new Date(timestampInMillis);
        const month = dateObject.getMonth(); // 0-11
        const totalTraffic = parseInt(row.Total, 10);
        const weekday = dateObject.getDay(); // 0 = Sunday, 6 = Saturday
        const directionName = row.DirectionName;

        // Filter by selected weekdays
        if (
            (MoFr && weekday >= 1 && weekday <= 5) || // Monday to Friday
            (SaSo && (weekday === 0 || weekday === 6)) // Saturday and Sunday
        ) {
            const key = `${month}#${directionName}`;
            if (!monthlyTraffic[key]) {
                monthlyTraffic[key] = {
                    total: 0,
                    days: new Set()
                };
            }
            monthlyTraffic[key].total += totalTraffic;
            monthlyTraffic[key].days.add(dateObject.getDate()); // Unique days in the month
            directionNames.add(directionName);
        }
    });

    // Compute average traffic per month per direction
    const aggregatedData = Object.entries(monthlyTraffic).map(([key, data]) => {
        const [monthStr, directionName] = key.split('#');
        const month = parseInt(monthStr, 10);
        const numberOfDays = data.days.size;

        return {
            month: month,
            directionName,
            total: data.total,
            numberOfDays
        };
    });

    return { aggregatedData, directionNames: Array.from(directionNames) };
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
