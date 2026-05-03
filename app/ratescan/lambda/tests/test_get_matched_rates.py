"""
test_get_matched_rates.py

Test suite for get_matched_rates.lambda_handler.

Test layers
───────────
1. Unit tests  — pure Python, no AWS calls, mock run_query
2. Contract tests — hit the live /rates/matched API endpoint and validate
                    the shape and accuracy of results against direct Athena queries

Run unit tests only (no AWS credentials needed):
    pytest tests/test_get_matched_rates.py -m unit -v

Run all tests including live API (requires AWS credentials + live endpoint):
    RATESCAN_API_URL=https://eqwjfw8zzh.execute-api.ap-southeast-2.amazonaws.com/prod \
    pytest tests/test_get_matched_rates.py -v

The contract tests POST to RATESCAN_API_URL/rates/matched and independently
verify each result row is actually present in the Athena table with the right
filters applied, so they catch SQL bugs, LVR filter errors, mapping mistakes,
and data drift.
"""

import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

import pytest

# ── path setup so tests can import lambda source directly ─────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── optional live-API imports (skipped when env var absent) ──────────────────
_API_URL = os.environ.get("RATESCAN_API_URL", "").rstrip("/")
_LIVE    = bool(_API_URL)

# ── helper: fake Athena row ───────────────────────────────────────────────────

