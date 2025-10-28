const API_BASE = "https://t2n4m8126c.execute-api.ap-southeast-2.amazonaws.com/dev"; // HSC Agent API Gateway endpoint

class QuizApp {
  constructor() {
    this.questions = [];
    this.currentAnswers = new Map();
    this.isSubmitting = false;
    this.userId = this.getOrGenerateUserId();
    this.title = '';
    this.author = '';
    this.poem = '';
  }

  getOrGenerateUserId() {
    let userId = localStorage.getItem('quizUserId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('quizUserId', userId);
    }
    return userId;
  }

  async init() {
    try {
      this.showLoading();
      const data = await this.fetchQuestions();
      this.questions = data.questions;
      await this.fetchMetadata();
      this.renderQuiz(data);
    } catch (error) {
      this.showError(`Failed to load questions: ${error.message}`);
    }
  }

  showLoading() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading questions...</p>
      </div>
    `;
  }

  showError(message) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="error-message">
        <strong>Error:</strong> ${message}
        <br><br>
        <button onclick="quizApp.init()" class="retry-btn">Try Again</button>
      </div>
    `;
  }

  async fetchQuestions() {
    const userId = this.getOrGenerateUserId();
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year') || localStorage.getItem('quizYear') || '12';
    const subject = params.get('subject') || localStorage.getItem('quizSubject') || 'Advanced English';
    const area = params.get('area') || localStorage.getItem('quizArea') || 'vocab';
    const response = await fetch(`${API_BASE}/questions?user_id=${encodeURIComponent(userId)}&year=${encodeURIComponent(year)}&subject=${encodeURIComponent(subject)}&area=${encodeURIComponent(area)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  async fetchMetadata() {
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year') || localStorage.getItem('quizYear') || '12';
    const subject = params.get('subject') || localStorage.getItem('quizSubject') || 'Advanced English';
    const area = params.get('area') || localStorage.getItem('quizArea') || 'vocab';
    const response = await fetch(`${API_BASE}/metadata?year=${encodeURIComponent(year)}&subject=${encodeURIComponent(subject)}&area=${encodeURIComponent(area)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    this.title = data.title;
    this.author = data.author;
    this.poem = data.poem || '';
  }

  renderQuiz(data) {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // Set header
    const header = document.getElementById('header');
    header.innerHTML = `
      <h1 class="display-4 text-primary mb-3">${this.title}</h1>
      <p class="lead text-muted">${this.author}</p>
      ${this.poem ? `
        <div class="poem-section mt-3">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#poemCollapse" aria-expanded="false" aria-controls="poemCollapse">
            View Poem
          </button>
          <div class="collapse mt-2" id="poemCollapse">
            <div class="card card-body">
              <pre>${this.poem}</pre>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    // Create quiz form
    const form = document.createElement('form');
    form.id = 'quizForm';
    form.className = 'slide-in';

    // Render each question
    data.questions.forEach((question, index) => {
      const questionCard = this.createQuestionCard(question, index);
      form.appendChild(questionCard);
    });

    // Add submit section
    const submitSection = this.createSubmitSection();
    form.appendChild(submitSection);

    // Add form event listener
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitAnswers();
    });

    app.appendChild(form);
  }

  createQuestionCard(question, index) {
    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm mb-3 fade-in';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-4';

    const questionNumber = document.createElement('span');
    questionNumber.className = 'badge bg-primary text-white me-2';
    questionNumber.textContent = index + 1;

    const questionTitle = document.createElement('h5');
    questionTitle.className = 'card-title d-inline text-dark fw-bold';
    questionTitle.textContent = question.word;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'd-flex align-items-center mb-3';
    headerDiv.appendChild(questionNumber);
    headerDiv.appendChild(questionTitle);

    const context = document.createElement('div');
    context.className = 'alert alert-info py-2 mb-3';
    context.innerHTML = `<strong>Context:</strong> ${question.context}`;

    const questionText = document.createElement('p');
    questionText.className = 'card-text text-dark mb-4';
    questionText.textContent = question.question;

    const options = document.createElement('div');
    options.className = 'd-grid gap-2';

    question.options.forEach((optionText, optionIndex) => {
      const optionElement = this.createOption(question.id, optionIndex, optionText);
      options.appendChild(optionElement);
    });

    cardBody.appendChild(headerDiv);
    cardBody.appendChild(context);
    cardBody.appendChild(questionText);
    cardBody.appendChild(options);
    card.appendChild(cardBody);

    return card;
  }

  createOption(questionId, optionIndex, optionText) {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'form-check p-3 border rounded mb-2';

    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'form-check-input';
    input.name = `question_${questionId}`;
    input.value = String.fromCharCode(65 + optionIndex);
    input.id = `q${questionId}_opt${optionIndex}`;

    const label = document.createElement('label');
    label.className = 'form-check-label w-100';
    label.htmlFor = `q${questionId}_opt${optionIndex}`;
    label.style.cursor = 'pointer';
    label.innerHTML = `
      <strong>${String.fromCharCode(65 + optionIndex)}.</strong> ${optionText}
    `;

    optionDiv.appendChild(input);
    optionDiv.appendChild(label);

    return optionDiv;
  }

  createSubmitSection() {
    const container = document.createElement('div');
    container.className = 'text-center p-4 bg-white rounded shadow-sm';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary btn-lg px-5';
    submitBtn.textContent = 'Submit Quiz';
    submitBtn.disabled = this.isSubmitting;

    if (this.isSubmitting) {
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting...';
    }

    container.appendChild(submitBtn);
    return container;
  }

  async submitAnswers() {
    if (this.isSubmitting) return;

    // Collect answers
    const answers = {};
    let answeredCount = 0;

    this.questions.forEach(question => {
      const radios = document.getElementsByName(`question_${question.id}`);
      let chosen = null;

      for (const radio of radios) {
        if (radio.checked) {
          chosen = radio.value;
          answeredCount++;
          break;
        }
      }

      answers[question.id] = chosen;
    });

    // Validate that all questions are answered
    if (answeredCount < this.questions.length) {
      this.showError(`Please answer all ${this.questions.length} questions before submitting. (${answeredCount}/${this.questions.length} answered)`);
      return;
    }

    this.isSubmitting = true;
    this.updateSubmitButton();

    try {
      const params = new URLSearchParams(window.location.search);
      const year = params.get('year') || localStorage.getItem('quizYear') || '12';
      const subject = params.get('subject') || localStorage.getItem('quizSubject') || 'Advanced English';
      const area = params.get('area') || localStorage.getItem('quizArea') || 'vocab';
      const response = await fetch(`${API_BASE}/submit?year=${encodeURIComponent(year)}&subject=${encodeURIComponent(subject)}&area=${encodeURIComponent(area)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers, user_id: this.userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.renderResults(result);

    } catch (error) {
      this.showError(`Failed to submit quiz: ${error.message}`);
    } finally {
      this.isSubmitting = false;
      this.updateSubmitButton();
    }
  }

  updateSubmitButton() {
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
      submitBtn.disabled = this.isSubmitting;
      if (this.isSubmitting) {
        submitBtn.innerHTML = '<div class="spinner" style="display: inline-block; margin-right: 8px;"></div>Submitting...';
      } else {
        submitBtn.textContent = 'Submit Quiz';
      }
    }
  }

  renderResults(result) {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'card border-0 shadow-sm fade-in';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body text-center p-5';

    const scoreDiv = document.createElement('h2');
    scoreDiv.className = 'display-3 text-primary mb-3';
    scoreDiv.textContent = `${result.correct} / ${result.total}`;

    const percentDiv = document.createElement('p');
    percentDiv.className = 'h4 text-muted mb-4';
    percentDiv.textContent = `(${result.percent}%)`;

    const performanceText = document.createElement('div');
    performanceText.className = 'mb-4';

    if (result.message) {
      performanceText.innerHTML = `<div class="alert alert-info h5">${result.message}</div>`;
    } else if (result.percent >= 90) {
      performanceText.innerHTML = '<div class="alert alert-success h5">🌟 Outstanding! You have excellent vocabulary knowledge!</div>';
    } else if (result.percent >= 80) {
      performanceText.innerHTML = '<div class="alert alert-success h5">🎉 Great job! You have a strong understanding of the vocabulary.</div>';
    } else if (result.percent >= 70) {
      performanceText.innerHTML = '<div class="alert alert-warning h5">👍 Good work! Keep studying to improve further.</div>';
    } else {
      performanceText.innerHTML = '<div class="alert alert-danger h5">📚 Keep studying! Review the vocabulary and try again.</div>';
    }

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'row justify-content-center mb-4';

    const detailsCol = document.createElement('div');
    detailsCol.className = 'col-md-8';

    result.details.forEach(detail => {
      const item = document.createElement('div');
      item.className = 'd-flex justify-content-between align-items-center p-3 mb-2 rounded';

      if (detail.is_correct) {
        item.className += ' bg-success bg-opacity-10';
      } else if (detail.chosen === null) {
        item.className += ' bg-warning bg-opacity-10';
      } else {
        item.className += ' bg-danger bg-opacity-10';
      }

      const wordDiv = document.createElement('div');
      wordDiv.innerHTML = `<strong>${detail.word}</strong>`;

      const answerDiv = document.createElement('div');
      answerDiv.className = 'text-end';

      // User's chosen answer
      const chosenBadge = document.createElement('div');
      chosenBadge.className = `badge mb-1 ${
        detail.is_correct ? 'bg-success' :
        detail.chosen === null ? 'bg-warning text-dark' : 'bg-danger'
      }`;
      chosenBadge.textContent = `Your answer: ${detail.chosen || 'No answer'}`;

      // Correct answer
      const correctBadge = document.createElement('div');
      correctBadge.className = 'badge bg-info';
      correctBadge.textContent = `Correct: ${detail.correct_answer}`;

      answerDiv.appendChild(chosenBadge);
      answerDiv.appendChild(correctBadge);

      item.appendChild(wordDiv);
      item.appendChild(answerDiv);
      detailsCol.appendChild(item);
    });

    detailsDiv.appendChild(detailsCol);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-success btn-lg';
    retryBtn.innerHTML = result.next_stage ? '🔄 Continue to Next Stage' : (result.completed ? '🎉 Completed!' : '🔄 Try Again');
    retryBtn.onclick = () => {
      if (result.completed) {
        // Show completion message or reset
        alert('Congratulations! You have completed all stages.');
      } else {
        this.init();
      }
    };

    cardBody.appendChild(scoreDiv);
    cardBody.appendChild(percentDiv);
    cardBody.appendChild(performanceText);
    cardBody.appendChild(detailsDiv);
    cardBody.appendChild(retryBtn);
    container.appendChild(cardBody);

    app.appendChild(container);
  }
}

// Initialize the quiz app
const quizApp = new QuizApp();
document.addEventListener('DOMContentLoaded', () => {
  quizApp.init();
});