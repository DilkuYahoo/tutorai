from typing import List, Dict, Optional
import sys

# Add debug print function for CloudWatch logging
def debug_print(msg):
    """Print debug messages to stdout for CloudWatch logs."""
    print(f"[SUPERCHART1 DEBUG] {msg}", file=sys.stdout)


def _score_year_for_purchase(year_data: dict, year_num: int, existing_purchase_years: list) -> dict:
    """Score a single forecast year for property purchase readiness (0-100)."""
    dti = year_data.get('dti_ratio', 99)
    accessible_equity = year_data.get('accessible_equity', 0)
    raw_equity = year_data.get('raw_equity', 0)
    total_debt = year_data.get('total_debt', 0)
    borrowing_capacity = sum(year_data.get('investor_borrowing_capacities', {}).values())
    household_surplus = year_data.get('household_surplus', 0)
    property_cashflow = year_data.get('property_cashflow', 0)

    # DTI score (45 pts max)
    if dti <= 0:       dti_score = 0
    elif dti < 2.5:    dti_score = 45
    elif dti < 3.5:    dti_score = 35
    elif dti < 4.5:    dti_score = 20
    elif dti < 5.5:    dti_score = 10
    else:              dti_score = 0

    # Equity score (35 pts max)
    if accessible_equity > 200_000:   eq_score = 35
    elif accessible_equity > 100_000: eq_score = 20
    elif accessible_equity > 50_000:  eq_score = 10
    else:                             eq_score = 0

    # Borrowing capacity score (35 pts max)
    if borrowing_capacity > 300_000:   bc_score = 35
    elif borrowing_capacity > 200_000: bc_score = 25
    elif borrowing_capacity > 100_000: bc_score = 15
    elif borrowing_capacity > 50_000:  bc_score = 5
    else:                              bc_score = 0

    # Cashflow score (15 pts max)
    combined_cf = household_surplus + property_cashflow
    if combined_cf > 20_000:   cf_score = 15
    elif combined_cf > 5_000:  cf_score = 10
    elif combined_cf > 0:      cf_score = 5
    else:                      cf_score = 0

    # LVR relief (25 pts max): low LVR can support lending even when income-based metrics are stretched.
    # Hard capped at DTI ≤ 7x — above that, no lender approves regardless of equity.
    # This threshold deliberately aligns with the DTI chart's hard-limit markline at 7.0x.
    # LVR = total_debt / (raw_equity + total_debt)  i.e. debt as % of total property value
    total_property_value = raw_equity + total_debt
    if total_property_value > 0 and raw_equity > 0 and dti <= 7:
        lvr = total_debt / total_property_value
        if lvr < 0.30:    lvr_bonus = 25   # very low LVR — strong security position
        elif lvr < 0.50:  lvr_bonus = 15
        elif lvr < 0.65:  lvr_bonus = 5
        else:             lvr_bonus = 0
    else:
        lvr_bonus = 0

    # Market cycle bonus (10 pts)
    cycle_bonus = 10 if 3 <= year_num <= 8 else (5 if year_num > 8 else 0)
    if year_num == 1: cycle_bonus -= 10

    # Gap penalty: suppress years within 2 of an existing purchase
    gap_penalty = 0
    for py in existing_purchase_years:
        if abs(year_num - py) < 2:
            gap_penalty = 50
            break

    raw_score = dti_score + eq_score + bc_score + cf_score + lvr_bonus + cycle_bonus - gap_penalty
    score = max(0, min(100, raw_score))

    if score >= 80:   rating = "Strong Buy"
    elif score >= 60: rating = "Buy"
    elif score >= 40: rating = "Hold"
    else:             rating = "Wait"

    return {'buy_score': round(score, 1), 'buy_rating': rating}