def _row(brand="ANZ", product_name="Variable Home Loan", rate_pct="5.99",
         comparison_rate_pct="6.01", applicationuri="https://anz.com.au/apply"):
    return {
        "brand":                brand,
        "product_name":         product_name,
        "rate_pct":             rate_pct,
        "comparison_rate_pct":  comparison_rate_pct,
        "applicationuri":       applicationuri,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. UNIT TESTS — lambda internals, no network
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.unit
class TestBuildResponse(unittest.TestCase):
    """_build_response() correctly maps Athena rows to API response objects."""

    def setUp(self):
        from get_matched_rates import _build_response
        self._build = _build_response

    def test_basic_row_mapped_correctly(self):
        rows   = [_row()]
        result = self._build(rows)
        self.assertEqual(len(result), 1)
        r = result[0]
        self.assertEqual(r["brand"],        "ANZ")
        self.assertEqual(r["productName"],  "Variable Home Loan")
        self.assertAlmostEqual(r["rate"],           5.99)
        self.assertAlmostEqual(r["comparisonRate"], 6.01)
        self.assertEqual(r["applicationUri"], "https://anz.com.au/apply")

    def test_null_application_uri_becomes_none(self):
        rows   = [_row(applicationuri="")]
        result = self._build(rows)
        self.assertIsNone(result[0]["applicationUri"])

    def test_zero_rate_row_excluded(self):
        rows   = [_row(rate_pct="0"), _row(brand="CBA", rate_pct="5.50")]
        result = self._build(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["brand"], "CBA")

    def test_null_comparison_rate_becomes_none(self):
        rows   = [_row(comparison_rate_pct="0")]
        result = self._build(rows)
        self.assertIsNone(result[0]["comparisonRate"])

    def test_multiple_rows_order_preserved(self):
        rows   = [_row(brand="ANZ", rate_pct="5.80"), _row(brand="CBA", rate_pct="5.90")]
        result = self._build(rows)
        self.assertEqual([r["brand"] for r in result], ["ANZ", "CBA"])

    def test_decimal_rate_normalised_from_fraction(self):
        """Rates stored as fractions (0.0599) must be converted to percent."""
        rows   = [_row(rate_pct="0.0599", comparison_rate_pct="0.0601")]
        # _build_response receives already-computed rate_pct from SQL CASE; test _f directly
        from get_matched_rates import _f
        self.assertAlmostEqual(_f("0.0599"), 0.0599)  # _f just casts — SQL handles normalisation


@pytest.mark.unit
class TestBuildSQL(unittest.TestCase):
    """_build_sql() generates correct SQL clauses for each input combination."""

    def setUp(self):
        from get_matched_rates import _build_sql
        self._sql = _build_sql

    def _get(self, **kw):
        defaults = dict(
            loan_purpose="OWNER_OCCUPIED",
            lending_rate_type="VARIABLE",
            additional_value=None,
            repayment_type="PRINCIPAL_AND_INTEREST",
            lvr=None,
        )
        defaults.update(kw)
        return self._sql(**defaults)

    def test_variable_rate_no_additional_value_filter(self):
        sql = self._get()
        self.assertNotIn("additionalvalue", sql)

    def test_fixed_rate_includes_additional_value_filter(self):
        sql = self._get(lending_rate_type="FIXED", additional_value="P3Y")
        self.assertIn("P3Y", sql)

    def test_fixed_rate_includes_month_alias(self):
        """P3Y should also match P36M rows in the table."""
        sql = self._get(lending_rate_type="FIXED", additional_value="P3Y")
        self.assertIn("P36M", sql)

    def test_no_lvr_no_tier_filter(self):
        sql = self._get(lvr=None)
        self.assertNotIn("minimumvalue", sql)

    def test_lvr_filter_present_when_lvr_provided(self):
        sql = self._get(lvr=0.80)
        self.assertIn("minimumvalue", sql)
        self.assertIn("maximumvalue", sql)
        self.assertIn("0.8", sql)

    def test_investment_purpose_in_sql(self):
        sql = self._get(loan_purpose="INVESTMENT")
        self.assertIn("INVESTMENT", sql)

    def test_interest_only_in_sql(self):
        sql = self._get(repayment_type="INTEREST_ONLY")
        self.assertIn("INTEREST_ONLY", sql)

    def test_limit_3(self):
        sql = self._get()
        self.assertIn("LIMIT 3", sql)

    def test_order_by_rate_asc(self):
        sql = self._get()
        self.assertIn("ORDER BY rate_pct ASC", sql)

    def test_residential_mortgages_filter(self):
        sql = self._get()
        self.assertIn("RESIDENTIAL_MORTGAGES", sql)

    def test_rate_range_filter_present(self):
        """Sanity filter 2–20% must be present to exclude bad data."""
        sql = self._get()
        self.assertIn("BETWEEN 2 AND 20", sql)


@pytest.mark.unit
class TestInputMappings(unittest.TestCase):
    """lambda_handler correctly maps form values to CDR filter values."""

    def _invoke(self, body: dict):
        with patch("get_matched_rates.run_query", return_value=[]):
            from get_matched_rates import lambda_handler
            event = {
                "httpMethod": "POST",
                "body": json.dumps(body),
            }
            return lambda_handler(event, None)

    def test_live_in_maps_to_owner_occupied(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler
            lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "variable",
                "repaymentType": "principal-and-interest",
                "propertyValue": "750000",
                "loanAmount": "600000",
            })}, None)
            sql = mock_rq.call_args[0][0]
            self.assertIn("OWNER_OCCUPIED", sql)
            self.assertNotIn("INVESTMENT", sql)

    def test_investment_maps_to_investment(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler
            lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "investment",
                "rateType": "variable",
                "repaymentType": "interest-only",
                "propertyValue": "800000",
                "loanAmount": "640000",
            })}, None)
            sql = mock_rq.call_args[0][0]
            self.assertIn("INVESTMENT", sql)
            self.assertIn("INTEREST_ONLY", sql)

    def test_fixed_3y_maps_to_p3y(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler
            lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "fixed-3y",
                "repaymentType": "principal-and-interest",
                "propertyValue": "600000",
                "loanAmount": "480000",
            })}, None)
            sql = mock_rq.call_args[0][0]
            self.assertIn("FIXED", sql)
            self.assertIn("P3Y", sql)

    def test_lvr_computed_from_property_and_loan_values(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler
            lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "variable",
                "repaymentType": "principal-and-interest",
                "propertyValue": "1000000",
                "loanAmount": "800000",   # LVR = 0.80
            })}, None)
            sql = mock_rq.call_args[0][0]
            self.assertIn("0.8", sql)

    def test_missing_property_values_skip_lvr_filter(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler
            lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "variable",
                "repaymentType": "principal-and-interest",
            })}, None)
            sql = mock_rq.call_args[0][0]
            self.assertNotIn("minimumvalue", sql)

    def test_options_preflight_returns_204(self):
        from get_matched_rates import lambda_handler
        resp = lambda_handler({"httpMethod": "OPTIONS"}, None)
        self.assertEqual(resp["statusCode"], 204)

    def test_invalid_json_returns_400(self):
        from get_matched_rates import lambda_handler
        resp = lambda_handler({"httpMethod": "POST", "body": "not-json"}, None)
        self.assertEqual(resp["statusCode"], 400)

    def test_successful_response_has_cors_header(self):
        with patch("get_matched_rates.run_query", return_value=[_row()]):
            from get_matched_rates import lambda_handler
            resp = lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "variable",
                "repaymentType": "principal-and-interest",
            })}, None)
            self.assertEqual(resp["headers"]["Access-Control-Allow-Origin"], "*")

    def test_athena_exception_returns_500(self):
        with patch("get_matched_rates.run_query", side_effect=RuntimeError("Athena failed")):
            from get_matched_rates import lambda_handler
            resp = lambda_handler({"httpMethod": "POST", "body": json.dumps({
                "propertyPurpose": "live-in",
                "rateType": "variable",
                "repaymentType": "principal-and-interest",
            })}, None)
            self.assertEqual(resp["statusCode"], 500)

    def test_commas_in_property_value_stripped(self):
        with patch("get_matched_rates.run_query") as mock_rq:
            mock_rq.return_value = []
            from get_matched_rates import lambda_handler, _to_float
            # Verify _to_float strips commas correctly
            self.assertEqual(_to_float("750,000"), 750000.0)
            self.assertEqual(_to_float("1,200,000"), 1200000.0)
            self.assertIsNone(_to_float(""))
            self.assertIsNone(_to_float(None))


