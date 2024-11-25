export function getCommonConnectors(basePath = '../') {
    return [
        {
            id: 'MIV-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `${basePath}data/dtv_MIV.json`
            }
        },
        {
            id: 'Velo-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `${basePath}data/dtv_Velo.json`
            }
        },
        {
            id: 'Fussgaenger-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `${basePath}data/dtv_Fussgaenger.json`
            }
        }
    ];
}
