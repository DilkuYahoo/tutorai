"""
BA Agent Lambda Function - Property Attribute Generation

This Lambda function reads pre-calculated chart1 financial data from DynamoDB,
passes it to AWS Bedrock to generate recommended property attributes,
and returns the results to the frontend for user review and persistence.

Supports four actions:
- "add": Generate a new property recommendation based on current portfolio
- "optimize": Optimize existing properties with market benchmarks
- "summary": Generate an AI executive summary of the user's portfolio
- "advice": Generate 3 actionable recommendations with reasoning based on forecast, risk profile, and investment goals
"""

import json
import os
import boto3
import logging
import re
from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CloudWatch Logs for audit trail
audit_logger = logging.getLogger('audit')
audit_logger.setLevel(logging.INFO)

def log_audit_event(event_type: str, user_email: str, portfolio_id: str, action: str, status: str, message: str = "") -> None:
    """
    Log authentication and authorization events for audit trail.
    This creates structured audit logs in CloudWatch for security monitoring.
    """
    audit_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "user_email": user_email or "anonymous",
        "portfolio_id": portfolio_id or "N/A",
        "action": action,
        "status": status,
        "message": message
    }
    
    if status in ["success", "approved"]:
        audit_logger.info(json.dumps(audit_entry))
    else:
        audit_logger.warning(json.dumps(audit_entry))
    
    # Also print for visibility in Lambda
    print(f"AUDIT: {event_type} - user={user_email or 'anonymous'} action={action} status={status}")


