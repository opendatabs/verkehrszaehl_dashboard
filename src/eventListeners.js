import {getStateFromUrl, clearZeiteinheitSelection} from './functions.js';

export function setupEventListeners(updateBoard, board) {
    setupFilterButtonsListeners(updateBoard, board);
    setupStrTypButtonListeners(updateBoard, board);
    setupCountingStationDropdownListener(updateBoard, board);
    setupDayRangeButtons(updateBoard, board);
    setupDateInputsListeners(updateBoard, board);
    setupZeitraumButtonsListeners(updateBoard, board);
}

function setupFilterButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#filter-buttons input[name="filter"]').forEach(filterElement => {
        filterElement.addEventListener('change', async event => {
            const currentState = getStateFromUrl();
            const activeType = event.target.value;
            await updateBoard(
                board,
                currentState.activeCountingStation,
                true,
                activeType,
                currentState.activeTimeRange
            );
        });
    });
}


function setupStrTypButtonListeners(updateBoard, board) {
    document.querySelectorAll('.filter-options input[name="filter-strtyp"]').forEach(radio => {
        let lastSelected = null;
        radio.addEventListener('click', async function () {
            const currentState = getStateFromUrl();
            if (lastSelected === this) {
                this.checked = false;
                lastSelected = null;
                await updateBoard(
                    board,
                    currentState.activeCountingStation,
                    true,
                    currentState.activeType,
                    currentState.activeTimeRange
                );
            } else {
                lastSelected = this;
                const activeStrtyp = this.value;
                await updateBoard(
                    board,
                    currentState.activeCountingStation,
                    true,
                    currentState.activeType,
                    currentState.activeTimeRange,
                    activeStrtyp
                );
            }
        });
    });
}


function setupCountingStationDropdownListener(updateBoard, board) {
    document.getElementById('counting-station-dropdown').addEventListener('change', async event => {
        const currentState = getStateFromUrl();
        const activeCountingStation = event.target.value;
        await updateBoard(
            board,
            activeCountingStation,
            true,
            currentState.activeType,
            currentState.activeTimeRange
        );
    });
}


function setupDayRangeButtons(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[type="checkbox"]').forEach(button => {
        button.addEventListener('change', async (event) => {
            const currentState = getStateFromUrl();
            const moFr = document.querySelector('#mo-fr');
            const saSo = document.querySelector('#sa-so');

            // Ensure at least one button is always selected
            if (!moFr.checked && !saSo.checked) {
                event.target.checked = true; // Prevent unchecking the last selected button
            } else {
                // Update the board based on the new selection
                await updateBoard(
                    board,
                    currentState.activeCountingStation,
                    true,
                    currentState.activeType,
                    currentState.activeTimeRange
                );
            }
        });
    });
}


function setupDateInputsListeners(updateBoard, board) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

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

            // Clear "Zeitraum" selection
            clearZeiteinheitSelection();
            // Update time-range-selector extremes
            const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
            navigatorChart.xAxis[0].setExtremes(min, max);
        }
    }

    startDateInput.addEventListener('change', onDatePickersChange);
    endDateInput.addEventListener('change', onDatePickersChange);
}

function setupZeitraumButtonsListeners(updateBoard, board) {
    document.querySelectorAll('#day-range-buttons input[name="zeitraum"]').forEach(radio => {
        radio.addEventListener('change', async (event) => {
            if (event.target.checked) {
                const navigatorChart = board.mountedComponents.find(c => c.cell.id === 'time-range-selector').component.chart;
                const max = navigatorChart.xAxis[0].dataMax
                let min;

                switch (event.target.value) {
                    case '1 Tag':
                        min = max - (24 * 3600 * 1000);
                        break;
                    case '1 Woche':
                        min = max - (7 * 24 * 3600 * 1000);
                        break;
                    case '1 Monat':
                        min = Date.UTC(new Date(max).getFullYear(), new Date(max).getMonth() - 1, new Date(max).getDate());
                        break;
                    case '1 Jahr':
                        min = Date.UTC(new Date(max).getFullYear() - 1, new Date(max).getMonth(), new Date(max).getDate());
                        break;
                    case 'Alles':
                        min = navigatorChart.xAxis[0].dataMin;
                        break;
                    default:
                        return;
                }

                navigatorChart.xAxis[0].setExtremes(min, max);
            }
        });
    });
}