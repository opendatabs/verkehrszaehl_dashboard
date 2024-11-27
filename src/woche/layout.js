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
        }, {
                cells: [{
                    id: 'weekly-table',
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
                }, {
                    id: 'weekly-charts',
                    layout: {
                        rows: [{
                            cells: [{id: 'weekly-dtv-chart'}]
                        }, {
                            cells: [{id: 'weekly-todo'}]
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
                    id: 'weekly-box-plot'
                }]
            }]
    }]
}