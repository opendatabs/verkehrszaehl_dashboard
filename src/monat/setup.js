import {gui} from './layout.js';
import {updateBoard} from './update.js';

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
            connectors: [{
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
        components: [{
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