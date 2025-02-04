from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
from dotenv import load_dotenv
import gspread
from oauth2client.service_account import ServiceAccountCredentials

import os
import mylib
import datetime
import markdown

load_dotenv()
client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY")
        )

def openai_response_to_html(response_text: str) -> str:
    """
    Converts OpenAI API Markdown response to HTML.
    
    :param response_text: Markdown-formatted text from OpenAI API.
    :return: HTML-formatted string.
    """
    # Convert Markdown to HTML
    html_output = markdown.markdown(response_text, extensions=['fenced_code', 'tables'])
    
    return html_output

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
    system_content = "You are an experienced financial advisor lives in Sydney Australia, specialized in creating custom share portfolios based on user-provided financial goals, risk tolerance, and preferences. Your primary objective is to recommend an optimized portfolio of shares, ensuring the user’s investment aligns with their risk appetite, objectives, and market exposure preferences"
    message = msgAppend(message=my_message, role='system',content=system_content) 
    message = msgAppend(message= message, role='user',content=prompt)
    analysis = mylib.request2ai(message=message)
    analysis = mylib.chatcompletion2message(response=analysis)
    analysis = mylib.openai_response_to_html(response_text=analysis)
    
    # Get Google Sheet instance
    #sheet = mylib.get_google_sheet()

    # Append row data to Google Sheet
    #sheet.append_row([customer_details{"full"}, email, message])
    return analysis


def msgAppend(message,role,content):
    message.append( {"role": role, "content": [{ "type": "text","text": content }]} )
    return (message)

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