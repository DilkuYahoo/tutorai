# Implementation Plan: "Our Advice" Section

## Overview

This document outlines the comprehensive solution to add a "Our Advice" section to the dashboard, similar to the existing "Executive Summary" section. The "Our Advice" section will provide 5-6 actionable recommendations based on:
- Forecast data (chart1 yearly projections)
- Risk profile (conservative/moderate/aggressive)
- Investment goals
Each recommendation should include reasoning backed by the data.

---

## Current Architecture

### Executive Summary Flow
```
Frontend (ChartSection.tsx)
    ↓ button click "🤖 Summarise"
dashboardService.generatePortfolioSummary()
    ↓ POST /ba-agent {property_action: "summary"}
Backend (ba_agent/main.py)
    ↓ invoke Bedrock AI
Returns {summary: "..."}
    ↓
Stored in DynamoDB (executive_summary field)
    ↓
Displayed in Executive Summary card
```

### Key Files Involved
| File | Purpose |
|------|---------|
| [`app/ba-portal/lambda/ba_agent/main.py`](app/ba-portal/lambda/ba_agent/main.py) | Backend Lambda - handles AI generation |
| [`app/ba-portal/dashboard-frontend/src/services/dashboardService.ts`](app/ba-portal/dashboard-frontend/src/services/dashboardService.ts) | Frontend API service |
| [`app/ba-portal/dashboard-frontend/src/components/ChartSection.tsx`](app/ba-portal/dashboard-frontend/src/components/ChartSection.tsx) | Frontend UI component |
| [`app/ba-portal/dashboard-frontend/src/components/Dashboard.tsx`](app/ba-portal/dashboard-frontend/src/components/Dashboard.tsx) | Parent component managing state |

---

## Implementation Steps

### Step 1: Backend Changes (ba_agent/main.py)

**File:** [`app/ba-portal/lambda/ba_agent/main.py`](app/ba-portal/lambda/ba_agent/main.py)

**Changes Required:**

1. **Add new property_action: "advice"**
   - Add "advice" to valid property_action values (line ~710)
   ```python
   if property_action not in ['add', 'optimize', 'summary', 'advice']:
   ```

