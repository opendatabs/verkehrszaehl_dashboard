import config from "./config.js";

export function getCommonConnectors() {
    const basePath = config.basePath;
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
