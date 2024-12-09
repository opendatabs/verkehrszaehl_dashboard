/**
 * Reads a CSV file from a URL or File object and returns an array of objects.
 * @param {string | File} input - The URL string or File object of the CSV file.
 * @returns {Promise<Object[]>} A promise that resolves to an array of objects representing the CSV data.
 */
export function readCSV(input) {
    return new Promise((resolve, reject) => {
        if (typeof input === 'string') {
            // Input is a URL
            fetch(input)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(csvText => {
                    const results = Papa.parse(csvText, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                    });
                    if (results.errors.length) {
                        reject(results.errors);
                    } else {
                        resolve(results.data);
                    }
                })
                .catch(error => {
                    reject(error);
                });
        } else if (input instanceof File) {
            // Input is a File object
            const reader = new FileReader();
            reader.onload = function(e) {
                const csvText = e.target.result;
                const results = Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                });
                if (results.errors.length) {
                    reject(results.errors);
                } else {
                    resolve(results.data);
                }
            };
            reader.onerror = function(error) {
                reject(error);
            };
            reader.readAsText(input);
        } else {
            reject(new Error('Invalid input. Must be a URL string or a File object.'));
        }
    });
}

export function updateState(type, strtyp, zst, fzgtyp, timeRange, zaehlstellen) {
    zst = populateZstDropdown(zaehlstellen, zst, strtyp);
    const isMoFrSelected = document.querySelector('#mo-fr').checked;
    const isSaSoSelected = document.querySelector('#sa-so').checked;
    const weekday_param = isMoFrSelected && isSaSoSelected ? 'mo-so' : isMoFrSelected ? 'mo-fr' : 'sa-so';
    if (type !== 'MIV' && fzgtyp !== 'Total') {
        fzgtyp = 'Total';
    }
    updateUrlParams({
        traffic_type: type,
        strtyp: strtyp,
        zst_id: zst,
        fzgtyp: fzgtyp,
        start_date: new Date(timeRange[0]).toISOString().split('T')[0],
        end_date: new Date(timeRange[1]).toISOString().split('T')[0],
        weekday: weekday_param
    });
    updateDatePickers(timeRange[0], timeRange[1]);
    updateStrassentypFilters(type);
    return zst;
}

export function getStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        activeType: params.get('traffic_type') || 'MIV',
        activeStrtyp: params.get('strtyp') || 'Alle',
        activeZst: params.get('zst_id') || 'default_station',
        activeFzgtyp: params.get('fzgtyp') || 'Total',
        activeTimeRange: [
            Date.parse(params.get('start_date')) || Date.parse('2023-01-01'),
            Date.parse(params.get('end_date')) || Date.parse('2023-12-31'),
        ],
        weekday: params.get('weekday') || 'mo-so'
    };
}

export function updateUrlParams(params) {
    const url = new URL(window.location.href);
    // Update the query parameters based on the current state
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key); // Remove parameter if null/undefined
        }
    });
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

