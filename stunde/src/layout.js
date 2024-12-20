export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section',
            }]
        }, {
            cells: [{
                id: 'time-range-selector'
            }]
        }, {
            cells: [{
                id: 'filter-section-2'
            }]
        },{
            cells: [{
                id: 'hour-table',
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
                id: 'hourly-charts',
                layout: {
                    rows: [{
                        cells: [{id: 'hourly-dtv-chart'}]
                    },{
                        cells: [{id: 'hourly-donut-chart'}]
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
                id: 'hourly-box-plot'
            }]
        }]
    }]
}