export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section',
            }]
        },{
            cells: [{
                id: 'time-range-selector'
            }]
        }, {
            cells: [{
                id: 'filter-section-2'
            }]
        },{
            cells: [{
                id: 'month-table',
            }, {
                id: 'monthly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'monthly-dtv-chart'}]
                    },{
                        cells: [{id: 'monthly-weather-chart'}]
                    }]
                }
            }]
        },
        {
            cells: [{
                id: 'monthly-box-plot'
            }]
        },
        {
            cells: [{
                id: 'monthly-scatter-plot'
            }]
        }]
    }]
}