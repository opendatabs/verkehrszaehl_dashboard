export function getCommonConnectors() {
    return [
        {
            id: 'MIV-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `../data/dtv_MIV.json`
            }
        },
        {
            id: 'Velo-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `../data/dtv_Velo.json`
            }
        },
        {
            id: 'Fussgaenger-Standorte',
            type: 'JSON',
            options: {
                dataUrl: `../data/dtv_Fussgaenger.json`
            }
        }
    ];
}