export function updateStrassentypFilters(activeType) {
    // Mapping of `Verkehrsmittel` to allowed `Strassentyp` values
    const allowedStrassentyp = {
        'MIV': ['HLS', 'HVS', 'HSS', 'SOS'],
        'Velo': ['HVS', 'SOS', 'Andere'],
        'Fussgaenger': ['HVS', 'HSS', 'SOS', 'Andere']
    };

    const allowed = allowedStrassentyp[activeType] || [];

    document.querySelectorAll('.filter-options input[name="filter-strtyp"]').forEach(radio => {
        const label = radio.nextElementSibling; // Get the associated label
        if (allowed.includes(radio.value)) {
            radio.disabled = false; // Enable the button
            label.style.display = ''; // Show the label
        } else {
            radio.disabled = true; // Disable the button
            label.style.display = 'none'; // Hide the label
            radio.checked = false; // Uncheck if it's disabled
        }
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

export async function getFilteredZaehlstellen(board, type, fzgtyp) {
    let zaehlstellenTable = await board.dataPool.getConnectorTable(`${type}-Standorte`);
    const zaehlstellenRows = zaehlstellenTable.getRowObjects();

    return zaehlstellenRows
        .filter(row => row.TrafficType === type)
        .map(row => {
            const strtypAbbrev = extractAbbreviation(row.strtyp);

            // Base data point
            return {
                lat: parseFloat(row['geo_point_2d'].split(',')[0]),
                lon: parseFloat(row['geo_point_2d'].split(',')[1]),
                name: String(row.name),
                id: row.Zst_id,
                type: row.TrafficType,
                strtyp: row.strtyp,
                color: getColorForStrTyp(strtypAbbrev),
                total: row[fzgtyp]
            };
        });
}


export function populateZstDropdown(zaehlstellen, currentZst, strtyp) {
    const dropdown = document.getElementById('zaehlstellen-dropdown');
    dropdown.innerHTML = ''; // Clear existing options

    let newZst = currentZst;

    // First, add all options to the dropdown
    zaehlstellen.forEach(station => {
        if (strtyp === 'Alle' || station.strtyp.includes(strtyp)) {
            const option = document.createElement('option');
            option.value = station.id;
            option.text = `${station.id} ${station.name}`;
            dropdown.add(option);
        }
    });

    // Then, set the selected option
    let optionFound = false;
    for (let i = 0; i < dropdown.options.length; i++) {
        if (String(dropdown.options[i].value) === String(currentZst)) {
            dropdown.selectedIndex = i;
            optionFound = true;
            break;
        }
    }

    // If no matching option is found, you can set a default or handle the case
    if (!optionFound) {
        newZst = dropdown.options[0].value;
    }

    return newZst;
}

export function filterToSelectedTimeRange(dailyDataRows, timeRange) {
    const [start, end] = timeRange;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Using Year and Month columns for filtering
    return dailyDataRows.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate && rowDate <= endDate;
    });
}


export function extractDailyTraffic(stationRows, fzgtyp) {
    const dailyTraffic = {};

    stationRows.forEach(row => {
        const dateTimestamp = new Date(row.Date);
        const totalTraffic = row[fzgtyp];

        if (!dailyTraffic[dateTimestamp]) {
            dailyTraffic[dateTimestamp] = null;
        }
        if (totalTraffic) {
            dailyTraffic[dateTimestamp] += totalTraffic;
        }
    });

    return Object.entries(dailyTraffic).map(([date, total]) => {
        return [Date.parse(date), total];
    });
}

export function extractDailyWeatherData(weatherRows, unit) {
    const dailyWeather = [];

    weatherRows.forEach(row => {
        const date = new Date(row.Date);
        const value = row[unit];
        dailyWeather.push([Date.parse(date), value]);
    });

    return dailyWeather;
}

export function extractMonthlyTraffic(monthlyDataRows, fzgtyp) {
    const monthlyTraffic = {};
    monthlyDataRows.forEach(row => {
        const date = new Date(row.Year, row.Month);
        if (!monthlyTraffic[date]) {
            monthlyTraffic[date] = null;
        }
        if (row[fzgtyp]) {
            monthlyTraffic[date] += row[fzgtyp];
        }
    });

    return Object.entries(monthlyTraffic).map(([date, total]) => {
        return [Date.parse(date), total];
    });
}

export function extractYearlyTraffic(stationRows, fzgtyp) {
    const yearlyTraffic = {};

    stationRows.forEach(row => {
        const year = row.Year;
        const totalTraffic = row[fzgtyp];
        const numMeasures = row.NumMeasures;

        if (!yearlyTraffic[year]) {
            yearlyTraffic[year] = { total: null, numMeasures: 0, numSpuren: 0, days: new Set()};
        }
        if (totalTraffic) {
            yearlyTraffic[year].total += totalTraffic;
            yearlyTraffic[year].numMeasures = Math.max(yearlyTraffic[year].numMeasures, numMeasures);
            yearlyTraffic[year].numSpuren += 1;
        }
    });

    const dailyAvgPerYear =  Object.entries(yearlyTraffic).map(([year, data]) => {
        if (data.total === null) {
            return [Date.UTC(year, 0, 1), null];
        }
        const dailyAverage = data.total
        // Return two objects: one array of dailyAverage and one with numDays measured
        return [Date.UTC(year, 0, 1), dailyAverage]
    });
    const numDaysPerYear = Object.entries(yearlyTraffic).map(([year, data]) => {
        const numDays = data.numMeasures / 24;
        return [Date.UTC(year, 0, 1), numDays]
    });
    return {dailyAvgPerYear, numDaysPerYear};
}

export function extractYearlyTemperature(temperatureRows) {
    const yearlyTemperature = [];

    temperatureRows.forEach(row => {
        const year = row.Year;
        const temperature = row.temp_c;

        yearlyTemperature.push([Date.UTC(year, 0, 1), temperature]);
    });
    return yearlyTemperature;
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


/**
 * Aggregates hourly traffic data by date, direction, and hour.
 *
 * This function processes traffic data from multiple dates. It:
 * 1. Filters data based on whether the date falls on a weekday or weekend/holiday,
 *    depending on the flags `MoFr` (Monday-Friday) and `SaSo` (Saturday-Sunday).
 * 2. For each valid date, direction, and hour, it sums up the traffic counts.
 * 3. It then produces several useful data structures:
 *    - `aggregatedData`: An array of objects, each representing a single combination
 *      of date, hour, and direction, along with a total and the number of distinct days encountered.
 *    - `hourlyTotalsPerHourPerDirection`: An object where keys are directionNames and hours,
 *      and values are arrays of summed traffic counts from each date.
 *    - `hourlyTotalsPerHourTotal`: An object keyed by hour, holding arrays of summed total traffic counts (all directions) for each date.
 *    - `directionNames`: An array of all directions encountered.
 *
 * Data Structures:
 * - hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour] = [...values]
 * - hourlyTotalsPerHourTotalPerDate[dateStr][hour] = [...values]
 *
 * After processing:
 * - hourlyTotalsPerHourPerDirection[directionName][hour] = [sumForDate1, sumForDate2, ...]
 * - hourlyTotalsPerHourTotal[hour] = [sumForDate1, sumForDate2, ...]
 *
 * @param {Array} stationRows - Array of station rows, each containing a Date, a DirectionName, and 24 hourly traffic values.
 * @param {boolean} [MoFr=true] - Include Monday through Friday data.
 * @param {boolean} [SaSo=true] - Include Saturday and Sunday data.
 * @returns {Object} The result object with:
 *   - aggregatedData: Array of aggregated results (date, hour, direction, total, numberOfDays)
 *   - hourlyTotalsPerHourPerDirection: Hourly aggregated totals per direction, arrays of sums for each hour.
 *   - hourlyTotalsPerHourTotal: Hourly aggregated totals across all directions, arrays of sums for each hour.
 *   - directionNames: Array of all encountered direction names.
 */
export function aggregateHourlyTraffic(stationRows, MoFr = true, SaSo = true) {
    // Tracks totals for each unique (date, hour, direction) combination
    // Key format: "dateStr#hour#directionName"
    // { total: number, days: Set of dateStrs }
    const hourlyTraffic = {};

    // Temporaries for storing raw data before summation:
    // These keep arrays of values that we will sum up later.
    const hourlyTotalsPerHourPerDirectionPerDate = {};
    const hourlyTotalsPerHourTotalPerDate = {};

    // Final aggregated structures:
    // After summation, these will store arrays of sums (one element per date) indexed by hour.
    const hourlyTotalsPerHourPerDirection = {};
    const hourlyTotalsPerHourTotal = {};
    const directionNames = new Set();

    // Process each row of traffic data
    stationRows.forEach(row => {
        const dateStr = row.Date;
        const weekday = new Date(dateStr).getDay(); // Sunday=0, Monday=1, ..., Saturday=6

        // Check if the date fits the desired filter (Mo-Fr and/or Sa-So)
        const isValidDay =
            (MoFr && weekday >= 1 && weekday <= 5) ||
            (SaSo && (weekday === 0 || weekday === 6));

        // Only proceed if the day is valid
        if (isValidDay) {
            const directionName = row.DirectionName;
            directionNames.add(directionName);

            // Loop through each hour of the day
            for (let hour = 0; hour < 24; hour++) {
                const totalTraffic = parseFloat(row[hour] || null);

                // Skip if no valid traffic count
                if (!totalTraffic || isNaN(totalTraffic)) continue;

                // Create a unique key for this date, hour, and direction
                const key = `${dateStr}#${hour}#${directionName}`;

                // Aggregate into hourlyTraffic
                if (!hourlyTraffic[key]) {
                    hourlyTraffic[key] = { total: 0, days: new Set() };
                }
                hourlyTraffic[key].total += totalTraffic;
                hourlyTraffic[key].days.add(dateStr);

                // Build the direction-per-date-per-hour structure
                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName] = {};
                }

                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr] = {};
                }

                if (!hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour]) {
                    hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour] = [];
                }

                hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour].push(totalTraffic);

                // Build the total-per-date-per-hour structure
                if (!hourlyTotalsPerHourTotalPerDate[dateStr]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr] = {};
                }

                if (!hourlyTotalsPerHourTotalPerDate[dateStr][hour]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr][hour] = [];
                }

                hourlyTotalsPerHourTotalPerDate[dateStr][hour].push(totalTraffic);
            }
        }
    });

    // Now we sum up the arrays of traffic values for each combination
    // For directions:
    for (const directionName in hourlyTotalsPerHourPerDirectionPerDate) {
        for (const dateStr in hourlyTotalsPerHourPerDirectionPerDate[directionName]) {
            if (!hourlyTotalsPerHourPerDirection[directionName]) {
                hourlyTotalsPerHourPerDirection[directionName] = {};
            }
            for (const hour in hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr]) {
                const values = hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour];
                const sum = values.reduce((acc, val) => acc + val, 0);

                if (!hourlyTotalsPerHourPerDirection[directionName][hour]) {
                    hourlyTotalsPerHourPerDirection[directionName][hour] = [];
                }
                hourlyTotalsPerHourPerDirection[directionName][hour].push(sum);
            }
        }
    }

    // For totals (all directions combined):
    for (const dateStr in hourlyTotalsPerHourTotalPerDate) {
        for (const hour in hourlyTotalsPerHourTotalPerDate[dateStr]) {
            const values = hourlyTotalsPerHourTotalPerDate[dateStr][hour];
            const sum = values.reduce((acc, val) => acc + val, 0);

            if (!hourlyTotalsPerHourTotal[hour]) {
                hourlyTotalsPerHourTotal[hour] = [];
            }
            hourlyTotalsPerHourTotal[hour].push(sum);
        }
    }

    // Convert `hourlyTraffic` into a more user-friendly array, `aggregatedData`
    const aggregatedData = Object.entries(hourlyTraffic).map(([key, data]) => {
        const [dateStr, hourStr, directionName] = key.split('#');
        const hour = parseInt(hourStr, 10);

        // Construct a Date object for this specific date and hour
        const baseDate = new Date(dateStr);
        baseDate.setHours(hour);

        return {
            hour: baseDate.getTime(),
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    // Return all the computed structures
    return {
        aggregatedData,
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames: Array.from(directionNames)
    };
}


/**
 * Aggregates daily traffic data by weekday and direction, introducing per-date arrays before summation.
 *
 * Data Flow:
 * - First, filter the data by day type (Mo-Fr, Sa-So).
 * - For each valid entry, store raw daily values into per-direction and total structures,
 *   including new per-date structures:
 *   - dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday] = [values]
 *   - dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday] = [values]
 * - After all data is collected, sum each date's values and push them into:
 *   - dailyTotalsPerWeekdayPerDirection[directionName][weekday] (final per-direction sums)
 *   - dailyTotalsPerWeekdayTotal[weekday] (final total sums)
 *
 * Returns:
 *   - aggregatedData: array of objects with total traffic per weekday/direction and numberOfDays
 *   - directionNames: all encountered directions
 *   - dailyTotalsPerWeekdayPerDirection: final aggregated sums per direction and weekday (array of sums from each date)
 *   - dailyTotalsPerWeekdayTotal: final aggregated sums per weekday (array of sums from each date)
 *
 * @param {Array} stationRows - Array of data rows with {Date, DirectionName, fzgtyp}
 * @param {string} fzgtyp - Property name to access traffic values in stationRows.
 * @param {boolean} [MoFr=true] - Include Monday-Friday data
 * @param {boolean} [SaSo=true] - Include Saturday-Sunday data
 * @returns {Object}
 */
export function aggregateWeeklyTraffic(stationRows, fzgtyp, MoFr = true, SaSo = true) {
    const weeklyTraffic = {};
    const directionNames = new Set();

    // Temporary detailed structures to hold raw values before summation:
    const dailyTotalsPerWeekdayPerDirectionPerDate = {};
    const dailyTotalsPerWeekdayTotalPerDate = {};

    // Final aggregated structures (after summation):
    const dailyTotalsPerWeekdayPerDirection = {};
    const dailyTotalsPerWeekdayTotal = {};

    stationRows.forEach(row => {
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const weekday = (date.getDay() + 6) % 7; // Monday=0 ... Sunday=6
        const directionName = row.DirectionName;
        const total = row[fzgtyp];

        const isWeekday = weekday >= 0 && weekday <= 4; // Mon-Fri
        const isWeekend = weekday === 5 || weekday === 6; // Sat-Sun

        // Filter by Mo-Fr / Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${weekday}#${directionName}`;

            if (!weeklyTraffic[key]) {
                weeklyTraffic[key] = { total: 0, days: new Set() };
            }
            if (total) {
                weeklyTraffic[key].total += total;
                weeklyTraffic[key].days.add(dateStr);
                directionNames.add(directionName);
            }

            // Collect raw data per direction per date and weekday
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName] = {};
            }
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr] = {};
            }
            if (!dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday]) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday] = [];
            }
            if (total) {
                dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday].push(total);
            }

            // Collect raw data total per date and weekday
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday] = [];
            }
            if (total) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday].push(total);
            }
        }
    });

    // Now sum up the per-date arrays and push into final aggregated structures
    // For direction-level aggregation:
    for (const directionName in dailyTotalsPerWeekdayPerDirectionPerDate) {
        if (!dailyTotalsPerWeekdayPerDirection[directionName]) {
            dailyTotalsPerWeekdayPerDirection[directionName] = {};
        }
        for (const dateStr in dailyTotalsPerWeekdayPerDirectionPerDate[directionName]) {
            for (const weekday in dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr]) {
                const arr = dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday];
                const sum = arr.reduce((acc, val) => acc + val, 0);

                if (!dailyTotalsPerWeekdayPerDirection[directionName][weekday]) {
                    dailyTotalsPerWeekdayPerDirection[directionName][weekday] = [];
                }
                dailyTotalsPerWeekdayPerDirection[directionName][weekday].push(sum);
            }
        }
    }

    // For total-level aggregation:
    for (const dateStr in dailyTotalsPerWeekdayTotalPerDate) {
        for (const weekday in dailyTotalsPerWeekdayTotalPerDate[dateStr]) {
            const arr = dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday];
            const sum = arr.reduce((acc, val) => acc + val, 0);

            if (!dailyTotalsPerWeekdayTotal[weekday]) {
                dailyTotalsPerWeekdayTotal[weekday] = [];
            }
            dailyTotalsPerWeekdayTotal[weekday].push(sum);
        }
    }

    // Convert aggregated results into a more usable array
    const aggregatedData = Object.entries(weeklyTraffic).map(([key, data]) => {
        const [weekdayStr, directionName] = key.split('#');
        const weekday = parseInt(weekdayStr, 10);
        return {
            weekday,
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal
    };
}



/**
 * Aggregates daily traffic data by month and direction, introducing per-date arrays before summation.
 *
 * Data Flow:
 * - Filter data by day type (Mo-Fr, Sa-So).
 * - For each valid entry, store raw daily values into per-direction and total structures,
 *   including new per-date structures:
 *   - dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month] = [values]
 *   - dailyTotalsPerMonthTotalPerDate[dateStr][month] = [values]
 * - After collecting all data, sum each date's values and push them into:
 *   - dailyTotalsPerMonthPerDirection[directionName][month] (final per-direction sums)
 *   - dailyTotalsPerMonthTotal[month] (final total sums)
 *
 * @param {Array} stationRows - Array of data rows with {Date, DirectionName, fzgtyp}
 * @param {string} fzgtyp - Property name to access traffic values in stationRows.
 * @param {boolean} [MoFr=true] - Include Monday-Friday data
 * @param {boolean} [SaSo=true] - Include Saturday-Sunday data
 * @returns {Object}
 *   aggregatedData: Array of { month, directionName, total, numberOfDays }
 *   directionNames: Array of encountered directions
 *   dailyTotalsPerMonthPerDirection: final aggregated sums per direction and month (array of sums from each date)
 *   dailyTotalsPerMonthTotal: final aggregated sums per month (array of sums from each date)
 */
export function aggregateMonthlyTraffic(stationRows, fzgtyp, MoFr = true, SaSo = true) {
    const monthlyTraffic = {};
    const directionNames = new Set();

    // Temporary structures to hold raw daily values before summation:
    const dailyTotalsPerMonthPerDirectionPerDate = {};
    const dailyTotalsPerMonthTotalPerDate = {};

    // Final aggregated structures (after summation):
    const dailyTotalsPerMonthPerDirection = {};
    const dailyTotalsPerMonthTotal = {};

    stationRows.forEach(row => {
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const month = date.getMonth(); // 0=January ... 11=December
        const weekday = date.getDay(); // Sunday=0 ... Saturday=6
        const directionName = row.DirectionName;
        const total = row[fzgtyp];

        const isWeekday = weekday >= 1 && weekday <= 5; // Monday to Friday
        const isWeekend = weekday === 0 || weekday === 6; // Sunday, Saturday

        // Filter by Mo-Fr and Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${month}#${directionName}`;

            if (!monthlyTraffic[key]) {
                monthlyTraffic[key] = { total: 0, days: new Set() };
            }
            if (total) {
                monthlyTraffic[key].total += total;
                monthlyTraffic[key].days.add(dateStr);
                directionNames.add(directionName);
            }

            // Collect raw data per direction per date and month
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName] = {};
            }
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr] = {};
            }
            if (!dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month]) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month] = [];
            }
            if (total) {
                dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month].push(total);
            }

            // Collect raw data total per date and month
            if (!dailyTotalsPerMonthTotalPerDate[dateStr]) {
                dailyTotalsPerMonthTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerMonthTotalPerDate[dateStr][month]) {
                dailyTotalsPerMonthTotalPerDate[dateStr][month] = [];
            }
            if (total) {
                dailyTotalsPerMonthTotalPerDate[dateStr][month].push(total);
            }
        }
    });

    // Sum up per-date arrays for direction-level aggregation
    for (const directionName in dailyTotalsPerMonthPerDirectionPerDate) {
        if (!dailyTotalsPerMonthPerDirection[directionName]) {
            dailyTotalsPerMonthPerDirection[directionName] = {};
        }
        for (const dateStr in dailyTotalsPerMonthPerDirectionPerDate[directionName]) {
            for (const month in dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr]) {
                const arr = dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month];
                const sum = arr.reduce((acc, val) => acc + val, 0);

                if (!dailyTotalsPerMonthPerDirection[directionName][month]) {
                    dailyTotalsPerMonthPerDirection[directionName][month] = [];
                }
                dailyTotalsPerMonthPerDirection[directionName][month].push(sum);
            }
        }
    }

    // Sum up per-date arrays for total-level aggregation
    for (const dateStr in dailyTotalsPerMonthTotalPerDate) {
        for (const month in dailyTotalsPerMonthTotalPerDate[dateStr]) {
            const arr = dailyTotalsPerMonthTotalPerDate[dateStr][month];
            const sum = arr.reduce((acc, val) => acc + val, 0);

            if (!dailyTotalsPerMonthTotal[month]) {
                dailyTotalsPerMonthTotal[month] = [];
            }
            dailyTotalsPerMonthTotal[month].push(sum);
        }
    }

    // Convert aggregated results into a user-friendly array
    const aggregatedData = Object.entries(monthlyTraffic).map(([key, data]) => {
        const [monthStr, directionName] = key.split('#');
        const month = parseInt(monthStr, 10);
        return {
            month,
            directionName,
            total: data.total,
            numberOfDays: data.days.size
        };
    });

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerMonthPerDirection,
        dailyTotalsPerMonthTotal
    };
}


