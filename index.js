import {gui} from './Layout.js';
import {colorStopsTemperature, tempRange} from './Constants.js';
import {updateBoard} from './UpdateBoard.js';

let hourlyDTVChart, hourlyDWVChart;

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
                type: 'JSON',
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
                header: [
                    {
                        columnId: "stunde",
                    },
                    {
                        format: "Durchschnittlicher Tagesverkehr (Mo - So)",
                        columns: [
                            "dtv_ri1",
                            "dtv_ri2",
                            "dtv_total",
                            "dtv_anteil"
                        ]
                    },
                    {
                        format: "Durchschnittlicher Werktagesverkehr (Mo - Fr)",
                        columns: [
                            "dwv_ri1",
                            "dwv_ri2",
                            "dwv_total",
                            "dwv_anteil"
                        ]
                    }
                ],
                columns: [
                    {
                        id: 'stunde',
                        header: {
                            format: 'Stunden'
                        }
                    },
                    {
                        id: 'dtv_ri1',
                        header: {
                            format: 'Ri. I'
                        }
                    },
                    {
                        id: 'dtv_ri2',
                        header: {
                            format: 'Ri. II'
                        }
                    },
                    {
                        id: 'dtv_total',
                        header: {
                            format: 'Ri. I+II'
                        }
                    },
                    {
                        id: 'dtv_anteil',
                        header: {
                            format: 'Anteil Std. am Tag'
                        },
                        cells: {
                            format: '{value:.1f} %'
                        }
                    },
                    {
                        id: 'dwv_ri1',
                        header: {
                            format: 'Ri. I'
                        }
                    },
                    {
                        id: 'dwv_ri2',
                        header: {
                            format: 'Ri. II'
                        }
                    },
                    {
                        id: 'dwv_total',
                        header: {
                            format: 'Ri. I+II'
                        }
                    },
                    {
                        id: 'dwv_anteil',
                        header: {
                            format: 'Anteil Std. am Tag'
                        },
                        cells: {
                            format: '{value:.1f} %'
                        }
                    }
                ],
            }
        }, {
            cell: 'hourly-dtv-graph',
            type: 'Highcharts',
            connector: {
                id: 'Hourly Traffic',
                columnAssignment: [{
                    seriesId: 'series-gesamt',
                    data: 'dtv_total'
                }, {
                    seriesId: 'series-ri1',
                    data: 'dtv_ri1'
                }, {
                    seriesId: 'series-ri2',
                    data: 'dtv_ri2'
                }]
            },
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px',
                    events: {
                        load: function () {
                            hourlyDTVChart = this;
                        }
                    }
                },
                plotOptions: {
                    series: {
                        states: {
                            hover: {
                                enabled: true,
                                lineWidthPlus: 2,
                                halo: {
                                    size: 0
                                }
                            }
                        },
                        point: {
                            events: {
                                mouseOver: function () {
                                    const seriesId = this.series.options.id;
                                    if (hourlyDWVChart) {
                                        const otherSeries = hourlyDWVChart.get(seriesId);
                                        if (otherSeries) {
                                            otherSeries.points[this.index].setState('hover');
                                            hourlyDWVChart.tooltip.refresh([otherSeries.points[this.index]]);
                                        }
                                    }
                                },
                                mouseOut: function () {
                                    const seriesId = this.series.options.id;
                                    if (hourlyDWVChart) {
                                        const otherSeries = hourlyDWVChart.get(seriesId);
                                        if (otherSeries) {
                                            otherSeries.points[this.index].setState('');
                                            hourlyDWVChart.tooltip.hide();
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV)'
                },
                xAxis: {
                    categories: [
                        '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                        '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
                    ],
                    title: {
                        text: 'Stunde'
                    },
                    labels: {
                        rotation: -45,
                        step: 1
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Mfz/h'
                    }
                },
                series: [{
                    id: 'series-gesamt',
                    name: 'Gesamtquerschnitt',
                    marker: {
                        enabled: false
                    }
                },
                    {
                        id: 'series-ri1',
                        name: 'Richtung 1',
                        marker: {
                            enabled: false
                        }
                    },
                    {
                        id: 'series-ri2',
                        name: 'Richtung 2',
                        marker: {
                            enabled: false
                        }
                    }],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A line chart showing DTV aggregated hourly.'
                }
            }
        }, {
            cell: 'hourly-dwv-graph',
            type: 'Highcharts',
            id: 'hourly-dwv-graph', // Ensure the component has a unique ID
            connector: {
                id: 'Hourly Traffic',
                columnAssignment: [{
                    seriesId: 'series-gesamt',
                    data: 'dwv_total'
                }, {
                    seriesId: 'series-ri1',
                    data: 'dwv_ri1'
                },
                    {
                        seriesId: 'series-ri2',
                        data: 'dwv_ri2'
                    }]
            },
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px',
                    events: {
                        load: function () {
                            hourlyDWVChart = this;
                        }
                    }
                },
                plotOptions: {
                    series: {
                        states: {
                            hover: {
                                enabled: true,
                                lineWidthPlus: 2,
                                halo: {
                                    size: 0
                                }
                            }
                        },
                        point: {
                            events: {
                                mouseOver: function () {
                                    const seriesId = this.series.options.id;
                                    if (hourlyDTVChart) {
                                        const otherSeries = hourlyDTVChart.get(seriesId);
                                        if (otherSeries) {
                                            console.log(otherSeries.points[this.index]);
                                            otherSeries.points[this.index].setState('hover');
                                            hourlyDTVChart.tooltip.refresh([otherSeries.points[this.index]]);
                                        }
                                    }
                                },
                                mouseOut: function () {
                                    const seriesId = this.series.options.id;
                                    if (hourlyDTVChart) {
                                        const otherSeries = hourlyDTVChart.get(seriesId);
                                        if (otherSeries) {
                                            otherSeries.points[this.index].setState('');
                                            hourlyDTVChart.tooltip.hide();
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                title: {
                    text: 'Durchschnittlicher Werktagesverkehr (DWV)'
                },
                xAxis: {
                    categories: [
                        '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                        '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                        '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
                    ],
                    title: {
                        text: 'Stunde'
                    },
                    labels: {
                        rotation: -45,
                        step: 1
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Mfz/h'
                    }
                },
                series: [{
                    id: 'series-gesamt',
                    name: 'Gesamtquerschnitt',
                    marker: {
                        enabled: false
                    }
                },
                    {
                        id: 'series-ri1',
                        name: 'Richtung 1',
                        marker: {
                            enabled: false
                        }
                    },
                    {
                        id: 'series-ri2',
                        name: 'Richtung 2',
                        marker: {
                            enabled: false
                        }
                    }],
                accessibility: {
                    description: 'A step line chart showing the average daily (for working days) traffic (DWV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A step line chart showing DWV aggregated hourly.'
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
        'stunde': [], 'dtv_ri1': [], 'dtv_ri2': [], 'dtv_total': [], 'dtv_anteil': [],
        'dwv_ri1': [], 'dwv_ri2': [], 'dwv_total': [], 'dwv_anteil': [],
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
