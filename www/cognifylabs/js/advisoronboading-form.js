document.addEventListener("DOMContentLoaded", function () {
    // Define the backend host URL as a variable
    const backendHost = 'https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev'; // Current backend URL
    // const backendHost = 'http://localhost:8080'; // Local development URL
    // const backendHost = 'https://fintelle.wn.r.appspot.com'; // Production URL

    let currentStep = 1;

    function showStep(step) {
        document.querySelectorAll(".step").forEach(s => s.classList.add("d-none"));
        document.getElementById(`step${step}`).classList.remove("d-none");
    }

    window.nextStep = function (step) {
        if (validateStep(step)) {
            currentStep++;
            showStep(currentStep);
        }
    };

    window.prevStep = function (step) {
        currentStep--;
        showStep(currentStep);
    };

    function validateStep(step) {
        let valid = true;
        let fields = document.querySelectorAll(`#step${step} input`);
        fields.forEach(field => {
            if (!field.checkValidity()) {
                valid = false;
                showModal("Validation Error", `Invalid input in field: ${field.previousElementSibling.innerText}`);
            }
        });
        return valid;
    }

    function showModal(title, message, isSuccess = false) {
        document.getElementById("modalMessage").innerText = message;
        let modal = new bootstrap.Modal(document.getElementById("errorModal"));
        
        // Update modal title and button based on success or error
        document.querySelector(".modal-title").innerText = title;
        let modalFooter = document.querySelector(".modal-footer");
        modalFooter.innerHTML = `<button type="button" class="btn ${isSuccess ? 'btn-success' : 'btn-secondary'}" data-bs-dismiss="modal">${isSuccess ? 'Ok' : 'Close'}</button>`;

        // Redirect to home page if it's a success modal
        if (isSuccess) {
            modalFooter.querySelector("button").addEventListener("click", function() {
                window.location.href = "/"; // Redirect to home page
            });
        }

        modal.show();
    }

    document.getElementById("onboardingForm").addEventListener("submit", function (event) {
        event.preventDefault();
        if (validateStep(currentStep)) {
            // Get the submit button
            const submitButton = document.querySelector("#onboardingForm button[type='submit']");
            
            // Disable the button and show the spinner
            submitButton.disabled = true;
            submitButton.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Submitting...
            `;

            let formData = {
                name: document.getElementById("name").value,
                phone: document.getElementById("phone").value,
                email: document.getElementById("email").value,
                afsl: document.getElementById("afsl").value,
                businessName: document.getElementById("businessName").value,
                businessAddress: document.getElementById("businessAddress").value,
                businessURL: document.getElementById("businessURL").value,
                agreement1: document.getElementById("agreement1").checked,
                agreement2: document.getElementById("agreement2").checked,
            };

            // Use the backendHost variable in the fetch URL
            fetch(`${backendHost}/onboard_advisors`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                // Re-enable the button and reset its text
                submitButton.disabled = false;
                submitButton.innerHTML = "Submit";
                showModal("Success", "Thanks for submitting the form, we will be in touch", true);
            })
            .catch(error => {
                // Re-enable the button and reset its text
                submitButton.disabled = false;
                submitButton.innerHTML = "Submit";
                showModal("Error", "Error submitting form!");
            });
        }
    });

    showStep(currentStep);
});