from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
from dotenv import load_dotenv
from newsapi.newsapi_client import NewsApiClient
import gspread
from oauth2client.service_account import ServiceAccountCredentials

import os
import mylib
import yfinance as yf
import datetime

load_dotenv()
client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY")
        )
newsapi = NewsApiClient(
        api_key=os.environ.get("YOUR_NEWSAPI_API_KEY")
        )

# Google Sheets setup
def get_google_sheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/spreadsheets",
             "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]

    creds = ServiceAccountCredentials.from_json_keyfile_name('.fintelle-gsheet.json', scope)
    client = gspread.authorize(creds)
    sheet = client.open("leads").sheet1  # Choose the first sheet, or specify the name
    return sheet



def financialAdvisor(customer_details):
    #combined_news = " ".join(headlines)
    my_message = [] 
    # Create the analysis prompt
    prompt = f" {customer_details}"
    system_content = "You are a financial advisor AI specializing in creating custom share portfolios based on user-provided financial goals, risk tolerance, and preferences. Your primary objective is to recommend an optimized portfolio of shares, ensuring the user’s investment aligns with their risk appetite, objectives, and market exposure preferences"
    message = msgAppend(message=my_message, role='system',content=system_content    ) 
    message = msgAppend(message= message, role='user',content=prompt)
    analysis = mylib.request2ai(message=message)
    analysis = mylib.chatcompletion2message(response=analysis)
    analysis = mylib.strings2html(analysis)
    
    # Get Google Sheet instance
    sheet = mylib.get_google_sheet()

    # Append row data to Google Sheet
    #sheet.append_row([customer_details{"full"}, email, message])
    return analysis

def analyze_stock_sentiment(headlines):
    combined_news = " ".join(headlines)
    my_message = [] 
    # Create the analysis prompt
    prompt = f"Analyze the following news headlines and provide a sentiment score between -1 (very bearish) to 1 (very bullish):\n\n{combined_news}"
    system_content = "Share Market Analyst specialied is calculating sentiment score"
    message = msgAppend(message=my_message, role='system',content=system_content    ) 
    message = msgAppend(message= message, role='user',content=prompt)
    analysis = mylib.request2ai(message=message)
    analysis = mylib.chatcompletion2message(response=analysis)
    analysis = mylib.strings2html(analysis)
    return analysis


def fetch_stock_data(ticker,period):
    stock = yf.Ticker(ticker)
    hist = stock.history(period=period, interval="1d")
    return hist

# Function to fetch news headlines for a stock
def fetch_news_headlines(stock):
    ticker = yf.Ticker(stock)
    company_info = ticker.info
    company_name = company_info.get('longName', 'N/A')

    query = stock.split('.')[0]  # Remove the '.AX' suffix for the query
    today = datetime.date.today()
    last_year = today - datetime.timedelta(days=30)
    
    articles = newsapi.get_everything(q=company_name, from_param=last_year, to=today, language='en', sort_by='relevancy')
    headlines = [article['title'] for article in articles['articles']]
    return headlines


import logging

