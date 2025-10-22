# HSC Agent Web Application

A responsive web application that interacts with the HSC Agent API to provide a vocabulary quiz and calculator functionality.

## Files

- `index.html` - Main vocabulary quiz application
- `demo.html` - Simple calculator demo using the /sum API endpoint
- `styles.css` - Additional styles for enhanced responsiveness and animations

## Features

### Quiz Application (`index.html`)

- **Bootstrap Integration**: Modern, responsive design using Bootstrap 5 components
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Interactive Quiz**: Fetches questions from the `/questions` API endpoint
- **Answer Validation**: Submits answers to `/submit` endpoint for server-side validation
- **Results Display**: Shows detailed results with Bootstrap alerts and badges
- **Error Handling**: Comprehensive error handling with retry functionality
- **Loading States**: Visual feedback during API calls using Bootstrap spinners
- **Modern UI**: Clean, modern interface with enhanced cards and animations
- **Text Visibility**: All text properly visible on white backgrounds

### Calculator Demo (`demo.html`)

- **Bootstrap Styling**: Consistent design using Bootstrap 5 components
- **Simple Calculator**: Demonstrates the `/sum` API endpoint
- **Input Validation**: Validates user input before API calls
- **Error Handling**: Displays clear error messages using Bootstrap alerts
- **Responsive**: Mobile-friendly design
- **Enhanced UX**: Loading states and improved button interactions

## API Endpoints Used

The application interacts with the following HSC Agent API endpoints:

- `GET /questions` - Retrieves quiz questions (without answers for security)
- `POST /submit` - Submits quiz answers and receives validation results
- `POST /sum` - Simple calculator function for adding two numbers

## Usage

1. **Quiz Application**:
   - Open `index.html` in a web browser
   - Wait for questions to load from the API
   - Answer all questions by selecting radio button options
   - Click "Submit Quiz" to see your results
   - Use "Try Again" to retake the quiz

2. **Calculator Demo**:
   - Open `demo.html` in a web browser
   - Enter two numbers in the input fields
   - Click "Calculate Sum" or press Enter
   - View the result displayed below

## Responsive Breakpoints

- **Desktop**: 1024px and above - Full layout with all features
- **Tablet**: 768px - 1023px - Optimized layout with touch-friendly elements
- **Mobile**: 767px and below - Single column layout, larger touch targets

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Supports dark mode preferences

## Development

The application uses vanilla JavaScript with modern ES6+ features and Bootstrap 5:

- **Bootstrap 5**: CSS framework for responsive design and UI components
- `async/await` for API calls
- `fetch` API for HTTP requests
- Bootstrap Grid system for responsive layouts
- CSS Custom Properties for theming
- Modern CSS features (backdrop-filter, CSS gradients)
- Bootstrap JavaScript components (modals, tooltips, etc.)

## Deployment

These files are designed to be served as static content and work with the HSC Agent Lambda function when deployed via API Gateway.

### API Configuration

The applications are configured to use the deployed API Gateway endpoint:
- **API Base URL**: `https://xwb2kfdd3m.execute-api.ap-southeast-2.amazonaws.com`

The API_BASE variable in both `index.html` and `demo.html` has been set to point to your deployed API Gateway endpoint. The applications will work immediately when served from your S3 bucket.