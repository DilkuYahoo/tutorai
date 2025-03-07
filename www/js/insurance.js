// Define the backend host as a variable
const backendHost = 'http://localhost:8080'; // or your production backend URL

// Function to show a modern alert (Bootstrap modal)
function showAlert(message) {
    const alertModal = new bootstrap.Modal(document.getElementById('alertModal'));
    const alertMessage = document.getElementById('alertMessage');
    alertMessage.textContent = message;
    alertModal.show();
}

// Validation functions for each step
const validators = {
    step1: () => {
        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phoneNumber').value.trim();
        const email = document.getElementById('emailAddress').value.trim();
        const age = document.getElementById('age').value;
        const annualIncome = document.getElementById('annualIncome').value;
        const dependents = document.querySelector('input[name="dependents"]:checked');
        const debts = document.getElementById('debts').value;
        const survivalMonths = document.getElementById('survivalMonths').value;

        return {
            fullName: fullName !== '',
            phone: /^\d{10,}$/.test(phone),
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
            age: age !== '' && age >= 18,
            annualIncome: annualIncome !== '' && annualIncome >= 0,
            dependents: dependents !== null,
            debts: debts !== '' && debts >= 0,
            survivalMonths: survivalMonths !== '' && survivalMonths >= 0,
        };
    },
    step2: () => {
        const occupation = document.getElementById('occupation').value.trim();
        const medicalConditions = document.querySelector('input[name="medicalConditions"]:checked');
        const smokeDrink = document.querySelector('input[name="smokeDrink"]:checked');

        return {
            occupation: occupation !== '',
            medicalConditions: medicalConditions !== null,
            smokeDrink: smokeDrink !== null,
        };
    },
    step3: () => {
        const insuranceType = document.getElementById('insuranceType').value;
        const healthCoverage = document.getElementById('healthCoverage').value;
        const monthlyPremium = document.getElementById('monthlyPremium').value;

        return {
            insuranceType: insuranceType !== '',
            healthCoverage: healthCoverage !== '',
            monthlyPremium: monthlyPremium !== '' && monthlyPremium >= 0,
        };
    },
    step4: () => {
        // Step 4 is optional, so no validation is required
        return true;
    },
    step5: () => {
        // Validate the disclaimer checkbox
        const acknowledgeDisclaimer = document.getElementById('acknowledgeDisclaimer').checked;
        return {
            acknowledgeDisclaimer: acknowledgeDisclaimer,
        };
    },
};

// Function to validate the current step
function validateStep(step) {
    const stepValidators = validators[step]();
    const errors = [];

    if (step === 'step1') {
        if (!stepValidators.fullName) errors.push('Please enter your full name.');
        if (!stepValidators.phone) errors.push('Please enter a valid phone number (at least 10 digits).');
        if (!stepValidators.email) errors.push('Please enter a valid email address.');
        if (!stepValidators.age) errors.push('Please enter a valid age (must be at least 18).');
        if (!stepValidators.annualIncome) errors.push('Please enter a valid annual income.');
        if (!stepValidators.dependents) errors.push('Please select whether you have dependents.');
        if (!stepValidators.debts) errors.push('Please enter a valid debt amount.');
        if (!stepValidators.survivalMonths) errors.push('Please enter a valid number of months for financial survival.');
    } else if (step === 'step2') {
        if (!stepValidators.occupation) errors.push('Please enter your occupation.');
        if (!stepValidators.medicalConditions) errors.push('Please select whether you have any pre-existing medical conditions.');
        if (!stepValidators.smokeDrink) errors.push('Please select whether you smoke or drink alcohol regularly.');
    } else if (step === 'step3') {
        if (!stepValidators.insuranceType) errors.push('Please select an insurance type.');
        if (!stepValidators.healthCoverage) errors.push('Please select a health coverage option.');
        if (!stepValidators.monthlyPremium) errors.push('Please enter a valid monthly premium amount.');
    } else if (step === 'step5') {
        if (!stepValidators.acknowledgeDisclaimer) errors.push('You must acknowledge the disclaimer to submit the form.');
    }

    if (errors.length > 0) {
        showAlert(errors.join('\n'));
        return false;
    }

    return true;
}