def extract_user_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract user email from API Gateway authorizer context.
    API Gateway validates the JWT and passes claims to Lambda via requestContext.authorizer.claims.
    """
    try:
        # API Gateway has already validated the JWT - we trust this data
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # Extract email from claims (already validated by API Gateway)
        email = claims.get('email')
        
        if email:
            logger.info(f"Extracted user email from JWT: {email}")
        
        return email
    except Exception as e:
        logger.warning(f"Could not extract user from event: {e}")
        return None

# CORS headers for API Gateway
CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Amz-Date, X-Amz-Security-Token, X-Api-Key'
}

# Bedrock client import
try:
    from lib.bedrock_client import invoke_bedrock
except ImportError:
    # Fallback if bedrock_client is not available
    def invoke_bedrock(system_prompt: str, user_prompt: str, model_kwargs: dict = None, region: str = "ap-southeast-2") -> str:
        """Fallback invoke_bedrock function."""
        logger.warning("Using fallback Bedrock invocation - no actual AI call will be made")
        return '{"error": "Bedrock client not available"}'


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal objects."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_data_from_dynamodb(table_name: str, item_id: str, region: str = "ap-southeast-2") -> dict:
    """
    Fetch investors, properties, and chart1 data from DynamoDB by ID.
    
    Args:
        table_name: Name of the DynamoDB table
        item_id: The ID of the item to retrieve
        region: AWS region (default: ap-southeast-2)
    
    Returns:
        Dictionary with investors, properties, chart1, and status
    """
    logger.info(f"Fetching data from DynamoDB - table: {table_name}, id: {item_id}, region: {region}")
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)
    
    response = table.get_item(Key={'id': item_id})
    
    if 'Item' not in response:
        logger.error(f"Item with ID '{item_id}' not found in table '{table_name}'")
        raise ValueError(f"Item with ID '{item_id}' not found in table '{table_name}'")
    
    item = response['Item']
    
    # Check if status is active
    status = item.get('status', '')
    if status != 'active':
        logger.error(f"Item with ID '{item_id}' has status '{status}', only 'active' items can be retrieved")
        raise ValueError(f"Item with ID '{item_id}' has status '{status}', only 'active' items can be retrieved")
    
    logger.info(f"Successfully retrieved item '{item_id}'")
    
    return {
        'investors': item.get('investors', []),
        'properties': item.get('properties', []),
        'chart1': item.get('chart1', {}),
        'status': status,
        'adviser_name': item.get('adviser_name', ''),
        'portfolio_dependants': item.get('portfolio_dependants', 0),
        'portfolio_dependants_events': item.get('portfolio_dependants_events', []),
        'investment_goals': item.get('investment_goals', None),
        'investment_years': int(item['investment_years']) if 'investment_years' in item else 30,
    }


def extract_metrics_from_chart1(chart1_data: dict) -> dict:
    """
    Extract key financial metrics from pre-calculated chart1 timeline with enhanced analysis.

    Args:
        chart1_data: The chart1 data from DynamoDB (can be dict with yearly_forecast or a list)

    Returns:
        Dictionary with extracted metrics including trend analysis, risk metrics, and timing indicators
    """
    if not chart1_data:
        return {}

    # Handle case where chart1_data is a list (direct yearly_forecast)
    if isinstance(chart1_data, list):
        yearly_forecast = chart1_data
    else:
        yearly_forecast = chart1_data.get('yearly_forecast', [])

    if not yearly_forecast:
        return {}

    # Use the year when ALL properties have been purchased as the "current" baseline.
    # Year 1 may show zero debt/DTI if properties have future purchase_years — reading
    # it would give the agent a false picture of a debt-free portfolio.
    # Find the last year where a new property first appears (highest property count year).
    max_prop_count = max(len(yr.get('property_values', {})) for yr in yearly_forecast)
    current_data = yearly_forecast[0]  # fallback
    baseline_year = int(yearly_forecast[0].get('year', 1))
    for yr in yearly_forecast:
        if len(yr.get('property_values', {})) >= max_prop_count:
            current_data = yr
            baseline_year = int(yr.get('year', baseline_year))
            break

    # Calculate aggregate metrics
    total_property_values = sum(current_data.get('property_values', {}).values())
    total_loan_balances = sum(current_data.get('property_loan_balances', {}).values())
    total_equity = total_property_values - total_loan_balances

    # Get DTI metrics
    dti_ratios = [yr.get('dti_ratio', 0) for yr in yearly_forecast if 'dti_ratio' in yr]
    current_dti = current_data.get('dti_ratio', 0)
    min_dti = min(dti_ratios) if dti_ratios else 0
    max_dti = max(dti_ratios) if dti_ratios else 0

    # Get accessible equity metrics
    accessible_equities = [yr.get('accessible_equity', 0) for yr in yearly_forecast if 'accessible_equity' in yr]
    max_accessible_equity = max(accessible_equities) if accessible_equities else 0

    # Get borrowing capacities
    borrowing_capacities = current_data.get('investor_borrowing_capacities', {})
    total_borrowing_capacity = sum(borrowing_capacities.values())

    # Get other metrics
    household_surplus = current_data.get('household_surplus', 0)
    property_cashflow = current_data.get('property_cashflow', 0)

    # ===== ENHANCED METRICS =====

    # 1. Trend Analysis
    dti_trend = _calculate_trend(dti_ratios) if len(dti_ratios) > 1 else 0
    equity_trend = _calculate_trend(accessible_equities) if len(accessible_equities) > 1 else 0

    # Borrowing capacity trend over time
    borrowing_capacity_trend = []
    for year_data in yearly_forecast[:5]:  # First 5 years
        year_capacity = sum(year_data.get('investor_borrowing_capacities', {}).values())
        borrowing_capacity_trend.append(year_capacity)
    borrowing_capacity_trend_value = _calculate_trend(borrowing_capacity_trend) if len(borrowing_capacity_trend) > 1 else 0

    # 2. Risk Metrics
    dti_volatility = _calculate_volatility(dti_ratios) if len(dti_ratios) > 1 else 0
    equity_buffer_ratio = max_accessible_equity / total_borrowing_capacity if total_borrowing_capacity > 0 else 0

    # 3. Timing Indicators - Optimal purchase windows
    optimal_purchase_windows = _find_optimal_purchase_years(yearly_forecast)

    # 4. Serviceability Buffers - Additional borrowing headroom
    # Australian lenders typically assess 2-3x serviceability buffer
    serviceability_buffer = total_borrowing_capacity * 2.5  # Conservative buffer
    risk_adjusted_capacity = _calculate_risk_adjusted_capacity(current_dti, total_borrowing_capacity)

    # 5. LVR Analysis
    current_lvrs = current_data.get('property_lvrs', {})
    avg_lvr = sum(current_lvrs.values()) / len(current_lvrs) if current_lvrs else 0

    # LVR risk zones: <60% low risk, 60-80% caution, 80-90% LMI required, >90% critical
    lvr_risk_score = _calculate_lvr_risk_score(avg_lvr, current_lvrs)

    # LVR trends over time
    lvr_trends = []
    for year_data in yearly_forecast[:3]:  # First 3 years
        year_lvrs = year_data.get('property_lvrs', {})
        if year_lvrs:
            year_avg_lvr = sum(year_lvrs.values()) / len(year_lvrs)
            lvr_trends.append(year_avg_lvr)
    lvr_trend = _calculate_trend(lvr_trends) if len(lvr_trends) > 1 else 0

    # 6. Cashflow Projections
    household_surplus_trend = []
    property_cashflow_trend = []
    for year_data in yearly_forecast[:5]:  # First 5 years
        household_surplus_trend.append(year_data.get('household_surplus', 0))
        property_cashflow_trend.append(year_data.get('property_cashflow', 0))

    surplus_stability = _calculate_stability(household_surplus_trend)
    cashflow_stability = _calculate_stability(property_cashflow_trend)

    return {
        # Basic metrics (existing)
        'baseline_year': baseline_year,
        'current_dti': current_dti,
        'min_dti': min_dti,
        'max_dti': max_dti,
        'max_accessible_equity': max_accessible_equity,
        'total_equity': total_equity,
        'total_property_values': total_property_values,
        'total_loan_balances': total_loan_balances,
        'borrowing_capacity': total_borrowing_capacity,
        'investor_borrowing_capacities': borrowing_capacities,
        'household_surplus': household_surplus,
        'property_cashflow': property_cashflow,
        'yearly_forecast': yearly_forecast,

        # Enhanced metrics (new)
        'dti_trend': dti_trend,
        'equity_trend': equity_trend,
        'borrowing_capacity_trend': borrowing_capacity_trend_value,
        'dti_volatility': dti_volatility,
        'equity_buffer_ratio': equity_buffer_ratio,
        'optimal_purchase_windows': optimal_purchase_windows,
        'serviceability_buffer': serviceability_buffer,
        'risk_adjusted_capacity': risk_adjusted_capacity,
        'avg_lvr': avg_lvr,
        'lvr_risk_score': lvr_risk_score,
        'lvr_trend': lvr_trend,
        'surplus_stability': surplus_stability,
        'cashflow_stability': cashflow_stability
    }


def _calculate_trend(values: list) -> float:
    """Calculate linear trend slope for a list of values."""
    if len(values) < 2:
        return 0

    n = len(values)
    x_values = list(range(n))

    # Calculate means
    x_mean = sum(x_values) / n
    y_mean = sum(values) / n

    # Calculate slope
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, values))
    denominator = sum((x - x_mean) ** 2 for x in x_values)

    return numerator / denominator if denominator != 0 else 0


def _calculate_volatility(values: list) -> float:
    """Calculate coefficient of variation (volatility) for a list of values."""
    if len(values) < 2:
        return 0

    mean = sum(values) / len(values)
    if mean == 0:
        return 0

    variance = sum((x - mean) ** 2 for x in values) / len(values)
    std_dev = variance ** 0.5

    return std_dev / mean  # Coefficient of variation


def _find_optimal_purchase_years(yearly_forecast: list) -> list:
    """Find years with optimal financial conditions for property purchase, considering Australian market realities."""
    if len(yearly_forecast) < 3:
        return [1]  # Default to year 1

    optimal_years = []
    existing_purchase_years = []  # Track existing purchases to ensure minimum gaps

    # First pass: collect existing purchase years from the data
    for year_data in yearly_forecast:
        if year_data.get('property_values'):
            # If there are properties purchased in this year, add it to existing purchases
            year = year_data.get('year', 1)
            existing_purchase_years.append(year)

    for i, year_data in enumerate(yearly_forecast[:15]):  # Check first 15 years for realistic timelines
        year = year_data.get('year', i + 1)
        dti = year_data.get('dti_ratio', 0)
        equity = year_data.get('accessible_equity', 0)
        borrowing = sum(year_data.get('investor_borrowing_capacities', {}).values())

        # Check minimum time gap from existing purchases (realistic Australian market timing)
        min_gap_required = 2  # Minimum 2 years between acquisitions for market stabilization
        if existing_purchase_years:
            closest_existing = min(existing_purchase_years)
            if year - closest_existing < min_gap_required:
                continue  # Skip years too close to existing purchases

        # Enhanced scoring for Australian market realities
        score = 0

        # DTI scoring (stricter for Australian lending standards)
        if dti < 2.5:
            score += 45  # Excellent - well below safe limits
        elif dti < 3.5:
            score += 30  # Good - safe zone
        elif dti < 4.5:
            score += 15  # Fair - caution zone
        elif dti < 5.5:
            score += 5   # Poor - high risk

        # Equity buffer scoring (higher thresholds for Australian market)
        if equity > 200000:
            score += 35  # Strong buffer for transaction costs
        elif equity > 100000:
            score += 20  # Adequate buffer
        elif equity > 50000:
            score += 10  # Minimum buffer

        # Borrowing capacity scoring (realistic for Australian lenders)
        if borrowing > 300000:
            score += 35  # Excellent capacity for good properties
        elif borrowing > 200000:
            score += 25  # Good capacity
        elif borrowing > 100000:
            score += 15  # Adequate capacity
        elif borrowing > 50000:
            score += 5   # Limited capacity

        # Market cycle consideration (prefer years 3-8 for typical holding periods)
        if 3 <= year <= 8:
            score += 10  # Bonus for realistic investment horizons
        elif year > 8:
            score += 5   # Slight bonus for longer-term planning

        # Australian market cycle consideration (avoid year 1 for stabilization)
        if year == 1:
            score -= 10  # Penalty for immediate acquisition (allow stabilization)

        if score >= 70:  # Higher threshold for Australian market realism
            optimal_years.append(year)
            existing_purchase_years.append(year)  # Add to existing for gap calculations

    # Return optimal years with realistic Australian market timing
    return optimal_years[:4] if len(optimal_years) >= 4 else (optimal_years + [max(existing_purchase_years) + 3] if existing_purchase_years else [3])[:4]


def _calculate_risk_adjusted_capacity(current_dti: float, total_capacity: float) -> float:
    """Calculate risk-adjusted borrowing capacity based on current DTI."""
    if current_dti < 2.0:
        return total_capacity * 1.0  # Full capacity
    elif current_dti < 3.0:
        return total_capacity * 0.9  # 90% capacity
    elif current_dti < 4.0:
        return total_capacity * 0.7  # 70% capacity
    elif current_dti < 5.0:
        return total_capacity * 0.5  # 50% capacity
    else:
        return total_capacity * 0.3  # 30% capacity (high risk)


def _calculate_lvr_risk_score(avg_lvr: float, individual_lvrs: dict) -> float:
    """Calculate LVR risk score (0-100, higher = more risk)."""
    if not individual_lvrs:
        return 0

    risk_score = 0

    # Average LVR risk
    if avg_lvr > 90:
        risk_score += 50  # Critical zone
    elif avg_lvr > 80:
        risk_score += 30  # LMI required
    elif avg_lvr > 60:
        risk_score += 15  # Caution zone
    # <60% = low risk, score += 0

    # Individual property risk (highest LVR contributes most)
    max_lvr = max(individual_lvrs.values()) if individual_lvrs else 0
    if max_lvr > 95:
        risk_score += 30
    elif max_lvr > 90:
        risk_score += 20
    elif max_lvr > 85:
        risk_score += 10

    # Diversity factor (penalty for concentrated high LVR properties)
    high_lvr_count = sum(1 for lvr in individual_lvrs.values() if lvr > 80)
    risk_score += high_lvr_count * 5

    return min(risk_score, 100)  # Cap at 100


def _calculate_stability(values: list) -> float:
    """Calculate stability score (0-100, higher = more stable)."""
    if len(values) < 2:
        return 100  # Single value is perfectly stable

    # Calculate coefficient of variation (lower = more stable)
    mean = sum(values) / len(values)
    if mean == 0:
        return 50  # Neutral stability when mean is zero

    variance = sum((x - mean) ** 2 for x in values) / len(values)
    cv = (variance ** 0.5) / abs(mean)  # Coefficient of variation

    # Convert to stability score (0-100)
    # CV of 0 = perfectly stable (100)
    # CV of 1.0 = highly volatile (0)
    stability = max(0, 100 - (cv * 100))

    return stability


def calculate_buy_signal_score(metrics: dict, risk_tolerance: str = 'moderate') -> dict:
    """
    Calculate buy signal score using risk-adjusted weighting based on investor profile.

    Args:
        metrics: Enhanced metrics from extract_metrics_from_chart1()
        risk_tolerance: 'conservative', 'moderate', or 'aggressive'

    Returns:
        Dictionary with composite score and component breakdowns
    """
    # Component scoring functions
    dti_score = _score_dti_factor(metrics.get('current_dti', 0))
    borrowing_capacity_score = _score_borrowing_capacity(metrics)
    equity_score = _score_equity_position(metrics)
    cashflow_score = _score_cashflow_stability(metrics)
    timing_score = _score_timing_opportunity(metrics)

    # Risk-adjusted weighting based on profile
    if risk_tolerance.lower() == 'conservative':
        weights = {
            'dti': 0.50,        # Highest priority for safety
            'cashflow': 0.25,   # Stability focus
            'equity': 0.15,     # Buffer importance
            'borrowing': 0.10   # Lower leverage priority
        }
        timing_weight = 0  # Conservative investors avoid timing plays

    elif risk_tolerance.lower() == 'aggressive':
        weights = {
            'dti': 0.25,        # Still important but less critical
            'borrowing': 0.30,  # Maximize leverage
            'equity': 0.25,     # Growth through equity
            'cashflow': 0.10,   # Minimal cashflow requirement
            'timing': 0.10      # Include timing opportunities
        }

    else:  # moderate (default)
        weights = {
            'dti': 0.35,        # Balanced importance
            'borrowing': 0.25,  # Good leverage utilization
            'equity': 0.20,     # Solid equity position
            'cashflow': 0.15,   # Reasonable stability
            'timing': 0.05      # Slight timing consideration
        }

    # Calculate weighted composite score
    composite_score = (
        dti_score * weights.get('dti', 0.35) +
        borrowing_capacity_score * weights.get('borrowing', 0.25) +
        equity_score * weights.get('equity', 0.20) +
        cashflow_score * weights.get('cashflow', 0.15) +
        timing_score * weights.get('timing', 0.05)
    )

    # Determine rating based on composite score
    if composite_score >= 80:
        rating = "Strong Buy"
        confidence = "High"
    elif composite_score >= 60:
        rating = "Buy"
        confidence = "Medium"
    elif composite_score >= 40:
        rating = "Hold"
        confidence = "Low"
    else:
        rating = "Wait"
        confidence = "Very Low"

    # Risk-adjusted conservatism modifier
    conservatism_modifier = _calculate_conservatism_modifier(risk_tolerance, composite_score)

    return {
        'composite_score': round(composite_score, 1),
        'rating': rating,
        'confidence': confidence,
        'risk_tolerance': risk_tolerance,
        'component_scores': {
            'dti_score': round(dti_score, 1),
            'borrowing_capacity_score': round(borrowing_capacity_score, 1),
            'equity_score': round(equity_score, 1),
            'cashflow_score': round(cashflow_score, 1),
            'timing_score': round(timing_score, 1)
        },
        'weights': weights,
        'conservatism_modifier': conservatism_modifier,
        'recommended_dti_limit': _get_recommended_dti_limit(risk_tolerance),
        'recommended_leverage_ratio': _get_recommended_leverage_ratio(risk_tolerance)
    }


def _score_dti_factor(current_dti: float) -> float:
    """Score DTI factor (0-100)."""
    if current_dti <= 2.0:
        return 100  # Excellent - well below safe limits
    elif current_dti <= 3.0:
        return 85   # Very good - safe zone
    elif current_dti <= 3.5:
        return 70   # Good - approaching caution zone
    elif current_dti <= 4.0:
        return 55   # Fair - in caution zone
    elif current_dti <= 4.5:
        return 40   # Poor - high caution
    elif current_dti <= 5.0:
        return 25   # Very poor - approaching high risk
    else:
        return 10   # Critical - high risk zone


def _score_borrowing_capacity(metrics: dict) -> float:
    """Score borrowing capacity factor (0-100)."""
    total_capacity = metrics.get('borrowing_capacity', 0)
    risk_adjusted_capacity = metrics.get('risk_adjusted_capacity', 0)

    if total_capacity <= 0:
        return 0  # No capacity — hard zero, not a passing score

    # Base score on risk-adjusted capacity
    if risk_adjusted_capacity >= 500000:
        base_score = 100
    elif risk_adjusted_capacity >= 300000:
        base_score = 85
    elif risk_adjusted_capacity >= 200000:
        base_score = 70
    elif risk_adjusted_capacity >= 100000:
        base_score = 55
    elif risk_adjusted_capacity >= 50000:
        base_score = 40
    else:
        base_score = 25

    # Small bonus for growing capacity trend — clamped so it never drives score negative
    trend_bonus = max(-base_score, min(15, metrics.get('borrowing_capacity_trend', 0) * 10))

    return min(100, base_score + trend_bonus)


def _score_equity_position(metrics: dict) -> float:
    """Score equity position factor (0-100)."""
    max_equity = metrics.get('max_accessible_equity', 0)
    total_equity = metrics.get('total_equity', 0)
    equity_buffer_ratio = metrics.get('equity_buffer_ratio', 0)

    # Score based on accessible equity
    if max_equity >= 500000:
        equity_score = 100
    elif max_equity >= 300000:
        equity_score = 85
    elif max_equity >= 200000:
        equity_score = 70
    elif max_equity >= 100000:
        equity_score = 55
    elif max_equity >= 50000:
        equity_score = 40
    else:
        equity_score = 25

    # Bonus for equity buffer ratio (higher ratio = more conservative buffer)
    buffer_bonus = min(15, equity_buffer_ratio * 50)  # Max 15 points bonus

    # Small bonus for positive equity trend — clamped so it never drives score negative
    trend_bonus = max(-(equity_score + buffer_bonus), min(15, metrics.get('equity_trend', 0) * 5))

    return min(100, equity_score + buffer_bonus + trend_bonus)


def _score_cashflow_stability(metrics: dict) -> float:
    """Score cashflow stability factor (0-100)."""
    surplus_stability = metrics.get('surplus_stability', 50)
    cashflow_stability = metrics.get('cashflow_stability', 50)
    current_surplus = metrics.get('household_surplus', 0)
    current_cashflow = metrics.get('property_cashflow', 0)

    # Average stability scores
    avg_stability = (surplus_stability + cashflow_stability) / 2

    # Bonus for positive cashflow
    cashflow_bonus = 0
    if current_surplus > 50000:
        cashflow_bonus += 15
    elif current_surplus > 25000:
        cashflow_bonus += 10
    elif current_surplus > 10000:
        cashflow_bonus += 5

    if current_cashflow > 0:
        cashflow_bonus += 10
    elif current_cashflow > -10000:
        cashflow_bonus += 5

    return min(100, avg_stability + cashflow_bonus)


def _score_timing_opportunity(metrics: dict) -> float:
    """Score timing opportunity factor (0-100)."""
    optimal_windows = metrics.get('optimal_purchase_windows', [])
    current_year = metrics.get('baseline_year', 1)

    # Score based on whether current year is optimal
    if current_year in optimal_windows:
        return 100  # Perfect timing
    elif len(optimal_windows) > 0:
        # Check proximity to optimal years
        closest_optimal = min(optimal_windows, key=lambda x: abs(x - current_year))
        distance = abs(closest_optimal - current_year)

        if distance <= 1:
            return 80  # Very close to optimal
        elif distance <= 2:
            return 60  # Reasonably close
        elif distance <= 3:
            return 40  # Somewhat close
        else:
            return 20  # Not optimal timing
    else:
        return 50  # Neutral timing


def _calculate_conservatism_modifier(risk_tolerance: str, composite_score: float) -> float:
    """Calculate conservatism modifier based on risk tolerance and score."""
    base_modifier = 1.0

    if risk_tolerance.lower() == 'conservative':
        # Conservative investors get more conservative recommendations
        if composite_score > 70:
            base_modifier = 0.8  # Reduce aggressive recommendations
        else:
            base_modifier = 1.2  # Amplify caution for lower scores

    elif risk_tolerance.lower() == 'aggressive':
        # Aggressive investors can handle more risk
        if composite_score < 60:
            base_modifier = 1.3  # Allow more aggressive recommendations
        else:
            base_modifier = 0.9  # Slightly more conservative for very high scores

    # Moderate investors use base_modifier = 1.0

    return base_modifier


def _get_recommended_dti_limit(risk_tolerance: str) -> float:
    """Get recommended DTI limit based on risk tolerance."""
    limits = {
        'conservative': 3.5,
        'moderate': 4.5,
        'aggressive': 5.0
    }
    return limits.get(risk_tolerance.lower(), 4.0)


def _get_recommended_leverage_ratio(risk_tolerance: str) -> float:
    """Get recommended leverage ratio based on risk tolerance."""
    ratios = {
        'conservative': 0.7,  # 70% of available capacity
        'moderate': 0.85,     # 85% of available capacity
        'aggressive': 1.0     # 100% of available capacity
    }
    return ratios.get(risk_tolerance.lower(), 0.8)


def _get_australian_market_context(risk_tolerance: str) -> str:
    """Get Australian market context based on risk tolerance."""
    base_context = """
