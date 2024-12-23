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
                responsive: {
                    large: {
                        width: '1/2'
                    },
                    medium: {
                        height: '100%',
                        width: '100%'
                    },
                    small: {
                        height: '100%',
                        width: '100%'
                    }
                }
            }, {
                id: 'monthly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'monthly-dtv-chart'}]
                    },{
                        cells: [{id: 'monthly-weather-chart'}]
                    }]
                },
                responsive: {
                    large: {
                        width: '1/2'
                    },
                    medium: {
                        width: '100%'
                    },
                    small: {
                        width: '100%'
                    }
                }
            }]
        },
        {
            cells: [{
                id: 'monthly-box-plot'
            }]
        }]
    }]
}