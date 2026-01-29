
from libs.superchart1 import borrowing_capacity_forecast_investor_blocks, calculate_net_income
import json

# Sample data for borrowing_capacity_forecast_investor_blocks
investors = [
    {
        "name": "Bob",
        "base_income": 120000,
        "annual_growth_rate": 0.03,
        "essential_expenditure": 30000,
        "nonessential_expenditure": 15000,
        "income_events": [
            {"year": 5, "type": "increase", "amount": 10000},
            {"year": 10, "type": "set", "amount": 150000}
        ]
    },
    {
        "name": "Alice",
        "base_income": 100000,
        "annual_growth_rate": 0.025,
        "essential_expenditure": 25000,
        "nonessential_expenditure": 12000,
        "income_events": []
    }
]

properties = [
    {
        "name": "Property A",
        "purchase_year": 1,
        "loan_amount": 60000,
        "annual_principal_change": 0,  # Interest-only
        "rent": 30000,
        "interest_rate": 0.05,
        "other_expenses": 5000,
        "property_value": 600000,  # Use initial_value directly
        "initial_value": 600000,
        "growth_rate": 0.03,
        "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
    },
    {
        "name": "Property B",
        "purchase_year": 3,
        "loan_amount": 50000,
        "annual_principal_change":  0,  # Interest-only
        "rent": 25000,
        "interest_rate": 0.04,
        "other_expenses": 4000,
        "property_value": 500000,  # Use initial_value directly
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


# Test calculate_net_income function
def test_calculate_net_income():
    # Test cases based on Australian tax brackets (including Medicare levy)
    test_cases = [
        # (gross_income, expected_net_income)
        (18000, 17640.0),  # Below tax threshold, Medicare deducted
        (30000, 27158.0),  # In first bracket
        (60000, 48833.0),  # In second bracket
        (150000, 106433.0),  # In third bracket
        (200000, 135333.0),  # In fourth bracket
        (250000, 161833.0),  # In top bracket
    ]

    for gross, expected in test_cases:
        result = calculate_net_income(gross)
        print(f"Gross: ${gross}, Net: ${result}, Expected: ${expected}")
        assert abs(result - expected) < 0.01, f"Failed for gross {gross}: got {result}, expected {expected}"

    print("All calculate_net_income tests passed!")


# Run the test
if __name__ == "__main__":
    test_calculate_net_income()