// Function to handle form submission
function submitForm() {
    // Validate all steps before submission
    const allStepsValid = Object.keys(validators).every(step => validateStep(step));
    if (!allStepsValid) return;

    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('emailAddress').value,
        phone: document.getElementById('phoneNumber').value,
        age: document.getElementById('age').value,
        annualIncome: document.getElementById('annualIncome').value,
        dependents: document.querySelector('input[name="dependents"]:checked')?.value,
        debts: document.getElementById('debts').value,
        survivalMonths: document.getElementById('survivalMonths').value,
        occupation: document.getElementById('occupation').value,
        medicalConditions: document.querySelector('input[name="medicalConditions"]:checked')?.value,
        smokeDrink: document.querySelector('input[name="smokeDrink"]:checked')?.value,
        insuranceType: document.getElementById('insuranceType').value,
        healthCoverage: document.getElementById('healthCoverage').value,
        monthlyPremium: document.getElementById('monthlyPremium').value,
        existingPolicies: document.getElementById('existingPolicies').value,
        payoutPreference: document.getElementById('payoutPreference').value,
    };

    // Show the spinner and disable the submit button
    const submitButton = document.getElementById('submitForm');
    submitButton.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Submitting...
    `;
    submitButton.disabled = true;

    // Send the data to the backend
    fetch(`${backendHost}/get_soi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            window.location.href = "thank-you.html"; // Redirect on success
        } else {
            showAlert('Failed to submit form. Please try again.');
            submitButton.innerHTML = 'Submit';
            submitButton.disabled = false;
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        showAlert('Failed to submit form. Check all the fields are filled. Please try again.');
        submitButton.innerHTML = 'Submit';
        submitButton.disabled = false;
    });
}

// Form Navigation Logic
const steps = document.querySelectorAll('.form-step');
const progressBar = document.getElementById('progressBar');
let currentStep = 0;

function showStep(stepIndex) {
    steps.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
    });

    if (stepIndex === 4) { // Step 5 is the review step
        populateReviewDetails();
    }

    const progress = ((stepIndex + 1) / steps.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
}

function populateReviewDetails() {
    const reviewDetails = document.getElementById('reviewDetails');
    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('emailAddress').value,
        phone: document.getElementById('phoneNumber').value,
        age: document.getElementById('age').value,
        annualIncome: document.getElementById('annualIncome').value,
        dependents: document.querySelector('input[name="dependents"]:checked')?.value,
        debts: document.getElementById('debts').value,
        survivalMonths: document.getElementById('survivalMonths').value,
        occupation: document.getElementById('occupation').value,
        medicalConditions: document.querySelector('input[name="medicalConditions"]:checked')?.value,
        smokeDrink: document.querySelector('input[name="smokeDrink"]:checked')?.value,
        insuranceType: document.getElementById('insuranceType').value,
        healthCoverage: document.getElementById('healthCoverage').value,
        monthlyPremium: document.getElementById('monthlyPremium').value,
        existingPolicies: document.getElementById('existingPolicies').value,
        payoutPreference: document.getElementById('payoutPreference').value,
    };

    const reviewHTML = Object.entries(formData)
        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
        .join('');

    reviewDetails.innerHTML = reviewHTML;
}

// Event listeners for navigation
document.querySelectorAll('.next-step').forEach(button => {
    button.addEventListener('click', () => {
        const currentStepName = steps[currentStep].id;
        if (validateStep(currentStepName)) {
            if (currentStep < steps.length - 1) {
                currentStep++;
                showStep(currentStep);
            }
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

// Event listener for form submission
document.getElementById('submitForm').addEventListener('click', submitForm);