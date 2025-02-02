from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import mylib
import json
from flask_cors import CORS


#import hashlib

app = Flask(__name__)
CORS(app)

app.secret_key = 'abc123e'
init = 'yes'
message_json = [] 




@app.route('/sentiment_tracker', methods=['POST'])
def sentiment_tracker():
    """
    Endpoint to track sentiment based on stock ticker symbol and exchange name.
    """
    # Validate and parse JSON input
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    # Extract and validate required fields
    ticker = data.get('TickerSymbol', '').strip()
    exchange = data.get('exchangeName', '').strip()
    period = data.get('period', '').strip()  # Optional field; may remove if unused

    if not ticker or not exchange:
        return jsonify({"error": "Missing required fields: TickerSymbol or exchangeName"}), 400

    # Construct the full ticker symbol
    full_ticker = f"{ticker}{exchange}"

    try:
        # Fetch stock news headlines
        headlines = mylib.fetch_news_headlines(full_ticker)

        # Analyze sentiment of the fetched headlines
        output = mylib.analyze_stock_sentiment(headlines)
    except Exception as e:
        return jsonify({"error": f"Failed to process stock data: {str(e)}"}), 500

    # Return sentiment analysis result
    return jsonify({"result": output}), 200


@app.route('/gen_share_portfolio', methods=['POST'])
def ger_share_portfolio():
    input_data = request.json
    combined_data = mylib.financialAdvisor(input_data)
    return jsonify({"result": combined_data})

@app.route('/update_leads', methods=['POST'])
def update_leads():
    # Validate JSON input
    if not request.is_json:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    data = request.get_json()

    # Extract all the required fields from JSON data
    full_name = data.get('fullName')
    email = data.get('email')
    phone = data.get('phone')
    dob = data.get('dob')
    financial_goal = data.get('financialGoal')
    investment_amount = data.get('investmentAmount')  # New field
    risk_tolerance = data.get('riskTolerance')

    # Check if all required fields are present
    if not all([full_name, email, phone, dob, financial_goal, investment_amount, risk_tolerance]):
        return jsonify({"error": "Missing required fields"}), 400

    # Get Google Sheet instance
    sheet = mylib.get_google_sheet()

    # Append row data to Google Sheet
    sheet.append_row([
        full_name, 
        email, 
        phone, 
        dob, 
        financial_goal, 
        investment_amount,  # New field
        risk_tolerance
    ])

    return jsonify({"message": "Data successfully added to Google Sheet"}), 200


@app.route('/multiply', methods=['POST'])
def multiply():
    try:
        # Get 'a' and 'b' from the JSON body of the request
        data = request.get_json()
        a = float(data.get('a'))
        b = float(data.get('b'))
        result = a * b
        return jsonify({'result': result}), 200
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid input. Please provide numerical values for a and b.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/ticker_analysis', methods=['POST'])
def ticker_analysis():
    # Validate JSON input
    try:
        data = request.get_json(force=True)  # Force parsing as JSON
    except:
        return jsonify({"error": "Invalid input: JSON data expected"}), 400

    # Extract and validate required fields
    ticker = data.get('TickerSymbol', '').rstrip()
    exchange = data.get('exchangeName', '').rstrip()
    period = data.get('period', '').rstrip()

    if not ticker or not exchange:
        return jsonify({"error": "Missing required fields: TickerSymbol or exchangeName"}), 400

    # Prepare full ticker symbol
    full_ticker = f"{ticker}{exchange}"

    try:
        # Fetch stock data
        stock_data = mylib.fetch_stock_data(ticker=full_ticker,period=period)
        
        # Convert DataFrame to JSON serializable format
        stock_data_json = stock_data.to_dict(orient='records')  # List of dictionaries
        # Fetch stock data
        output = mylib.analyze_data(stock_data=stock_data)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch stock data: {str(e)}"}), 500

    # Return stock data
    return jsonify({"result": output})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port="8080", debug=True)
