export const gui = {
    layouts: [{
        rows: [{
            cells: [{
                id: 'filter-section'
            }]
        },{
            cells: [{
                id: 'world-map',
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
                id: 'dtv-graph',
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
                id: 'hour-table',
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
                id: 'hourly-graphs',
                layout: {
                    rows: [{
                        cells: [{id: 'hourly-dtv-graph'}]
                    },{
                        cells: [{id: 'hourly-dwv-graph'}]
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
        }, {
            cells: [{
                id: 'month-table',
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
                id: 'monthly-graphs',
                layout: {
                    rows: [{
                        cells: [{id: 'monthly-dtv-graph'}]
                    },{
                        cells: [{id: 'monthly-dwv-graph'}]
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
                    id: 'weekly-graphs',
                    layout: {
                        rows: [{
                            cells: [{id: 'weekly-pw-graph'}]
                        }, {
                            cells: [{id: 'weekly-lw-graph'}]
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
            }]
    }]
}