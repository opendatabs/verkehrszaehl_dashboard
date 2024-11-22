import {gui} from './layout.js';
import {updateBoard} from './update.js';

setupBoard().then(r => console.log('Board setup complete'));
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
                id: 'MIV-Standorte',
                type: 'CSV',
                options: {
                    csvURL: './data/dtv_MIV_Class_10_1.csv'
                }
            }, {
                id: 'Velo-Standorte',
                type: 'CSV',
                options: {
                    csvURL: './data/dtv_Velo.csv'
                }
            }, {
                id: 'Fussgaenger-Standorte',
                type: 'CSV',
                options: {
                    csvURL: './data/dtv_Fussgaenger.csv'
                }
            }, {
                id: 'Monthly Traffic',
                type: 'JSON',
                options: {
                    dataModifier: {
                        'type': 'Math',
                    }
                }
            }, {
                id: 'Weekly Traffic',
                type: 'JSON',
                options: {
                    dataModifier: {
                        'type': 'Math',
                    }
                }
            }]
        },
        gui,
        components: [{
            cell: 'time-range-selector',
            type: 'Navigator',
            chartOptions: {
                chart: {
                    height: '100px',
                    type: 'line'
                },
                series: [{
                    name: 'DailyTraffic',
                    data: [
                        [Date.UTC(2000, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ]
                }, {
                    name: '7-Day Rolling Average',
                    data: [
                        [Date.UTC(2000, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ]
                }],
                xAxis: {
                    min: activeTimeRange[0],
                    max: activeTimeRange[1],
                    minRange: 30 * 24 * 3600 * 1000, // 30 days
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
                        <!--Verkehrsmittel -->
                        <div class="filter-group">
                            <h3>Verkehrsmittel</h3>
                            <input type="radio" id="filter-velo" name="filter" value="Velo">
                            <label for="filter-velo">
                                <img src="../../img/bicycle.png" alt="Velo" class="filter-icon"> Velo
                            </label>
                            <input type="radio" id="filter-fuss" name="filter" value="Fussgaenger">
                            <label for="filter-fuss">
                                <img src="../../img/pedestrian.png" alt="Fuss" class="filter-icon"> Fussgänger
                            </label>
                            <input type="radio" id="filter-miv" name="filter" value="MIV" checked>
                            <label for="filter-miv">
                                <img src="../../img/car.png" alt="MIV" class="filter-icon"> MIV
                            </label>
                        </div>
                        <!--Zählstelle -->
                        <h3>Zählstelle</h3>
                        <div class="custom-select">
                            <select id="counting-station-dropdown"></select>
                        </div>
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
                legend: {
                    enabled: true
                },
                mapView: {
                    projection: {
                        name: 'WebMercator' // Projection is required for custom URL
                    },
                    center: [7.589804, 47.560058],
                    zoom: 12
                },
                mapNavigation: {
                    enabled: true,
                    buttonOptions: {
                        alignTo: 'spacingBox'
                    }
                },
                series: [{
                    type: 'tiledwebmap',
                    name: 'Basemap Tiles',
                    provider: {
                        type: 'OpenStreetMap',
                        theme: 'Standard',
                        subdomain: 'a'
                    },
                    showInLegend: false
                }],
                credits: {
                    enabled: true,
                    text: 'Geoportal Kanton Basel-Stadt',
                    href: 'https://www.geo.bs.ch/'
                },
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
            cell: 'daily-traffic-by-year',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line', // Changed to line chart
                    height: '400px'
                },
                title: {
                    text: 'Tagesverkehr nach Jahr'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Tag'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Tagesverkehr (Anz. Fzg.)'
                    }
                },
                series: [],
                accessibility: {
                    description: 'A line chart showing daily traffic for the selected counting station.',
                    typeDescription: 'A line chart showing daily traffic trends.'
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
                tooltip: {
                    useHTML: true,
                    formatter: function () {
                        return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Jahr: <b>${Highcharts.dateFormat('%Y', this.x)}</b><br>
                                    Anzahl Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                               `;
                    },
                },
                title: {
                    text: 'Durchschnittlicher Tagesverkehr (DTV)'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Jahr'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Anz. Fzg.'
                    }
                },
                series: [{
                    name: 'Gesamtquerschnitt',
                    data: [], // Placeholder data, to be updated dynamically
                    marker: {
                        enabled: false
                    }
                }],
                accessibility: {
                    description: 'A line chart showing the average daily traffic (DTV) for the selected counting station.',
                    typeDescription: 'A line chart showing DTV trends over a range of years.'
                }
            }
        }, {
                renderTo: 'month-table',
                type: 'DataGrid',
                connector: {
                    id: 'Monthly Traffic'
                },
                sync: {
                    highlight: {
                        enabled: true,
                        autoScroll: true
                    }
                },
                dataGridOptions: {
                    editable: false,
                    header: [
                        {
                            columnId: "monat",
                        },
                        {
                            format: "Durchschnittlicher Tagesverkehr",
                            columns: [
                                "dtv_ri1",
                                "dtv_ri2",
                                "dtv_total",
                                "dtv_abweichung"
                            ]
                        }
                    ],
                    columns: [
                        {
                            id: 'monat',
                            header: {
                                format: 'Monate'
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
                            id: 'dtv_abweichung',
                            header: {
                                format: 'Abw. vom Durchschnitt'
                            },
                            // If null or undefined, display no percent
                            cells: {
                                format: '{value:.1f} %'
                            }
                        }
                    ],
                }
            },{
                cell: 'monthly-dtv-graph',
                type: 'Highcharts',
                connector: {
                    id: 'Monthly Traffic',
                    columnAssignment: [
                        {
                            seriesId: 'series-ri1',
                            data: 'dtv_ri1'
                        },
                        {
                            seriesId: 'series-ri2',
                            data: 'dtv_ri2'
                        },
                        {
                            seriesId: 'series-total',
                            data: 'dtv_total'
                        }
                    ]
                },
                sync: {
                    highlight: true
                },
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Monatsverkehr (DTV)'
                    },
                    xAxis: {
                        categories: [
                            'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
                        ],
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Fzg./Tag'
                        }
                    },
                    tooltip: {
                        useHTML: true,
                        formatter: function () {
                            return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Monat: <b>${this.x}</b><br>
                                    Anzahl Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                               `;
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
                            id: 'series-total',
                            name: 'Gesamtquerschnitt',
                            marker: {
                                enabled: false
                            }
                        }
                    ],
                    accessibility: {
                        description: 'A line chart showing the average monthly traffic (DMV) for the selected counting station.',
                        typeDescription: 'A line chart showing DMV trends over a range of years.'
                    }
                }
            },
            {
                cell: 'weekly-dtv-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'column',
                        height: '400px'
                    },
                    title: {
                        text: 'Durchschnittlicher Wochenverkehr (DTV)'
                    },
                    xAxis: {
                        categories: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], // Weekday categories
                        title: {
                            text: 'Wochentag'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anz. Fzg./Tag'
                        }
                    },
                    tooltip: {
                        useHTML: true,
                        formatter: function () {
                            return `
                                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                                    Wochentag: <b>${this.x}</b><br>
                                    Anzahl Fahrzeuge: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                               `;
                        }
                    },
                    series: [{
                        name: 'Gesamtquerschnitt',
                        data: [] // Placeholder data, to be updated dynamically with aggregateWeeklyTrafficPW()
                    }],
                    accessibility: {
                        description: 'A column chart showing the average weekly traffic for Personenwagen for each weekday (Mo to So).',
                        typeDescription: 'A column chart showing weekly Personenwagen traffic.'
                    }
                }
            }],
    }, true);
    const dataPool = board.dataPool;
    const MIVLocations = await dataPool.getConnectorTable('MIV-Standorte');
    const MIVLocationsRows = MIVLocations.getRowObjects();
    const VeloLocations = await dataPool.getConnectorTable('Velo-Standorte');
    const VeloLocationsRows = VeloLocations.getRowObjects();
    const FussLocations = await dataPool.getConnectorTable('Fussgaenger-Standorte');
    const FussLocationsRows = FussLocations.getRowObjects();

    // Helper function to set default counting station based on type
    function setDefaultCountingStation(type) {
        switch (type) {
            case 'Velo':
                activeCountingStation = '2280';
                break;
            case 'MIV':
                activeCountingStation = '404';
                break;
            case 'Fussgaenger':
                activeCountingStation = '802';
                break;
            default:
                activeCountingStation = '404'; // Default or fallback station
        }
    }

    // Initialize default counting station based on activeType
    setDefaultCountingStation(activeType);

    // Set up connectors for each counting station
    MIVLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `MIV-${row.Zst_id}-hourly`, // Unique ID based on type and ID_ZST
            type: 'CSV',
            options: {
                csvURL: `./data/MIV/${row.Zst_id}_hourly.csv` // Path based on folder and station ID
            }
        });
    });

    VeloLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `$Velo-${row.Zst_id}`, // Unique ID based on type and ID_ZST
            type: 'CSV',
            options: {
                csvURL: `./data/${row.TrafficType}/${row.Zst_id}_hourly.csv` // Path based on folder and station ID
            }
        });
    });

    FussLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `$Fussgaenger-${row.Zst_id}`, // Unique ID based on type and ID_ZST
            type: 'CSV',
            options: {
                csvURL: `./data/Fussgaenger/${row.Zst_id}_hourly.csv` // Path based on folder and station ID
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

    document.getElementById('counting-station-dropdown').addEventListener('change', async (event) => {
        activeCountingStation = event.target.value;
        isManualSelection = true; // Set manual selection flag
        await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
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

window.setupBoard = setupBoard;