
async function fetchData() {
    document.getElementById("loader").style.display = "block";

    // Hide the content
    document.getElementById("myDiv").style.display = "none";
    //await delay(2000)
    try {
        // Replace with your API endpoint
        const response = await fetch('https://catfact.ninja/fact');

        // Check if the request was successful
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }

        // Parse the JSON data
        const data = await response.json();

        // Update the content of the HTML element with the API data
        // Hide the loader
        document.getElementById("loader").style.display = "none";
        // Update the content dynamically
        document.getElementById("myDiv").innerHTML = data.fact
        document.getElementById("myDiv").style.display = "block";
        //quoteContainer.innerHTML = data.fact; // Adjust based on your API response structure
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
        document.getElementById('output').innerText = 'Failed to load data';
    }
}
async function fetchQuote() {
  const formData = document.getElementById("soa");
  

    // Hide the content
    document.getElementById("myDiv").style.display = "none";

  const Data_input = {
    fullName: document.getElementById("fullName").value,
    dob: document.getElementById("dob").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    investmentObjective: document.getElementById("investmentObjective").value,
    investmentHorizon: document.getElementById("investmentHorizon").value,
    investmentAmount: document.getElementById("investmentAmount").value,
    riskTolerance: document.getElementById("riskTolerance").value
};

  if (formData.checkValidity() && validateDOB()) {
    document.getElementById("loader").style.display = "block";
    try {
        const response = await fetch("https://fintelle.wn.r.appspot.com/gen_share_portfolio", {
        //const response = await fetch("http://localhost:8080/gen_share_portfolio", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(Data_input)
        });
        
        // Parse the JSON data
        const data = await response.json();

        // Update the content of the HTML element with the API data
        // Hide the loader
        document.getElementById("loader").style.display = "none";
        // Update the content dynamically
        document.getElementById("myDiv").innerHTML = `${data.result}`;
        document.getElementById("myDiv").style.display = "block";
        //quoteContainer.innerHTML = data.fact; // Adjust based on your API response structure

      } catch (error) {
        quoteContainer.innerHTML = '<p>Failed to load quote. Please try again.</p>';
      }
  } else {
    formData.reportValidity();
  }
}


async function submitData() {

    const quoteContainer = document.getElementById('quoteContainer');
    quoteContainer.innerHTML = '<div class="spinner"></div>';
    
    const formData = {
        fullName: document.getElementById("fullName").value,
        dob: document.getElementById("dob").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        investmentObjective: document.getElementById("investmentObjective").value,
        investmentHorizon: document.getElementById("investmentHorizon").value,
        investmentAmount: document.getElementById("investmentAmount").value,
        riskTolerance: document.getElementById("riskTolerance").value
    };

        try {
            const response = await fetch("https://fintelle.wn.r.appspot.com/gen_share_portfolio", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            quoteContainer.innerHTML = `${data.result}`;
            
        } catch (error) {
            console.error("Error:", error);
            quoteContainer.innerHTML = '<p>Failed to load quote. Please try again.</p>';
        }
    }

    function validateDOB() {
        const dobInput = document.getElementById("dob").value;
        const dobError = document.getElementById("dobError");

        if (!dobInput) return false; // Ensure DOB is filled out

        // Parse the entered date of birth
        const dob = new Date(dobInput);
        const today = new Date();

        // Calculate age in years
        const age = today.getFullYear() - dob.getFullYear();
        const monthDifference = today.getMonth() - dob.getMonth();
        const dayDifference = today.getDate() - dob.getDate();

        // Adjust the age if the birth date hasn't occurred this year yet
        const actualAge = monthDifference < 0 || (monthDifference === 0 && dayDifference < 0) ? age - 1 : age;

        // Check if age is within the specified range
        if (actualAge < 15 || actualAge > 65) {
            dobError.style.display = "block";  // Show error message
            return false;  // Prevent form submission
        }

        dobError.style.display = "none";  // Hide error message if age is valid
        return true;  // Allow form submission
    }