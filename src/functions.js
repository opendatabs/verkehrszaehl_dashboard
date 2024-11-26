export function updateUrlParams(params) {
    const url = new URL(window.location.href);

    console.log(url.search);

    // Update the query parameters based on the current state
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key); // Remove parameter if null/undefined
        }
    });

    console.log(url.pathname);

    // Update the URL without reloading the page
    history.replaceState({}, '', `${url.pathname}${url.search}#${window.location.hash.substr(1)}`);
}

export function updateDatePickers(min, max) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.value = new Date(min).toISOString().split('T')[0];
    endDateInput.value = new Date(max).toISOString().split('T')[0];
}

// Helper function to clear "Zeitraum" selection
export function clearZeiteinheitSelection() {
    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        radio.checked = false;
    });
}

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
    const startDate = new Date(start);
    const endDate = new Date(end);

    return countingTrafficRows.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate && rowDate <= endDate;
    });
}

export function filterDailyDataRows(dailyDataRows, timeRange) {
    const [start, end] = timeRange;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Using Year and Month columns for filtering
    return dailyDataRows.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate && rowDate <= endDate;
    });
}


export function extractDailyTraffic(stationRows) {
    const dailyTraffic = {};

    stationRows.forEach(row => {
        const dateTimestamp = new Date(row.Date);
        const totalTraffic = row.Total;

        dailyTraffic[dateTimestamp] = totalTraffic;
    });

    return Object.entries(dailyTraffic).map(([date, total]) => {
        return [Date.parse(date), total];
    });
}

export function extractMonthlyTraffic(monthlyDataRows) {
    const monthlyTraffic = {};
    monthlyDataRows.forEach(row => {
        const date = new Date(row.Year, row.Month);
        const totalTraffic = row.Total;

        monthlyTraffic[date] = totalTraffic;
    });

    return Object.entries(monthlyTraffic).map(([date, total]) => {
        return [Date.parse(date), total];
    });
}

export function extractYearlyTraffic(stationRows) {
    const yearlyTraffic = {};

    stationRows.forEach(row => {
        const year = row.Year;
        const totalTraffic = row.Total;

        if (!yearlyTraffic[year]) {
            yearlyTraffic[year] = { total: 0, days: new Set() };
        }

        yearlyTraffic[year].total += totalTraffic;
        yearlyTraffic[year].days.add(row.Date);
    });

    return Object.entries(yearlyTraffic).map(([year, data]) => {
        const dailyAverage = data.total / data.days.size;
        return [Date.UTC(year, 0, 1), dailyAverage];
    });
}

export function compute7DayRollingAverage(data) {
    // data is an array of [date, total], sorted by date
    const result = [];
    const values = data.map(([date, total]) => ({ date: parseInt(date, 10), total }));

    // Sort the data by date
    values.sort((a, b) => a.date - b.date);

    for (let i = 0; i < values.length; i++) {
        let sum = 0;
        let count = 0;

        // Sum over the previous 7 days including current day
        for (let j = i; j >= 0 && j >= i - 6; j--) {
            if (values[j].total !== null && values[j].total !== undefined) {
                sum += values[j].total;
                count++;
            }
        }
        const average = count > 0 ? sum / count : null;
        result.push([values[i].date, average]);
    }
    return result;
}