# --- Default Tax configuration (Australia - simplified) ---
DEFAULT_TAX_BRACKETS = [
    (0, 18_200, 0.00),
    (18_200, 45_000, 0.16),
    (45_000, 135_000, 0.30),
    (135_000, 190_000, 0.37),
    (190_000, float("inf"), 0.45),
]

DEFAULT_MEDICARE_LEVY_RATE = 0.02
DEFAULT_CPI_RATE = 0.03
DEFAULT_ACCESSIBLE_EQUITY_RATE = 0.80  # 80% of raw equity can be accessed
DEFAULT_BORROWING_POWER_MULTIPLIER_MIN = 3.5  # Minimum borrowing power multiplier
DEFAULT_BORROWING_POWER_MULTIPLIER_BASE = 5.0  # Base borrowing power multiplier before dependants reduction
DEFAULT_BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION = 0.25  # Reduction per dependant


# Module-level variables (can be overridden)
TAX_BRACKETS = DEFAULT_TAX_BRACKETS
MEDICARE_LEVY_RATE = DEFAULT_MEDICARE_LEVY_RATE
CPI_RATE = DEFAULT_CPI_RATE
ACCESSIBLE_EQUITY_RATE = DEFAULT_ACCESSIBLE_EQUITY_RATE
BORROWING_POWER_MULTIPLIER_MIN = DEFAULT_BORROWING_POWER_MULTIPLIER_MIN
BORROWING_POWER_MULTIPLIER_BASE = DEFAULT_BORROWING_POWER_MULTIPLIER_BASE
BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION = DEFAULT_BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION


def set_config_params(config: Dict) -> None:
    """
    Set configuration parameters from a config dictionary.
    
    Parameters
    ----------
    config : dict
        Dictionary containing configuration parameters:
        - medicare_levy_rate: float
        - cpi_rate: float
        - accessible_equity_rate: float
        - borrowing_power_multiplier_min: float
        - borrowing_power_multiplier_base: float
        - borrowing_power_multiplier_dependant_reduction: float
    """
    global MEDICARE_LEVY_RATE, CPI_RATE, ACCESSIBLE_EQUITY_RATE
    global BORROWING_POWER_MULTIPLIER_MIN, BORROWING_POWER_MULTIPLIER_BASE, BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION
    
    if 'medicare_levy_rate' in config:
        MEDICARE_LEVY_RATE = config['medicare_levy_rate']
    if 'cpi_rate' in config:
        CPI_RATE = config['cpi_rate']
    if 'accessible_equity_rate' in config:
        ACCESSIBLE_EQUITY_RATE = config['accessible_equity_rate']
    if 'borrowing_power_multiplier_min' in config:
        BORROWING_POWER_MULTIPLIER_MIN = config['borrowing_power_multiplier_min']
    if 'borrowing_power_multiplier_base' in config:
        BORROWING_POWER_MULTIPLIER_BASE = config['borrowing_power_multiplier_base']
    if 'borrowing_power_multiplier_dependant_reduction' in config:
        BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION = config['borrowing_power_multiplier_dependant_reduction']


def reset_config_to_defaults() -> None:
    """Reset all configuration parameters to default values."""
    global MEDICARE_LEVY_RATE, CPI_RATE, ACCESSIBLE_EQUITY_RATE
    global BORROWING_POWER_MULTIPLIER_MIN, BORROWING_POWER_MULTIPLIER_BASE, BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION
    
    MEDICARE_LEVY_RATE = DEFAULT_MEDICARE_LEVY_RATE
    CPI_RATE = DEFAULT_CPI_RATE
    ACCESSIBLE_EQUITY_RATE = DEFAULT_ACCESSIBLE_EQUITY_RATE
    BORROWING_POWER_MULTIPLIER_MIN = DEFAULT_BORROWING_POWER_MULTIPLIER_MIN
    BORROWING_POWER_MULTIPLIER_BASE = DEFAULT_BORROWING_POWER_MULTIPLIER_BASE
    BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION = DEFAULT_BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION


def calculate_borrowing_multiple(dependants: int) -> float:
    """
    Calculate borrowing power multiplier based on number of dependants.
    
    Formula:
        - borrowing_multiple = max(3.5, 5 - (dependants * 0.25))
    
    Parameters
    ----------
    dependants : int
        Number of dependants
        
    Returns
    -------
    float
        The borrowing power multiplier
    """
    return max(BORROWING_POWER_MULTIPLIER_MIN, BORROWING_POWER_MULTIPLIER_BASE - (dependants * BORROWING_POWER_MULTIPLIER_DEPENDANT_REDUCTION))


def calculate_dti(total_debt: float, annual_income: float) -> dict:
    """
    Calculate Debt-to-Income (DTI) ratio.
    
    Formula:
        - DTI = (Total Debt / Annual Income) × 100
    
    Parameters
    ----------
    total_debt : float
        The total debt amount (annual debt payments or total debt)
    annual_income : float
        The annual gross income
        
    Returns
    -------
    dict
        A dictionary containing the DTI ratio and components
    """
    if annual_income <= 0:
        dti_ratio = 0.0
    else:
        dti_ratio = total_debt / annual_income
    
    return {
        "total_debt": round(total_debt, 2),
        "annual_income": round(annual_income, 2),
        "dti_ratio": dti_ratio
    }

def calculate_net_income(gross_income: float) -> dict:
    """
    Calculate net income after deducting tax and Medicare levy based on Australian tax brackets.

    Parameters
    ----------
    gross_income : float
        The gross annual income.

    Returns
    -------
    dict
        A dictionary containing:
        - gross_income: The original gross income
        - income_tax: The income tax amount
        - medicare_levy: The Medicare levy amount
        - total_tax: Total tax (income tax + medicare levy)
        - net_income: Net income after all deductions
    """
    tax = 0.0

    for lower, upper, rate in TAX_BRACKETS:
        if gross_income > lower:
            taxable_amount = min(gross_income, upper) - lower
            tax += taxable_amount * rate
        else:
            break

    medicare_levy = gross_income * MEDICARE_LEVY_RATE
    total_tax = tax + medicare_levy
    net_income = gross_income - total_tax

    return {
        "gross_income": round(gross_income, 2),
        "income_tax": round(tax, 2),
        "medicare_levy": round(medicare_levy, 2),
        "total_tax": round(total_tax, 2),
        "net_income": round(net_income, 2),
    }



def calculate_max_purchase_price(property_value: float, loans: float) -> dict:
    """
    Calculate the maximum purchase price based on accessible equity.
    
    Formula:
        - Accessible Equity = (Property value × ACCESSIBLE_EQUITY_RATE) - Loans
        - MaxPurchasePrice = Accessible Equity / 0.25
    
    Parameters
    ----------
    property_value : float
        The current value of the property
    loans : float
        The total loan amount on the property
        
    Returns
    -------
    dict
        A dictionary containing raw_equity, accessible_equity, and max_purchase_price
    """
    raw_equity = property_value - loans
    accessible_equity = max(0, (property_value * ACCESSIBLE_EQUITY_RATE) - loans)
    max_purchase_price = accessible_equity / 0.25
    
    return {
        "raw_equity": round(raw_equity, 2),
        "accessible_equity": round(accessible_equity, 2),
        "max_purchase_price": round(max_purchase_price, 2)
    }


