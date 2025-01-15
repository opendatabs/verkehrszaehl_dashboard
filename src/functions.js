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

export function updateCredits(credits, type){
    if (type === 'MIV') {
        credits.update({
            text: 'Datenquelle: Verkehrszähldaten motorisierter Individualverkehr',
            href: 'https://data.bs.ch/explore/dataset/100006/'
        });
    } else {
        credits.update({
            text: 'Datenquelle: Verkehrszähldaten Velos und Fussgänger',
            href: 'https://data.bs.ch/explore/dataset/100013/'
        });
    }
}

export async function updateExporting(board, exporting, filename_prefix, type = '', zst = '', fzgtyp= '', timeRange = '', weekday = false, map = false) {
    let typeFilename = type === '' ? '' : `_${type}`;
    let typeSubtitle = type === 'MIV' ? '(MIV)' : type === 'Velo' ? '(Velo)' : type === 'Fussgaenger' ? '(Fussgänger)' : '';

    if (fzgtyp !== '' && fzgtyp !== 'Total') {
        typeFilename = `_${fzgtyp}`;
        const fzgtypMappings = {
            "Total": "Total",
            "MR": "Motorrad",
            "PW": "Personenwagen",
            "PW+": "Personenwagen mit Anhänger",
            "Lief": "Lieferwagen",
            "Lief+": "Lieferwagen mit Anhänger",
            "Lief+Aufl.": "Lieferwagen mit Auflieger",
            "LW": "Lastwagen",
            "LW+": "Lastwagen mit Anhänger",
            "Sattelzug": "Sattelzug",
            "Bus": "Bus",
            "andere": "nicht klassifizierbare Fahrzeuge"
        };
        typeSubtitle = `(${fzgtypMappings[fzgtyp]})`;
    }

    const zstFilename = zst === '' ? '' : `_${zst}`;
    let zstSubtitle = '';
    if (zst !== '') {
        let zaehlstellenTable = await board.dataPool.getConnectorTable(`${type}-Standorte`);
        const zaehlstellenRows = zaehlstellenTable.getRowObjects();
        const zstName = zaehlstellenRows.find(row => row['Zst_id'] === zst)['name'];
        zstSubtitle = `${zst} ${zstName}`;
    }

    // Transform timeRange to string
    let startFilename = '';
    let endFilename = '';
    let startSubtitle = '';
    let endSubtitle = '';
    if (timeRange !== '') {
        const startDate = new Date(timeRange[0]);
        const endDate = new Date(timeRange[1]);
        const startDay = startDate.getDate();
        const startMonth = startDate.getMonth() + 1;
        const startYear = startDate.getFullYear();
        const endDay = endDate.getDate();
        const endMonth = endDate.getMonth() + 1;
        const endYear = endDate.getFullYear();
        startFilename = `_${startYear}-${startMonth}-${startDay}`;
        endFilename = `_${endYear}-${endMonth}-${endDay}`;
        startSubtitle = `von ${startDay}.${startMonth}.${startYear}`;
        endSubtitle = `bis ${endDay}.${endMonth}.${endYear}`;
    }
    let weekdayFilename = '';
    let weekdaySubtitle = '';
    if (weekday) {
        const isMoFrSelected = document.querySelector('#mo-fr').checked;
        const isSaSoSelected = document.querySelector('#sa-so').checked;
        const weekday_param = isMoFrSelected && isSaSoSelected ? 'mo-so' : isMoFrSelected ? 'mo-fr' : 'sa-so';
        weekdayFilename = weekday_param === '' ? '' : `_${weekday_param}`;
        weekdaySubtitle = weekday_param === 'mo-fr' ? '(Werktage)' : weekday_param === 'sa-so' ? '(Wochenenden)' : '';
    }


    exporting.update({
        filename: `${filename_prefix}${typeFilename}${zstFilename}${startFilename}${endFilename}${weekdayFilename}`,
        sourceWidth: 960,
        sourceHeight: 540,
        chartOptions: {
            // Add subtitle with newline after the type
            subtitle: {
                text: `${zstSubtitle} ${typeSubtitle} ${startSubtitle} ${endSubtitle} ${weekdaySubtitle}`,
            },
            credits: {
                enabled: false
            }
        },
        menuItemDefinitions: {
            printChart: {
                text: 'Drucken',
            },
            downloadPNG: {
                text: 'Bild - PNG',
            },
            downloadJPEG: {
                text: 'Bild - JPEG',
            },
            downloadPDF: {
                text: 'Bild - PDF',
            },
            downloadSVG: {
                text: 'Bild - SVG',
            },
            downloadCSV: {
                text: 'Daten - CSV',
            },
            downloadXLSX: {
                text: 'Daten - XLSX',
                onclick: function () {
                    const div = document.createElement('div');
                    let name,
                        xlsxRows;
                    div.style.display = 'none';
                    document.body.appendChild(div);
                    const rows = this.getDataRows(true);
                    xlsxRows = rows.slice(1).map(function (row) {
                        return row.map(function (column) {
                            return {
                                type: typeof column === 'number' ? 'number' : 'string',
                                value: column
                            };
                        });
                    });

                    // Get the filename, copied from the Chart.fileDownload function
                    if (this.options.exporting.filename) {
                        name = this.options.exporting.filename;
                    } else if (this.title && this.title.textStr) {
                        name = this.title.textStr.replace(/ /g, '-').toLowerCase();
                    } else {
                        name = 'chart';
                    }

                    window.zipcelx({
                        filename: name,
                        sheet: {
                            data: xlsxRows
                        }
                    });
                }
            }
        },
        buttons: {
            contextButton: {
                menuItems: [
                    'printChart',
                    'separator',
                    'downloadPNG',
                    // For the map, do not show JPEG, since it can't download the tiles
                    map ? '' : 'downloadJPEG',
                    'downloadPDF',
                    'downloadSVG',
                    'separator',
                    'downloadCSV',
                    'downloadXLSX'
                ],
            },
        }
    });
}

