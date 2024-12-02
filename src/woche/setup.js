import {gui} from './layout.js';
import {updateBoard} from './update.js';
import {clearZeiteinheitSelection} from '../functions.js';
import {getCommonConnectors} from '../common_connectors.js';
import {getFilterComponent, getDayRangeButtonsComponent} from "../common_components.js";

export default  async function setupBoard(params) {
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
            renderTo: 'weekly-table',
            type: 'DataGrid',
            connector: {
                id: 'Weekly Traffic'
            },
            sync: {
                highlight: {
                    enabled: true,
                    autoScroll: true
                }
            },
            dataGridOptions: {
                editable: false,
                header: [],
                columns: []}
        }, {
            cell: 'weekly-dtv-chart',
            type: 'Highcharts',
            connector: {
                id: 'Weekly Traffic',
                columnAssignment: []
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
                series: [],
                accessibility: {
                    description: 'A column chart showing the average weekly traffic for each weekday (Mo to So).',
                    typeDescription: 'A column chart showing weekly traffic.'
                }
            }
        }, {
                cell: 'weekly-box-plot',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'boxplot',
                        height: '400px'
                    },
                    title: {
                        text: 'Verteilung von Tagesverkehr nach Wochentag'
                    },
                    xAxis: {
                        categories: [
                            'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'
                        ],
                        title: {
                            text: 'Wochentag'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anzahl Fahrzeuge pro Tag'
                        }
                    },
                    series: [],
                    tooltip: {
                        headerFormat: '<em>Wochentag: {point.key}</em><br/>',
                        pointFormat:
                            '<span style="color:{series.color}">{series.name}</span><br/>' +
                            'Min: {point.low}<br/>' +
                            'Q1: {point.q1}<br/>' +
                            'Median: {point.median}<br/>' +
                            'Q3: {point.q3}<br/>' +
                            'Max: {point.high}<br/>'
                    },
                    plotOptions: {
                        boxplot: {
                            fillColor: '#F0F0E0',
                            lineWidth: 2,
                            medianColor: '#0C5DA5',
                            medianWidth: 3,
                            stemColor: '#A63400',
                            stemDashStyle: 'dot',
                            stemWidth: 1,
                            whiskerColor: '#3D9200',
                            whiskerLength: '20%',
                            whiskerWidth: 3
                        }
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