/**
 * Aggregates monthly weather data from daily rows, filtered by the given time range.
 * - Temperature: Average of daily average temperatures per month
 * - Precipitation: Sum of all daily precipitation values per month
 *
 * @param {Object[]} dailyTempRows - Array of row objects for daily data
 * @param {[number, number]} timeRange - Array with two timestamps [start, end]
 * @returns {Object} An object containing arrays monthlyTemperatures and monthlyPrecipitations
 *                   (index 0 = January, ..., 11 = December)
 */
export function aggregateMonthlyWeather(dailyTempRows, timeRange) {
    const startDate = new Date(timeRange[0]);
    const endDate = new Date(timeRange[1]);

    const monthlyTempsAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
    const monthlyPrecipAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));

    dailyTempRows.forEach(row => {
        // Parse the date from the row
        const date = new Date(row.Date);
        // Check if the date is within the specified time range
        if (date < startDate || date > endDate) return;

        // Extract month index (0-based)
        const monthIndex = date.getMonth();

        // Parse temperature and precipitation
        const temp = parseFloat(row.temp_c);
        const precip = parseFloat(row.prec_mm);
        console.log(temp, precip);

        // Accumulate temperature data if valid
        if (!isNaN(temp)) {
            monthlyTempsAccum[monthIndex].sum += temp;
            monthlyTempsAccum[monthIndex].count += 1;
        }

        // Accumulate precipitation data if valid
        if (!isNaN(precip)) {
            monthlyPrecipAccum[monthIndex].sum += precip;
            monthlyPrecipAccum[monthIndex].count += 1;
        }
    });

    // Compute monthly average temperature (sum of daily averages / number of days with data)
    const monthlyTemperatures = monthlyTempsAccum.map(m => (m.count > 0 ? m.sum / m.count : null));

    // Compute monthly total precipitation (sum of daily precipitation values)
    const monthlyPrecipitations = monthlyPrecipAccum.map(m => (m.count > 0 ? m.sum : null));

    return { monthlyTemperatures, monthlyPrecipitations };
}


