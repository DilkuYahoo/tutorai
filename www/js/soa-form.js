// script.js
// Define the backend host as a variable
//const backendHost = 'http://localhost:8080'; // You can change this to your production URL when needed
const backendHost = 'https://fintelle.wn.r.appspot.com';

// Function to show a modern alert (Bootstrap modal)
function showAlert(message) {
    const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
    const alertMessage = document.getElementById('alertMessage');
    alertMessage.textContent = message;
    alertModal.show();
}

// Function to validate email
function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

// Function to validate phone number (basic validation for demonstration)
function validatePhone(phone) {
    const phonePattern = /^\d{10,}$/; // At least 10 digits
    return phonePattern.test(phone);
}

// Function to validate date of birth (basic validation for demonstration)
function validateDOB(dob) {
    return dob !== ''; // Ensure the date is not empty
}

// Function to validate full name (basic validation for demonstration)
function validateFullName(fullName) {
    return fullName.trim() !== ''; // Ensure the name is not empty
}

// Function to validate financial goal selection
function validateFinancialGoal() {
    const selectedGoal = document.querySelector('input[name="financialGoal"]:checked');
    return selectedGoal !== null; // Ensure a goal is selected
}

// Function to validate Step 3 fields (income, expenses, savings, debts)
function validateStep3() {
    const income = document.getElementById('income').value;
    const expenses = document.getElementById('expenses').value;
    const savings = document.getElementById('savings').value;
    const debts = document.getElementById('debts').value;

    // Ensure all fields are filled and are valid numbers
    if (income === '' || isNaN(income) || parseFloat(income) < 0) {
        showAlert('Please enter a valid annual income (must be a positive number).');
        return false;
    }
    if (expenses === '' || isNaN(expenses) || parseFloat(expenses) < 0) {
        showAlert('Please enter valid monthly expenses (must be a positive number).');
        return false;
    }
    if (savings === '' || isNaN(savings) || parseFloat(savings) < 0) {
        showAlert('Please enter valid current savings (must be a positive number).');
        return false;
    }
    if (debts === '' || isNaN(debts) || parseFloat(debts) < 0) {
        showAlert('Please enter valid total debts (must be a positive number).');
        return false;
    }

    return true; // All fields are valid
}

// Function to validate risk tolerance selection
function validateRiskTolerance() {
    const selectedRisk = document.querySelector('input[name="riskTolerance"]:checked');
    return selectedRisk !== null; // Ensure a risk tolerance option is selected
}

// Function to handle form submission
function submitForm() {
    // Show the spinner
    const submitButton = document.getElementById('submitForm');
    submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Submitting...
    `;
    submitButton.disabled = true; // Disable the button to prevent multiple submissions

    // Collect all form data
    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        dob: document.getElementById('dob').value,
        financialGoal: document.querySelector('input[name="financialGoal"]:checked').value,
        income: document.getElementById('income').value,
        expenses: document.getElementById('expenses').value,
        savings: document.getElementById('savings').value,
        debts: document.getElementById('debts').value,
        riskTolerance: document.querySelector('input[name="riskTolerance"]:checked').value
    };

    // Send the data to the backend
    fetch(`${backendHost}/update_leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Redirect to the thank-you page after successful submission
            window.location.href = "thank-you.html";
        } else {
            showAlert('Failed to submit form. Please try again.');
            // Reset the submit button
            submitButton.innerHTML = 'Submit';
            submitButton.disabled = false;
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        showAlert('Failed to submit form. Check all the fields are filled. Please try again.');
        // Reset the submit button
        submitButton.innerHTML = 'Submit';
        submitButton.disabled = false;
    });
}

// Add event listener to the submit button
document.getElementById('submitForm').addEventListener('click', submitForm);

// Form Navigation Logic
const steps = document.querySelectorAll('.form-step');
const progressBar = document.getElementById('progressBar');
let currentStep = 0;

function showStep(stepIndex) {
    steps.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
    });
    const progress = ((stepIndex + 1) / steps.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
}

document.querySelectorAll('.next-step').forEach(button => {
    button.addEventListener('click', () => {
        if (currentStep === 0) {
            // Validate all fields in Step 1 before proceeding to the next step
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const dob = document.getElementById('dob').value;

            if (!validateFullName(fullName)) {
                showAlert('Please enter your full name.');
                return;
            }

            if (!validateEmail(email)) {
                showAlert('Please enter a valid email address.');
                return;
            }

            if (!validatePhone(phone)) {
                showAlert('Please enter a valid phone number (at least 10 digits).');
                return;
            }

            if (!validateDOB(dob)) {
                showAlert('Please enter your date of birth.');
                return;
            }
        }

        if (currentStep === 1) {
            // Validate financial goal selection in Step 2
            if (!validateFinancialGoal()) {
                showAlert('Please select a financial goal before proceeding.');
                return;
            }
        }

        if (currentStep === 2) {
            // Validate Step 3 fields (income, expenses, savings, debts)
            if (!validateStep3()) {
                return; // Stop if validation fails
            }
        }

        if (currentStep === 3) {
            // Validate risk tolerance selection in Step 4
            if (!validateRiskTolerance()) {
                showAlert('Please select a risk tolerance option before proceeding.');
                return;
            }
        }

        if (currentStep < steps.length - 1) {
            currentStep++;
            showStep(currentStep);
        }
        if (currentStep === steps.length - 1) {
            // Populate review details
            const reviewDetails = document.getElementById('reviewDetails');
            reviewDetails.innerHTML = `
                <p><strong>Name:</strong> ${document.getElementById('fullName').value}</p>
                <p><strong>Email:</strong> ${document.getElementById('email').value}</p>
                <p><strong>Phone:</strong> ${document.getElementById('phone').value}</p>
                <p><strong>Date of Birth:</strong> ${document.getElementById('dob').value}</p>
                <p><strong>Financial Goals:</strong> ${document.querySelector('input[name="financialGoal"]:checked').value}</p>
                <p><strong>Annual Income:</strong> $${document.getElementById('income').value}</p>
                <p><strong>Monthly Expenses:</strong> $${document.getElementById('expenses').value}</p>
                <p><strong>Current Savings:</strong> $${document.getElementById('savings').value}</p>
                <p><strong>Total Debts:</strong> $${document.getElementById('debts').value}</p>
                <p><strong>Risk Tolerance:</strong> ${document.querySelector('input[name="riskTolerance"]:checked').value}</p>
            `;
        }
    });
});

document.querySelectorAll('.prev-step').forEach(button => {
    button.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    });
});