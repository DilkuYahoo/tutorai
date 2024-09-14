from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
from dotenv import load_dotenv
from newsapi import NewsApiClient
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


def fetch_stock_data(ticker):
    stock = yf.Ticker(ticker)
    hist = stock.history(period="3mo", interval="1d")
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


def analyze_data(stock_data):
    # Convert the DataFrame to a dictionary for easier processing in the prompt
    stock_data_dict = stock_data.to_dict(orient='records')
    my_message = [] 
    # Create the analysis prompt
    prompt = f"Analyze the following stock data: {stock_data_dict}. What are the key trends and potential future movements?"
    system_content = "Share Market Analyst specialied is picking growth shares"
    message = msgAppend(message=my_message, role='system',content=system_content    ) 
    message = msgAppend(message= message, role='user',content=prompt)
    analysis = mylib.request2ai(message=message)
    analysis = mylib.chatcompletion2message(response=analysis)
    analysis = mylib.strings2html(analysis)
    return analysis


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
