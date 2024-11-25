export function getCommonConnectors(basePath = '../') {
    return [
        {
            id: 'MIV-Standorte',
            type: 'CSV',
            options: {
                csvURL: `${basePath}data/dtv_MIV_Class_10_1.csv`
            }
        },
        {
            id: 'Velo-Standorte',
            type: 'CSV',
            options: {
                csvURL: `${basePath}data/dtv_Velo.csv`
            }
        },
        {
            id: 'Fussgaenger-Standorte',
            type: 'CSV',
            options: {
                csvURL: `${basePath}data/dtv_Fussgaenger.csv`
            }
        }
    ];
}
