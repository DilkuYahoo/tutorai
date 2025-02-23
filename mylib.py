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
def get_google_sheet(spreadsheet_name: str, sheet_name: str):
    scope = [
        "https://spreadsheets.google.com/feeds", 
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file", 
        "https://www.googleapis.com/auth/drive"
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name('.fintelle-gsheet.json', scope)
    client = gspread.authorize(creds)
    sheet = client.open(spreadsheet_name).worksheet(sheet_name)  # Select sheet by name
    
    return sheet


def financialAdvisor(customer_details):
    #combined_news = " ".join(headlines)
    my_message = [] 
    # Create the analysis prompt
    prompt = f" {customer_details}"
    # system_content = ""
    # system_content = "You are a financial advisor specializing in constructing personalized share portfolios tailored to user-provided financial goals, risk tolerance, and market preferences within the Australian investment landscape. Recommend an optimized portfolio of ASX-listed Index Funds (ETFs) and Managed Funds with a strong track record of performance improvement. Provide 5 to 10 diversified fund selections, specifying investment allocation as both a percentage and AUD value. Offer a comparative analysis with an alternative ASX-listed fund for each recommendation and justify choices based on historical performance, fees, sector exposure, and growth potential. Ensure the portfolio includes local and international exposure, considering key Australian sectors like materials, energy, infrastructure, and financials. The goal is to provide a data-driven investment strategy that maximizes returns within the user's risk tolerance. Exclude any delisted companies for last 6 month and the list is MKG,LRS,SXG,CAI,CDD,ADA,DRA,GDA,EP1,NTL,CAJ,ANL,POX,CE1,TNJ,CSE,AME,POW,RB1,TT3,VT2,E33,LT6,AMT,RXM,ME1,NAM,WEK,ZER,IMQ,RFC,PSI,APM,BSE,SRX,K2F,SCL,VUK,PU2,PNX,KED,AND,ECG,AC8,AJQ,AJY,BKG,CFO,ELE,HLF,LVT,MCL,NGL,PAN,ROO,RVS,TBA,LT5,QIP,MMM,DCG,MLM,SIH"  

    system_content = """
You are a financial advisor specialising in personalised share portfolios for the Australian investment landscape. 
Recommend an optimised ASX-listed Index Fund (ETF) and Managed Fund portfolio, ensuring strong historical performance. 
Provide 5 to 10 diversified fund selections with investment allocation as both a percentage and AUD value.

### Requirements:
1. Portfolio Table:
   - List fund name, ASX code, allocation (% and AUD), and rationale.
2. Comparative Analysis:
   - Suggest an alternative ASX-listed fund for each selection with justification.
3. Justification Criteria:
   - Consider historical performance, fees, sector exposure, and growth potential.
4. Market Exposure:
   - Include local and international funds with emphasis on **materials, energy, infrastructure, and financials.**
5. Exclusion Criteria:
   - Exclude delisted companies in the past 6 months. The excluded list is:
     MKG, LRS, SXG, CAI, CDD, ADA, DRA, GDA, EP1, NTL, CAJ, ANL, POX, CE1, TNJ, CSE, AME, POW, RB1, TT3, VT2, E33, 
     LT6, AMT, RXM, ME1, NAM, WEK, ZER, IMQ, RFC, PSI, APM, BSE, SRX, K2F, SCL, VUK, PU2, PNX, KED, AND, ECG, AC8, 
     AJQ, AJY, BKG, CFO, ELE, HLF, LVT, MCL, NGL, PAN, ROO, RVS, TBA, LT5, QIP, MMM, DCG, MLM, SIH.

The goal is to deliver a data-driven investment strategy that maximizes returns within the user's risk tolerance.
"""


    message = msgAppend(message=my_message, role='system',content=system_content) 
    message = msgAppend(message= message, role='user',content=prompt)
    analysis = mylib.request2ai(message=message)
    analysis = mylib.chatcompletion2message(response=analysis)
    analysis = mylib.openai_response_to_html(response_text=analysis)
    
    return analysis


def msgAppend(message,role,content):
    message.append( {"role": role, "content": [{ "type": "text","text": content }]} )
    return (message)

def chatcompletion2message(response):
    return response.choices[0].message.content

def request2ai(message):
    response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=message,
    temperature=0.8,
    max_tokens=1024,
    top_p=1,
    frequency_penalty=0,
    presence_penalty=0
    )
    return(response)