from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
from dotenv import load_dotenv
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import re
import datetime
import base64
import boto3
from config import SYSTEM_PROMPTS, EMAIL_TEMPLATES, EMAIL_STYLES, GOOGLE_FONTS, BOOTSTRAP_CSS
import markdown2
from typing import List

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# AWS SES Configuration
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
CHARSET = "UTF-8"
SENDER_EMAIL = "info@mail.advicegenie.com.au"

# Initialize the AWS SES client
ses_client = boto3.client("ses", region_name=AWS_REGION)

def convert_markdown_to_html_email(md_content: str, extras: List[str] = None) -> str:
    """
    Converts Markdown content to HTML suitable for email formatting.

    Args:
        md_content (str): The Markdown content to convert.
        extras (List[str], optional): List of markdown2 extras to enable. 
            Defaults to common email-safe features.

    Returns:
        str: HTML representation of the Markdown content.
    """
    if extras is None:
        extras = [
            "fenced-code-blocks",
            "tables",
            "footnotes",
            "strike",
            "header-ids"
        ]

    return markdown2.markdown(md_content, extras=extras)

def get_google_sheet(spreadsheet_name: str, sheet_name: str):
    """
    Get a Google Sheet instance.
    
    :param spreadsheet_name: Name of the Google Spreadsheet.
    :param sheet_name: Name of the sheet within the spreadsheet.
    :return: Google Sheet instance.
    """
    scope = [
        "https://spreadsheets.google.com/feeds", 
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file", 
        "https://www.googleapis.com/auth/drive"
    ]
    
    creds = ServiceAccountCredentials.from_json_keyfile_name('.fintelle-gsheet.json', scope)
    client = gspread.authorize(creds)
    sheet = client.open(spreadsheet_name).worksheet(sheet_name)
    return sheet

def append_to_google_sheet(sheet_name: str, sheet_tab: str, data: list):
    """
    Append data to a Google Sheet.
    
    :param sheet_name: Name of the Google Spreadsheet.
    :param sheet_tab: Name of the sheet within the spreadsheet.
    :param data: List of data to append.
    """
    sheet = get_google_sheet(sheet_name, sheet_tab)
    sheet.append_row(data)

def validate_json_input(data: dict, required_fields: list) -> bool:
    """
    Validate JSON input to ensure all required fields are present.
    
    :param data: JSON data to validate.
    :param required_fields: List of required fields.
    :return: True if all required fields are present, False otherwise.
    """
    return all(data.get(field) for field in required_fields)

def send_email_via_ses(recipient: str, subject: str, body: str, body_type: str = "text", attachment: str = None, attachment_name: str = None, attachment_type: str = None):
    """
    Send an email via AWS SES.
    
    :param recipient: Email recipient.
    :param subject: Email subject.
    :param body: Email body.
    :param body_type: Type of email body (text or html).
    :param attachment: Base64 encoded attachment.
    :param attachment_name: Name of the attachment.
    :param attachment_type: MIME type of the attachment.
    :return: SES response.
    """
    try:
        body_content_type = "text/html" if body_type.lower() == "html" else "text/plain"
        message = {
            "Subject": {"Data": subject, "Charset": CHARSET},
            "Body": {
                "Html" if body_type.lower() == "html" else "Text": {"Data": body, "Charset": CHARSET}
            },
        }

        if attachment and attachment_name and attachment_type:
            attachment_data = base64.b64decode(attachment)
            raw_message = {
                "Source": SENDER_EMAIL,
                "Destinations": [recipient],
                "RawMessage": {
                    "Data": f"From: {SENDER_EMAIL}\nTo: {recipient}\nSubject: {subject}\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=boundary\n\n--boundary\nContent-Type: {body_content_type}; charset=UTF-8\n\n{body}\n\n--boundary\nContent-Type: {attachment_type}; name={attachment_name}\nContent-Disposition: attachment; filename={attachment_name}\nContent-Transfer-Encoding: base64\n\n{attachment}\n\n--boundary--"
                }
            }
            response = ses_client.send_raw_email(**raw_message)
        else:
            response = ses_client.send_email(
                Source=SENDER_EMAIL,
                Destination={"ToAddresses": [recipient]},
                Message=message,
            )
        return response
    except Exception as e:
        raise e