AUSTRALIAN PROPERTY MARKET REALITIES (2026):
- Median house price: $1.3M (Sydney CBD), $900k (Melbourne CBD), $750k (regional capitals)
- Average unit price: $800k-$1.1M (capital city CBD), $500k-$800k (capital city suburbs), $400k-$600k (regional cities)
- Entry-level pricing: $400k-$700k (regional markets, secondary capitals, affordable suburbs)
- Realistic growth rates: 3-7% annually (varies by location and market conditions)
- Gross rental yields: 4-6% for houses, 5-7% for units, 6-8% for regional properties
- Property holding periods: 5-10+ years for optimal tax benefits and capital growth
- Transaction costs: Stamp duty (0.75-5.5%), legal fees, agent commissions (~3-5% total)
- Vacancy rates: 3-5% annually (factor into cashflow projections)
- Interest rates: Variable around 5.5-7.0% (affects borrowing capacity)
- Market cycles: Consider 5-7 year cycles with peaks and troughs

LOCATION-BASED MARKET BIAS:
- CAPITAL CITY CBD: Higher growth (5-7%) but higher prices and vacancy risk
- CAPITAL CITY SUBURBS: Balanced growth (4-6%) with good rental demand
- REGIONAL CITIES: Steady growth (3-5%) with higher yields but limited capital appreciation
- SECONDARY REGIONAL: Stable yields (5-7%) with lower entry barriers but slower growth"""

    if risk_tolerance.lower() == 'conservative':
        return base_context + """

CONSERVATIVE INVESTOR MARKET APPROACH:
- Focus on established suburbs with stable growth (2-4% annually)
- Prioritize houses over units for long-term capital appreciation
- Target gross rental yields of 4.5-5.5% for reliable cashflow
- Allow 3-5 years between acquisitions for portfolio stabilization
- Consider regional markets ($400k-$600k entry) with lower volatility but steady growth
- Prefer secondary regional areas for lower entry costs and stable yields"""

    elif risk_tolerance.lower() == 'aggressive':
        return base_context + """

AGGRESSIVE INVESTOR MARKET APPROACH:
- Target high-growth suburbs (5-7%+ annually) in emerging areas
- Consider units in CBD locations ($800k-$1.1M) for rental demand and capital growth
- Target gross rental yields of 5-7% balancing income with growth potential
- Minimize time between acquisitions (1-2 years) during market upswings
- Consider development sites or off-the-plan opportunities in growth corridors
- Location bias: Capital city growth suburbs over regional stability"""

    else:  # moderate
        return base_context + """

