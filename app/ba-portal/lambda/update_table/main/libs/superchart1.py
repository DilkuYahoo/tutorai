import json
from typing import List, Dict


def borrowing_capacity_forecast_investor_blocks(
    investors: List[Dict],
    properties: List[Dict],
    years: int
):
    """
    Forecasts income, borrowing capacity and debt using investor blocks.

    Parameters
    ----------
    investors : list of dict
        Each investor must include:
            - name : str
            - base_income : float
            - annual_growth_rate : float
            - income_events : list of dict with
                - year : int
                - type : "increase" or "set"
                - amount : float

    properties : list of dict
        Each property must include:
            - name : str
            - purchase_year : int
            - loan_amount : float
            - annual_principal_change : float
            - rent : float
            - interest_rate : float
            - other_expenses : float
            - property_value : float
            - initial_value : float (optional, defaults to loan_amount)
            - growth_rate : float
            - investor_splits : list of dict with
                - name : str
                - percentage : float

    years : int
        Number of forecast years
    """

    results = {"yearly_forecast": []}

    # track current investor incomes
    investor_current_income = {
        inv["name"]: inv["base_income"] for inv in investors
    }

    # map events per investor
    investor_events = {
        inv["name"]: inv.get("income_events", []) for inv in investors
    }

    # property balances
    property_balances = {}

    # property values
    property_values = {prop["name"]: prop.get("initial_value", prop["loan_amount"]) for prop in properties}

    # investor debts
    investor_debt = {inv["name"]: 0 for inv in investors}

    for year in range(1, years + 1):

        # ---- handle investor incomes ----
        combined_income = 0
        investor_income_snapshot = {}

        for inv in investors:
            name = inv["name"]

            # apply scheduled events
            for ev in investor_events[name]:
                if ev["year"] == year:
                    if ev["type"] == "increase":
                        investor_current_income[name] += ev["amount"]
                    elif ev["type"] == "set":
                        investor_current_income[name] = ev["amount"]

            # apply annual growth (after year 1)
            if year > 1:
                investor_current_income[name] *= (1 + inv["annual_growth_rate"])

            income_val = investor_current_income[name]
            combined_income += income_val
            investor_income_snapshot[name] = round(income_val, 2)

        # ---- handle properties ----
        for prop in properties:
            if prop["purchase_year"] == year:
                property_balances[prop["name"]] = prop["loan_amount"]
                for split in prop.get("investor_splits", []):
                    investor_debt[split["name"]] += prop["loan_amount"] * split["percentage"] / 100

        for prop in properties:
            name = prop["name"]
            if name in property_balances and year >= prop["purchase_year"]:
                property_balances[name] += prop["annual_principal_change"]
                for split in prop.get("investor_splits", []):
                    investor_debt[split["name"]] += prop["annual_principal_change"] * split["percentage"] / 100

        total_debt = sum(property_balances.values())

        # ---- property LVRs ----
        property_lvrs = {}
        for prop in properties:
            name = prop["name"]
            if name in property_balances:
                loan = property_balances[name]
                value = prop["property_value"]
                lvr = (loan / value) * 100 if value > 0 else 0
                property_lvrs[name] = round(lvr, 2)

        # ---- per-investor costs ----
        investor_interest_cost = {inv["name"]: 0 for inv in investors}
        investor_rent = {inv["name"]: 0 for inv in investors}
        investor_other_expenses = {inv["name"]: 0 for inv in investors}

        for prop in properties:
            if year >= prop["purchase_year"]:
                interest = property_balances.get(prop["name"], 0) * prop["interest_rate"]
                rent = prop["rent"]
                other = prop["other_expenses"]
                for split in prop.get("investor_splits", []):
                    pct = split["percentage"] / 100
                    investor_interest_cost[split["name"]] += interest * pct
                    investor_rent[split["name"]] += rent * pct
                    investor_other_expenses[split["name"]] += other * pct

        # ---- investor net incomes ----
        investor_net_income = {}
        for inv in investors:
            name = inv["name"]
            gross = investor_current_income[name]
            net = gross - investor_interest_cost[name] - investor_rent[name] - investor_other_expenses[name]
            investor_net_income[name] = round(net, 2)

        combined_income = sum(investor_net_income.values())
        investor_income_snapshot = investor_net_income

        # ---- cashflow components ----
        total_rent = sum(prop["rent"] for prop in properties if year >= prop["purchase_year"])
        total_interest_cost = sum(property_balances.get(prop["name"], 0) * prop["interest_rate"] for prop in properties if prop["name"] in property_balances)
        total_other_expenses = sum(prop["other_expenses"] for prop in properties if year >= prop["purchase_year"])
        cashflow = combined_income - total_interest_cost - total_rent - total_other_expenses

        # ---- borrowing capacity ----
        investor_borrowing_capacities = {}
        for inv in investors:
            name = inv["name"]
            net_income = investor_net_income[name]
            debt = investor_debt[name]
            investor_borrowing_capacities[name] = round(net_income * 6 - debt, 2)

        # ---- write results for year ----
        results["yearly_forecast"].append({
            "year": year,
            "investor_net_incomes": investor_income_snapshot,
            "combined_income": round(combined_income, 2),
            "investor_borrowing_capacities": investor_borrowing_capacities,
            "investor_debts": {name: round(debt, 2) for name, debt in investor_debt.items()},
            "total_debt": round(total_debt, 2),
            "total_rent": round(total_rent, 2),
            "total_interest_cost": round(total_interest_cost, 2),
            "total_other_expenses": round(total_other_expenses, 2),
            "cashflow": round(cashflow, 2),
            "property_loan_balances": {
                name: round(balance, 2)
                for name, balance in property_balances.items()
            },
            "property_lvrs": property_lvrs,
            "property_values": {name: round(val, 2) for name, val in property_values.items()}
        })

        # update property values for next year
        for prop in properties:
            property_values[prop["name"]] *= (1 + prop["growth_rate"])

    # Return just the yearly_forecast
    return results["yearly_forecast"]