export function updateState(board, type, strtyp, zst, fzgtyp, timeRange, zaehlstellen) {
    zst = populateZstDropdown(zaehlstellen, zst, strtyp);
    let isMoFrSelected = true;
    let isSaSoSelected = true;
    if (document.querySelector('#mo-fr')){ // Check if the radio buttons exist
        isMoFrSelected = document.querySelector('#mo-fr').checked;
        isSaSoSelected = document.querySelector('#sa-so').checked;
    }
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
        // params should give the feeling end-date is inclusive
        end_date: new Date(timeRange[1] - 24 * 3600 * 1000).toISOString().split('T')[0],
        weekday: weekday_param
    });
    updateStrassentypFilters(type);
    updateDatePickers(timeRange[0], timeRange[1]);
    updateZeiteinheitSelection(board, timeRange);
    return zst;
}

export function getStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const lastYear = new Date().getFullYear() - 1;

    return {
        activeType: params.get('traffic_type') || 'MIV',
        activeStrtyp: params.get('strtyp') || 'Alle',
        activeZst: params.get('zst_id') || 'default_station',
        activeFzgtyp: params.get('fzgtyp') || 'Total',
        activeTimeRange: [
            Date.parse(params.get('start_date')) || Date.parse(`${lastYear}-01-01`),
            // Params should give the feeling end-date is inclusive
            (Date.parse(params.get('end_date')) || Date.parse(`${lastYear}-12-31`)) + 24 * 3600 * 1000
        ],
        weekday: params.get('weekday') || 'mo-so'
    };
}

function updateUrlParams(params) {
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
    history.replaceState({}, '', `${url.pathname}${url.search}`);

    // Now update the nav links with the new query parameters
    const queryString = url.search; // e.g. '?traffic_type=MIV&...'
    const links = document.querySelectorAll('.navbar-links a.navbar-link');

    links.forEach(link => {
        // Get base href (strip any existing query parameters)
        let baseHref = link.getAttribute('href') || '';
        baseHref = baseHref.split('?')[0];

        // Append the new query string if it exists
        link.setAttribute('href', baseHref + queryString);
    });

    initializeFromUrlParams();
}