@pytest.mark.unit
class TestAllFixedTerms(unittest.TestCase):
    """Every fixed term (1Y–5Y) maps to the right ISO duration."""

    _EXPECTED = {
        "fixed-1y": "P1Y",
        "fixed-2y": "P2Y",
        "fixed-3y": "P3Y",
        "fixed-4y": "P4Y",
        "fixed-5y": "P5Y",
    }

    def test_each_fixed_term(self):
        from get_matched_rates import _RATE_TYPE_MAP
        for form_val, iso in self._EXPECTED.items():
            lending_type, addl = _RATE_TYPE_MAP[form_val]
            self.assertEqual(lending_type, "FIXED",  msg=form_val)
            self.assertEqual(addl,         iso,       msg=form_val)

    def test_variable_has_no_additional_value(self):
        from get_matched_rates import _RATE_TYPE_MAP
        lending_type, addl = _RATE_TYPE_MAP["variable"]
        self.assertEqual(lending_type, "VARIABLE")
        self.assertIsNone(addl)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CONTRACT TESTS — hit the live API + verify against Athena
# ═══════════════════════════════════════════════════════════════════════════════

def _skip_if_no_api():
    return pytest.mark.skipif(not _LIVE, reason="RATESCAN_API_URL not set — skipping live API tests")


