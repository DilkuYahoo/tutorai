from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import mylib

app = Flask(__name__)
CORS(app)

# Routes
@app.route("/send-email", methods=["POST"])
def send_email():
    try:
        data = request.get_json()
        required_fields = ["recipient", "subject", "body"]
        if not mylib.validate_json_input(data, required_fields):
            return jsonify({"error": "All fields (recipient, subject, body) are required"}), 400

        response = mylib.send_email_via_ses(
            data["recipient"], data["subject"], data["body"], 
            data.get("body_type", "text"), data.get("attachment"), 
            data.get("attachment_name"), data.get("attachment_type")
        )
        return jsonify({"message": "Email sent successfully", "response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_retirement_soa', methods=['POST'])
def get_retirement_soa():
    try:
        # Get the JSON data from the request
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["fullName", "email", "phone", "persona"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Missing required fields. Required: {', '.join(required_fields)}"}), 400

        # Extract persona details (assuming it's a string that needs parsing)
        persona_text = data["persona"]
        
        # Here you would typically parse the persona text into structured data
        # For now, we'll just use the raw text
        customer_details = {
            "name": data["fullName"],
            "email": data["email"],
            "phone": data["phone"],
            "persona": persona_text
        }

        current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Prepare data for Google Sheet
        sheet_data = [
            data["fullName"],
            data["email"],
            data["phone"],
            current_datetime
        ]

        # Generate analysis (assuming mylib has this function)
        analysis = mylib.retirementAdvisor(customer_details)
        
        analysis=mylib.convert_markdown_to_html_email(analysis)
        # Generate email body
        email_body = mylib.generate_email_body(
            "Retirement SOA Request Details",
            customer_details,
            "Retirement Analysis",
            analysis,
            current_datetime
        )

        # Send to Google Sheet and send email
        response = mylib.append_to_sheet_and_send_email(
            "leads",
            sheet_data,
            f"Retirement SOA for {data['fullName']}",
            email_body
        )

        return jsonify({
            "message": "Retirement SOA request processed successfully",
            "email_response": response
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route('/get_soi', methods=['POST'])
def get_soi():
    data, error = mylib.validate_and_extract_data(request.get_json(), [
        "fullName", "email", "phone", "age", "annualIncome", "dependents", "debts", 
        "survivalMonths", "occupation", "medicalConditions", "smokeDrink", "insuranceType", 
        "healthCoverage", "monthlyPremium"
    ])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'fullName', 'email', 'phone', 'age', 'annualIncome', 'dependents', 'debts', 
        'survivalMonths', 'occupation', 'medicalConditions', 'smokeDrink', 'insuranceType', 
        'healthCoverage', 'monthlyPremium', 'existingPolicies', 'payoutPreference'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.insuranceAdvice(customer_details)
    analysis=mylib.convert_markdown_to_html_email(analysis)
    email_body = mylib.generate_email_body(
        "Customer Details", customer_details, "Insurance Analysis", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"Statement of Insurance for {data.get('fullName')}", email_body
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update_leads', methods=['POST'])
def update_leads():
    data, error = mylib.validate_and_extract_data(request.get_json(), [
        "fullName", "email", "phone", "age", "financialGoal", "investmentAmount", "riskTolerance"
    ])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'fullName', 'email', 'phone', 'age', 'financialGoal', 'investmentAmount', 'riskTolerance'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.financialAdvisor(customer_details)
    analysis=mylib.convert_markdown_to_html_email(analysis)
    email_body = mylib.generate_email_body(
        "Customer Details", customer_details, "Financial Analysis", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"Statement of Advice for {data.get('fullName')}", email_body
        )
        return jsonify({"message": "Data successfully added to Google Sheet and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/onboard_advisors", methods=["POST"])
def onboard_advisors():
    try:
        data, error = mylib.validate_and_extract_data(request.get_json(), [
            "name", "phone", "email", "afsl", "businessName", "businessAddress", 
            "businessURL", "agreement1", "agreement2"
        ])
        if error:
            return jsonify({"error": error}), 400

        if not (data.get('agreement1') and data.get('agreement2')):
            return jsonify({"error": "You must agree to both the engagement and privacy terms"}), 400

        current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet_data = [data.get(key) for key in [
            'name', 'phone', 'email', 'afsl', 'businessName', 'businessAddress', 
            'businessURL', 'agreement1', 'agreement2'
        ]] + [current_datetime]

        email_body = mylib.generate_email_body(
            "New Advisor Onboarding", data, "Advisor Details", "", current_datetime
        )

        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"New Advisor Onboarding: {data.get('name')}", email_body
        )
        return jsonify({"message": "Advisor onboarding data received and processed", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"message": "Flask app is running"}), 200

@app.route('/multiply', methods=['POST'])
def multiply():
    try:
        data = request.get_json()
        a = float(data.get('a'))
        b = float(data.get('b'))
        result = a * b
        return jsonify({'result': result}), 200
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid input. Please provide numerical values for a and b.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate_english', methods=['POST'])
def generate_english():
    data, error = mylib.validate_and_extract_data(request.get_json(), [
        "name", "email", "language_level", "learning_goal"
    ])
    if error:
        return jsonify({"error": error}), 400

    current_datetime = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet_data = [data.get(key) for key in [
        'name', 'email', 'language_level', 'learning_goal'
    ]] + [current_datetime]

    customer_details = {key: data.get(key) for key in data}
    analysis = mylib.englishGeneration(customer_details)
    analysis=mylib.convert_markdown_to_html_email(analysis)
    email_body = mylib.generate_email_body(
        "English Language Questions", customer_details, "Generated Questions", analysis, current_datetime
    )

    try:
        response = mylib.append_to_sheet_and_send_email(
            "leads", sheet_data, f"English Language Questions for {data.get('name')}", email_body
        )
        return jsonify({"message": "English language questions generated and email sent", "email_response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)