/**
 * This function initializes the UI elements based on the current URL state.
 * It sets the proper filters, dropdown values, and radio button selections
 * so that the UI immediately reflects what is in the URL parameters.
 */
function initializeFromUrlParams() {
    const currentState = getStateFromUrl();

    // Set initial filter (Type)
    const filterRadio = document.querySelector(`#filter-buttons input[name="filter"][value="${currentState.activeType}"]`);
    if (filterRadio) {
        filterRadio.checked = true;
    }

    // Set initial StrTyp radio button if different from 'Alle'
    if (currentState.activeStrtyp && currentState.activeStrtyp !== 'Alle') {
        const strTypRadio = document.querySelector(`.filter-options input[name="filter-strtyp"][value="${currentState.activeStrtyp}"]`);
        if (strTypRadio) {
            strTypRadio.checked = true;
        }
    }

    // Set initial Zaehlstelle in dropdown
    const zaehlstellenDropdown = document.getElementById('zaehlstellen-dropdown');
    if (zaehlstellenDropdown && currentState.activeZst) {
        zaehlstellenDropdown.value = currentState.activeZst;
    }

    // Set initial Fahrzeugtyp in dropdown
    const vehicleTypeDropdown = document.getElementById('vehicle-type-dropdown');
    if (vehicleTypeDropdown && currentState.activeFzgtyp) {
        vehicleTypeDropdown.value = currentState.activeFzgtyp;
    }
}

export function uncheckAllStrTyp() {
    const radios = document.querySelectorAll(`input[name="filter-strtyp"]`);
    radios.forEach(radio => {
        radio.checked = false;
    });
}


function updateDatePickers(min, max) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.value = new Date(min).toISOString().split('T')[0];
    // Datepicker should give the feeling end-date is inclusive
    endDateInput.value = new Date(max - 24 * 3600 * 1000).toISOString().split('T')[0];
}

// Helper function to clear "Zeitraum" selection
function updateZeiteinheitSelection(board, timeRange) {
    const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
    const dataMin = navigatorChart.xAxis[0].dataMin;
    const dataMax = navigatorChart.xAxis[0].dataMax;

    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        // Uncheck all radio buttons
        radio.checked = false;

        if (timeRange) {
            const [min, max] = timeRange;
            const minDate = new Date(min).toISOString().split('T')[0];
            const maxDate = new Date(max).toISOString().split('T')[0];

            switch (radio.value) {
                case '1 Tag':
                    if (max - min === 24 * 3600 * 1000) {
                        radio.checked = true;
                    }
                    break;
                case '1 Woche':
                    if (max - min === 7 * 24 * 3600 * 1000) {
                        radio.checked = true;
                    }
                    break;
                case '1 Monat':
                    // Match "YYYY-MM-DD" with one month difference
                    const monthRegex = new RegExp(`^${maxDate.split('-')[0]}-${(parseInt(maxDate.split('-')[1], 10) === 1 ? 12 : (parseInt(maxDate.split('-')[1], 10) - 1).toString().padStart(2, '0'))}-${maxDate.split('-')[2]}$`);
                    if (monthRegex.test(minDate)) {
                        radio.checked = true;
                    }
                    break;
                case '1 Jahr':
                    // Match "YYYY-MM-DD" with one year difference
                    const yearRegex = new RegExp(`^${(parseInt(maxDate.split('-')[0], 10) - 1)}-${maxDate.split('-')[1]}-${maxDate.split('-')[2]}$`);
                    if (yearRegex.test(minDate)) {
                        radio.checked = true;
                    }
                    break;
                case 'Alles':
                    if (min <= dataMin && max >= dataMax) {
                        radio.checked = true;
                    }
                    break;
                default:
                    break;
            }
        }
    });
}

