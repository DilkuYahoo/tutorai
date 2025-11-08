const API_BASE = "https://hn3tnvdc0g.execute-api.ap-southeast-2.amazonaws.com/dev"; // HSC Agent API Gateway endpoint

class FilterApp {
  constructor() {
    this.years = [];
    this.subjects = [];
    this.areas = [];
  }

  async init() {
    try {
      await this.fetchFilterOptions();
      this.populateDropdowns();
      this.setupForm();
    } catch (error) {
      this.showError(`Failed to load filter options: ${error.message}`);
    }
  }

  async fetchFilterOptions() {
    const response = await fetch(`${API_BASE}/filters`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    this.years = data.years || [];
    this.subjects = data.subjects || [];
    this.areas = data.areas || [];
  }

  populateDropdowns() {
    const yearSelect = document.getElementById('yearSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const areaSelect = document.getElementById('areaSelect');

    // Populate years
    this.years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });

    // Populate subjects
    this.subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    });

    // Populate areas
    this.areas.forEach(area => {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      areaSelect.appendChild(option);
    });
  }

  setupForm() {
    const form = document.getElementById('filterForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  handleSubmit() {
    const year = document.getElementById('yearSelect').value;
    const subject = document.getElementById('subjectSelect').value;
    const area = document.getElementById('areaSelect').value;

    if (!year || !subject || !area) {
      alert('Please select all filters.');
      return;
    }

    // Save to localStorage
    localStorage.setItem('quizYear', year);
    localStorage.setItem('quizSubject', subject);
    localStorage.setItem('quizArea', area);

    // Redirect to quiz page with parameters
    const params = new URLSearchParams({ year, subject, area });
    window.location.href = `index.html?${params.toString()}`;
  }

  showError(message) {
    const container = document.querySelector('.card-body');
    container.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> ${message}
        <br><br>
        <button onclick="filterApp.init()" class="btn btn-primary">Try Again</button>
      </div>
    `;
  }
}

// Initialize the filter app
const filterApp = new FilterApp();
document.addEventListener('DOMContentLoaded', () => {
  filterApp.init();
});