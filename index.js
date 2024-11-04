import {gui} from './Layout.js';
import {colorStopsTemperature, tempRange, KPIChartOptions} from './Constants.js';
import {updateBoard} from './UpdateBoard.js';

setupBoard();

async function setupBoard() {
    let activeCountingStation = '404',
        activeTimeRange = [ // default to a year
            Date.UTC(2023, 1, 1, 0, 0, 1),
            Date.UTC(2023, 12, 31)
        ],
        activeType = 'MIV',
        isManualSelection = false;

    // Initialize board with most basic data
    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [{
                id: 'Range Selection',
                type: 'CSV',
                options: {
                    dataModifier: {
                        type: 'Range'
                    }
                }
            }, {
                id: 'Counting Stations',
                type: 'CSV',
                options: {
                    csvURL: (
                        './data/100038.csv'
                    )
                }
            }, {
                id: 'Hourly Traffic',
                type: 'CSV',
                options: {
                    dataModifier: {
                        'type': 'Math',
                    }
                }
            }]
        },
        editMode: {
            enabled: true,
            contextMenu: {
                enabled: true,
                icon: (
                    'https://code.highcharts.com/dashboards/gfx/' +
                    'dashboards-icons/menu.svg'
                ),
                items: [
                    'editMode',
                ]
            }
        },
        gui,
        components: [{
            cell: 'time-range-selector',
            type: 'Navigator',
            chartOptions: {
                chart: {
                    height: '80px',
                    type: 'spline'
                },
                series: [{
                    name: 'Timeline',
                    data: [
                        [Date.UTC(2000, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ]
                }],
                xAxis: {
                    min: activeTimeRange[0],
                    max: activeTimeRange[1],
                    minRange: 30 * 24 * 3600 * 1000, // 30 days
                    maxRange: 2 * 365 * 24 * 3600 * 1000, // 2 years
                    events: {
                        afterSetExtremes: async function (e) {
                            const min = Math.round(e.min);
                            const max = Math.round(e.max);

                            if (activeTimeRange[0] !== min || activeTimeRange[1] !== max) {
                                activeTimeRange = [min, max];
                                await updateBoard(
                                    board,
                                    activeCountingStation,
                                    true,
                                    activeType,
                                    activeTimeRange
                                ); // Refresh board on range change
                            }
                        }
                    }
                }
            }
        }, {
            cell: 'filter-section',
            type: 'HTML',
            html: `
                <div id="filter-buttons">
                    <label>
                        <input type="radio" name="filter" value="Velo">
                        <img src="./img/bicycle.png" alt="Velo" class="filter-icon"> Velo
                    </label>
                    <label>
                        <input type="radio" name="filter" value="Fuss">
                        <img src="./img/pedestrian.png" alt="Fuss" class="filter-icon"> Fuss
                    </label>
                    <label>
                        <input type="radio" name="filter" value="MIV" checked>
                        <img src="./img/car.png" alt="MIV" class="filter-icon"> MIV
                    </label>
                </div>
                `
        }, {
            cell: 'world-map',
            type: 'Highcharts',
            chartConstructor: 'mapChart',
            chartOptions: {
                chart: {
                    margin: 0
                },
                colorAxis: {
                    startOnTick: false,
                    endOnTick: false,
                    max: tempRange.maxC,
                    min: tempRange.minC,
                    stops: colorStopsTemperature
                },
                legend: {
                    enabled: false
                },
                navigation: {
                    buttonOptions: {
                        align: 'left',
                        theme: {
                            stroke: '#e6e6e6'
                        }
                    }
                },
                mapNavigation: {
                    enabled: true,
                    buttonOptions: {
                        alignTo: 'spacingBox'
                    }
                },
                mapView: {
                    center: [7.589804, 47.560058],
                    zoom: 13
                },
                series: [{
                    type: 'tiledwebmap',
                    name: 'Basemap Tiles',
                    provider: {
                        type: 'OpenStreetMap'
                    },
                    showInLegend: false
                }, {
                    type: 'mappoint',
                    name: 'Counting Stations',
                    data: [], // Placeholder for initial counting stations data
                    point: {
                        events: {
                            click: async function (e) {
                                activeCountingStation = e.point.id; // Set active counting station
                                isManualSelection = true; // Indicate manual selection
                                await updateBoard(board,
                                    activeCountingStation,
                                    true,
                                    activeType,
                                    activeTimeRange);
                            }
                        }
                    },
                    marker: {
                        enabled: true,
                        lineWidth: 2,
                        radius: 12,
                        states: {
                            hover: {
                                lineWidthPlus: 4,
                                radiusPlus: 0
                            },
                            select: {
                                lineWidthPlus: 4,
                                radiusPlus: 2
                            }
                        },
                        symbol: 'mapmarker'
                    },
                    tooltip: {
                        pointFormat: '{point.name}: {point.zweck}<br><span style="color: {point.color}">●</span> {point.zweck}'
                    }
                }],
                title: {
                    text: void 0
                },
                tooltip: {
                    shape: 'rect',
                    distance: -60,
                    useHTML: true,
                    stickOnContact: true
                },
                lang: {
                    accessibility: {
                        chartContainerLabel: 'Counting stations in Basel. Highcharts Interactive Map.'
                    }
                },
                accessibility: {
                    description: `The chart is displaying counting stations in Basel.`,
                    point: {
                        valueDescriptionFormat: '{index}. {point.name}, {point.lat}, {point.lon}.'
                    }
                }
            }
        }, {
            cell: 'dtv-graph',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line', // Changed to line chart
                    height: '400px'
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV)'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Year'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Durchschnittlicher Tagesverkehr'
                    }
                },
                series: [{
                    name: 'Durchschnittlicher Tagesverkehr',
                    data: [] // Placeholder data, to be updated dynamically
                }],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) for the selected counting station.',
                    typeDescription: 'A line chart showing DTV trends over a range of years.'
                }
            }
        }, {
            renderTo: 'hour-table',
            type: 'DataGrid',
            connector: {
                id: 'Hourly Traffic'
            },
            sync: {
                highlight: true
            },
            dataGridOptions: {
                editable: false,
                columns: [
                    {
                        id: 'stunde',
                        header: {
                            format: 'Stunde'
                        }
                    },
                    {
                        id: 'dtv_ri1',
                        header: {
                            format: 'Richtung I'
                        }
                    },
                    {
                        id: 'dtv_ri2',
                        header: {
                            format: 'Richtung II'
                        }
                    },
                    {
                        id: 'dtv_total',
                        header: {
                            format: 'beide Richtungen'
                        }
                    },
                    {
                        id: 'dtv_anteil',
                        header: {
                            format: 'Anteil Std. am Tag'
                        }
                    },
                    {
                        id: 'dwv_ri1',
                        header: {
                            format: 'Richtung I'
                        }
                    },
                    {
                        id: 'dwv_ri2',
                        header: {
                            format: 'Richtung II'
                        }
                    },
                    {
                        id: 'dwv_total',
                        header: {
                            format: 'beide Richtungen'
                        }
                    },
                    {
                        id: 'dwv_anteil',
                        header: {
                            format: 'Anteil Std. am Tag'
                        }
                    }
                ],
            }
        }, {
            cell: 'hourly-dtv-graph',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV)'
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: {
                        hour: '%H' // Only show hours like 01, 03, 05, etc.
                    },
                    tickInterval: 2 * 3600 * 1000, // Two-hour interval in milliseconds
                    labels: {
                        formatter: function () {
                            return Highcharts.dateFormat('%H', this.value); // Format only hours
                        }
                    },
                    title: {
                        text: 'Stunde'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Mfz/h'
                    }
                },
                series: [{
                    name: 'Gesamtquerschnitt',
                    data: [] // Placeholder data, to be updated dynamically
                },
                    {
                        name: '1 nach Bahnhof SBB (1 FS mit ÖV-Bus)',
                        data: [] // Placeholder data, to be updated dynamically
                    },
                    {
                        name: '2 von Bahnhof SBB (1 FS mit ÖV-Bus)',
                        data: [] // Placeholder data, to be updated dynamically
                    }
                ],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A line chart showing DTV aggregated hourly.'
                }
            }
        }, {
            cell: 'hourly-dwv-graph',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                title: {
                    text: 'Durchschnittlicher Werktagesverkehr (DWV)'
                },
                xAxis: {
                    type: 'datetime',
                    dateTimeLabelFormats: {
                        hour: '%H' // Only show hours like 01, 03, 05, etc.
                    },
                    tickInterval: 2 * 3600 * 1000, // Two-hour interval in milliseconds
                    labels: {
                        formatter: function () {
                            return Highcharts.dateFormat('%H', this.value); // Format only hours
                        }
                    },
                    title: {
                        text: 'Stunde'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Mfz/h'
                    }
                },
                series: [{
                    name: 'Gesamtquerschnitt',
                    data: [] // Placeholder data, to be updated dynamically
                },
                    {
                        name: '1 nach Bahnhof SBB (1 FS mit ÖV-Bus)',
                        data: [] // Placeholder data, to be updated dynamically
                    },
                    {
                        name: '2 von Bahnhof SBB (1 FS mit ÖV-Bus)',
                        data: [] // Placeholder data, to be updated dynamically
                    }
                ],
                accessibility: {
                    description: 'A line chart showing the average daily (for working days) traffic (DTV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A line chart showing DTV aggregated hourly.'
                }
            }
        },
            {
                cell: 'monthly-dtv-graph',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Tagesverkehr (DTV)'
                    },
                    xAxis: {
                        type: 'datetime',
                        tickInterval: 30 * 24 * 3600 * 1000, // Tick every month (approx 30 days)
                        labels: {
                            formatter: function () {
                                return Highcharts.dateFormat('%b', this.value); // Display short month names (Jan, Feb, etc.)
                            }
                        },
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Mfz/24h'
                        }
                    },
                    series: [{
                        name: 'Durchschnittlicher Tagesverkehr',
                        data: [] // Placeholder data, to be updated dynamically
                    }],
                    accessibility: {
                        description: 'A line chart showing the average monthly traffic (DMV) for the selected counting station.',
                        typeDescription: 'A line chart showing DMV trends over a range of years.'
                    }
                }
            },
            {
                cell: 'monthly-dwv-graph',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Werktagesverkehr (DWV)'
                    },
                    xAxis: {
                        type: 'datetime',
                        tickInterval: 30 * 24 * 3600 * 1000, // Tick every month (approx 30 days)
                        labels: {
                            formatter: function () {
                                return Highcharts.dateFormat('%b', this.value); // Display short month names (Jan, Feb, etc.)
                            }
                        },
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Mfz/24h'
                        }
                    },
                    series: [{
                        name: 'Durchschnittlicher Werktagesverkehr',
                        data: [] // Placeholder data, to be updated dynamically
                    }],
                    accessibility: {
                        description: 'A line chart showing the average monthly traffic (DMV) for the selected counting station.',
                        typeDescription: 'A line chart showing DMV trends over a range of years.'
                    }
                }
            },
            {
                cell: 'weekly-pw-graph',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Wochenverkehr (Personenwagen)'
                    },
                    xAxis: {
                        categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], // Weekday categories
                        title: {
                            text: 'Wochentag'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Personenwagen/Tag'
                        }
                    },
                    series: [{
                        name: 'Durchschnittlicher Personenwagenverkehr',
                        data: [] // Placeholder data, to be updated dynamically with aggregateWeeklyTrafficPW()
                    }],
                    accessibility: {
                        description: 'A column chart showing the average weekly traffic for Personenwagen for each weekday (Mo to So).',
                        typeDescription: 'A column chart showing weekly Personenwagen traffic.'
                    }
                }
            }, {
                cell: 'weekly-lw-graph',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Wochenverkehr (Lastwagen)'
                    },
                    xAxis: {
                        categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], // Weekday categories
                        title: {
                            text: 'Wochentag'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Lastwagen/Tag'
                        }
                    },
                    series: [{
                        name: 'Durchschnittlicher Lastwagenverkehr',
                        data: [] // Placeholder data, to be updated dynamically with aggregateWeeklyTrafficLW()
                    }],
                    accessibility: {
                        description: 'A column chart showing the average weekly traffic for Lastwagen for each weekday (Mo to So).',
                        typeDescription: 'A column chart showing weekly Lastwagen traffic.'
                    }
                }
            }],
    }, true);
    const dataPool = board.dataPool;
    const countingStationsTable = await dataPool.getConnectorTable('Counting Stations');
    const hourlyTraffic = await dataPool.getConnectorTable('Hourly Traffic');
    const countingStationRows = countingStationsTable.getRowObjects();

    hourlyTraffic.setColumns({
        'stunde': ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
            '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
            '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', 'Total', '%'],
        'dtv_ri1': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            '=SUM(B1:B24)', '=B25/D25*100'],
        'dtv_ri2': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            '=SUM(C1:C24)', '=C25/D25*100'],
        'dtv_total': ['=SUM(B1:C1)', '=SUM(B2:C2)', '=SUM(B3:C3)', '=SUM(B4:C4)', '=SUM(B5:C5)',
            '=SUM(B6:C6)', '=SUM(B7:C7)', '=SUM(B8:C8)', '=SUM(B9:C9)', '=SUM(B10:C10)',
            '=SUM(B11:C11)', '=SUM(B12:C12)', '=SUM(B13:C13)', '=SUM(B14:C14)', '=SUM(B15:C15)',
            '=SUM(B16:C16)', '=SUM(B17:C17)', '=SUM(B18:C18)', '=SUM(B19:C19)', '=SUM(B20:C20)',
            '=SUM(B21:C21)', '=SUM(B22:C22)', '=SUM(B23:C23)', '=SUM(B24:C24)',
            '=SUM(D1:D24)', '=D25/D25*100'],
        'dtv_anteil': ['=D1/D25*100', '=D2/D25*100', '=D3/D25*100', '=D4/D25*100', '=D5/D25*100', '=D6/D25*100',
            '=D7/D25*100', '=D8/D25*100', '=D9/D25*100', '=D10/D25*100', '=D11/D25*100', '=D12/D25*100',
            '=D13/D25*100', '=D14/D25*100', '=D15/D25*100', '=D16/D25*100', '=D17/D25*100', '=D18/D25*100',
            '=D19/D25*100', '=D20/D25*100', '=D21/D25*100', '=D22/D25*100', '=D23/D25*100', '=D24/D25*100',
            '=D25/D25*100', ''],
        'dwv_ri1': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            '=SUM(F1:F24)', '=F25/H25*100'],
        'dwv_ri2': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            '=SUM(G1:G24)', '=G25/H25*100'],
        'dwv_total': ['=SUM(F1:G1)', '=SUM(F2:G2)', '=SUM(F3:G3)', '=SUM(F4:G4)', '=SUM(F5:G5)',
            '=SUM(F6:G6)', '=SUM(F7:G7)', '=SUM(F8:G8)', '=SUM(F9:G9)', '=SUM(F10:G10)',
            '=SUM(F11:G11)', '=SUM(F12:G12)', '=SUM(F13:G13)', '=SUM(F14:G14)', '=SUM(F15:G15)',
            '=SUM(F16:G16)', '=SUM(F17:G17)', '=SUM(F18:G18)', '=SUM(F19:G19)', '=SUM(F20:G20)',
            '=SUM(F21:G21)', '=SUM(F22:G22)', '=SUM(F23:G23)', '=SUM(F24:G24)',
            '=SUM(H1:H24)', '=H25/H25*100'],
        'dwv_anteil': ['=H1/H25*100', '=H2/H25*100', '=H3/H25*100', '=H4/H25*100', '=H5/H25*100', '=H6/H25*100',
            '=H7/H25*100', '=H8/H25*100', '=H9/H25*100', '=H10/H25*100', '=H11/H25*100', '=H12/H25*100',
            '=H13/H25*100', '=H14/H25*100', '=H15/H25*100', '=H16/H25*100', '=H17/H25*100', '=H18/H25*100',
            '=H19/H25*100', '=H20/H25*100', '=H21/H25*100', '=H22/H25*100', '=H23/H25*100', '=H24/H25*100',
            '=H25/H25*100', ''],
    })

    // Helper function to set default counting station based on type
    function setDefaultCountingStation(type) {
        switch (type) {
            case 'Velo':
                activeCountingStation = '2280';
                break;
            case 'MIV':
                activeCountingStation = '404';
                break;
            case 'Fuss':
                activeCountingStation = '802';
                break;
            default:
                activeCountingStation = '404'; // Default or fallback station
        }
    }

    // Initialize default counting station based on activeType
    setDefaultCountingStation(activeType);

    // Add counting station sources based on ZWECK field and corresponding folder
    countingStationRows.forEach(row => {
        const {ZWECK, ID_ZST} = row;
        const types = ZWECK.split('+').map(type => type.trim()); // Split and trim each type

        types.forEach(type => {
            let folder = '';

            // Determine folder path based on each type
            if (type.includes('MIV')) {
                folder = 'MIV';
            } else if (type.includes('Fuss')) {
                folder = 'Fussgaenger';
            } else if (type.includes('Velo')) {
                folder = 'Velo';
            }

            // Only proceed if folder is set (i.e., type matches one of the categories)
            if (folder) {
                dataPool.setConnectorOptions({
                    id: `${type}-${ID_ZST}`, // Unique ID based on type and ID_ZST
                    type: 'CSV',
                    options: {
                        csvURL: `./data/${folder}/${ID_ZST}.csv` // Path based on folder and station ID
                    }
                });
            }
        });
    });

    // Listen for filter (type) changes
    document.querySelectorAll('#filter-buttons input[name="filter"]').forEach(filterElement => {
        filterElement.addEventListener('change', async (event) => {
            activeType = event.target.value; // Capture the selected filter value
            isManualSelection = false; // Reset manual selection flag on type change
            setDefaultCountingStation(activeType); // Set default station for new type
            await updateBoard(board,
                activeCountingStation,
                true,
                activeType,
                activeTimeRange); // Update the board with the new filter and default station
        });
    });

    // Load active counting station
    await updateBoard(board,
        activeCountingStation,
        true,
        activeType,
        activeTimeRange);
}