function updateStrassentypFilters(activeType) {
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


export function toggleFahrzeugtypDropdown(type, fzgtyp) {
    const dropdownContainer = document.getElementById('vehicle-type-dropdown').closest('.filter-group');
    if (type === 'MIV') {
        dropdownContainer.style.display = 'flex'; // Show the dropdown
        return fzgtyp;
    } else {
        dropdownContainer.style.display = 'none'; // Hide the dropdown
        return 'Total'
    }
}


export function filterToSelectedTimeRange(dailyDataRows, timeRange) {
    const [start, end] = timeRange;
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Using Year and Month columns for filtering
    return dailyDataRows.filter(row => {
        const rowDate = new Date(row.Date);
        return rowDate >= startDate && rowDate < endDate;
    });
}


export function extractDailyTraffic(stationRows, fzgtyp) {
    const TrafficPerDay = {};
    let minDate = new Date('9999-12-31');
    let maxDate = new Date('0000-01-01');

    stationRows.forEach(row => {
        const dateTimestamp = new Date(row.Date);
        minDate = dateTimestamp < minDate ? dateTimestamp : minDate;
        maxDate = dateTimestamp > maxDate ? dateTimestamp : maxDate;

        // Convert date to ISO string for consistent key usage
        const dateKey = dateTimestamp.toISOString().split('T')[0]; // Use only the date part
        const totalTraffic = row[fzgtyp] || null; // Handle potential undefined/null values

        if (!TrafficPerDay[dateKey]) {
            TrafficPerDay[dateKey] = null;
        }
        if (!totalTraffic) return;
        TrafficPerDay[dateKey] += totalTraffic;
    });

    // Convert TrafficPerDay to the required format
    const dailyTraffic = Object.entries(TrafficPerDay).map(([date, total]) => {
        return [Date.parse(date), total];
    });

    return {dailyTraffic, minDate, maxDate};
}


export function extractDailyWeatherData(weatherRows, minDate, maxDate) {
    const dailyTemp = [];
    const dailyPrec = [];
    const dailyTempRange = [];

    weatherRows.forEach(row => {
        const date = new Date(row.Date);
        if (date < minDate || date > maxDate) return;

        const timestamp = Date.parse(date);
        const temp = row.temp_c || null;
        const prec = row.prec_mm || 0;
        const tempMin = row.temp_min || null;
        const tempMax = row.temp_max || null;

        // Push individual values
        dailyTemp.push([timestamp, temp]);
        dailyPrec.push([timestamp, prec]);
        dailyTempRange.push([timestamp, tempMin, tempMax]); // Combine min and max into a range
    });

    return { dailyTemp, dailyPrec, dailyTempRange };
}


export function extractMonthlyTraffic(monthlyDataRows, fzgtyp) {
    const monthlyTraffic = {};
    monthlyDataRows.forEach(row => {
        const date = new Date(row.Year, row.Month);
        if (!row[fzgtyp]) return;

        if (!monthlyTraffic[date]) {
            monthlyTraffic[date] = 0;
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
    let minYear = 9999;
    let maxYear = 0;
    const directionNames = new Set();

    stationRows.forEach(row => {
        const year = row.Year;
        const totalTraffic = row[fzgtyp];
        const numMeasures = row.NumMeasures;
        const directionName = row.DirectionName || 'Unknown';
        directionNames.add(directionName);

        if (!yearlyTraffic[year]) {
            yearlyTraffic[year] = {
                directions: {},
                allDirections: { total: 0, numMeasures: 0 }
            };
        }

        if (totalTraffic && !isNaN(totalTraffic)) {
            if (!yearlyTraffic[year].directions[directionName]) {
                yearlyTraffic[year].directions[directionName] = { total: 0, numMeasures: 0 };
            }

            yearlyTraffic[year].directions[directionName].total += totalTraffic;
            yearlyTraffic[year].directions[directionName].numMeasures = Math.max(yearlyTraffic[year].directions[directionName].numMeasures, numMeasures);

            yearlyTraffic[year].allDirections.total += totalTraffic;
            yearlyTraffic[year].allDirections.numMeasures = Math.max(yearlyTraffic[year].allDirections.numMeasures, numMeasures);

            minYear = Math.min(minYear, year);
            maxYear = Math.max(maxYear, year);
        }
    });

    const dailyAvgPerYearTotal = [];
    const dailyAvgPerYearByDirection = {};

    for (const dir of directionNames) {
        dailyAvgPerYearByDirection[dir] = [];
    }

    for (const year in yearlyTraffic) {
        const y = parseInt(year, 10);
        const baseDate = Date.UTC(y, 0, 1);

        // Track if any direction is null
        let hasNullInDirections = false;

        // Per direction
        for (const dir of directionNames) {
            const dirData = yearlyTraffic[year].directions[dir];
            const val = dirData && dirData.total > 0 ? dirData.total : null;

            // If we find a null in any direction, note it
            if (val === null) {
                hasNullInDirections = true;
            }
            dailyAvgPerYearByDirection[dir].push([baseDate, val]);
        }

        // If one direction is null, totalAll becomes null
        const totalAll = yearlyTraffic[year].allDirections.total;
        dailyAvgPerYearTotal.push([
            baseDate,
            hasNullInDirections ? null : (totalAll > 0 ? totalAll : null)
        ]);
    }


    // Sort arrays by date
    dailyAvgPerYearTotal.sort((a, b) => a[0] - b[0]);
    for (const dir in dailyAvgPerYearByDirection) {
        dailyAvgPerYearByDirection[dir].sort((a, b) => a[0] - b[0]);
    }

    // Number of days measured per year (for all directions)
    const numDaysPerYear = Object.entries(yearlyTraffic).map(([year, data]) => {
        const numDays = data.allDirections.numMeasures / 24;
        return [Date.UTC(year, 0, 1), numDays];
    });
    numDaysPerYear.sort((a, b) => a[0] - b[0]);

    return {
        dailyAvgPerYearTotal,
        dailyAvgPerYearByDirection,
        numDaysPerYear,
        directionNames: Array.from(directionNames),
        minYear,
        maxYear
    };
}

export function extractYearlyTemperature(temperatureRows, minYear, maxYear) {
    const yearlyTemperature = [];

    temperatureRows.forEach(row => {
        const year = row.Year;
        if (year < minYear || year > maxYear) return;
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

            // Loop through each hour of the day
            for (let hour = 0; hour < 24; hour++) {
                const total = parseFloat(row[hour] || null);

                // Skip if no valid traffic count
                if (!total || isNaN(total)) continue;

                // Create a unique key for this date, hour, and direction
                const key = `${hour}#${directionName}`;

                // Aggregate into hourlyTraffic
                if (!hourlyTraffic[key]) {
                    hourlyTraffic[key] = { total: null, days: 0 };
                }
                hourlyTraffic[key].total += total;
                hourlyTraffic[key].days += 1;
                directionNames.add(directionName);

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
                hourlyTotalsPerHourPerDirectionPerDate[directionName][dateStr][hour].push(total);

                // Build the total-per-date-per-hour structure
                if (!hourlyTotalsPerHourTotalPerDate[dateStr]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr] = {};
                }
                if (!hourlyTotalsPerHourTotalPerDate[dateStr][hour]) {
                    hourlyTotalsPerHourTotalPerDate[dateStr][hour] = [];
                }
                hourlyTotalsPerHourTotalPerDate[dateStr][hour].push(total);
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
        const [ hourStr, directionName] = key.split('#');
        const hour = parseInt(hourStr, 10);

        return {
            hour: Date.UTC(1970, 0, 1, hour),
            directionName,
            total: data.total,
            numberOfDays: data.days
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
        const total = row[fzgtyp];
        // Skip row if no valid traffic count
        if (!total || isNaN(total)) return;
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const weekday = (date.getDay() + 6) % 7; // Monday=0 ... Sunday=6
        const directionName = row.DirectionName;

        const isWeekday = weekday >= 0 && weekday <= 4; // Mon-Fri
        const isWeekend = weekday === 5 || weekday === 6; // Sat-Sun

        // Filter by Mo-Fr / Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${weekday}#${directionName}`;

            if (!weeklyTraffic[key]) {
                weeklyTraffic[key] = { total: 0, days: new Set() };
            }
            weeklyTraffic[key].total += total;
            weeklyTraffic[key].days.add(dateStr);
            directionNames.add(directionName);

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
            dailyTotalsPerWeekdayPerDirectionPerDate[directionName][dateStr][weekday].push(total);


            // Collect raw data total per date and weekday
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday]) {
                dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday] = [];
            }
            dailyTotalsPerWeekdayTotalPerDate[dateStr][weekday].push(total);
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
        const total = row[fzgtyp];
        // Skip row if no valid traffic count
        if (!total || isNaN(total)) return;
        const date = new Date(row.Date);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const month = date.getMonth(); // 0=January ... 11=December
        const weekday = date.getDay(); // Sunday=0 ... Saturday=6
        const directionName = row.DirectionName;

        const isWeekday = weekday >= 1 && weekday <= 5; // Monday to Friday
        const isWeekend = weekday === 0 || weekday === 6; // Sunday, Saturday

        // Filter by Mo-Fr and Sa-So
        if ((MoFr && isWeekday) || (SaSo && isWeekend)) {
            const key = `${month}#${directionName}`;

            if (!monthlyTraffic[key]) {
                monthlyTraffic[key] = { total: 0, days: new Set() };
            }
            monthlyTraffic[key].total += total;
            monthlyTraffic[key].days.add(dateStr);
            directionNames.add(directionName);

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
            dailyTotalsPerMonthPerDirectionPerDate[directionName][dateStr][month].push(total);

            // Collect raw data total per date and month
            if (!dailyTotalsPerMonthTotalPerDate[dateStr]) {
                dailyTotalsPerMonthTotalPerDate[dateStr] = {};
            }
            if (!dailyTotalsPerMonthTotalPerDate[dateStr][month]) {
                dailyTotalsPerMonthTotalPerDate[dateStr][month] = [];
            }
            dailyTotalsPerMonthTotalPerDate[dateStr][month].push(total);

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
 * - Temperature Range: Minimum and maximum temperatures per month
 *
 * @param {Object[]} dailyTempRows - Array of row objects for daily data
 * @param {[number, number]} timeRange - Array with two timestamps [start, end]
 * @returns {Object} An object containing arrays monthlyTemperatures, monthlyPrecipitations,
 *                   and monthlyTempRanges (index 0 = January, ..., 11 = December)
 */
export function aggregateMonthlyWeather(dailyTempRows, timeRange) {
    const startDate = new Date(timeRange[0]);
    const endDate = new Date(timeRange[1]);

    // Initialize accumulators for temperature, precipitation, and ranges
    const monthlyTempsAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0, min: Infinity, max: -Infinity }));
    const monthlyPrecipAccum = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));

    dailyTempRows.forEach(row => {
        // Parse the date from the row
        const date = new Date(row.Date);

        // Check if the date is within the specified time range
        if (date < startDate || date >= endDate) return;

        // Extract month index (0-based)
        const monthIndex = date.getMonth();

        // Parse temperature and precipitation
        const temp = parseFloat(row.temp_c);
        const precip = parseFloat(row.prec_mm);
        const tempMin = parseFloat(row.temp_min);
        const tempMax = parseFloat(row.temp_max);

        // Accumulate average temperature if valid
        if (!isNaN(temp)) {
            monthlyTempsAccum[monthIndex].sum += temp;
            monthlyTempsAccum[monthIndex].count += 1;
        }

        // Track minimum temperature for the month
        if (!isNaN(tempMin) && tempMin < monthlyTempsAccum[monthIndex].min) {
            monthlyTempsAccum[monthIndex].min = tempMin;
        }

        // Track maximum temperature for the month
        if (!isNaN(tempMax) && tempMax > monthlyTempsAccum[monthIndex].max) {
            monthlyTempsAccum[monthIndex].max = tempMax;
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

    // Compute monthly temperature range (min and max temperatures)
    const monthlyTempRange = monthlyTempsAccum.map(m => (m.count > 0 ? [m.min, m.max] : [null, null]));
    return { monthlyTemperatures, monthlyTempRange, monthlyPrecipitations};
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
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
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
        type: 'boxplot',
        color: '#6f6f6f'
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
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
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
        type: 'boxplot',
        color: '#6f6f6f'
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
                type: 'boxplot',
                color: ri === 'ri1' ? '#007a2f' : '#008ac3'
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
        type: 'boxplot',
        color: '#6f6f6f'
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