# Configure logging
logging.basicConfig(
    filename='analyze_data.log',
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def analyze_data(stock_data):
    """
    Analyzes the given stock data and provides insights into key trends and potential future movements.

    Parameters:
    stock_data (DataFrame): A pandas DataFrame containing stock data.

    Returns:
    str: The analysis of the stock data in HTML format, or an error message if the process fails.
    """
    logging.info("Function analyze_data called.")

    try:
        # Step 1: Validate input
        if stock_data is None or stock_data.empty:
            logging.error("Input stock_data is None or empty.")
            raise ValueError("The stock_data parameter is either None or empty. Please provide valid data.")
        logging.debug("Input stock_data validated successfully.")

        # Step 2: Convert the stock data DataFrame into a dictionary format for easier processing.
        try:
            stock_data_dict = stock_data.to_dict(orient='records')
            logging.debug("Converted stock_data to dictionary format.")
        except AttributeError as e:
            logging.error("The stock_data parameter must be a pandas DataFrame.")
            raise TypeError("The stock_data parameter must be a pandas DataFrame.") from e

        # Step 3: Initialize an empty message list to construct the conversation for the AI.
        my_message = []

        # Step 4: Define the analysis prompt that will be sent to the AI system.
        prompt = f"Analyze the following stock data: {stock_data_dict}. What are the key trends and potential future movements?"
        logging.debug("Analysis prompt created.")

        # Step 5: Define the system's role for this interaction.
        system_content = "Share Market Analyst specialized in picking growth shares"
        logging.debug("System content defined.")

        # Step 6: Append the system role and content to the message list.
        try:
            message = msgAppend(message=my_message, role='system', content=system_content)
            message = msgAppend(message=message, role='user', content=prompt)
            logging.debug("Message constructed successfully.")
        except Exception as e:
            logging.error("Failed to construct the message for the AI.")
            raise RuntimeError("Failed to construct the message for the AI.") from e

        # Step 7: Send the constructed message to the AI system and get the response.
        try:
            analysis = mylib.request2ai(message=message)
            logging.debug("Received response from AI system.")
        except Exception as e:
            logging.error("Failed to communicate with the AI system.")
            raise ConnectionError("Failed to communicate with the AI system.") from e

        # Step 8: Extract the analysis from the AI response.
        try:
            analysis = mylib.chatcompletion2message(response=analysis)
            logging.debug("Processed the AI response successfully.")
        except Exception as e:
            logging.error("Failed to process the AI response.")
            raise ValueError("Failed to process the AI response.") from e

        # Step 9: Convert the analysis text into HTML format for better presentation.
        try:
            analysis = mylib.strings2html(analysis)
            logging.debug("Converted analysis to HTML format.")
        except Exception as e:
            logging.error("Failed to convert the analysis to HTML format.")
            raise ValueError("Failed to convert the analysis to HTML format.") from e

        # Step 10: Return the formatted analysis.
        logging.info("Function analyze_data completed successfully.")
        return analysis

    except ValueError as ve:
        logging.exception(f"ValueError: {ve}")
        return f"ValueError: {ve}"
    except TypeError as te:
        logging.exception(f"TypeError: {te}")
        return f"TypeError: {te}"
    except ConnectionError as ce:
        logging.exception(f"ConnectionError: {ce}")
        return f"ConnectionError: {ce}"
    except RuntimeError as re:
        logging.exception(f"RuntimeError: {re}")
        return f"RuntimeError: {re}"
    except Exception as e:
        logging.exception(f"An unexpected error occurred: {e}")
        return f"An unexpected error occurred: {e}"



def msgAppend(message,role,content):
    message.append( {"role": role, "content": [{ "type": "text","text": content }]} )
    return (message)

def strings2html (string):
    str = string.replace("\n","<br>")
    string = str.replace(r'\(', '').replace(r'\)', '')
    return string

def chatcompletion2message(response):
    return response.choices[0].message.content

def request2ai(message):
    response = client.chat.completions.create(
    model="gpt-4o",
    messages=message,
    temperature=0.8,
    max_tokens=1024,
    top_p=1,
    frequency_penalty=0,
    presence_penalty=0
    )
    return(response)

def generateQ(init,message,student):
    if init == "yes":
        if student['year'] == "psychometric":
            system_content = f"The OPQ measures 32 different personality traits that are relevant to occupational settings. Ultimately the test measures traits with the purpose of determining your behavioural style at work"
            user_content = f"provide a {student['subject']} ability questions without the solution, similar to SHL testing site, also provide the exptected time to respond is seconds"
        else :
            system_content=f"You are an expert educational assistant tasked with creating engaging and thought-provoking questions for high school students in {student['state']} {student['country']}. The question should be suitable for {student['year']}, {student['term']} and cover subject {student['subject']} {student['specialist_area']}"
            user_content=f"Generating a question without the answer with a difficulty level {student['difficulty']} out of 5 to test the in-depth understanding of the subject"

        message = mylib.msgAppend(message=message,role="system",content=system_content)
        message = mylib.msgAppend(message=message,role="user",content=user_content)
    else:
        user_content= f"prompt another slightly difficult question"
        message = mylib.msgAppend(message=message,role="user",content=user_content)

    str = request2ai(message)
    question = chatcompletion2message(response=str)
    #question = "this is a test question"
    message = msgAppend(message,'assistant',question)
    question = strings2html(question)
    return question, message



def generateQold(init,message,student):
    if init == "yes":
        country = student["country"]
        state = student["state"]
        year = student["year"]
        subject = student["subject"]
        specialist_area = student["specialist_area"]
        difficulty = student["difficulty"]
        system_content= f"Teacher specialised in year {year} student living in {country} {state} in the year 2024"
        user_content=f"Generate a question in subject {subject} {specialist_area} with difficulty level {difficulty} out of 5, question only"
        message = msgAppend(message=message,role="system",content=system_content)
        message = msgAppend(message=message,role="user",content=user_content)
        
    else:
        user_content="Ask another question slightly increase difficulty"
        message = msgAppend(message=message,role="user",content=user_content)

    str = request2ai(message)
    question = chatcompletion2message(response=str)
    #question = "this is a test question"
    message = msgAppend(message,'assistant',question)
    question = strings2html(question)
    return question, message

def validateAnw(message, answer):
    answer = f"{answer} Is the correct answer ? if not please explain"
    message = msgAppend(message=message,role="user",content=answer)
    str = request2ai(message=message)
    str = chatcompletion2message(response=str)
    str = strings2html(str)
    return str,message
