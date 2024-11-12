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
                    <input type="radio" id="filter-velo" name="filter" value="Velo">
                    <label for="filter-velo">
                        <img src="./img/bicycle.png" alt="Velo" class="filter-icon"> Velo
                    </label>
                    <input type="radio" id="filter-fuss" name="filter" value="Fuss">
                    <label for="filter-fuss">
                        <img src="./img/pedestrian.png" alt="Fuss" class="filter-icon"> Fuss
                    </label>
                    <input type="radio" id="filter-miv" name="filter" value="MIV" checked>
                    <label for="filter-miv">
                        <img src="./img/car.png" alt="MIV" class="filter-icon"> MIV
                    </label>
                </div>
                `
        }, {
            cell: 'filter-section-2',
            type: 'HTML',
            html: `
                    <div id="day-range-buttons">
                        <input type="checkbox" id="mo-fr" value="Mo-Fr" checked>
                        <label for="mo-fr">Mo-Fr</label>
                        <input type="checkbox" id="sa-so" value="Sa-So" checked>
                        <label for="sa-so">Sa+So</label>
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
                        format: "Durchschnittlicher Tagesverkehr",
                        columns: [
                            "dtv_ri1",
                            "dtv_ri2",
                            "dtv_total",
                            "dtv_anteil"
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
                        },
                        cells: {
                            format: '{value:.0f}'
                        }
                    },
                    {
                        id: 'dtv_ri2',
                        header: {
                            format: 'Ri. II'
                        },
                        cells: {
                            format: '{value:.0f}'
                        }
                    },
                    {
                        id: 'dtv_total',
                        header: {
                            format: 'Ri. I+II'
                        },
                        cells: {
                            format: '{value:.0f}'
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
                    }
                ],
            }
        }, {
            cell: 'hourly-dtv-graph',
            type: 'Highcharts',
            connector: {
                id: 'Hourly Traffic',
                columnAssignment: [{
                    seriesId: 'series-ri1',
                    data: 'dtv_ri1'
                }, {
                    seriesId: 'series-ri2',
                    data: 'dtv_ri2'
                }, {
                    seriesId: 'series-gesamt',
                    data: 'dtv_total'
                }]
            },
            sync: {
                highlight: true
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
                tooltip: {
                    useHTML: true,
                    formatter: function () {
                        return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Stunde: <b>${this.point.category}</b><br>
                                    Anzahl Fahrzeuge pro Stunde: <b>${Highcharts.numberFormat(this.point.y, 0)}</b>
                               `;
                    },
                    shared: false
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
                        text: 'Anz. Fzg/h'
                    }
                },
                series: [
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
                    },
                    {
                        id: 'series-gesamt',
                        name: 'Gesamtquerschnitt',
                        marker: {
                            enabled: false
                        }
                    }],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) aggregated hourly for the selected counting station.',
                    typeDescription: 'A line chart showing DTV aggregated hourly.'
                }
            }
        },
            {
                cell: 'hourly-donut-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'pie',
                        height: '400px',
                        events: {
                            // Event handler for when the chart is loaded
                            load: function() {
                                var total = 0;
                                this.series[0].data.forEach(function(point) {
                                    total += point.y;
                                });
                                // Format the total with spaces as thousands separator
                                var formattedTotal = Highcharts.numberFormat(total, 0, '.', ' ');
                                // Create a label in the center of the donut chart with a newline after 'Gesamtquerschnitt'
                                if (!this.lbl) {
                                    this.lbl = this.renderer.text(
                                        'Gesamtquerschnitt:<br/>' + formattedTotal + ' Fzg. pro Tag <br/> 100%',
                                        this.plotWidth / 2 + this.plotLeft,
                                        this.plotHeight / 2 + this.plotTop - 20, // Adjusted vertical position
                                        true // Enable HTML rendering
                                    )
                                        .attr({
                                            align: 'center',
                                            zIndex: 10
                                        })
                                        .css({
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            textAlign: 'center' // Ensure center alignment
                                        })
                                        .add();
                                }
                            }
                        }
                    },
                    title: {
                        text: 'Anteil der Verkehrsrichtungen am Tagesverkehr'
                    },
                    plotOptions: {
                        pie: {
                            innerSize: '70%', // Increase inner size to make a larger hole
                            dataLabels: {
                                enabled: false,
                                format: '{point.name}: {point.y} ({point.percentage:.1f}%)',
                                distance: -40, // Negative distance to position labels inside slices
                                style: {
                                    fontSize: '14px',
                                    color: 'white',
                                    textOutline: 'none'
                                },
                                connectorWidth: 0, // Remove connector lines
                                crop: false,
                                overflow: 'none'
                            },
                            point: {
                                events: {
                                    // Event handler for when a segment is hovered over
                                    mouseOver: function() {
                                        var chart = this.series.chart;
                                        if (chart.lbl) {
                                            // Extract the number from the direction name
                                            var match = this.name.match(/\d+/); // Extract digits from the name
                                            var richtungNummer = match ? match[0] : this.name;
                                            // Format the value and percentage with spaces
                                            var formattedValue = Highcharts.numberFormat(this.y, 0, '.', ' ');
                                            var formattedPercentage = Highcharts.numberFormat(this.percentage, 1, '.', ' ');
                                            chart.lbl.attr({
                                                text: 'Richtung ' + richtungNummer + ':<br/>' + formattedValue + ' Fzg. pro Tag<br/>' + formattedPercentage + '%'
                                            });
                                        }
                                    },
                                    // Event handler for when the mouse leaves a segment
                                    mouseOut: function() {
                                        var chart = this.series.chart;
                                        var total = 0;
                                        chart.series[0].data.forEach(function(point) {
                                            total += point.y;
                                        });
                                        var formattedTotal = Highcharts.numberFormat(total, 0, '.', ' ');
                                        if (chart.lbl) {
                                            chart.lbl.attr({
                                                text: 'Gesamtquerschnitt:<br/>' + formattedTotal + ' Fzg. pro Tag<br/>100%'
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    },
                    series: [{
                        name: 'Traffic',
                        colorByPoint: true,
                        data: [] // Placeholder, updated dynamically in updateBoard
                    }],
                    accessibility: {
                        description: 'A donut chart showing the distribution of traffic directions over the day.',
                        point: {
                            valueDescriptionFormat: '{point.name}: {point.y}, {point.percentage:.1f}%.'
                        }
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
        'stunde': [], 'dtv_ri1': [], 'dtv_ri2': [], 'dtv_total': [], 'dtv_anteil': []
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
            await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
        });
    });

    document.querySelectorAll('#day-range-buttons input').forEach(button => {
        button.checked = true; // Ensure both are selected by default
        button.addEventListener('change', async (event) => {
            const moFr = document.querySelector('#mo-fr');
            const saSo = document.querySelector('#sa-so');

            // Ensure at least one button is always selected
            if (!moFr.checked && !saSo.checked) {
                event.target.checked = true; // Prevent unchecking the last selected button
            } else {
                // Update the board based on the new selection
                await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
            }
        });
    });

    // Load active counting station
    await updateBoard(board,
        activeCountingStation,
        true,
        activeType,
        activeTimeRange);
}