MODERATE INVESTOR MARKET APPROACH:
- Balance established suburbs (3-5% growth) with some higher-growth opportunities
- Mix houses and units for portfolio diversification
- Target gross rental yields of 4.5-6% for balanced income and growth
- Allow 2-3 years between acquisitions for market timing and stabilization
- Consider both capital city suburbs ($500k-$800k) and regional opportunities ($400k-$700k)
- Use location bias: regional for stability, capital suburbs for growth potential"""


def _get_minimum_time_between_purchases(risk_tolerance: str) -> int:
    """Get minimum recommended time between property purchases."""
    timing = {
        'conservative': 3,  # Allow time for stabilization
        'moderate': 2,      # Balanced approach
        'aggressive': 1     # Maximize acquisition pace
    }
    return timing.get(risk_tolerance.lower(), 2)


def format_investor_details(investors: List[dict]) -> str:
    """Format investor details for the prompt."""
    lines = []
    for inv in investors:
        name = inv.get('name', 'Unknown')
        base_income = inv.get('base_income', 0)
        growth_rate = inv.get('annual_growth_rate', 0)
        # Growth rate is stored as integer (e.g., 3 = 3%), no need to multiply
        essential = inv.get('essential_expenditure', 0)
        nonessential = inv.get('nonessential_expenditure', 0)
        
        lines.append(f"- {name}: Base Income ${base_income:,.0f}, Growth {growth_rate}%, "
                    f"Essential ${essential:,.0f}, Non-essential ${nonessential:,.0f}")
    return "\n".join(lines) if lines else "No investors"


def format_current_dependants(investors: List[dict], portfolio_dependants: int = 0) -> str:
    """Format current dependants for portfolio-level dependants."""
    if portfolio_dependants > 0:
        return f"Portfolio Level: {portfolio_dependants} dependant{'s' if portfolio_dependants != 1 else ''}"
    return "No dependants at portfolio level"


def format_income_events(investors: List[dict]) -> str:
    """Format future income events for each investor."""
    lines = []
    for inv in investors:
        name = inv.get('name', 'Unknown')
        events = inv.get('income_events', [])
        if events:
            for ev in events:
                year = ev.get('year', 0)
                event_type = ev.get('type', 'increase')
                amount = ev.get('amount', 0)
                lines.append(f"- {name}: Year {year}, {event_type} ${amount:,.0f}")
    return "\n".join(lines) if lines else "No future income events"


def format_dependants_events(portfolio_dependants_events: List[dict] = None) -> str:
    """Format future dependant events for portfolio-level dependants."""
    if not portfolio_dependants_events:
        return "No future dependant events at portfolio level"
    
    lines = []
    for ev in portfolio_dependants_events:
        year = ev.get('year', 0)
        dependants = ev.get('dependants', 0)
        lines.append(f"- Year {year}: {dependants} dependant{'s' if dependants != 1 else ''}")
    return "\n".join(lines)


def format_existing_properties(properties: List[dict]) -> str:
    """Format existing properties for the prompt."""
    if not properties:
        return "No existing properties"
    
    lines = []
    for prop in properties:
        name = prop.get('name', 'Unknown')
        purchase_year = prop.get('purchase_year', 0)
        value = prop.get('property_value', 0) or prop.get('initial_value', 0)
        loan = prop.get('loan_amount', 0)
        rent = prop.get('rent', 0)
        
        lines.append(f"- {name}: Purchase Year {purchase_year}, Value ${value:,.0f}, "
                    f"Loan ${loan:,.0f}, Rent ${rent:,.0f}/yr")
    return "\n".join(lines)


def build_property_prompt(
    investors: List[dict],
    chart1_metrics: dict,
    existing_properties: List[dict],
    property_action: str,
    investment_goals: Optional[dict] = None,
    risk_tolerance: str = 'moderate',
    next_buy_year: Optional[int] = None,
    next_buy_score: Optional[float] = None,
) -> Tuple[str, str]:
    """
    Build system and user prompts for property generation or optimization with risk-adjusted analysis.

    Args:
        investors: List of investor data
        chart1_metrics: Enhanced financial metrics from extract_metrics_from_chart1()
        existing_properties: List of existing properties
        property_action: Either "add" or "optimize"
        investment_goals: Optional dict with 'goal' and 'risk_tolerance' keys
        risk_tolerance: Risk tolerance level ('conservative', 'moderate', 'aggressive')

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    
    # Enhanced system prompt with comprehensive Australian market context and realistic timing
    system_prompt = """You are a senior Australian property investment strategist specializing in portfolio optimization and acquisition strategy.
Your expertise covers advanced financial analysis, risk assessment, APRA lending standards, and Australian property market dynamics.

CRITICAL AUSTRALIAN LENDING STANDARDS & RISK FRAMEWORK:

**DTI Risk Zones (Debt-to-Income Multiples):**
- SAFE ZONE: < 3.0x (300%) - Excellent borrowing capacity, lowest risk
- CAUTION ZONE: 3.0x - 4.5x (300-450%) - Acceptable but monitor closely
- HIGH RISK ZONE: 4.5x - 5.5x (450-550%) - Requires strong buffers, limited lenders
- CRITICAL ZONE: > 5.5x (550%) - Very difficult lending, high default risk

**LVR Risk Assessment:**
- LOW RISK: < 60% - No LMI required, best rates
- CAUTION: 60-75% - Approaching LMI threshold
- LMI REQUIRED: 75-80% - Lender's Mortgage Insurance mandatory
- HIGH RISK: 80-90% - Significantly higher rates and fees
- CRITICAL: > 90% - Very limited lender appetite

**Australian Market Realities:**
- Median house prices: $1.3M (Sydney), $900k (Melbourne), $750k (regional capitals)
- Realistic growth rates: 3-7% annually depending on location and market cycle
- Gross rental yields: 4-6% for houses, 5-7% for units in high-demand areas
- Transaction costs: 3-5% of property value (stamp duty, legal, agent fees)
- Vacancy rates: 3-5% annually (must be factored into cashflow projections)
- Holding periods: 5-10+ years optimal for tax benefits and capital growth
- Market cycles: 5-7 year cycles requiring strategic timing between acquisitions

**Serviceability Requirements:**
- 2.5x minimum buffer above current debt commitments
- Minimum 10% equity buffer for property acquisition
- Positive cashflow after all expenses, loan repayments, and realistic vacancy rates

**Buy Signal Framework:**
- STRONG BUY: Score ≥80 - Optimal conditions, prioritize acquisition
- BUY: Score 60-79 - Good conditions, proceed with due diligence
- HOLD: Score 40-59 - Marginal conditions, wait for improvement
- WAIT: Score <40 - Poor conditions, focus on debt reduction

**Realistic Timing Considerations:**
- Minimum 1-3 years between acquisitions depending on risk tolerance
- Allow time for portfolio stabilization after each purchase
- Consider market cycles and interest rate environment
- Factor in settlement periods (30-90 days) and holding requirements

**Risk-Adjusted Investment Strategy:**
- CONSERVATIVE: DTI <3.5x, 20% equity buffers, 3-5 year gaps, established suburbs
- MODERATE: DTI up to 4.5x, 10-15% buffers, 2-3 year gaps, balanced growth
- AGGRESSIVE: DTI up to 5.0x, minimal buffers, 1-2 year gaps, high-growth areas

KEY ANALYSIS FACTORS:
1. **DTI Trajectory**: Current ratio + trend analysis for future risk
2. **Borrowing Capacity**: Risk-adjusted capacity considering all constraints
3. **Equity Buffers**: Accessible equity vs. serviceability requirements
4. **Cashflow Stability**: Household surplus consistency and property cashflow with vacancy rates
5. **LVR Risk Profile**: Individual property risk and portfolio concentration
6. **Realistic Timing**: Market-appropriate intervals between acquisitions
7. **Australian Market Context**: Local pricing, growth rates, and market conditions
8. **Serviceability Headroom**: Additional borrowing capacity beyond current needs

CRITICAL: Output ONLY valid JSON. Do NOT include any explanations, markdown formatting, or additional text. The response must be pure JSON starting with {{ and ending with }}. No code blocks, no backticks, no prose."""
    
    # User prompt based on action
    if property_action == "add":
        # Generate next property name based on existing properties
        existing_names = [p.get('name', '') for p in existing_properties]
        max_num = 0
        for name in existing_names:
            if name.startswith('Property '):
                try:
                    num = int(name.split()[-1])
                    max_num = max(max_num, num)
                except:
                    pass
        next_property_name = f"Property {chr(ord('A') + len(existing_properties))}"  # Property B, C, etc.

        # Format investment goals and risk tolerance
        goals_text = ""
        if investment_goals:
            goal = investment_goals.get('goal', 'Not specified')
            goals_text = f"""
INVESTMENT OBJECTIVES:
- Primary Goal: {goal}
- Risk Tolerance: {risk_tolerance.title()}
- Investment Horizon: Long-term portfolio growth"""

        # Risk-adjusted capacity limits based on risk tolerance
        dti_limit = _get_recommended_dti_limit(risk_tolerance)
        leverage_ratio = _get_recommended_leverage_ratio(risk_tolerance)

        # Australian market context
        market_context = _get_australian_market_context(risk_tolerance)

        user_prompt = f"""AUSTRALIAN PROPERTY INVESTMENT ANALYSIS WITH REALISTIC MARKET TIMING:

{goals_text}

AUSTRALIAN MARKET CONTEXT:
{market_context}

PORTFOLIO FINANCIAL METRICS:
{json.dumps(chart1_metrics, indent=2)}

EXISTING PORTFOLIO:
- Properties: {len(existing_properties)}
- Total Value: ${chart1_metrics.get('total_property_values', 0):,.0f}
- Total Debt: ${chart1_metrics.get('total_loan_balances', 0):,.0f}
- Total Equity: ${chart1_metrics.get('total_equity', 0):,.0f}

CURRENT POSITION (Year {chart1_metrics.get('baseline_year', 1)} — first year all properties are active):
- DTI Ratio: {chart1_metrics.get('current_dti', 0):.2f}x ({chart1_metrics.get('current_dti', 0)*100:.1f}%)
- Borrowing Capacity: ${chart1_metrics.get('borrowing_capacity', 0):,.0f}
- Risk-Adjusted Capacity: ${chart1_metrics.get('risk_adjusted_capacity', 0):,.0f}
- Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.0f}
- Household Surplus: ${chart1_metrics.get('household_surplus', 0):,.0f}/yr
- Property Cashflow: ${chart1_metrics.get('property_cashflow', 0):,.0f}/yr

TREND ANALYSIS:
- DTI Trend: {chart1_metrics.get('dti_trend', 0):.3f} (direction over time)
- Equity Trend: {chart1_metrics.get('equity_trend', 0):.3f}
- Borrowing Capacity Trend: {chart1_metrics.get('borrowing_capacity_trend', 0):.3f}
- DTI Volatility: {chart1_metrics.get('dti_volatility', 0):.3f}
- Surplus Stability: {chart1_metrics.get('surplus_stability', 0):.1f}/100
- Cashflow Stability: {chart1_metrics.get('cashflow_stability', 0):.1f}/100

RISK METRICS:
- LVR Risk Score: {chart1_metrics.get('lvr_risk_score', 0)}/100
- Average LVR: {chart1_metrics.get('avg_lvr', 0):.1f}%
- Equity Buffer Ratio: {chart1_metrics.get('equity_buffer_ratio', 0):.2f}
- Serviceability Buffer: ${chart1_metrics.get('serviceability_buffer', 0):,.0f}

OPTIMAL TIMING:
- Best Purchase Years: {chart1_metrics.get('optimal_purchase_windows', [1])}
- RECOMMENDED PURCHASE YEAR: Year {next_buy_year if next_buy_year is not None else 'N/A'} (buy score: {next_buy_score if next_buy_score is not None else 'N/A'}/100)
- IMPORTANT: Set purchase_year in your response to {next_buy_year if next_buy_year is not None else 1}. This is the first year where portfolio conditions support a new acquisition.

LOCATION-BASED PRICING GUIDELINES ({risk_tolerance.title()} Profile):
- Capital City CBD: $800k-$1.1M (higher growth, higher risk)
- Capital City Suburbs: $500k-$800k (balanced opportunity)
- Regional Cities: $400k-$600k (stable yields, lower entry)
- Secondary Regional: $350k-$550k (maximum affordability, steady returns)

INVESTOR PROFILES:
{format_investor_details(investors)}

EXISTING PROPERTIES:
{format_existing_properties(existing_properties)}

RISK-ADJUSTED STRATEGY ({risk_tolerance.title()} Profile):
- DTI Limit: ≤ {dti_limit}x (maintains {risk_tolerance} risk posture)
- Leverage Ratio: {leverage_ratio:.0%} of available borrowing capacity
- Minimum Time Between Purchases: {_get_minimum_time_between_purchases(risk_tolerance)} years
- Realistic Property Pricing: Based on Australian median house prices and market conditions

CRITICAL REQUIREMENTS:
1. Property name MUST be "{next_property_name}" - no variations allowed
2. Purchase year must allow sufficient time for portfolio stabilization and market conditions
3. Consider Australian property pricing by location type and market conditions (minimum $400k)
4. Loan amount must keep DTI ≤ {dti_limit}x considering current portfolio
5. Property value must be supportable by equity + {leverage_ratio:.0%} of risk-adjusted capacity
6. LVR should minimize risk (target <80% for conservative, <85% for moderate/aggressive)
7. Rent must provide positive cashflow with realistic yields (4-6% for houses, 5-7% for units, 6-8% for regional)
8. Growth rate should be realistic by location (3-5% regional, 4-6% capital suburbs, 5-7% CBD)
9. Minimum {_get_minimum_time_between_purchases(risk_tolerance)}-year gap between property acquisitions

AUSTRALIAN MARKET CONSIDERATIONS:
- Property pricing ranges: $400k-$1.5M (varies by location and risk tolerance)
- Regional entry level: $400k-$600k (stable yields, lower capital growth)
- Capital city suburbs: $500k-$800k (balanced growth and rental demand)
- Capital city CBD: $800k-$1.1M (higher growth potential, higher risk)
- Realistic purchase timelines: Allow 2-5+ years between acquisitions
- Market cycles: Consider property market conditions and interest rate environment
- Holding periods: Properties typically held 5-10+ years for optimal returns
- Stamp duty and transaction costs: Factor in 1-3% of property value
- Vacancy rates: Assume 3-5% vacancy when calculating cashflow

RECOMMENDATION FRAMEWORK:
- Consider realistic Australian property market conditions and timelines
- Ensure sufficient time between acquisitions for portfolio stabilization
- Factor in transaction costs, market conditions, and holding periods
- {'Prioritize capital preservation and long-term stability' if risk_tolerance == 'conservative' else 'Balance growth with prudent risk management and market timing' if risk_tolerance == 'moderate' else 'Maximize growth potential while respecting market realities'}

IMPORTANT: Respond with ONLY valid JSON. No explanations, no markdown, no additional text. The response must be parseable JSON starting with {{ and ending with }}.

{{
  "name": "{next_property_name}",
  "purchase_year": <realistic_year_considering_location_and_market_timing>,
  "loan_amount": <{risk_tolerance}_loan_amount_based_on_location>,
  "annual_principal_change": 0,
  "rent": <realistic_australian_rental_yield_by_location>,
  "interest_rate": <current_australian_market_rate>,
  "other_expenses": <realistic_australian_property_expenses>,
  "property_value": <location_biased_australian_price_$400k_minimum>,
  "initial_value": <starting_value>,
  "growth_rate": <location_specific_australian_growth_rate>,
  "investor_splits": [{{"name": "<investor>", "percentage": <split>}}]
}}"""
    
    else:  # optimize
        user_prompt = f"""FINANCIAL ANALYSIS FOR PORTFOLIO OPTIMIZATION:

EXISTING CHART1 TIMELINE DATA:
{json.dumps(chart1_metrics.get('yearly_forecast', [])[:5], indent=2)}

CURRENT PORTFOLIO STATUS:
- Property Count: {len(existing_properties)}
- Total Property Values: ${chart1_metrics.get('total_property_values', 0):,.2f}
- Total Loan Balances: ${chart1_metrics.get('total_loan_balances', 0):,.2f}
- Total Equity: ${chart1_metrics.get('total_equity', 0):,.2f}

CURRENT FINANCIAL METRICS (Year 1):
- DTI Ratio: {chart1_metrics.get('current_dti', 0):.2f}x ({chart1_metrics.get('current_dti', 0)*100:.1f}%)
- Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.2f}
- Household Surplus: ${chart1_metrics.get('household_surplus', 0):,.2f}
- Property Cashflow: ${chart1_metrics.get('property_cashflow', 0):,.2f}

EXISTING PROPERTIES:
{format_existing_properties(existing_properties)}

INVESTOR DETAILS:
{format_investor_details(investors)}

TASK: Analyze the existing properties and provide portfolio recommendations including:

IMPORTANT AUSTRALIAN LENDING STANDARDS:
- DTI is expressed as a MULTIPLE (e.g., 1.5 = 150% = debt is 1.5x annual income)
- DTI < 3.0 (300%) = SAFE ZONE - comfortable borrowing capacity
- DTI 3.0-5.0 (300-500%) = CAUTION ZONE - still acceptable but monitor closely
- DTI > 5.0 (500%) = HIGH RISK - may have difficulty obtaining additional credit

1. **IDENTIFY BOTTLENECKS**: What areas are limiting portfolio growth? Consider:
   - High DTI ratio (>5.0 indicates high risk)
   - Low accessible equity
   - Negative property cashflow
   - High LVR (>80%)

2. **PROVIDE RECOMMENDATIONS**: Actionable steps to optimize the portfolio:
   - Debt management strategies
   - Property acquisition opportunities based on current capacity
   - Rent adjustment suggestions
   - Expense optimization

3. **OPTIMAL TIMING**: When is the best time to make investment decisions based on financial projections?

4. **MAX PURCHASE PRICE**: Based on accessible equity and borrowing capacity, what is the maximum property price that can be supported?

Respond with JSON containing:
{{
  "bottlenecks": "<description of main bottlenecks limiting portfolio growth>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "optimal_timing": "<best time to make investment decisions>",
  "max_purchase_price": "$<amount> based on accessible equity and borrowing capacity"
}}"""
    
    return system_prompt, user_prompt


