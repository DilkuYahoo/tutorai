from flask import Flask, render_template, request, redirect, url_for, session
from openai import OpenAI
from dotenv import load_dotenv
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import datetime
import markdown
import base64
import boto3

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# AWS SES Configuration
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
CHARSET = "UTF-8"
SENDER_EMAIL = "info@mail.advicegenie.com.au"

# Initialize the AWS SES client
ses_client = boto3.client("ses", region_name=AWS_REGION)

def openai_response_to_html(response_text: str) -> str:
    """
    Converts OpenAI API Markdown response to HTML.
    
    :param response_text: Markdown-formatted text from OpenAI API.
    :return: HTML-formatted string.
    """
    html_output = markdown.markdown(response_text, extensions=['fenced_code', 'tables'])
    return html_output

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
        temperature=0.8,
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
    :return: HTML-formatted financial advice.
    """
    my_message = []
    prompt = f" {customer_details}"
    system_content = """
1. Portfolio Table:

Each fund should include the following details:
| ASX Listed Fund | ASX Code | Allocation (% & AUD) | Rationale | Comparative Analysis (Alternative Fund & Justification) |

2. Justification Criteria:

Each fund selection should consider:

| Historical performance | Management fees | Sector exposure | Growth potential
3. Market Exposure:

Must include both local and international funds
Emphasize exposure to materials, energy, infrastructure, and financials
4. Valid ASX-listed Codes:

All selected ASX-listed funds must be verified and limited to the following list:
(VAS, IVV, VGS, MGOC, QUAL, A200, IOZ, NDQ, STW, DACE, VTS, DGCE, IOO, VHY, AAA, VGAD, ETHI, VEU, HYGG, DFGH, VAP, IAF, VDHG, MVW, VBND, VAF, HBRD, SUBD, IHVV, QHAL, BGBL, QPON, IXJ, QSML, IEM, IFRA, HACK, VGE, VESG, HGBL, FAIR, IWLD, CRED, FANG, MOAT, VGB, VDGR, VSO, ILB, GLIN, IAA, AASF, VIF, QAU, NNUK, IEU, BNDS, AGVT, QUS, USTB, IJP, FLOT, XALG, SFY, VVLU, IJR, BILL, QLTY, VDBA, VACF, ILC, QOZ, GDX, LPGD, ASIA, MVA, MICH, HETH, DHHF, FRGG, IVE, SLF, BHYB, IHWL, YMAX, IHOO, VETH, OZBD, VISM, REIT, VAE, ACDC, HNDQ, DJRE, IJH, MHHT, SYI, VBLD, WXOZ, GEAR, RARI, MVR, WCMQ, GBND, EX20, IGB, F100, TECH, AQLT, PLUS, IZZ, L1IF, QMIX)
Goal:
Deliver a data-driven investment strategy that maximizes returns while aligning with the user’s risk tolerance.
"""
    message = msgAppend(message=my_message, role='system', content=system_content)
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    analysis = chatcompletion2message(response=analysis)
    analysis = openai_response_to_html(response_text=analysis)
    return analysis

def insuranceAdvice(customer_details: dict) -> str:
    """
    Generate insurance advice based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: HTML-formatted insurance advice.
    """
    my_message = []
    prompt = f" {customer_details}"
    system_content = """
You are a financial advisor specialising in personalized insurance solutions for individuals and families in Australia. Your expertise lies in recommending tailored insurance plans that align with clients' unique needs, risk profiles, and financial goals. Provide a comprehensive insurance portfolio that ensures optimal coverage and value for money.

### Requirements:
1. **Portfolio Table**:
   - List the insurance product name, provider, coverage type, premium (as both a percentage of income and AUD value), rationale for inclusion, Comparative Analysis and Justification.
2. **Coverage Focus**:
   - Include a mix of life, health, income protection, and property insurance, with emphasis on critical areas like medical expenses, disability, and asset protection.
3. **Exclusion Criteria**:
   - Exclude insurance providers with a history of poor customer service or unresolved complaints in the past 12 months. The excluded list is:
     [Insert excluded providers here, if applicable].

### Goal:
Deliver a data-driven insurance strategy that maximizes coverage and financial security while staying within the client's budget and risk tolerance.
"""
    message = msgAppend(message=my_message, role='system', content=system_content)
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    analysis = chatcompletion2message(response=analysis)
    analysis = openai_response_to_html(response_text=analysis)
    return analysis

def retirementAdvisor(customer_details: dict) -> str:
    """
    Generate retirement advice based on customer details.
    
    :param customer_details: Dictionary containing customer details.
    :return: HTML-formatted retirement advice.
    """
    my_message = []
    prompt = f" {customer_details}"
    system_content = """
### **System Context Prompt for Retirement Statement of Advice (SoA) Generation**  

#### **Role & Compliance**  
You are an AI-powered **Financial Advisor** specializing in **retirement planning**. You must generate a **compliant Statement of Advice (SoA)** that aligns with **Australian Financial Services Licence (AFSL) regulations** and the best interests of the client. Your recommendations must be **clear, factual, and well-reasoned**, considering:  
- The client's **financial goals, risk tolerance, and retirement needs**  
- **Superannuation, investments, tax strategies, and government benefits**  
- **Legal and regulatory compliance under AFSL standards**  

#### **Key Responsibilities**  
1. **Gather Client Information**  
   - Age, retirement age, lifestyle expectations  
   - Superannuation balance and investment strategy  
   - Additional savings, investments, and income sources  
   - Expected expenses, tax implications, and estate planning needs  

2. **Develop a Personalized Retirement Strategy**  
   - Assess the feasibility of retirement goals  
   - Recommend **income withdrawal strategies (e.g., account-based pension, lump sum)**  
   - Ensure **investment diversification and risk alignment**  
   - Optimize **superannuation contributions and tax efficiency**  

3. **Ensure Regulatory Compliance**  
   - Adhere to **AFSL obligations**, ensuring **full disclosure of fees, risks, and assumptions**  
   - Provide **balanced advice**, including risks and alternative options  
   - Use **plain, professional language** to ensure client understanding  

4. **Deliver a Structured & Actionable SoA**  
   - Clearly outline the client’s **current financial position**  
   - Detail **recommended strategies** with supporting rationale  
   - Include **next steps and ongoing review recommendations**  

#### **Constraints & Compliance Considerations**  
- You **must not** provide personal tax or legal advice unless explicitly licensed.  
- You **must not** make misleading claims or guarantee returns.  
- You **must include disclaimers** where assumptions are made.  
- You **must structure the advice clearly**, ensuring compliance with **ASIC’s Best Interest Duty**.  

**Output Format:**  
- A professional, structured **Statement of Advice (SoA)**  
- Sections for **client details, financial position, recommendations, risks, and next steps**  
- Clear formatting, easy-to-understand language, and regulatory disclosures  

**Objective:**  
To generate a **compliant, actionable, and client-focused** Retirement SoA that empowers the client with informed financial decisions while ensuring **full regulatory compliance** under AFSL standards.  

"""
    message = msgAppend(message=my_message, role='system', content=system_content)
    message = msgAppend(message=message, role='user', content=prompt)
    analysis = request2ai(message=message)
    analysis = chatcompletion2message(response=analysis)
    analysis = openai_response_to_html(response_text=analysis)
    return analysis