export function processHourlyBoxPlotData(
    hourlyTotalsPerHourPerDirection,
    hourlyTotalsPerHourTotal,
    directionNames,
    directionToRi,
    isSingleDirection
) {
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0 to 23

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        directionNames.forEach(direction => {
            const ri = directionToRi[direction];
            const dataPerHour = hourlyTotalsPerHourPerDirection[direction];
            const boxPlotData = [];

            hours.forEach(hour => {
                const data = dataPerHour[hour];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    hours.forEach(hour => {
        const data = hourlyTotalsPerHourTotal[hour];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot'
    });

    return seriesData;
}

export function processWeeklyBoxPlotData(
    dailyTotalsPerWeekdayPerDirection,
    dailyTotalsPerWeekdayTotal,
    weeklyDirectionNames,
    directionToRiWeekly,
    isSingleDirection
) {
    const weekdays = Array.from({ length: 7 }, (_, i) => i); // 0 to 6

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        weeklyDirectionNames.forEach(direction => {
            const ri = directionToRiWeekly[direction];
            const dataPerWeekday = dailyTotalsPerWeekdayPerDirection[direction];
            const boxPlotData = [];

            weekdays.forEach(weekday => {
                const data = dataPerWeekday[weekday];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    weekdays.forEach(weekday => {
        const data = dailyTotalsPerWeekdayTotal[weekday];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot'
    });

    return seriesData;
}

export function processMonthlyBoxPlotData(
    dailyTotalsPerMonthPerDirection,
    dailyTotalsPerMonthTotal,
    monthlyDirectionNames,
    directionToRiMonthly,
    isSingleDirection
) {
    const months = Array.from({ length: 12 }, (_, i) => i); // 0 to 11

    const seriesData = [];

    if (!isSingleDirection) {
        // Process data for each direction
        monthlyDirectionNames.forEach(direction => {
            const ri = directionToRiMonthly[direction];
            const dataPerMonth = dailyTotalsPerMonthPerDirection[direction];
            const boxPlotData = [];

            months.forEach(month => {
                const data = dataPerMonth[month];

                if (data && data.length > 0) {
                    const quartiles = computeQuartiles(data);
                    boxPlotData.push(quartiles);
                } else {
                    boxPlotData.push([null, null, null, null, null]);
                }
            });

            seriesData.push({
                id: `series-${ri}`,
                name: direction, // Use actual direction name
                data: boxPlotData,
                type: 'boxplot'
            });
        });
    }

    // Always include total series
    const totalBoxPlotData = [];

    months.forEach(month => {
        const data = dailyTotalsPerMonthTotal[month];

        if (data && data.length > 0) {
            const quartiles = computeQuartiles(data);
            totalBoxPlotData.push(quartiles);
        } else {
            totalBoxPlotData.push([null, null, null, null, null]);
        }
    });

    seriesData.push({
        id: 'series-gesamt',
        name: 'Gesamtquerschnitt',
        data: totalBoxPlotData,
        type: 'boxplot'
    });

    return seriesData;
}

function computeQuartiles(dataArray) {
    dataArray.sort((a, b) => a - b);
    const min = dataArray[0];
    const max = dataArray[dataArray.length - 1];
    const median = percentile(dataArray, 50);
    const q1 = percentile(dataArray, 25);
    const q3 = percentile(dataArray, 75);

    return [min, q1, median, q3, max];
}

function percentile(arr, p) {
    const index = (p / 100) * (arr.length - 1);
    if (Math.floor(index) === index) {
        return arr[index];
    } else {
        const i = Math.floor(index);
        const fraction = index - i;
        return arr[i] + (arr[i + 1] - arr[i]) * fraction;
    }
}