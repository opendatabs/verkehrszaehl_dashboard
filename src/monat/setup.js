import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {clearZeiteinheitSelection, getMonthName} from '../functions.js';
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
                ...getCommonConnectors('../'),
            {
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
                        type: 'column'
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
            cell: 'monthly-dtv-chart',
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
                    height: '525px'
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
        }, {
                cell: 'violin-plot',
                type: 'Highcharts',
                sync: {
                    highlight: true
                },
                chartOptions: {
                    chart: {
                        type: 'areasplinerange',
                        height: '400px',
                        animation: true,
                        inverted: true
                    },
                    title: {
                        text: 'Verteilung von Tagesverkehr'
                    },
                    xAxis: {
                        reversed: false,
                        title: {
                            text: 'Anz. Fzg./Tag'
                        }
                    },
                    yAxis: {
                        categories: [
                            'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
                        ],
                        title: {
                            text: 'Monat'
                        },
                        min: 0,
                        max: 11,
                        gridLineWidth: 0
                    },
                    plotOptions: {
                        series: {
                            states: {
                                hover: {
                                    enabled: false
                                }
                            },
                            events: {
                                legendItemClick: function (e) {
                                    e.preventDefault();
                                }
                            }
                        },
                        areasplinerange: {
                            marker: {
                                enabled: false
                            },
                            animation: {
                                duration: 2000
                            }
                        },
                        line: {
                            marker: {
                                enabled: false
                            },
                            showInLegend: false,
                            color: "#232b2b",
                            lineWidth: 1,
                            dashStyle: "shortdot"
                        },
                        scatter: {
                            marker: {
                                enabled: true,
                                symbol: "diamond"
                            }
                        }
                    },
                    series: [
                        // Violin data series for each month
                        ...Array.from({ length: 12 }, (_, i) => ({
                            name: getMonthName(i),
                            data: [],
                            color: '#a8beff',
                            showInLegend: false
                        })),
                        // Statistical lines (min, Q1, median, Q3, max) for each month
                        ...Array.from({ length: 12 }, () => ({
                            type: 'line',
                            data: []
                        })),
                        // Scatter plots for min, Q1, median, Q3, max
                        {
                            type: 'scatter',
                            data: [],
                            name: 'Min',
                            color: '#000000'
                        },
                        {
                            type: 'scatter',
                            data: [],
                            name: 'Q1',
                            color: '#0000CD'
                        },
                        {
                            type: 'scatter',
                            data: [],
                            name: 'Median',
                            color: '#DC143C'
                        },
                        {
                            type: 'scatter',
                            data: [],
                            name: 'Q3',
                            color: '#0000CD'
                        },
                        {
                            type: 'scatter',
                            data: [],
                            name: 'Max',
                            color: '#000000'
                        }
                    ]
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
            id: `MIV-${row.Zst_id}-monthly`,
            type: 'CSV',
            options: {
                csvURL: `./data/MIV/${row.Zst_id}_monthly.csv`
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
            id: `Velo-${row.Zst_id}-monthly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Velo/${row.Zst_id}_monthly.csv`
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
            id: `Fussgaenger-${row.Zst_id}-monthly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Fussgaenger/${row.Zst_id}_monthly.csv`
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
