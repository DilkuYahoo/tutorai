document.getElementById("submitForm").addEventListener("click", function(event) {
  event.preventDefault();
  var alertMessage = "Your form has been submitted successfully!";
  document.getElementById("alertMessage").textContent = alertMessage;
  var alertModal = new bootstrap.Modal(document.getElementById("alertModal"));
  alertModal.show();
});



document.addEventListener('DOMContentLoaded', function() {
  var currentStep = 0;
  var steps = document.querySelectorAll('.form-step');
  var progressBar = document.getElementById('progressBar');

  function showStep(index) {
    steps.forEach(function(step, i) {
      step.classList.toggle('active', i === index);
    });
    var percent = ((index) / (steps.length - 1)) * 100;
    progressBar.style.width = percent + '%';
    progressBar.setAttribute('aria-valuenow', percent);
  }

  function validateStep(step) {
    var isValid = true;
    var inputs = step.querySelectorAll('input, select, textarea');
    inputs.forEach(function(input) {
      if (input.hasAttribute('required') && !input.value.trim()) {
        isValid = false;
        input.classList.add('is-invalid');
        input.nextElementSibling.textContent = 'This field is required.';
      } else {
        input.classList.remove('is-invalid');
        input.nextElementSibling.textContent = '';
      }
    });
    return isValid;
  }

  document.querySelectorAll('.next-step').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var currentStepElement = steps[currentStep];
      if (validateStep(currentStepElement)) {
        if (currentStep < steps.length - 1) {
          currentStep++;
          showStep(currentStep);
        }
      }
    });
  });

  document.querySelectorAll('.prev-step').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });
  });

  // Initialize first step
  showStep(currentStep);

  // Handle form submission
  document.getElementById('submitForm').addEventListener('click', function() {
    var currentStepElement = steps[currentStep];
    if (validateStep(currentStepElement)) {
      alert('Form submitted successfully!');
      // Optionally, you can submit the form data via AJAX or standard form submission.
    }
  });
});