def borrowing_capacity_forecast_investor_blocks(
    investors: List[Dict],
    properties: List[Dict],
    years: int,
    portfolio_dependants: int = 0,
    portfolio_dependants_events: List[Dict] = None
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
            - essential_expenditure : float
            - nonessential_expenditure : float
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
        
    portfolio_dependants : int
        Number of dependants at portfolio level (household total)
        
    portfolio_dependants_events : list of dict
        List of dependant change events at portfolio level:
        - year : int
        - dependants : int
    """
    debug_print(f"Starting calculation with {len(investors)} investors, {len(properties)} properties, {years} years")
    debug_print(f"Config: CPI_RATE={CPI_RATE}, MEDICARE_LEVY_RATE={MEDICARE_LEVY_RATE}, ACCESSIBLE_EQUITY_RATE={ACCESSIBLE_EQUITY_RATE}")
    debug_print(f"Config: BORROWING_POWER_MULTIPLIER_MIN={BORROWING_POWER_MULTIPLIER_MIN}, BASE={BORROWING_POWER_MULTIPLIER_BASE}")
    debug_print(f"Portfolio dependants: {portfolio_dependants}, events: {portfolio_dependants_events}")
    
    # Initialize portfolio_dependants_events if not provided
    if portfolio_dependants_events is None:
        portfolio_dependants_events = []

    # Validate that all properties have purchase_year to handle missing data gracefully
    for prop in properties:
        if "purchase_year" not in prop:
            debug_print(f"ERROR: Property {prop.get('name', 'unknown')} is missing 'purchase_year'")
            raise ValueError(f"Property {prop.get('name', 'unknown')} is missing 'purchase_year'")

    results = {"yearly_forecast": []}

    # track current investor incomes
    investor_current_income = {
        inv["name"]: inv.get("base_income", 0) or 0 for inv in investors
    }

    # track current essential and nonessential expenditures (grow with CPI)
    investor_essential_current = {
        inv["name"]: inv["essential_expenditure"] for inv in investors
    }
    investor_nonessential_current = {
        inv["name"]: inv["nonessential_expenditure"] for inv in investors
    }

    # map events per investor
    investor_events = {
        inv["name"]: inv.get("income_events", []) for inv in investors
    }

    # property balances
    property_balances = {}

    # property values - start empty, add properties when they are purchased
    property_values = {}

    # track current property rent and other_expenses (grow with CPI)
    property_rent_current = {prop["name"]: prop.get("rent", 0) or 0 for prop in properties}
    property_other_expenses_current = {prop["name"]: prop.get("other_expenses", 0) or 0 for prop in properties}

    # Create a dict for quick lookup of purchase years
    purchase_years = {prop["name"]: prop["purchase_year"] for prop in properties}

    # investor debts
    investor_debt = {inv["name"]: 0 for inv in investors}

    # portfolio-level dependants (household total)
    current_portfolio_dependants = portfolio_dependants

    for year in range(1, years + 1):
        debug_print(f"Processing year {year}/{years}")

        # ---- handle investor incomes ----
        combined_income = 0
        investor_income_snapshot = {}

        for inv in investors:
            name = inv["name"]

            # apply scheduled income events
            for ev in investor_events[name]:
                if ev["year"] == year:
                    if ev["type"] == "increase":
                        amount = ev.get("amount") or 0
                        investor_current_income[name] += amount
                    elif ev["type"] == "set":
                        investor_current_income[name] = ev.get("amount", 0)

            # apply scheduled portfolio-level dependant events
            for ev in portfolio_dependants_events:
                if ev["year"] == year:
                    current_portfolio_dependants = ev["dependants"]

            # apply annual growth (after year 1)
            if year > 1:
                growth_rate = inv.get("annual_growth_rate") or 0
                investor_current_income[name] *= (1 + growth_rate)
                investor_essential_current[name] *= (1 + CPI_RATE)
                investor_nonessential_current[name] *= (1 + CPI_RATE)

            income_val = investor_current_income.get(name, 0) or 0
            combined_income += income_val
            investor_income_snapshot[name] = round(income_val, 2)

        # ---- handle properties ----
        for prop in properties:
            if prop["purchase_year"] == year:
                loan_amount = prop.get("loan_amount") or 0
                property_balances[prop["name"]] = loan_amount
                # Initialize property value when purchased
                property_values[prop["name"]] = prop.get("initial_value", loan_amount)
                for split in prop.get("investor_splits", []):
                    pct = (split.get("percentage") or 0) / 100
                    investor_debt[split["name"]] += loan_amount * pct

        for prop in properties:
            name = prop["name"]
            if name in property_balances and year >= prop["purchase_year"]:
                annual_change = prop.get("annual_principal_change") or 0
                property_balances[name] += annual_change
                for split in prop.get("investor_splits", []):
                    pct = (split.get("percentage") or 0) / 100
                    investor_debt[split["name"]] += annual_change * pct

        total_debt = sum(property_balances.values())

        # update property values for this year - only apply growth to properties already in the portfolio and purchased
        for name in list(property_values.keys()):
            prop = next((p for p in properties if p["name"] == name), None)
            if prop and year >= prop.get("purchase_year", 1):
                growth = prop.get("growth_rate") or 0
                property_values[name] *= (1 + growth)

        # apply annual CPI growth to property rent and other expenses (after year 1)
        if year > 1:
            for prop in properties:
                property_rent_current[prop["name"]] *= (1 + CPI_RATE)
                property_other_expenses_current[prop["name"]] *= (1 + CPI_RATE)

        # ---- max purchase price based on accessible equity ----
        # Calculate for total portfolio (all properties combined)
        # Only calculate if there are properties with loans
        if property_balances:
            total_property_value = sum(
                property_values[name] 
                for name in property_balances.keys()
            )
            max_purchase_result = calculate_max_purchase_price(
                property_value=total_property_value, 
                loans=total_debt
            )
        else:
            max_purchase_result = {
                "raw_equity": 0,
                "accessible_equity": 0,
                "max_purchase_price": 0
            }

        # ---- DTI (Debt to Income) ratio ----
        # Calculate DTI using gross income (combined_income from investor_income_snapshot)
        gross_income = sum(investor_income_snapshot.values())
        dti_result = calculate_dti(
            total_debt=total_debt,
            annual_income=gross_income
        )

        # ---- property LVRs ----
        property_lvrs = {}
        for prop in properties:
            name = prop["name"]
            if name in property_balances:
                loan = property_balances[name]
                value = property_values[name]
                lvr = (loan / value) * 100 if value > 0 else 0
                property_lvrs[name] = round(lvr, 2)

        # ---- per-investor costs ----
        investor_interest_cost = {inv["name"]: 0 for inv in investors}
        investor_rent = {inv["name"]: 0 for inv in investors}
        investor_other_expenses = {inv["name"]: 0 for inv in investors}

        for prop in properties:
            if year >= prop["purchase_year"]:
                interest = property_balances.get(prop["name"], 0) * (prop.get("interest_rate") or 0)
                rent = property_rent_current.get(prop["name"], 0)
                other = property_other_expenses_current.get(prop["name"], 0)
                for split in prop.get("investor_splits", []):
                    pct = (split.get("percentage") or 0) / 100
                    investor_interest_cost[split["name"]] = (investor_interest_cost.get(split["name"], 0) or 0) + interest * pct
                    investor_rent[split["name"]] = (investor_rent.get(split["name"], 0) or 0) + rent * pct
                    investor_other_expenses[split["name"]] = (investor_other_expenses.get(split["name"], 0) or 0) + other * pct

        # ---- investor net incomes ----
        investor_net_income = {}
        combined_income = 0
        for inv in investors:
            name = inv["name"]
            gross = investor_income_snapshot[name]
            result = calculate_net_income(gross)
            net_after_tax = result["net_income"]
            net = net_after_tax - investor_essential_current[name] - investor_nonessential_current[name] + investor_rent[name] - investor_interest_cost[name] - investor_other_expenses[name]
            investor_net_income[name] = round(net, 2)
            combined_income += (net_after_tax or 0)

        # combined_income is sum of net incomes after tax
        investor_income_snapshot = investor_net_income

        # ---- property cashflow components ----
        total_rent = sum(property_rent_current[prop["name"]] for prop in properties if year >= prop["purchase_year"])
        total_interest_cost = sum(property_balances.get(prop["name"], 0) * prop["interest_rate"] for prop in properties if prop["name"] in property_balances)
        total_other_expenses = sum(property_other_expenses_current[prop["name"]] for prop in properties if year >= prop["purchase_year"])
        total_essential_expenses = sum(investor_essential_current[inv["name"]] for inv in investors)
        total_nonessential_expenses = sum(investor_nonessential_current[inv["name"]] for inv in investors)
        property_cashflow = total_rent - total_interest_cost - total_other_expenses
        household_surplus = combined_income - total_essential_expenses - total_nonessential_expenses + property_cashflow


        # ---- borrowing capacity ----
        investor_borrowing_capacities = {}
        investor_borrowing_multiples = {}
        # Calculate borrowing multiple based on portfolio-level dependants
        borrowing_multiple = calculate_borrowing_multiple(current_portfolio_dependants)
        for inv in investors:
            name = inv["name"]
            net_income = investor_net_income[name]
            debt = investor_debt[name]
            # Use same borrowing multiple for all investors (based on household dependants)
            investor_borrowing_multiples[name] = borrowing_multiple
            # Use net income after tax and expenditures
            # Ensure borrowing capacity is not less than 0
            investor_borrowing_capacities[name] = round(max(0, net_income * borrowing_multiple - debt), 2)

        # ---- write results for year ----
        _existing_purchase_years = [p.get('purchase_year', 0) for p in properties]
        _buy_signal = _score_year_for_purchase(
            {
                'dti_ratio': dti_result["dti_ratio"],
                'accessible_equity': max_purchase_result["accessible_equity"],
                'raw_equity': max_purchase_result["raw_equity"],
                'total_debt': total_debt,
                'investor_borrowing_capacities': investor_borrowing_capacities,
                'household_surplus': household_surplus,
                'property_cashflow': property_cashflow,
            },
            year,
            _existing_purchase_years,
        )
        results["yearly_forecast"].append({
            "year": year,
            "investor_net_incomes": investor_income_snapshot,
            "combined_income": round(combined_income, 2),
            "investor_borrowing_capacities": investor_borrowing_capacities,
            "investor_borrowing_multiples": investor_borrowing_multiples,
            "portfolio_dependants": current_portfolio_dependants,
            "investor_debts": {name: round(debt, 2) for name, debt in investor_debt.items()},
            "total_debt": round(total_debt, 2),
            "total_rent": round(total_rent, 2),
            "total_interest_cost": round(total_interest_cost, 2),
            "total_other_expenses": round(total_other_expenses, 2),
            "total_essential_expenses": round(total_essential_expenses, 2),
            "total_nonessential_expenses": round(total_nonessential_expenses, 2),
            "property_cashflow": round(property_cashflow, 2),
            "household_surplus": round(household_surplus, 2),
            "property_loan_balances": {
                name: round(balance, 2)
                for name, balance in property_balances.items()
            },
            "property_lvrs": property_lvrs,
            # Modified: Only include property values for properties purchased by or before the current year
            "property_values": {name: round(val, 2) for name, val in property_values.items() if year >= purchase_years[name]},
            # Max purchase price based on accessible equity
            "max_purchase_price": max_purchase_result["max_purchase_price"],
            "accessible_equity": max_purchase_result["accessible_equity"],
            "raw_equity": max_purchase_result["raw_equity"],
            # DTI (Debt to Income) ratio
            "dti_ratio": dti_result["dti_ratio"],
            # Per-year property purchase readiness score
            "buy_score": _buy_signal["buy_score"],
            "buy_rating": _buy_signal["buy_rating"],
        })

    # Return just the yearly_forecast
    debug_print(f"Calculation complete. Returning {len(results['yearly_forecast'])} years of data")
    return results["yearly_forecast"]