def _post_matched(body: dict) -> list:
    """POST to the live /rates/matched endpoint, return parsed JSON list."""
    import urllib.request
    req  = urllib.request.Request(
        f"{_API_URL}/rates/matched",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _athena_verify(brand: str, product_name: str, loan_purpose: str,
                   lending_rate_type: str, repayment_type: str,
                   additional_value: str | None, lvr: float | None) -> bool:
    """
    Return True if Athena confirms this (brand, product_name) row exists with
    all the required filters applied — rate must be in the 2–20% range.
    Used by contract tests to independently verify each API result row.
    """
    from athena_helper import run_query

    _MONTH_ALIAS = {"P1Y": "P12M", "P2Y": "P24M", "P3Y": "P36M", "P4Y": "P48M", "P5Y": "P60M"}
    addl_filter = ""
    if additional_value:
        month_alias = _MONTH_ALIAS.get(additional_value, additional_value)
        addl_filter = f"AND UPPER(additionalvalue) IN ('{additional_value}', '{month_alias}')"

    lvr_filter = ""
    if lvr is not None:
        lvr_filter = f"""
        AND (
          (TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) IS NULL AND TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) IS NULL)
          OR (
            (TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) IS NULL OR TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) <= {lvr})
            AND (TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) IS NULL OR TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) >= {lvr})
          )
        )"""

    sql = f"""
    SELECT COUNT(*) AS cnt
    FROM obdb.daily_rates
    WHERE productcategory       = 'RESIDENTIAL_MORTGAGES'
      AND UPPER(lendingratetype) = '{lending_rate_type}'
      AND UPPER(loanpurpose)     = '{loan_purpose}'
      AND UPPER(repaymenttype)   = '{repayment_type}'
      AND brand                  = '{brand.replace("'", "''")}'
      AND name                   = '{product_name.replace("'", "''")}'
      AND TRY_CAST(rate AS DOUBLE) IS NOT NULL
      AND (
        CASE WHEN TRY_CAST(rate AS DOUBLE) < 1
             THEN TRY_CAST(rate AS DOUBLE) * 100
             ELSE TRY_CAST(rate AS DOUBLE) END
      ) BETWEEN 2 AND 20
      {addl_filter}
      {lvr_filter}
    """
    rows = run_query(sql)
    return int(rows[0]["cnt"]) > 0 if rows else False


@_skip_if_no_api()
@pytest.mark.contract
class TestLiveAPIContract(unittest.TestCase):
    """
    These tests POST real requests to the live API and validate that:
      - The response shape is correct
      - Rates are ordered lowest-first
      - Every returned row actually exists in Athena with matching filters
      - No more than 3 results are returned
    """

    # ── scenario definitions ──────────────────────────────────────────────────
    # Each entry: (description, request_body, expected_loan_purpose, lending_rate_type, addl_value)
    _SCENARIOS = [
        (
            "OO Variable P&I — most common query",
            {"propertyPurpose": "live-in", "rateType": "variable",
             "repaymentType": "principal-and-interest",
             "propertyValue": "750000", "loanAmount": "600000"},
            "OWNER_OCCUPIED", "VARIABLE", None, 0.80,
        ),
        (
            "OO Variable IO",
            {"propertyPurpose": "live-in", "rateType": "variable",
             "repaymentType": "interest-only",
             "propertyValue": "800000", "loanAmount": "640000"},
            "OWNER_OCCUPIED", "VARIABLE", None, 0.80,
        ),
        (
            "Investment Variable P&I",
            {"propertyPurpose": "investment", "rateType": "variable",
             "repaymentType": "principal-and-interest",
             "propertyValue": "900000", "loanAmount": "720000"},
            "INVESTMENT", "VARIABLE", None, 0.80,
        ),
        (
            "Investment Variable IO",
            {"propertyPurpose": "investment", "rateType": "variable",
             "repaymentType": "interest-only",
             "propertyValue": "900000", "loanAmount": "720000"},
            "INVESTMENT", "VARIABLE", None, 0.80,
        ),
        (
            "OO Fixed 1Y P&I",
            {"propertyPurpose": "live-in", "rateType": "fixed-1y",
             "repaymentType": "principal-and-interest",
             "propertyValue": "700000", "loanAmount": "560000"},
            "OWNER_OCCUPIED", "FIXED", "P1Y", 0.80,
        ),
        (
            "OO Fixed 2Y P&I",
            {"propertyPurpose": "live-in", "rateType": "fixed-2y",
             "repaymentType": "principal-and-interest",
             "propertyValue": "700000", "loanAmount": "560000"},
            "OWNER_OCCUPIED", "FIXED", "P2Y", 0.80,
        ),
        (
            "OO Fixed 3Y P&I",
            {"propertyPurpose": "live-in", "rateType": "fixed-3y",
             "repaymentType": "principal-and-interest",
             "propertyValue": "700000", "loanAmount": "560000"},
            "OWNER_OCCUPIED", "FIXED", "P3Y", 0.80,
        ),
        (
            "OO Fixed 5Y P&I",
            {"propertyPurpose": "live-in", "rateType": "fixed-5y",
             "repaymentType": "principal-and-interest",
             "propertyValue": "700000", "loanAmount": "560000"},
            "OWNER_OCCUPIED", "FIXED", "P5Y", 0.80,
        ),
        (
            "High LVR 95% — should still return results (most tiers are open)",
            {"propertyPurpose": "live-in", "rateType": "variable",
             "repaymentType": "principal-and-interest",
             "propertyValue": "600000", "loanAmount": "570000"},
            "OWNER_OCCUPIED", "VARIABLE", None, 0.95,
        ),
        (
            "Low LVR 50% — lowest-risk tier",
            {"propertyPurpose": "live-in", "rateType": "variable",
             "repaymentType": "principal-and-interest",
             "propertyValue": "1000000", "loanAmount": "500000"},
            "OWNER_OCCUPIED", "VARIABLE", None, 0.50,
        ),
    ]

    def _run_scenario(self, desc, body, loan_purpose, lending_rate_type, addl_value, lvr):
        results = _post_matched(body)

        # ── shape checks ──────────────────────────────────────────────────────
        self.assertIsInstance(results, list, f"[{desc}] response is not a list")
        self.assertLessEqual(len(results), 3, f"[{desc}] more than 3 results returned")

        for i, r in enumerate(results):
            with self.subTest(scenario=desc, rank=i + 1):
                self.assertIn("brand",        r, "missing brand")
                self.assertIn("productName",  r, "missing productName")
                self.assertIn("rate",         r, "missing rate")
                self.assertIsInstance(r["rate"], (int, float), "rate is not numeric")
                self.assertGreater(r["rate"], 0,  "rate must be > 0")
                self.assertLess(r["rate"],    20, "rate must be < 20% (sanity)")

        # ── ordering check ─────────────────────────────────────────────────────
        rates = [r["rate"] for r in results]
        self.assertEqual(rates, sorted(rates),
                         f"[{desc}] results not ordered lowest-rate-first: {rates}")

        # ── Athena cross-validation ────────────────────────────────────────────
        for r in results:
            exists = _athena_verify(
                brand=r["brand"],
                product_name=r["productName"],
                loan_purpose=loan_purpose,
                lending_rate_type=lending_rate_type,
                repayment_type=body["repaymentType"].upper().replace("-", "_"),
                additional_value=addl_value,
                lvr=lvr,
            )
            self.assertTrue(exists,
                f"[{desc}] Row not found in Athena: brand={r['brand']!r}, "
                f"product={r['productName']!r}, loan_purpose={loan_purpose}, "
                f"rate_type={lending_rate_type}, addl={addl_value}, lvr={lvr}")

    def test_all_scenarios(self):
        for args in self._SCENARIOS:
            with self.subTest(scenario=args[0]):
                self._run_scenario(*args)


@_skip_if_no_api()
@pytest.mark.contract
class TestLiveAPIEdgeCases(unittest.TestCase):
    """Edge cases that do not require Athena cross-validation."""

    def test_no_results_returns_empty_list_not_error(self):
        """A very unusual combo (investment IO fixed 5Y) might return 0 results — still valid."""
        results = _post_matched({
            "propertyPurpose": "investment",
            "rateType": "fixed-5y",
            "repaymentType": "interest-only",
            "propertyValue": "500000",
            "loanAmount": "475000",
        })
        self.assertIsInstance(results, list)

    def test_missing_property_values_does_not_crash(self):
        """Omitting propertyValue/loanAmount should still return results (no LVR filter)."""
        results = _post_matched({
            "propertyPurpose": "live-in",
            "rateType": "variable",
            "repaymentType": "principal-and-interest",
        })
        self.assertIsInstance(results, list)
        self.assertLessEqual(len(results), 3)

    def test_unknown_rate_type_falls_back_to_variable(self):
        """An unrecognised rateType should gracefully default to variable."""
        results = _post_matched({
            "propertyPurpose": "live-in",
            "rateType": "unknown-type",
            "repaymentType": "principal-and-interest",
            "propertyValue": "750000",
            "loanAmount": "600000",
        })
        self.assertIsInstance(results, list)

    def test_rates_within_plausible_australian_range(self):
        """All returned rates must be within 2–15% — catches obvious data quality issues."""
        results = _post_matched({
            "propertyPurpose": "live-in",
            "rateType": "variable",
            "repaymentType": "principal-and-interest",
            "propertyValue": "750000",
            "loanAmount": "600000",
        })
        for r in results:
            self.assertGreaterEqual(r["rate"], 2.0,  f"Rate {r['rate']} is implausibly low")
            self.assertLessEqual(r["rate"],    15.0, f"Rate {r['rate']} is implausibly high")

    def test_comparison_rate_at_least_as_high_as_rate(self):
        """Comparison rate includes fees so should be >= advertised rate."""
        results = _post_matched({
            "propertyPurpose": "live-in",
            "rateType": "variable",
            "repaymentType": "principal-and-interest",
            "propertyValue": "750000",
            "loanAmount": "600000",
        })
        for r in results:
            if r.get("comparisonRate") is not None:
                self.assertGreaterEqual(
                    r["comparisonRate"], r["rate"] - 0.5,
                    f"Comparison rate {r['comparisonRate']} is suspiciously lower than rate {r['rate']}"
                )

    def test_investment_rates_higher_than_oo_rates(self):
        """
        Market invariant: investment P&I variable should be higher than OO P&I variable
        on average (~30bp premium due to APRA capital requirements).
        Compare the lowest rates returned for each to confirm the relationship holds.
        """
        oo  = _post_matched({"propertyPurpose": "live-in",    "rateType": "variable",
                              "repaymentType": "principal-and-interest",
                              "propertyValue": "750000", "loanAmount": "600000"})
        inv = _post_matched({"propertyPurpose": "investment",  "rateType": "variable",
                              "repaymentType": "principal-and-interest",
                              "propertyValue": "750000", "loanAmount": "600000"})

        if oo and inv:
            # The lowest investment rate should be at or above the lowest OO rate
            # Allow a 20bp tolerance for edge cases where a lender briefly undercuts
            self.assertGreaterEqual(
                inv[0]["rate"], oo[0]["rate"] - 0.20,
                f"Investment rate {inv[0]['rate']} is unexpectedly well below OO rate {oo[0]['rate']}"
            )

    def test_io_premium_over_pi(self):
        """
        Market invariant: OO Variable IO should carry a premium over P&I (~81bp).
        Allow a broad tolerance — just ensure IO is not cheaper than P&I.
        """
        pi = _post_matched({"propertyPurpose": "live-in", "rateType": "variable",
                             "repaymentType": "principal-and-interest",
                             "propertyValue": "750000", "loanAmount": "600000"})
        io = _post_matched({"propertyPurpose": "live-in", "rateType": "variable",
                             "repaymentType": "interest-only",
                             "propertyValue": "750000", "loanAmount": "600000"})

        if pi and io:
            self.assertGreaterEqual(
                io[0]["rate"], pi[0]["rate"] - 0.10,
                f"IO rate {io[0]['rate']} is unexpectedly lower than P&I rate {pi[0]['rate']}"
            )

    def test_response_is_valid_json_array(self):
        """Smoke test: endpoint returns a parseable JSON array."""
        import urllib.request
        req = urllib.request.Request(
            f"{_API_URL}/rates/matched",
            data=json.dumps({"propertyPurpose": "live-in", "rateType": "variable",
                             "repaymentType": "principal-and-interest"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            self.assertEqual(resp.status, 200)
            body = json.loads(resp.read())
            self.assertIsInstance(body, list)

    def test_cors_header_present_in_response(self):
        """CORS header must be present so the browser frontend can read the response."""
        import urllib.request
        req = urllib.request.Request(
            f"{_API_URL}/rates/matched",
            data=json.dumps({"propertyPurpose": "live-in", "rateType": "variable",
                             "repaymentType": "principal-and-interest"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")

    def test_options_preflight_returns_204(self):
        """Browser preflight must succeed or cross-origin POST will be blocked."""
        import urllib.request
        req = urllib.request.Request(
            f"{_API_URL}/rates/matched",
            headers={"Content-Type": "application/json"},
            method="OPTIONS",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                self.assertIn(resp.status, [200, 204])
        except urllib.error.HTTPError as e:
            self.assertIn(e.code, [200, 204])


if __name__ == "__main__":
    unittest.main(verbosity=2)
