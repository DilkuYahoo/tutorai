# config.py

# External Resources
GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap"
BOOTSTRAP_CSS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"

# Email Template Styles
EMAIL_STYLES = {
    "body": "font-family: 'Roboto', sans-serif; background-color: #f8f9fa; padding: 20px;",
    "container": "max-width: 800px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);",
    "card": "background: #ffffff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);",
    "heading": "color: #333366;",
    "table": "width: 100%; border-collapse: collapse;",
    "table_cell": "padding: 10px; border: 1px solid #ddd;",
    "table_header": "background-color: #333366; color: white;",
}

# Email Templates
EMAIL_TEMPLATES = {
    "customer_details": """
        <html>
        <head>
            <link href="{google_fonts}" rel="stylesheet">
            <link href="{bootstrap_css}" rel="stylesheet">
            <style>
                body {{ {body} }}
                .container {{ {container} }}
                .card {{ {card} }}
                h1, h2 {{ {heading} }}
                table {{ {table} }}
                th, td {{ {table_cell} }}
                th {{ {table_header} }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="text-primary">{title}</h1>
                <div class="card">
                    {details}
                    <p><strong>Date and Time:</strong> {current_datetime}</p>
                </div>
                <div class="analysis mt-4">
                    <h2 class="text-success">{analysis_title}</h2>
                    <table class="table table-striped table-bordered">
                        {analysis}
                    </table>
                </div>
            </div>
        </body>
        </html>
    """
}