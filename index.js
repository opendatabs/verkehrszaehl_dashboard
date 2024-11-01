import { colorStopsTemperature, tempRange, KPIChartOptions } from './Constants.js';
import { updateBoard } from './UpdateBoard.js';

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
        gui: {
            layouts: [{
                rows: [{
                    cells: [{
                        id: 'filter-section'
                    }]
                },{
                    cells: [{
                        id: 'world-map',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'dtv-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }]
                },{
                    cells: [{
                        id: 'time-range-selector'
                    }]
                }, {
                    cells: [{
                        id: 'hour-table',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'hourly-dtv-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'hourly-dwv-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }]
                }, {
                    cells: [{
                        id: 'month-table',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'monthly-dtv-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    },
                    {
                        id: 'monthly-dwv-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }]
                },
                {
                    cells: [{
                        id: 'weekly-table',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'weekly-pw-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }, {
                        id: 'weekly-lw-graph',
                        responsive: {
                            large: {
                                width: '1/2'
                            },
                            medium: {
                                width: '100%'
                            },
                            small: {
                                width: '100%'
                            }
                        }
                    }]
                }]
            }]
        },
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
        },
        //     {
        //     renderTo: 'hour-table', // Adjust to your table's render target ID
        //     type: 'DataGrid',
        //     connector: {
        //         id: 'Range Selection'
        //     },
        //     sync: {
        //         highlight: true
        //     },
        //     dataGridOptions: {
        //         cellHeight: 38,
        //             editable: false,
        //             columns: {
        //             time: {
        //                 headerFormat: 'Hour'
        //             },
        //             dtv_richtung1: {
        //                 headerFormat: 'DTV - 1 nach Bahnhof SBB (1 FS mit ÖV-Bus)'
        //             },
        //             dtv_richtung2: {
        //                 headerFormat: 'DTV - 2 von Bahnhof SBB (1 FS mit ÖV-Bus)'
        //             },
        //             dtv_gesamt: {
        //                 headerFormat: 'DTV - Gesamtquerschnitt'
        //             },
        //             dwv_richtung1: {
        //                 headerFormat: 'DWV - 1 nach Bahnhof SBB (1 FS mit ÖV-Bus)'
        //             },
        //             dwv_richtung2: {
        //                 headerFormat: 'DWV - 2 von Bahnhof SBB (1 FS mit ÖV-Bus)'
        //             },
        //             dwv_gesamt: {
        //                 headerFormat: 'DWV - Gesamtquerschnitt'
        //             }
        //         }
        //     }
        // },
            {
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
                        formatter: function() {
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
        },
        {
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
                        formatter: function() {
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
                        formatter: function() {
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
                        formatter: function() {
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
        },{
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
    const countingStationRows = countingStationsTable.getRowObjects();

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
        const { ZWECK, ID_ZST } = row;
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
