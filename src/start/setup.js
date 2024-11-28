import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {clearZeiteinheitSelection} from '../functions.js';
import {getCommonConnectors} from '../common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../common_components.js";

export default async function setupBoard(params) {
    const {
        traffic_type,
        zst_id,
        start_date,
        end_date,
        weekday,
    } = params;

    let activeTimeRange = [
        Date.parse(start_date),
        Date.parse(end_date)
    ];
    let activeType = traffic_type;

    // Initialize board with most basic data
    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors(),
            {
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
        components: [
            getFilterComponent(),
        {
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
                cell: 'dtv-chart',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'line', // Main chart type is line
                        height: '400px'
                    },
                    tooltip: {
                        useHTML: true,
                        formatter: function () {
                            if (this.series.name === 'Verfügbarkeit') {
                                return `
                        <b style="color:${this.series.color}">${this.series.name}</b><br>
                        Jahr: <b>${Highcharts.dateFormat('%Y', this.x)}</b><br>
                        Anzahl gemessene Tage: <b>${Highcharts.numberFormat(this.y, 0)}</b>
                    `;
                            }
                            // Default tooltip for other series
                            return `
                    <b style="color:${this.series.color}">${this.series.name}</b><br>
                    Jahr: <b>${Highcharts.dateFormat('%Y', this.x)}</b><br>
                    Anzahl Fahrzeuge pro Tag: <b>${Highcharts.numberFormat(this.y, 0)}</b>
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
                    yAxis: [
                        {
                            // Primary Y-axis for "Anz. Fzg."
                            title: {
                                text: 'Anz. Fzg. por Tag'
                            },
                            min: 0
                        },
                        {
                            // Secondary Y-axis for "Verfügbarkeit"
                            title: {
                                text: 'Anzahl gemessene Tage'
                            },
                            opposite: true, // Place on the opposite side of the chart
                            max: 2000,
                            labels: {
                                enabled: false // Disable labels for this axis
                            }
                        }
                    ],
                    series: [
                        {
                            name: 'Gesamtquerschnitt',
                            data: [],
                            marker: {
                                enabled: false
                            }
                        },
                        {
                            name: 'Verfügbarkeit',
                            type: 'column',
                            data: [],
                            marker: {
                                enabled: false,
                            },
                            yAxis: 1 // Link this series to the secondary Y-axis
                        }
                    ],
                    accessibility: {
                        description: 'A line chart showing the average daily traffic (DTV) for the selected counting station.',
                        typeDescription: 'A line chart showing DTV trends over a range of years.'
                    }
                }
            },{
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
                        [Date.UTC(2014, 1, 1), 0],
                        [Date.UTC(2024, 3, 10), 0]
                    ],
                    connectNulls: false
                }],
                xAxis: {
                    min: activeTimeRange[0],
                    max: activeTimeRange[1],
                    minRange: 30 * 24 * 3600 * 1000, // 30 days
                    events: {
                        afterSetExtremes: async function (e) {
                            const min = Math.round(e.min);
                            const max = Math.round(e.max);

                            // Uncheck "Zeitraum" options
                            clearZeiteinheitSelection();
                            if (activeTimeRange[0] !== min || activeTimeRange[1] !== max) {
                                activeTimeRange = [min, max];
                                await updateBoard(
                                    board,
                                    activeCountingStation,
                                    true,
                                    activeType,
                                    activeTimeRange
                                );
                            }
                        }
                    }
                }
            }
        },
            getDayRangeButtonsComponent(weekday),
        {
            cell: 'tv-chart',
            type: 'Highcharts',
            chartOptions: {
                chart: {
                    type: 'line',
                    height: '400px'
                },
                title: {
                    text: 'Tagesverkehr'
                },
                xAxis: {
                    type: 'datetime',
                    title: {
                        text: 'Datum'
                    },
                    min: activeTimeRange[0],
                    max: activeTimeRange[1]
                },
                yAxis: {
                    title: {
                        text: 'Anzahl Fahrzeuge'
                    }
                },
                tooltip: {
                    shared: true, // This allows multiple series to share the tooltip
                    formatter: function() {
                        const date = Highcharts.dateFormat('%A, %b %e, %Y', this.x);
                        let tooltipText = `<b>${date}</b><br/>`;
                        this.points.forEach(point => {
                            tooltipText += `<span style="color:${point.series.color}">\u25CF</span> ${point.series.name}: <b>${Highcharts.numberFormat(point.y, 0, ',', '.')}</b><br/>`;
                        });
                        return tooltipText;
                    }
                },
                series: [
                    {
                        name: 'Anzahl Fahrzeuge',
                        data: [],
                        marker: {
                            enabled: false
                        },
                        connectNulls: false
                    },
                    {
                        name: '7-Tage gleitender Durchschnitt',
                        data: [],
                        marker: {
                            enabled: false
                        },
                        connectNulls: false
                    }
                ]
            }
        }]
    }, true);

    const dataPool = board.dataPool;
    const MIVLocations = await dataPool.getConnectorTable('MIV-Standorte');
    const MIVLocationsRows = MIVLocations.getRowObjects();
    const VeloLocations = await dataPool.getConnectorTable('Velo-Standorte');
    const VeloLocationsRows = VeloLocations.getRowObjects();
    const FussLocations = await dataPool.getConnectorTable('Fussgaenger-Standorte');
    const FussLocationsRows = FussLocations.getRowObjects();


    // Set up connectors for each counting station
    MIVLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `MIV-${row.Zst_id}-daily`,
            type: 'CSV',
            options: {
                csvURL: `./data/MIV/${row.Zst_id}_daily.csv`
            }
        });
        dataPool.setConnectorOptions({
            id: `MIV-${row.Zst_id}-yearly`,
            type: 'CSV',
            options: {
                csvURL: `./data/MIV/${row.Zst_id}_yearly.csv`
            }
        });
    });

    VeloLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `Velo-${row.Zst_id}-daily`,
            type: 'CSV',
            options: {
                csvURL: `./data/Velo/${row.Zst_id}_daily.csv`
            }
        });
        dataPool.setConnectorOptions({
            id: `Velo-${row.Zst_id}-yearly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Velo/${row.Zst_id}_yearly.csv`
            }
        });
    });

    FussLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `Fussgaenger-${row.Zst_id}-daily`,
            type: 'CSV',
            options: {
                csvURL: `./data/Fussgaenger/${row.Zst_id}_daily.csv`
            }
        });
        dataPool.setConnectorOptions({
            id: `Fussgaenger-${row.Zst_id}-yearly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Fussgaenger/${row.Zst_id}_yearly.csv`
            }
        });
    });

    // Find or default `zst_id` to the top-most entry
    let activeCountingStation = MIVLocationsRows.find(row => row.Zst_id === zst_id)?.Zst_id || MIVLocationsRows[0]?.Zst_id;
    if (activeType === 'Velo') {
        activeCountingStation = VeloLocationsRows.find(row => row.Zst_id === zst_id)?.Zst_id || VeloLocationsRows[0]?.Zst_id;
    }
    if (activeType === 'Fussgaenger') {
        activeCountingStation = FussLocationsRows.find(row => row.Zst_id === zst_id)?.Zst_id || FussLocationsRows[0]?.Zst_id;
    }

    document.querySelectorAll('#filter-buttons input[name="filter"]').forEach(filterElement => {

        filterElement.addEventListener('change', async event => {
            activeType = event.target.value;
            const locationsRows = activeType === 'MIV' ? MIVLocationsRows : activeType === 'Velo' ? VeloLocationsRows : FussLocationsRows;
            activeCountingStation = locationsRows[0]?.Zst_id; // Reset to top-most for new type

            await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
        });
    });

    document.getElementById('counting-station-dropdown').addEventListener('change', async event => {
        activeCountingStation = event.target.value;
        await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
    });

    document.querySelectorAll('#day-range-buttons input[type="checkbox"]').forEach(button => {
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

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.addEventListener('change', onDatePickersChange);
    endDateInput.addEventListener('change', onDatePickersChange);

    async function onDatePickersChange() {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (startDateValue && endDateValue) {
            const min = Date.parse(startDateValue);
            const max = Date.parse(endDateValue) + (24 * 3600 * 1000 - 1); // End of day

            if (min > max) {
                alert('Das Startdatum darf nicht nach dem Enddatum liegen.');
                return;
            }

            activeTimeRange = [min, max];

            // Clear "Zeitraum" selection
            clearZeiteinheitSelection();

            // Update time-range-selector extremes
            const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
            navigatorChart.xAxis[0].setExtremes(min, max);

            await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
        }
    }

    // "Zeitraum" radio buttons event listener
    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        radio.addEventListener('change', async (event) => {
            if (event.target.checked) {
                const now = new Date();
                let min, max;

                switch (event.target.value) {
                    case '1 Tag':
                        min = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                        max = min + (24 * 3600 * 1000 - 1);
                        break;
                    case '1 Woche':
                        max = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                        min = max - (7 * 24 * 3600 * 1000 - 1);
                        break;
                    case '1 Monat':
                        max = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                        min = Date.UTC(now.getFullYear(), now.getMonth() - 1, now.getDate());
                        break;
                    case '1 Jahr':
                        max = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                        min = Date.UTC(now.getFullYear() - 1, now.getMonth(), now.getDate());
                        break;
                    case 'Alles':
                        // Set to full available range or a predefined range
                        min = Date.UTC(2000, 0, 1);
                        max = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                        break;
                    default:
                        return;
                }

                activeTimeRange = [min, max];

                // Update time-range-selector extremes
                // Get it by asking for the component with id 'time-range-selector'
                const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
                navigatorChart.xAxis[0].setExtremes(min, max);

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