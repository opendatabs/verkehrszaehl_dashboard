document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginButton = document.getElementById('login-button');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Show modal on load
    loginModal.classList.add('active');

    loginButton.addEventListener('click', () => {
        const username = usernameInput.value;
        const password = passwordInput.value;

        // WARNING: This is not secure and should not be used in production
        if (username === 'verkehr_zaehlen' && password === 'macht_spass') {
            // Hide the modal
            loginModal.classList.remove('active');
        } else {
            alert('Invalid username or password');
        }
    });
});
