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

    const board = await Dashboards.board('container', {
        dataPool: {
            connectors: [
                ...getCommonConnectors('../'),
            {
                id: 'Hourly Traffic',
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
            renderTo: 'hour-table',
            type: 'DataGrid',
            connector: {
                id: 'Hourly Traffic'
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
                    height: '400px'
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
                            symbol: 'circle',
                            enabled: false
                        }
                    },
                    {
                        id: 'series-ri2',
                        name: 'Richtung 2',
                        marker: {
                            symbol: 'circle',
                            enabled: false
                        }
                    },
                    {
                        id: 'series-gesamt',
                        name: 'Gesamtquerschnitt',
                        marker: {
                            symbol: 'circle',
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
                    tooltip: {
                        pointFormat: '{point.name}: <b>{point.y:.0f}</b> ({point.percentage:.1f}%)'
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
                cell: 'hourly-box-plot',
                type: 'Highcharts',
                chartOptions: {
                    chart: {
                        type: 'boxplot',
                        height: '400px'
                    },
                    title: {
                        text: 'Verteilung von Stundenverkehr'
                    },
                    xAxis: {
                        categories: [
                            '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
                            '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
                            '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
                        ],
                        title: {
                            text: 'Monat'
                        }
                    },
                    yAxis: {
                        title: {
                            text: 'Anzahl Fahrzeuge'
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
                    tooltip: {
                        headerFormat: '<em>Stunde: {point.key}</em><br/>',
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

    // Set up connectors for each counting station
    MIVLocationsRows.forEach(row => {
        dataPool.setConnectorOptions({
            id: `MIV-${row.Zst_id}-hourly`,
            type: 'CSV',
            options: {
                csvURL: `./data/MIV/${row.Zst_id}_Total_hourly.csv`
            }
        });
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
            id: `Velo-${row.Zst_id}-hourly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Velo/${row.Zst_id}_Total_hourly.csv`
            }
        });
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
            id: `Fussgaenger-${row.Zst_id}-hourly`,
            type: 'CSV',
            options: {
                csvURL: `./data/Fussgaenger/${row.Zst_id}_Total_hourly.csv`
            }
        });
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