def msgAppend(message: list, role: str, content: str) -> list:
    """
    Append a message to the message list.
    
    :param message: List of messages.
    :param role: Role of the message (system, user, assistant).
    :param content: Content of the message.
    :return: Updated message list.
    """
    message.append({"role": role, "content": [{"type": "text", "text": content}]})
    return message

def chatcompletion2message(response) -> str:
    """
    Extract the message content from the OpenAI chat completion response.
    
    :param response: OpenAI chat completion response.
    :return: Message content.
    """
    return response.choices[0].message.content

def request2ai(message: list):
    """
    Send a request to OpenAI's chat completion API.
    
    :param message: List of messages.
    :return: OpenAI chat completion response.
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=message,
        temperature=1.0,
        max_tokens=2048,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0
    )
    return response

def financialAdvisor(customer_details: dict) -> str:
    """
    Generate financial advice based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: Financial advice as plain text.
    """
    my_message = []
    prompt = f" {customer_details}"
    message = msgAppend(message=my_message, role='system', content=SYSTEM_PROMPTS["financial_advisor"])
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    return chatcompletion2message(response=analysis)

def insuranceAdvice(customer_details: dict) -> str:
    """
    Generate insurance advice based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: Insurance advice as plain text.
    """
    my_message = []
    prompt = f" {customer_details}"
    message = msgAppend(message=my_message, role='system', content=SYSTEM_PROMPTS["insurance_advice"])
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    return chatcompletion2message(response=analysis)

def retirementAdvisor(customer_details: dict) -> str:
    """
    Generate retirement advice based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: Retirement advice as plain text.
    """
    my_message = []
    prompt = f" {customer_details}"
    message = msgAppend(message=my_message, role='system', content=SYSTEM_PROMPTS["retirement_advisor"])
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    return chatcompletion2message(response=analysis)

def englishGeneration(customer_details: dict) -> str:
    """
    Generate English language questions based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: English questions as plain text.
    """
    my_message = []
    prompt = f" {customer_details}"
    message = msgAppend(message=my_message, role='system', content=SYSTEM_PROMPTS["english_generation"])
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    return chatcompletion2message(response=analysis)

# Helper Functions moved from app.py
def validate_and_extract_data(data, required_fields):
    """
    Validate JSON input and extract data.
    
    :param data: JSON data to validate.
    :param required_fields: List of required fields.
    :return: Tuple of (data, error_message) where error_message is None if validation passes.
    """
    if not request.is_json:
        return None, "Invalid input: JSON data expected"
    if not validate_json_input(data, required_fields):
        return None, "Missing required fields"
    return data, None

def generate_email_body(title, details, analysis_title, analysis, current_datetime):
    """
    Generate an email body using the email template.
    
    :param title: Title of the email.
    :param details: Dictionary of customer details.
    :param analysis_title: Title of the analysis section.
    :param analysis: Analysis content.
    :param current_datetime: Current date and time.
    :return: Formatted email body.
    """
    return EMAIL_TEMPLATES["customer_details"].format(
        google_fonts=GOOGLE_FONTS,
        bootstrap_css=BOOTSTRAP_CSS,
        body=EMAIL_STYLES["body"],
        container=EMAIL_STYLES["container"],
        card=EMAIL_STYLES["card"],
        heading=EMAIL_STYLES["heading"],
        table=EMAIL_STYLES["table"],
        table_cell=EMAIL_STYLES["table_cell"],
        table_header=EMAIL_STYLES["table_header"],
        title=title,
        details=''.join(f'<p><strong>{key}:</strong> {value}</p>' for key, value in details.items() if value),
        analysis_title=analysis_title,
        analysis=analysis,
        current_datetime=current_datetime
    )

def append_to_sheet_and_send_email(sheet_name, sheet_data, email_subject, email_body, recipient="info@advicegenie.com.au"):
    """
    Append data to a Google Sheet and send an email.
    
    :param sheet_name: Name of the Google Spreadsheet.
    :param sheet_data: List of data to append.
    :param email_subject: Subject of the email.
    :param email_body: Body of the email.
    :param recipient: Email recipient.
    :return: SES response.
    """
    append_to_google_sheet(sheet_name, "Sheet1", sheet_data)
    response = send_email_via_ses(recipient, email_subject, email_body, "html")
    return response