def parse_property_attributes(response: str) -> dict:
    """
    Parse Bedrock response into property attribute format.

    Args:
        response: The raw response from Bedrock

    Returns:
        Parsed property object or error dict
    """
    logger.info(f"Raw Bedrock response (first 1000 chars): {response[:1000]}")

    try:
        # Try to find JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            json_str = json_match.group()
            logger.info(f"Extracted JSON: {json_str}")
            parsed = json.loads(json_str)
            logger.info(f"Successfully parsed JSON with keys: {list(parsed.keys())}")
            return parsed
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        logger.error(f"Failed JSON string: {response}")

    return {"error": "Failed to parse property attributes", "raw_response": response[:500]}


def build_summary_prompt(
    investors: List[dict],
    chart1_metrics: dict,
    existing_properties: List[dict],
    investment_goals: Optional[dict] = None,
    investment_years: int = 30,
    portfolio_dependants: int = 0,
    portfolio_dependants_events: List[dict] = None
) -> Tuple[str, str]:
    """
    Build system and user prompts for portfolio summary generation.
    
    Args:
        investors: List of investor data
        chart1_metrics: Extracted financial metrics from chart1
        existing_properties: List of existing properties
        investment_goals: Optional investment goals from user
        investment_years: Number of years for investment projection
    
    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    
    # System prompt for summary generation - 4-section structure
    system_prompt = """You are a professional Australian property investment analyst specializing in portfolio analysis and executive summaries.