export function aggregateHourlyTraffic(stationRows, MoFr = true, SaSo = true) {
    const hourlyTraffic = {};
    const directionNames = new Set();

    stationRows.forEach(row => {
        const weekday = new Date(row.Date).getDay(); // 0 = Sunday, ..., 6 = Saturday
        const isValidDay =
            (MoFr && weekday >= 1 && weekday <= 5) ||
            (SaSo && (weekday === 0 || weekday === 6));

        if (isValidDay) {
            for (let hour = 0; hour < 24; hour++) {
                const totalTraffic = parseFloat(row[hour] || 0);
                const directionName = row.DirectionName;

                const key = `${hour}#${directionName}`;
                if (!hourlyTraffic[key]) {
                    hourlyTraffic[key] = { total: 0, days: 0 };
                }

                hourlyTraffic[key].total += totalTraffic;
                hourlyTraffic[key].days += 1;
                directionNames.add(directionName);
            }
        }
    });

    const aggregatedData = Object.entries(hourlyTraffic).map(([key, data]) => {
        const [hourStr, directionName] = key.split('#');
        const hour = parseInt(hourStr, 10);

        return {
            hour: Date.UTC(1970, 0, 1, hour),
            directionName,
            total: data.total,
            numberOfDays: data.days
        };
    });

    return { aggregatedData, directionNames: Array.from(directionNames) };
}


export function aggregateMonthlyTraffic(stationRows, MoFr = true, SaSo = true) {
    const monthlyTraffic = {};
    const directionNames = new Set();

    stationRows.forEach(row => {
        const date = new Date(row.Date);
        const month = date.getMonth(); // 0-11
        const weekday = date.getDay();

        if (
            (MoFr && weekday >= 1 && weekday <= 5) || // Monday to Friday
            (SaSo && (weekday === 0 || weekday === 6)) // Saturday and Sunday
        ) {
            Object.keys(row)
                .filter(key => !isNaN(key)) // Hour columns
                .forEach(hour => {
                    const key = `${month}#${row.DirectionName.split('#')[0]}`;
                    if (!monthlyTraffic[key]) {
                        monthlyTraffic[key] = {
                            total: 0,
                            days: new Set()
                        };
                    }

                    monthlyTraffic[key].total += parseFloat(row[hour] || 0);
                    monthlyTraffic[key].days.add(row.Date);
                    directionNames.add(row.DirectionName.split('#')[0]);
                });
        }
    });

    const aggregatedData = Object.entries(monthlyTraffic).map(([key, data]) => {
        const [monthStr, directionName] = key.split('#');
        const month = parseInt(monthStr, 10);
        const numberOfDays = data.days.size;

        return {
            month,
            directionName,
            total: data.total,
            numberOfDays
        };
    });

    return { aggregatedData, directionNames: Array.from(directionNames) };
}


export function aggregateWeeklyTraffic(stationRows) {
    // Structure to hold total traffic and counts for each weekday (1: Monday, ..., 7: Sunday)
    const weeklyTraffic = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));

    // Aggregate data by weekday
    stationRows.forEach(row => {
        const date = new Date(row.Date); // Parse the date from the row
        const weekday = (date.getDay() + 6) % 7; // Convert Sunday (0) to end of the week

        // Calculate the total traffic for all hours in the row
        const totalTraffic = Object.keys(row)
            .filter(key => !isNaN(key)) // Filter only numeric keys (hourly columns)
            .reduce((sum, hour) => sum + parseFloat(row[hour] || 0), 0);

        // Add the traffic data to the respective weekday
        if (weekday >= 0 && weekday < 7) {
            weeklyTraffic[weekday].total += totalTraffic;
            weeklyTraffic[weekday].count += 1;
        }
    });

    // Map weekday numbers to German day names
    const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Convert weekly traffic data to the desired format with average daily traffic
    return weeklyTraffic.map((data, index) => {
        const averageTraffic = data.count > 0 ? data.total / data.count : 0; // Avoid division by zero
        return {
            day: weekdays[index],
            total: averageTraffic
        };
    });
}

export function getHeatMapData(filteredCountingTrafficRows) {
    let heatmapData = [];
    filteredCountingTrafficRows.forEach(row => {
        // Loop over each hour in the row
        for (let hour = 0; hour <= 23; hour++) {
            const value = row[hour];
            if (typeof value === 'undefined') continue; // Skip if value is missing

            // Create a timestamp for the x-axis
            const date = new Date(row.Date)

            // Add the data point
            heatmapData.push([date, hour, value]);
        }
    });
    return heatmapData;
}