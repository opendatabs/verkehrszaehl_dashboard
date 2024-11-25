import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {updateDatePickers, clearZeitraumSelection, onDatePickersChange} from '../functions.js';
import {getCommonConnectors} from '../common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../common_components.js";

setupBoard().then(r => console.log('Board setup complete'));
export default async function setupBoard() {
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
            connectors: [
                ...getCommonConnectors('../'),
            {
                id: 'Daily Data',
                type: 'CSV',
                options: {
                    csvURL: `./data/MIV/404_daily.csv`
                }
            }, {
                id: 'Monthly Data',
                type: 'CSV',
                options: {
                    csvURL: `./data/MIV/404_monthly.csv`
                }
            }, {
                id: 'Monthly Traffic',
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
                }],
                xAxis: {
                    min: activeTimeRange[0],
                    max: activeTimeRange[1],
                    minRange: 30 * 24 * 3600 * 1000, // 30 days
                    events: {
                        afterSetExtremes: async function (e) {
                            const min = Math.round(e.min);
                            const max = Math.round(e.max);

                            // Update date pickers
                            updateDatePickers(min, max);
                            // Uncheck "Zeitraum" options
                            clearZeitraumSelection();

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
        },
            getDayRangeButtonsComponent(),
        {
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
            id: `$Velo-${row.Zst_id}-hourly`, // Unique ID based on type and ID_ZST
            type: 'CSV',
            options: {
                csvURL: `./data/${row.TrafficType}/${row.Zst_id}_hourly.csv` // Path based on folder and station ID
            }
        });
    });

    FussLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `$Fussgaenger-${row.Zst_id}-hourly`, // Unique ID based on type and ID_ZST
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


    document.querySelectorAll('#day-range-buttons input[type="checkbox"]').forEach(button => {
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

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    startDateInput.addEventListener('change', onDatePickersChange);
    endDateInput.addEventListener('change', onDatePickersChange);

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

                // Update date pickers
                updateDatePickers(min, max);

                // Update time-range-selector extremes
                const navigatorChart = board.getComponent('time-range-selector').boardElement.chart;
                navigatorChart.xAxis[0].setExtremes(min, max);

                await updateBoard(board, activeCountingStation, true, activeType, activeTimeRange);
            }
        });
    });

    // Initialize date pickers with default values
    updateDatePickers(activeTimeRange[0], activeTimeRange[1]);

    // Load active counting station
    await updateBoard(board,
        activeCountingStation,
        true,
        activeType,
        activeTimeRange);
}