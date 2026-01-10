
from libs.superchart1 import borrowing_capacity_forecast_investor_blocks
import json

# Sample data for borrowing_capacity_forecast_investor_blocks
investors = [
    {
        "name": "Bob",
        "base_income": 120000,
        "annual_growth_rate": 0.03,
        "income_events": [
            {"year": 5, "type": "increase", "amount": 10000},
            {"year": 10, "type": "set", "amount": 150000}
        ]
    },
    {
        "name": "Alice",
        "base_income": 100000,
        "annual_growth_rate": 0.025,
        "income_events": []
    }
]

properties = [
    {
        "name": "Property A",
        "purchase_year": 1,
        "loan_amount": 600000,
        "annual_principal_change": 0,  # Interest-only
        "rent": 30000,
        "interest_rate": 0.05,
        "other_expenses": 5000,
        "property_value": 660000,  # loan * 1.1
        "initial_value": 600000,
        "growth_rate": 0.03,
        "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
    },
    {
        "name": "Property B",
        "purchase_year": 3,
        "loan_amount": 500000,
        "annual_principal_change":  0,  # Interest-only
        "rent": 25000,
        "interest_rate": 0.04,
        "other_expenses": 4000,
        "property_value": 550000,  # loan * 1.1
        "initial_value": 500000,
        "growth_rate": 0.03,
        "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
    }
]

# Call the function
results = borrowing_capacity_forecast_investor_blocks(
    investors=investors,
    properties=properties,
    years=30
)
print (results)