2. **Create build_advice_prompt() function** (new function)
   - Similar to `build_summary_prompt()` but focused on actionable advice
   - Should extract key metrics and ask for:
     - Bottlenecks (what's limiting portfolio growth)
     - Recommendations (actionable steps)
     - Optimal timing (when to make decisions)
     - Max purchase price

3. **Handle "advice" action in lambda_handler()** (around line ~756)
   - Call `build_advice_prompt()` instead of `build_summary_prompt()`
   - Return `{'advice': advice_text}` instead of `{'summary': summary_text}`

**New Function Structure:**
```python
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
    Build prompts for actionable advice generation.
    """
    system_prompt = """You are a professional Australian property investment advisor.
    Your role is to provide actionable advice based on the portfolio analysis.
    
    Output format:
    1. KEY BOTTLENECKS: What areas are limiting portfolio growth?
    2. ACTIONABLE RECOMMENDATIONS: Specific steps to improve the portfolio
    3. OPTIMAL TIMING: When to take action
    4. MAX PURCHASE PRICE: Based on current capacity
    
    Output ONLY the advice text. No JSON required."""
    
    # User prompt with portfolio data...
    user_prompt = f"""PORTFOLIO ADVICE REQUEST:
    
    [Include similar data as summary but ask for advice]
    
    Provide actionable advice based on this data."""
    
    return system_prompt, user_prompt
```

---

### Step 2: Frontend Service (dashboardService.ts)

**File:** [`app/ba-portal/dashboard-frontend/src/services/dashboardService.ts`](app/ba-portal/dashboard-frontend/src/services/dashboardService.ts)

**Changes Required:**

1. **Update DashboardApiResponse interface** (line ~25)
```typescript
export interface DashboardApiResponse {
  chartData: any[];
  investors: any[];
  properties: any[];
  investmentYears?: number;
  executiveSummary?: string;
  ourAdvice?: string;  // ADD THIS
}
```

2. **Update fetchDashboardData()** (line ~57)
```typescript
return {
  chartData: result.result.chart1 || [],
  investors: result.result.investors || [],
  properties: result.result.properties || [],
  investmentYears: result.result.investment_years || 30,
  executiveSummary: result.result.executive_summary || '',
  ourAdvice: result.result.our_advice || '',  // ADD THIS
};
```

3. **Update fetchDashboardDataById()** (line ~118)
```typescript
return {
  // ... same fields
  ourAdvice: result.result.our_advice || '',  // ADD THIS
};
```

4. **Update updateDashboardData()** (line ~148)
```typescript
export async function updateDashboardData(
  investors?: any[],
  properties?: any[],
  chart1?: any[],
  investmentYears?: number,
  executiveSummary?: string,
  ourAdvice?: string,  // ADD THIS
  portfolioId?: string,
): Promise<void> {
  // ... 
  if (ourAdvice !== undefined && ourAdvice !== null) {
    attributes.our_advice = ourAdvice;
  }
}
```

5. **Add new generateOurAdvice() function** (new section at end)
```typescript
export async function generateOurAdvice(portfolioId?: string): Promise<{ advice: string }> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/ba-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      property_action: "advice",  // NEW ACTION
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

  return result;
}
```

---

### Step 3: Dashboard Component (Dashboard.tsx)

**File:** [`app/ba-portal/dashboard-frontend/src/components/Dashboard.tsx`](app/ba-portal/dashboard-frontend/src/components/Dashboard.tsx)

**Changes Required:**

1. **Update DashboardData interface** (line ~21)
```typescript
interface DashboardData {
  chartData: any[];
  investors: any[];
  properties: any[];
  investmentYears?: number;
  executiveSummary?: string;
  ourAdvice?: string;  // ADD THIS
  loading: boolean;
  error: string | null;
}
```

2. **Update data state initialization** (line ~38)
```typescript
const [data, setData] = useState<DashboardData>({
  chartData: [],
  investors: [],
  properties: [],
  investmentYears: 30,
  ourAdvice: '',  // ADD THIS
  loading: true,
  error: null,
});
```

3. **Update load function** (line ~113)
```typescript
setData({
  ...result,
  investmentYears: result.investmentYears || 30,
  executiveSummary: result.executiveSummary || '',
  ourAdvice: result.ourAdvice || '',  // ADD THIS
  loading: false,
  error: null,
});
```

4. **Update handleUpdate function** (line ~210)
```typescript
await updateDashboardData(
  investors, 
  properties, 
  data.chartData, 
  investmentYears, 
  data.executiveSummary,
  data.ourAdvice,  // ADD THIS
  selectedPortfolioId
);
```

5. **Update ChartSection props** (line ~381)
```typescript
<ChartSection 
  chartData={data.chartData} 
  loading={data.loading}
  executiveSummary={data.executiveSummary}
  ourAdvice={data.ourAdvice}  // ADD THIS
  selectedPortfolioId={selectedPortfolioId}
  onSummaryGenerated={(summary) => {
    setData(prev => ({ ...prev, executiveSummary: summary }));
  }}
  onAdviceGenerated={(advice) => {  // ADD THIS
    setData(prev => ({ ...prev, ourAdvice: advice }));
  }}
/>
```

---

### Step 4: ChartSection Component (ChartSection.tsx)

**File:** [`app/ba-portal/dashboard-frontend/src/components/ChartSection.tsx`](app/ba-portal/dashboard-frontend/src/components/ChartSection.tsx)

**Changes Required:**

1. **Update interface** (line ~40)
```typescript
interface ChartSectionProps {
  chartData: any[];
  loading: boolean;
  executiveSummary?: string;
  ourAdvice?: string;  // ADD THIS
  selectedPortfolioId?: string;
  onSummaryGenerated?: (summary: string) => void;
  onAdviceGenerated?: (advice: string) => void;  // ADD THIS
}
```

2. **Update component props** (line ~48)
```typescript
const ChartSection: React.FC<ChartSectionProps> = ({ 
  chartData, 
  loading, 
  executiveSummary, 
  ourAdvice,  // ADD THIS
  selectedPortfolioId, 
  onSummaryGenerated,
  onAdviceGenerated,  // ADD THIS
}) => {
```

3. **Add state for Our Advice** (after line ~57)
```typescript
// Our Advice state
const [adviceText, setAdviceText] = useState<string>('');
const [adviceLoading, setAdviceLoading] = useState<boolean>(false);
const [adviceError, setAdviceError] = useState<string | null>(null);
const [isAdviceExpanded, setIsAdviceExpanded] = useState<boolean>(true);
```

4. **Add useEffect to load advice from props** (after line ~72)
```typescript
useEffect(() => {
  if (selectedPortfolioId && selectedPortfolioId !== cachedPortfolioId) {
    setCachedPortfolioId(selectedPortfolioId);
    setAdviceText('');
  }
  
  if (ourAdvice && ourAdvice.trim().length > 0) {
    setAdviceText(ourAdvice);
  }
}, [ourAdvice, selectedPortfolioId, cachedPortfolioId]);
```

5. **Add handleGenerateOurAdvice function** (after line ~548)
```typescript
const handleGenerateOurAdvice = async () => {
  setAdviceLoading(true);
  setAdviceError(null);
  try {
    const result = await generateOurAdvice(selectedPortfolioId);
    setAdviceText(result.advice);
    if (onAdviceGenerated) {
      onAdviceGenerated(result.advice);
    }
  } catch (error) {
    console.error("Failed to generate advice:", error);
    setAdviceError("Unable to generate advice. Please try again.");
  } finally {
    setAdviceLoading(false);
  }
};
```

6. **Import generateOurAdvice** (add to imports line ~5)
```typescript
import { generatePortfolioSummary, generateOurAdvice } from '../services/dashboardService';
```

7. **Add "Our Advice" card UI** (after Executive Summary card, around line ~660)
```tsx
{/* Our Advice Card */}
<div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-bold" style={{ color: cardText }}>Our Advice</h2>
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsAdviceExpanded(!isAdviceExpanded)}
        className="p-2 rounded-lg transition-colors"
        style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}
        title={isAdviceExpanded ? 'Collapse details' : 'Expand details'}
      >
        <ChevronDown className={`w-5 h-5 transform transition-transform ${isAdviceExpanded ? 'rotate-180' : ''}`} />
      </button>
      <button
        onClick={handleGenerateOurAdvice}
        disabled={adviceLoading}
        className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        style={{ backgroundColor: '#10b981', color: 'white' }}
      >
        <Sparkles className="w-5 h-5" />
        {adviceLoading ? 'Generating...' : '💡 Get Advice'}
      </button>
    </div>
  </div>
  {isAdviceExpanded && (
    <>
      {adviceLoading && (
        <div className="text-center py-4" style={{ color: cardTextSecondary }}>
          Generating advice...
        </div>
      )}
      {adviceError && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: '#ef4444' }}>
          {adviceError}
        </div>
      )}
      {adviceText && !adviceLoading && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }}>
          <div 
            style={{ color: cardTextSecondary }}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(adviceText) }}
          />
        </div>
      )}
      {!adviceText && !adviceLoading && !adviceError && (
        <div className="text-sm" style={{ color: cardTextSecondary }}>
          <p>Click the button to get actionable advice for your portfolio.</p>
        </div>
      )}
    </>
  )}
</div>
```

---

## Data Flow Diagram

```mermaid
graph TD
    A[User clicks '💡 Get Advice'] --> B[ChartSection calls generateOurAdvice]
    B --> C[dashboardService POST /ba-agent with property_action: 'advice']
    D[Backend ba_agent/main.py] --> E[build_advice_prompt]
    E --> F[invoke_bedrock with advice-focused prompt]
    F --> G[Returns {status: 'success', advice: '...'}]
    G --> H[Frontend receives advice text]
    H --> I[Display in 'Our Advice' card]
    I --> J[User can save to DynamoDB via 'Refresh Data' button]
```

---

## Files Summary

| File | Changes | Complexity |
|------|---------|------------|
| `lambda/ba_agent/main.py` | Add "advice" action, new prompt builder | Medium |
| `dashboardService.ts` | Add interface fields, new API function | Low |
| `Dashboard.tsx` | Add state, pass props | Low |
| `ChartSection.tsx` | Add UI card, state, handlers | Medium |

---

## Testing Checklist

- [ ] Backend: Test "advice" action returns valid advice text
- [ ] Frontend: "Our Advice" card displays below Executive Summary
- [ ] Frontend: Clicking "💡 Get Advice" generates and displays advice
- [ ] Frontend: Advice persists after page refresh (from DynamoDB)
- [ ] Frontend: "Refresh Data" button saves advice to database
- [ ] Integration: Both Executive Summary and Our Advice work independently

---

## Deployment Steps

1. **Deploy Backend Lambda:**
   ```bash
   cd app/ba-portal/lambda/ba_agent
   python deploy_lambda.py
   ```

2. **Deploy Frontend:**
   ```bash
   cd app/ba-portal/dashboard-frontend
   npm run build
   # Deploy to hosting (S3, CloudFront, etc.)
   ```

---

## Estimated Complexity: Medium

- Backend changes: ~2 hours
- Frontend changes: ~2 hours
- Testing: ~1 hour
- **Total: ~5 hours**
