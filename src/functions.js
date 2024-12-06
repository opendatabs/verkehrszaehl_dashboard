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
        dailyTraffic[dateTimestamp] = row[fzgtyp];
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
        monthlyTraffic[date] = row[fzgtyp];
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
            yearlyTraffic[year] = { total: 0, numMeasures: 0, numSpuren: 0, days: new Set()};
        }

        yearlyTraffic[year].total += totalTraffic;
        yearlyTraffic[year].numMeasures += numMeasures;
        yearlyTraffic[year].numSpuren += 1;
    });

    const dailyAvgPerYear =  Object.entries(yearlyTraffic).map(([year, data]) => {
        const dailyAverage = data.total / data.numSpuren;
        // Return two objects: one array of dailyAverage and one with numDays measured
        return [Date.UTC(year, 0, 1), dailyAverage]
    });
    const numDaysPerYear = Object.entries(yearlyTraffic).map(([year, data]) => {
        const numDays = data.numMeasures / (data.numSpuren*24);
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


export function aggregateHourlyTraffic(stationRows, MoFr = true, SaSo = true) {
    const hourlyTraffic = {};
    const hourlyTotalsPerHourPerDirection = {};
    const hourlyTotalsPerHourTotal = {};
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

                // Collect data per direction
                if (!hourlyTotalsPerHourPerDirection[directionName]) {
                    hourlyTotalsPerHourPerDirection[directionName] = {};
                }
                if (!hourlyTotalsPerHourPerDirection[directionName][hour]) {
                    hourlyTotalsPerHourPerDirection[directionName][hour] = [];
                }
                hourlyTotalsPerHourPerDirection[directionName][hour].push(totalTraffic);

                // Collect data for total
                if (!hourlyTotalsPerHourTotal[hour]) {
                    hourlyTotalsPerHourTotal[hour] = [];
                }
                hourlyTotalsPerHourTotal[hour].push(totalTraffic);
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

    return {
        aggregatedData,
        hourlyTotalsPerHourPerDirection,
        hourlyTotalsPerHourTotal,
        directionNames: Array.from(directionNames) };
}


export function aggregateMonthlyTraffic(stationRows, fzgtyp, MoFr = true, SaSo = true) {
    const monthlyTraffic = {};
    const directionNames = new Set();
    const dailyTotalsPerMonthPerDirection = {};
    const dailyTotalsPerMonthTotal = {};

    stationRows.forEach(row => {
        const date = new Date(row.Date);
        const month = date.getMonth(); // 0-11
        const weekday = date.getDay(); // 0 = Sunday, ..., 6 = Saturday
        const directionName = row.DirectionName;
        const total = row[fzgtyp];

        const isWeekday = weekday >= 1 && weekday <= 5; // Monday to Friday
        const isWeekend = weekday === 0 || weekday === 6; // Saturday and Sunday

        if (
            (MoFr && isWeekday) ||
            (SaSo && isWeekend)
        ) {
            const key = `${month}#${directionName}`;
            if (!monthlyTraffic[key]) {
                monthlyTraffic[key] = {
                    total: 0,
                    days: new Set()
                };
            }

            monthlyTraffic[key].total += total;
            monthlyTraffic[key].days.add(date);
            directionNames.add(directionName);

            // Collect daily totals per month per direction
            if (!dailyTotalsPerMonthPerDirection[directionName]) {
                dailyTotalsPerMonthPerDirection[directionName] = {};
            }
            if (!dailyTotalsPerMonthPerDirection[directionName][month]) {
                dailyTotalsPerMonthPerDirection[directionName][month] = [];
            }
            dailyTotalsPerMonthPerDirection[directionName][month].push(row.Total);


            // Collect daily totals per month for total
            if (!dailyTotalsPerMonthTotal[month]) {
                dailyTotalsPerMonthTotal[month] = [];
            }
            dailyTotalsPerMonthTotal[month].push(total);
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

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerMonthPerDirection,
        dailyTotalsPerMonthTotal
    };
}



export function aggregateWeeklyTraffic(stationRows, fzgtyp, MoFr = true, SaSo = true) {
    const weeklyTraffic = {};
    const directionNames = new Set();
    const dailyTotalsPerWeekdayPerDirection = {};
    const dailyTotalsPerWeekdayTotal = {};

    stationRows.forEach(row => {
        const date = new Date(row.Date);
        const weekday = (date.getDay() + 6) % 7; // 0=Monday, ..., 6=Sunday
        const directionName = row.DirectionName;
        const total = row[fzgtyp];

        const isWeekday = weekday >= 0 && weekday <= 4; // Monday (0) to Friday (4)
        const isWeekend = weekday === 5 || weekday === 6; // Saturday (5) and Sunday (6)

        if (
            (MoFr && isWeekday) ||
            (SaSo && isWeekend)
        ) {
            const key = `${weekday}#${directionName}`;
            if (!weeklyTraffic[key]) {
                weeklyTraffic[key] = {
                    total: 0,
                    days: new Set()
                };
            }

            weeklyTraffic[key].total += total;
            weeklyTraffic[key].days.add(date.toDateString());
            directionNames.add(directionName);

            // Collect daily totals per weekday per direction
            if (!dailyTotalsPerWeekdayPerDirection[directionName]) {
                dailyTotalsPerWeekdayPerDirection[directionName] = {};
            }
            if (!dailyTotalsPerWeekdayPerDirection[directionName][weekday]) {
                dailyTotalsPerWeekdayPerDirection[directionName][weekday] = [];
            }
            dailyTotalsPerWeekdayPerDirection[directionName][weekday].push(total);

            // Collect daily totals per weekday for total
            if (!dailyTotalsPerWeekdayTotal[weekday]) {
                dailyTotalsPerWeekdayTotal[weekday] = [];
            }
            dailyTotalsPerWeekdayTotal[weekday].push(total);
        }
    });

    const aggregatedData = Object.entries(weeklyTraffic).map(([key, data]) => {
        const [weekdayStr, directionName] = key.split('#');
        const weekday = parseInt(weekdayStr, 10);
        const numberOfDays = data.days.size;

        return {
            weekday,
            directionName,
            total: data.total,
            numberOfDays
        };
    });

    return {
        aggregatedData,
        directionNames: Array.from(directionNames),
        dailyTotalsPerWeekdayPerDirection,
        dailyTotalsPerWeekdayTotal
    };
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