Your role is to analyze an investor's property portfolio and provide a clear, actionable executive summary.

IMPORTANT AUSTRALIAN LENDING STANDARDS:
- DTI (Debt-to-Income) ratio is expressed as a MULTIPLE (e.g., 1.5 = 150% = debt is 1.5x annual income)
- DTI below 3.0 (300%) is considered SAFE
- DTI 3.0-5.0 (300-500%) is CAUTION
- DTI above 5.0 (500%) is HIGH RISK

Output format - STRICTLY follow this 3-section structure:
1. INVESTOR PROFILE: Start with this section. Details about investors, current dependants, and future events (income changes and dependant changes over time).
2. RISKS & OBJECTIVES: Investment goals, risk tolerance profile, and how the portfolio aligns with objectives.
3. PORTFOLIO STATUS: Current status considering the investment timeframe and how it aligns with risk profile and objectives.

Output ONLY the summary text. No JSON required."""
    
    # Format goals text
    goals_text = ""
    if investment_goals:
        goals_text = f"""
INVESTMENT GOALS:
- Goal: {investment_goals.get('goal', 'Not specified')}
- Risk Tolerance: {investment_goals.get('risk_tolerance', 'Not specified')}"""
    
    # Build user prompt with 4 sections
    user_prompt = f"""PORTFOLIO EXECUTIVE SUMMARY REQUEST:

=== SECTION 1: INVESTOR PROFILE ===
INVESTOR DETAILS (from investors[]):
{format_investor_details(investors)}

CURRENT DEPENDANTS (from portfolio level - portfolio_dependants):
{format_current_dependants(investors, portfolio_dependants)}

INCOME EVENTS (from investors[].income_events - future income changes):
{format_income_events(investors)}

DEPENDANT EVENTS (from portfolio_dependants_events - future dependant changes at portfolio level):
{format_dependants_events(portfolio_dependants_events)}

=== SECTION 2: RISKS & OBJECTIVES ===
{goals_text}

INVESTMENT TIMEFRAME (from investment_years):
- Years to Invest: {investment_years} years

=== SECTION 3: PORTFOLIO STATUS ===
CURRENT PORTFOLIO:
- Property Count: {len(existing_properties)}
- Total Property Values: ${chart1_metrics.get('total_property_values', 0):,.2f}
- Total Loan Balances: ${chart1_metrics.get('total_loan_balances', 0):,.2f}
- Total Equity: ${chart1_metrics.get('total_equity', 0):,.2f}

FINANCIAL METRICS (from chart1 yearly_forecast):
- Current DTI Ratio: {chart1_metrics.get('current_dti', 0):.2f}x ({chart1_metrics.get('current_dti', 0)*100:.1f}%)
- Min DTI (Best over timeline): {chart1_metrics.get('min_dti', 0):.2f}x
- Max Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.2f}
- Borrowing Capacity: ${chart1_metrics.get('borrowing_capacity', 0):,.2f}
- Household Surplus: ${chart1_metrics.get('household_surplus', 0):,.2f}/year
- Property Cashflow: ${chart1_metrics.get('property_cashflow', 0):,.2f}/year

EXISTING PROPERTIES:
{format_existing_properties(existing_properties)}

Provide the executive summary covering the three sections above."""
    
    return system_prompt, user_prompt


def parse_summary_response(response: str) -> str:
    """
    Parse Bedrock summary response.
    
    Args:
        response: The raw response from Bedrock
    
    Returns:
        Summary text string
    """
    # The response should be plain text, but try to clean it up
    if not response:
        return ""
    
    # If response contains JSON wrapper, try to extract text
    try:
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed = json.loads(json_match.group())
            # Check for summary field in JSON
            if isinstance(parsed, dict):
                if 'summary' in parsed:
                    return parsed['summary']
                if 'analysis' in parsed:
                    return parsed['analysis']
    except (json.JSONDecodeError, Exception):
        pass
    
    # Return cleaned response
    return response.strip()


def build_advice_prompt(
    investors: List[dict],
    chart1_metrics: dict,
    existing_properties: List[dict],
    investment_goals: Optional[dict] = None,
    investment_years: int = 30,
    portfolio_dependants: int = 0,
    portfolio_dependants_events: List[dict] = None
) -> Tuple[str, str]:
    """
    Build prompts for actionable advice generation with 3 recommendations.
    
    Args:
        investors: List of investor data
        chart1_metrics: Extracted financial metrics from chart1
        existing_properties: List of existing properties
        investment_goals: Optional investment goals from user
        investment_years: Number of years for investment projection
        portfolio_dependants: Number of dependants at portfolio level
        portfolio_dependants_events: Future dependant events
    
    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    # Get risk profile from investment_goals
    risk_tolerance = investment_goals.get('risk_tolerance', 'moderate') if investment_goals else 'moderate'
    investment_goal = investment_goals.get('goal', 'Wealth accumulation') if investment_goals else 'Wealth accumulation'
    
    # System prompt for advice generation - 5-6 recommendations with reasoning
    system_prompt = """You are a professional Australian property investment advisor.
Your role is to provide 3 actionable recommendations based on portfolio analysis.

IMPORTANT REQUIREMENTS:
1. Each recommendation MUST include reasoning backed by data
2. Consider: chart1 forecast projections, risk profile, investment goals
3. Use Australian lending standards (DTI < 3.0 = safe, 3.0-5.0 = caution, > 5.0 = high risk)
4. Format each recommendation as: "**Recommendation X:** [title]\n**Reasoning:** [explanation based on data]"

Output format - Provide exactly 3 recommendations, each with:
- Recommendation title
- Detailed reasoning based on the data (chart1 forecasts, risk profile, goals)

Output ONLY the recommendations text. No JSON required."""
    
    # Build user prompt with forecast data, risk profile, and investment goals
    user_prompt = f"""PORTFOLIO ADVICE REQUEST:

RISK PROFILE: {risk_tolerance}
INVESTMENT GOAL: {investment_goal}
INVESTMENT TIMEFRAME: {investment_years} years

=== INVESTORS ===
{format_investor_details(investors)}

DEPENDANTS: {format_current_dependants(investors, portfolio_dependants)}
INCOME EVENTS: {format_income_events(investors)}
DEPENDANT EVENTS: {format_dependants_events(portfolio_dependants_events)}

=== FORECAST (Year 1) ===
{json.dumps(chart1_metrics.get('yearly_forecast', [])[:1], indent=2)}

=== PORTFOLIO ===
- Properties: {len(existing_properties)}, Equity: ${chart1_metrics.get('total_equity', 0):,.0f}
- DTI: {chart1_metrics.get('current_dti', 0):.2f}x, Max Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.0f}
- Borrowing: ${chart1_metrics.get('borrowing_capacity', 0):,.0f}, Surplus: ${chart1_metrics.get('household_surplus', 0):,.0f}/yr

=== PROPERTIES ===
{format_existing_properties(existing_properties)}

Provide 3 actionable recommendations with reasoning based on risk profile ({risk_tolerance}), goal ({investment_goal}), and the {investment_years}-year timeframe."""
    
    return system_prompt, user_prompt


def parse_advice_response(response: str) -> str:
    """
    Parse Bedrock advice response.
    
    Args:
        response: The raw response from Bedrock
    
    Returns:
        Advice text string
    """
    if not response:
        return ""
    
    # Try to clean up and return the response
    try:
        # If response contains JSON wrapper, try to extract text
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed = json.loads(json_match.group())
            if isinstance(parsed, dict):
                if 'advice' in parsed:
                    return parsed['advice']
                if 'recommendations' in parsed:
                    return parsed['recommendations']
    except (json.JSONDecodeError, Exception):
        pass
    
    return response.strip()


def validate_property_attributes(properties: dict, action: str) -> Tuple[bool, str]:
    """
    Validate property attributes meet business rules.
    
    Args:
        properties: Property or properties object to validate
        action: The action type ("add" or "optimize")
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if action == "add":
        property_obj = properties
        required_fields = ['name', 'purchase_year', 'loan_amount', 'rent', 
                         'interest_rate', 'property_value', 'initial_value', 
                         'growth_rate', 'investor_splits']
        
        for field in required_fields:
            if field not in property_obj:
                return False, f"Missing required field: {field}"
        
        # Validate numeric ranges
        if property_obj.get('purchase_year', 0) < 1:
            return False, "Purchase year must be >= 1"
        
        if property_obj.get('loan_amount', 0) < 0:
            return False, "Loan amount must be positive"
        
        if property_obj.get('interest_rate', 0) < 0 or property_obj.get('interest_rate', 0) > 20:
            return False, "Interest rate must be between 0-20%"
        
        # Validate investor splits total 100%
        splits = property_obj.get('investor_splits', [])
        if splits:
            total_percentage = sum(s.get('percentage', 0) for s in splits)
            if abs(total_percentage - 100) > 1:  # Allow 1% tolerance
                return False, f"Investor splits must total 100%, got {total_percentage}%"
    
    elif action == "optimize":
        if 'properties' not in properties:
            return False, "Missing 'properties' array in optimize response"
        
        if not isinstance(properties.get('properties'), list):
            return False, "'properties' must be an array"
        
        if 'analysis' not in properties:
            return False, "Missing 'analysis' object in optimize response"
    
    return True, ""


def convert_decimal_to_float(obj):
    """Convert Decimal values to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal_to_float(item) for item in obj]
    return obj


def create_response(status_code: int, body: dict) -> dict:
    """
    Create a standardized API Gateway response with CORS headers.
    
    Args:
        status_code: HTTP status code
        body: Response body dictionary
    
    Returns:
        API Gateway compatible response dict
    """
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, cls=DecimalEncoder)
    }


def handle_options_request(event: dict) -> dict:
    """
    Handle OPTIONS preflight request for CORS.
    
    Args:
        event: Lambda event dictionary
    
    Returns:
        API Gateway response for OPTIONS request
    """
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': ''
    }


def lambda_handler(event: dict, context: any) -> dict:
    """
    Lambda function handler for API Gateway.
    
    Expected event format (from API Gateway):
    {
        "httpMethod": "POST",
        "body": "{\"table_name\": \"BA-PORTAL-BASETABLE\", \"id\": \"YOUR-ID-HERE\", \"property_action\": \"add\"}"
    }
    
    Or direct call:
    {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": "YOUR-ID-HERE",
        "property_action": "add"
    }
    
    property_action can be:
    - "add": Generate a new property recommendation
    - "optimize": Optimize existing properties
    """
    logger.info("BA Agent Lambda handler started")
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle CORS preflight (OPTIONS) request
    http_method = event.get('httpMethod', '')
    if http_method == 'OPTIONS':
        logger.info("Handling OPTIONS preflight request")
        return handle_options_request(event)
    
    # Extract user from API Gateway authorizer context (already validated by API Gateway)
    email = extract_user_from_event(event)
    
    if not email:
        logger.warning("No user email found in JWT - authentication required")
        
        # Audit: Failed authentication
        log_audit_event(
            event_type="AUTH_FAILURE",
            user_email="",
            portfolio_id=event.get('body',{}).get('id','unknown'),
            action="ba_agent",
            status="denied",
            message="No valid JWT token provided"
        )
        
        return create_response(401, {
            'status': 'error',
            'message': 'Authentication required. Please login.',
            'error_code': 'UNAUTHORIZED',
            'timestamp': datetime.utcnow().isoformat()
        })
    
    # Parse the event to extract parameters
    body_data = {}
    
    # Handle API Gateway proxy integration format
    if 'body' in event:
        body = event['body']
        if isinstance(body, str):
            try:
                body_data = json.loads(body)
            except json.JSONDecodeError:
                return create_response(400, {
                    'status': 'error', 
                    'message': 'Invalid JSON in body'
                })
        elif isinstance(body, dict):
            body_data = body
    else:
        body_data = event
    
    # Also check query string parameters
    if 'queryStringParameters' in event and isinstance(event['queryStringParameters'], dict):
        body_data.update(event['queryStringParameters'])
    
    # Extract parameters
    table_name = body_data.get('table_name', 'BA-PORTAL-BASETABLE')
    item_id = body_data.get('id')
    region = body_data.get('region', 'ap-southeast-2')
    property_action = body_data.get('property_action', 'add')
    
    logger.info(f"Parameters - table: {table_name}, id: {item_id}, action: {property_action}, region: {region}")
    
    # Validate required parameters
    if not item_id:
        return create_response(400, {
            'status': 'error', 
            'message': 'Missing required parameter: id'
        })
    
    if property_action not in ['add', 'optimize', 'summary', 'advice']:
        return create_response(400, {
            'status': 'error',
            'message': f"Invalid property_action: {property_action}. Must be 'add', 'optimize', 'summary', or 'advice'"
        })

    # Single DynamoDB fetch — used for both ownership check and main logic
    try:
        data = get_data_from_dynamodb(table_name, item_id, region)
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        return create_response(404, {
            'status': 'error',
            'message': str(e)
        })
    except Exception as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {
            'status': 'error',
            'message': f'DynamoDB error: {str(e)}'
        })

    # Validate portfolio ownership
    item_adviser = data.get('adviser_name', '')
    if item_adviser and item_adviser.lower() != email.lower():
        logger.warning(f"User {email} attempted to access portfolio owned by {item_adviser}")
        log_audit_event(
            event_type="ACCESS_DENIED",
            user_email=email,
            portfolio_id=item_id,
            action=f"ba_agent_{property_action}",
            status="denied",
            message=f"User {email} attempted to access portfolio owned by {item_adviser}"
        )
        return create_response(403, {
            'status': 'error',
            'message': 'Access denied. You do not have permission to access this portfolio.',
            'error_code': 'FORBIDDEN',
            'timestamp': datetime.utcnow().isoformat()
        })
    
    # Convert Decimal values
    investors = convert_decimal_to_float(data.get('investors', []))
    properties = convert_decimal_to_float(data.get('properties', []))
    chart1 = convert_decimal_to_float(data.get('chart1', {}))
    portfolio_dependants_clean = convert_decimal_to_float(data.get('portfolio_dependants', 0))
    portfolio_dependants_events_clean = convert_decimal_to_float(data.get('portfolio_dependants_events', []))
    
    # Extract metrics from chart1
    chart1_metrics = extract_metrics_from_chart1(chart1)
    
    if not chart1_metrics:
        logger.warning("No chart1 data found - proceeding with basic analysis")
        chart1_metrics = {
            'current_dti': 0,
            'min_dti': 0,
            'max_accessible_equity': 0,
            'total_equity': 0,
            'total_property_values': 0,
            'total_loan_balances': 0,
            'borrowing_capacity': 0,
            'household_surplus': 0,
            'property_cashflow': 0,
            'yearly_forecast': []
        }
    
    # Build prompts
    if property_action == "summary":
        # For summary action, we need to get investment goals and investment years
        # Extract investment goals from the item if available
        investment_goals = None
        if 'investment_goals' in data:
            investment_goals = data['investment_goals']
        
        # Get investment_years from the data (default to 30)
        investment_years = data.get('investment_years', 30)
        
        system_prompt, user_prompt = build_summary_prompt(
            investors=investors,
            chart1_metrics=chart1_metrics,
            existing_properties=properties,
            investment_goals=investment_goals,
            investment_years=data.get('investment_years', 30),
            portfolio_dependants=portfolio_dependants_clean,
            portfolio_dependants_events=portfolio_dependants_events_clean
        )
        
        # Invoke Bedrock
        try:
            logger.info(f"Invoking Bedrock for property_action: {property_action}, region: {region}")
            bedrock_response = invoke_bedrock(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model_kwargs={
                    "max_tokens": 4096,  # Summary needs fewer tokens
                    "temperature": 0.7
                },
                region=region
            )
            logger.info("Bedrock invocation successful")
        except Exception as e:
            logger.error(f"Bedrock invocation error: {str(e)}")
            return create_response(500, {
                'status': 'error',
                'message': f'Bedrock invocation failed: {str(e)}'
            })
        
        # Parse summary response
        summary_text = parse_summary_response(bedrock_response)
        
        # Validate summary is not empty
        if not summary_text or len(summary_text.strip()) < 10:
            logger.warning("Generated summary is too short or empty")
            summary_text = "Unable to generate a meaningful portfolio summary at this time. Please try again."
        
        response_body = {
            'status': 'success',
            'summary': summary_text
        }
    elif property_action == "advice":
        # For advice action - check for existing advice first
        # If advice exists in DB, return it immediately (no timeout)
        # If not, generate new advice (may timeout but will be saved)
        
        try:
            # Check if there's already existing advice in DynamoDB
            dynamodb = boto3.resource('dynamodb', region_name=region)
            advice_table = dynamodb.Table(table_name)
            
            existing_item = advice_table.get_item(Key={'id': item_id})
            existing_advice = existing_item.get('Item', {}).get('our_advice', '')
            
            # If advice exists and is not the "generating" placeholder, return it
            if existing_advice and existing_advice != 'Generating advice...' and len(existing_advice) > 50:
                logger.info(f"Returning cached advice for item {item_id}")
                return create_response(200, {
                    'status': 'success',
                    'advice': existing_advice,
                    'cached': True
                })
            
            logger.info(f"Generating new advice for item {item_id}")
        except Exception as e:
            logger.error(f"Error checking for existing advice: {str(e)}")
        
        # Extract investment goals from the data
        investment_goals = None
        if 'investment_goals' in data:
            investment_goals = data['investment_goals']
        
        # Get investment_years from the data (default to 30)
        investment_years = data.get('investment_years', 30)
        
        # Build prompts
        system_prompt, user_prompt = build_advice_prompt(
            investors=investors,
            chart1_metrics=chart1_metrics,
            existing_properties=properties,
            investment_goals=investment_goals,
            investment_years=data.get('investment_years', 30),
            portfolio_dependants=portfolio_dependants_clean,
            portfolio_dependants_events=portfolio_dependants_events_clean
        )
        
        # Invoke Bedrock
        try:
            logger.info(f"Invoking Bedrock for property_action: {property_action}, region: {region}")
            bedrock_response = invoke_bedrock(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model_kwargs={
                    "max_tokens": 2048,
                    "temperature": 0.7
                },
                region=region
            )
            logger.info("Bedrock invocation successful")
        except Exception as e:
            logger.error(f"Bedrock invocation error: {str(e)}")
            return create_response(500, {
                'status': 'error',
                'message': f'Bedrock invocation failed: {str(e)}'
            })
        
        # Parse advice response
        advice_text = parse_advice_response(bedrock_response)
        
        # Validate advice is not empty
        if not advice_text or len(advice_text.strip()) < 10:
            logger.warning("Generated advice is too short or empty")
            advice_text = "Unable to generate meaningful advice at this time. Please try again."
        
        # Save advice to DynamoDB
        try:
            dynamodb = boto3.resource('dynamodb', region_name=region)
            advice_table = dynamodb.Table(table_name)
            advice_table.update_item(
                Key={'id': item_id},
                UpdateExpression='SET our_advice = :advice',
                ExpressionAttributeValues={':advice': advice_text}
            )
            logger.info(f"Saved advice to DynamoDB for item {item_id}")
        except Exception as e:
            logger.error(f"Failed to save advice to DynamoDB: {str(e)}")
        
        response_body = {
            'status': 'success',
            'advice': advice_text
        }
    else:
        # Enhanced logic for add and optimize actions with buy signal analysis

        # Extract investment goals for risk-adjusted recommendations
        investment_goals = None
        if 'investment_goals' in data:
            investment_goals = data['investment_goals']

        # Determine risk tolerance (use from goals or default to moderate)
        risk_tolerance = 'moderate'
        if investment_goals and 'risk_tolerance' in investment_goals:
            risk_tolerance = investment_goals['risk_tolerance'].lower()
        elif 'risk_tolerance' in data:
            risk_tolerance = data['risk_tolerance'].lower()

        # Validate risk tolerance
        if risk_tolerance not in ['conservative', 'moderate', 'aggressive']:
            risk_tolerance = 'moderate'

        # Calculate buy signal score
        buy_signal = calculate_buy_signal_score(chart1_metrics, risk_tolerance)
        logger.info(f"Buy signal calculated - Score: {buy_signal['composite_score']}, Rating: {buy_signal['rating']}")

        # Forward-looking gate: find the next year in the forecast where buy_score >= 60.
        # Borrowing capacity at the baseline year may be $0 but grows over time — we look
        # ahead across all 30 years and let Bedrock target the correct future purchase year.
        yearly_forecast_raw = chart1 if isinstance(chart1, list) else chart1.get('yearly_forecast', [])
        next_buy_year = None
        next_buy_score = None
        for yr in yearly_forecast_raw:
            if yr.get('buy_score', 0) >= 60 and yr.get('buy_rating') in ('Buy', 'Strong Buy'):
                next_buy_year = yr.get('year')
                next_buy_score = yr.get('buy_score')
                break

        if property_action == "add" and next_buy_year is None:
            logger.warning("Blocking add recommendation: no viable purchase year found across 30-year forecast")
            return create_response(200, {
                'status': 'not_recommended',
                'action': 'add',
                'message': (
                    "No viable purchase year was found across the 30-year forecast. "
                    "Focus on reducing existing debt or increasing income before acquiring additional properties."
                ),
                'buy_signal': {
                    'score': buy_signal['composite_score'],
                    'rating': buy_signal['rating'],
                    'next_buy_year': None,
                }
            })

        # Use buy signal insights internally to enhance recommendations
        system_prompt, user_prompt = build_property_prompt(
            investors=investors,
            chart1_metrics=chart1_metrics,
            existing_properties=properties,
            property_action=property_action,
            investment_goals=investment_goals,
            risk_tolerance=risk_tolerance,
            next_buy_year=next_buy_year,
            next_buy_score=next_buy_score,
        )

        # Invoke Bedrock
        try:
            logger.info(f"Invoking Bedrock for property_action: {property_action}, region: {region}, risk_tolerance: {risk_tolerance}")
            bedrock_response = invoke_bedrock(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model_kwargs={
                    "max_tokens": 2048,
                    "temperature": 0.7
                },
                region=region
            )
            logger.info("Bedrock invocation successful")
        except Exception as e:
            logger.error(f"Bedrock invocation error: {str(e)}")
            return create_response(500, {
                'status': 'error',
                'message': f'Bedrock invocation failed: {str(e)}'
            })
        
        # Parse response
        parsed_response = parse_property_attributes(bedrock_response)
        
        # Validate response
        is_valid, error_msg = validate_property_attributes(parsed_response, property_action)
        
        if not is_valid:
            logger.warning(f"Validation warning: {error_msg}")
            # Still return the response but with warning
        
        # Build final response
        if property_action == "add":
            response_body = {
                'status': 'success',
                'action': 'add',
                'property': parsed_response.get('name') and {
                    'name': parsed_response.get('name'),
                    'purchase_year': parsed_response.get('purchase_year'),
                    'loan_amount': parsed_response.get('loan_amount'),
                    'annual_principal_change': parsed_response.get('annual_principal_change', 0),
                    'rent': parsed_response.get('rent'),
                    'interest_rate': parsed_response.get('interest_rate'),
                    'other_expenses': parsed_response.get('other_expenses'),
                    'property_value': parsed_response.get('property_value'),
                    'initial_value': parsed_response.get('initial_value'),
                    'growth_rate': parsed_response.get('growth_rate'),
                    'investor_splits': parsed_response.get('investor_splits', [])
                } or parsed_response
            }
        else:  # optimize
            # Build analysis object with extracted metrics
            current_dti = chart1_metrics.get('current_dti', 0)
            max_equity = chart1_metrics.get('max_accessible_equity', 0)
            borrowing_capacity = chart1_metrics.get('borrowing_capacity', 0)
            property_cashflow = chart1_metrics.get('property_cashflow', 0)
            
            # Calculate max purchase price (equity / 0.25 for 25% deposit)
            max_purchase_price = max_equity / 0.25 if max_equity > 0 else 0
            
            # Determine optimal timing based on Australian DTI thresholds
            # DTI < 3.0 = SAFE, DTI 3.0-5.0 = CAUTION, DTI > 5.0 = HIGH RISK
            if current_dti < 3.0:
                optimal_timing = "NOW - DTI is in the safe zone (<3.0x), comfortable borrowing capacity for new investments"
            elif current_dti < 5.0:
                optimal_timing = "CAUTION - DTI is 3.0-5.0x range. Monitor closely, still acceptable but reducing capacity"
            else:
                optimal_timing = "HIGH RISK - DTI exceeds 5.0x. Focus on debt reduction before additional borrowing"
            
            # Build initial bottlenecks from metrics (using Australian thresholds)
            bottlenecks_list = []
            if current_dti > 5.0:
                bottlenecks_list.append(f"High DTI ratio of {current_dti:.2f}x ({current_dti*100:.1f}%) exceeds recommended threshold of 5.0x")
            elif current_dti > 3.0:
                bottlenecks_list.append(f"DTI ratio of {current_dti:.2f}x ({current_dti*100:.1f}%) is in caution zone (3.0-5.0x)")
            if max_equity < 100000:
                bottlenecks_list.append("Limited accessible equity restricts new property purchases")
            if property_cashflow < 0:
                bottlenecks_list.append("Negative property cashflow indicates rental income not covering expenses")
            if borrowing_capacity < 100000:
                bottlenecks_list.append("Low borrowing capacity constrains portfolio growth")
            
            if not bottlenecks_list:
                bottlenecks_list.append("Portfolio is well-positioned for growth - DTI is healthy and within acceptable range")
            
            bottlenecks = ". ".join(bottlenecks_list)
            
            # Build recommendations based on Australian lending standards
            recommendations_list = []
            if current_dti > 5.0:
                recommendations_list.append("Focus on debt reduction to bring DTI below 5.0x before considering additional properties")
            elif current_dti > 3.0:
                recommendations_list.append("DTI is in caution zone - consider reducing debt before major investments")
            else:
                recommendations_list.append("DTI is in healthy range - good time to explore investment opportunities")
            if max_equity > 0:
                recommendations_list.append(f"Accessible equity of ${max_equity:,.0f} available for next purchase")
            if property_cashflow < 0:
                recommendations_list.append("Property cashflow is negative, consider increasing rent or reducing expenses")
            if borrowing_capacity > 0:
                recommendations_list.append(f"Borrowing capacity of ${borrowing_capacity:,.0f} available")
            recommendations_list.append(f"Maximum purchase price of ${max_purchase_price:,.0f} based on accessible equity")
            
            # If Bedrock returned enhanced analysis, use it
            if parsed_response.get('bottlenecks'):
                bottlenecks = parsed_response.get('bottlenecks', bottlenecks)
            if parsed_response.get('recommendations'):
                recommendations_list = parsed_response.get('recommendations', recommendations_list)
            if parsed_response.get('optimal_timing'):
                optimal_timing = parsed_response.get('optimal_timing', optimal_timing)
            if parsed_response.get('max_purchase_price'):
                max_purchase_price = parsed_response.get('max_purchase_price', f"${max_purchase_price:,.0f}")
            
            response_body = {
                'status': 'success',
                'action': 'optimize',
                'analysis': {
                    'bottlenecks': bottlenecks,
                    'recommendations': recommendations_list,
                    'optimal_timing': optimal_timing,
                    'max_purchase_price': f"${max_purchase_price:,.0f}" if isinstance(max_purchase_price, (int, float)) else max_purchase_price
                }
            }
    
    return create_response(200, response_body)


# For local testing
if __name__ == "__main__":
    import sys
    
    # Test parameters
    test_id = "1EB8EB7F-576B-497B-BF47-32664361A464"
    table_name = "BA-PORTAL-BASETABLE"
    region = "ap-southeast-2"
    
    # Determine action from command line
    action = sys.argv[1] if len(sys.argv) > 1 else "add"
    
    # Create test event (simulating API Gateway format)
    test_event = {
        "httpMethod": "POST",
        "body": json.dumps({
            "table_name": table_name,
            "id": test_id,
            "property_action": action,
            "region": region
        })
    }
    
    print(f"Testing BA Agent Lambda with action: {action}")
    print(f"Event: {json.dumps(test_event, indent=2)}")
    print("-" * 50)
    
    try:
        response = lambda_handler(test_event, None)
        print(f"Response Status: {response['statusCode']}")
        print(f"Response Headers: {response['headers']}")
        print(f"Response Body:\n{json.dumps(json.loads(response['body']), indent=2)}")
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
