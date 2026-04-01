# Login System Design Document - BA Portal Dashboard

## Executive Summary

This document outlines the design for implementing a role-based access control (RBAC) system for the BA Portal Dashboard. The system will **require authentication before accessing the dashboard**. Users must login via AWS Cognito to view and interact with the dashboard. **All authorization is handled at the API Gateway level**, eliminating the need for frontend authentication logic. Once authenticated, users will only see portfolios filtered by their email address stored in the `adviser_name` field of the DynamoDB table `BA-PORTAL-BASETABLE`.

---

## 1. Current System Architecture

### 1.1 Existing Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Header** | `dashboard-frontend/src/components/Header.tsx` | Displays login/logout UI |
| **Dashboard** | `dashboard-frontend/src/components/Dashboard.tsx` | Main dashboard component |
| **Sidebar** | `dashboard-frontend/src/components/Sidebar.tsx` | Data editing interface |
| **DashboardService** | `dashboard-frontend/src/services/dashboardService.ts` | API calls for CRUD operations |
| **API Gateway** | AWS API Gateway | Handles all authentication and authorization |
| **Cognito Authorizer** | AWS API Gateway | Validates JWT tokens and extracts user info |

### 1.2 Current Authentication Flow

```
User → Login Button → Cognito Hosted UI → OAuth Callback → Token Exchange → HTTP-only Cookie
```

### 1.3 Current API Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/read-table` | POST | Read portfolio data | ❌ No (NOT SECURED) |
| `/update-table` | POST | Update portfolio data | ❌ No (NOT SECURED) |
| `/ba-agent` | POST | AI agent operations | ❌ No (NOT SECURED) |

**⚠️ SECURITY NOTE:** As of the current implementation, API Gateway has NO Cognito authorizer configured. All endpoints are publicly accessible. The frontend performs authentication checks only.

---

## 2. Proposed System Design

### 2.1 Access Control Model

```
┌─────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL MATRIX                     │
├─────────────────────────────────────────────────────────────┤
│  Operation          │  Unauthenticated  │  Authenticated    │
├─────────────────────────────────────────────────────────────┤
│  View Dashboard     │       ❌          │       ✅ (Frontend) │
│  View Charts        │       ❌          │       ✅ (Frontend) │
│  View Sidebar       │       ❌          │       ✅ (Frontend) │
│  Edit Investors     │       ❌          │       ✅ (Frontend) │
│  Edit Properties    │       ❌          │       ✅ (Frontend) │
│  Save Config        │       ❌          │       ✅ (Frontend) │
│  Update Table       │       ✅ ⚠️        │       ✅ ⚠️        │
│  Add Property       │       ✅ ⚠️        │       ✅ ⚠️        │
│  Generate Summary   │       ✅ ⚠️        │       ✅ ⚠️        │
│  Generate Advice    │       ✅ ⚠️        │       ✅ ⚠️        │
└─────────────────────────────────────────────────────────────┘

**⚠️ SECURITY ISSUE:** API Gateway is NOT configured with Cognito authorizer. 
Backend endpoints accept requests from ANYONE. Only frontend enforces auth.

**CURRENT STATE:** 
- Frontend: Handles authentication with AuthContext ✅
- Backend: NO authorization (authentication.type = "NONE") ❌
- Portfolio filtering: Done in Lambda using adviser_name parameter ✅
```

### 2.2 Portfolio Filtering Model

```
┌─────────────────────────────────────────────────────────────┐
│                PORTFOLIO FILTERING LOGIC                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Email (from Cognito ID Token)                         │
│         │                                                    │
│         ▼                                                    │
│  DynamoDB Query:                                             │
│    Table: BA-PORTAL-BASETABLE                               │
│    Filter: adviser_name = user_email                        │
│         │                                                    │
│         ▼                                                    │
│  Filtered Portfolios (only user's own)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### 3.1 Frontend Changes

#### 3.1.1 Login Page Component

**File:** `dashboard-frontend/src/pages/Login.tsx` (NEW)

**Purpose:** Display login page for unauthenticated users

```typescript
import React from 'react';
import { LogIn, Shield, Eye, Edit } from 'lucide-react';
import cognitoConfig from '../config/cognitoConfig';

const Login: React.FC = () => {
  const handleLogin = () => {
    // Redirect to Cognito Hosted UI
    const params = new URLSearchParams({
      client_id: cognitoConfig.clientId,
      response_type: 'code',
      scope: cognitoConfig.scopes.join(' '),
      redirect_uri: cognitoConfig.redirectUri
    });
    
    window.location.href = `https://${cognitoConfig.domain}/login?${params.toString()}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">D</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">AdviceGenie</h1>
            <p className="text-slate-400 text-sm">Your AI-assisted Wealth Adviser</p>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-slate-300">
              <Eye size={20} className="text-cyan-400" />
              <span className="text-sm">View your portfolio analytics</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Edit size={20} className="text-cyan-400" />
              <span className="text-sm">Update investor and property data</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Shield size={20} className="text-cyan-400" />
              <span className="text-sm">Secure access to your portfolios</span>
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            <LogIn size={20} />
            Login with Cognito
          </button>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs mt-6">
            Secure authentication powered by AWS Cognito
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

#### 3.1.2 App Component Routing

**File:** `dashboard-frontend/src/App.tsx`

**Changes:**
- Check for authorization code in URL (from Cognito callback)
- If code present, exchange for tokens and set HTTP-only cookie
- Show Login page if not authenticated
- Show Dashboard if authenticated

```typescript
import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './components/Dashboard';
import cognitoConfig from './config/cognitoConfig';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if there's an authorization code in URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Exchange code for tokens
        try {
          const response = await fetch(`${cognitoConfig.domain}/oauth2/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: cognitoConfig.clientId,
              code: code,
              redirect_uri: cognitoConfig.redirectUri
            }),
          });
          
          if (response.ok) {
            // Tokens are set as HTTP-only cookies by backend
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsAuthenticated(true);
          }
        } catch (error) {
          console.error('Auth error:', error);
        }
      } else {
        // Check if user is already authenticated
        // This would typically be done by checking if cookies exist
        // For now, we'll assume not authenticated
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-cyan-400"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show dashboard if authenticated
  return <Dashboard />;
};

export default App;
```

#### 3.1.3 Simplified App Component

**File:** `dashboard-frontend/src/App.tsx`

**Changes:**
- Remove AuthContext dependency
- Simple routing based on URL code presence
- All authorization handled by API Gateway

**Note:** AuthContext and AuthService are no longer needed. All authentication is handled at the API Gateway level. The frontend only needs to:
1. Redirect to Cognito for login
2. Handle the callback with authorization code
3. Let API Gateway validate tokens and extract user info

#### 3.1.4 Header Component Updates

**File:** `dashboard-frontend/src/components/Header.tsx`

**Changes:**
- Show user email in header (received from API)
- Add logout functionality (clear cookies and redirect)
- Display portfolio count for authenticated users

**Note:** User info is received from API responses, not from frontend auth context.

### 3.2 Backend Changes

#### 3.2.1 API Gateway Authentication (PRIMARY AUTHORIZATION POINT)

**File:** `app/ba-portal/IaC/api-config.json`

**Changes:**
- Add Cognito Authorizer to API Gateway
- Configure JWT validation for ALL endpoints
- All endpoints require authentication (no public access)
- API Gateway extracts user email from JWT and passes to Lambda

```json
{
  "endpoints": [
    {
      "path": "/read-table",
      "method": "POST",
      "authentication": {
        "type": "COGNITO_USER_POOLS",
        "description": "Requires Cognito authentication"
      }
    },
    {
      "path": "/update-table",
      "method": "POST",
      "authentication": {
        "type": "COGNITO_USER_POOLS",
        "description": "Requires Cognito authentication"
      }
    },
    {
      "path": "/ba-agent",
      "method": "POST",
      "authentication": {
        "type": "COGNITO_USER_POOLS",
        "description": "Requires Cognito authentication"
      }
    }
  ]
}
```

**Key Point:** API Gateway is the PRIMARY authorization point. It validates JWT tokens and extracts user information (email) from the token claims. This information is passed to Lambda functions via the `requestContext.authorizer.claims` object.

#### 3.2.2 Lambda Function Authorization

**File:** `app/ba-portal/lambda/update_table/update_table.py`

**Changes:**
- Extract user email from API Gateway authorizer context (already validated by API Gateway)
- Validate user has access to the portfolio being updated
- Add `adviser_name` validation before update

```python
def extract_user_from_event(event: Dict[str, Any]) -> Optional[str]:
    """Extract user email from API Gateway authorizer context."""
    try:
        # API Gateway has already validated the JWT and extracted claims
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # Extract email from claims
        email = claims.get('email')
        return email
    except Exception as e:
        logger.warning(f"Could not extract user from event: {e}")
        return None

def validate_portfolio_access(item_id: str, user_email: str, table) -> bool:
    """Validate user has access to the portfolio."""
    try:
        response = table.get_item(Key={'id': item_id})
        item = response.get('Item', {})
        
        # Check if adviser_name matches user email
        adviser_name = item.get('adviser_name', '')
        return adviser_name.lower() == user_email.lower()
    except Exception as e:
        logger.error(f"Error validating portfolio access: {e}")
        return False

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda function handler with authorization."""
    try:
        # Extract user from API Gateway context (already validated)
        user_email = extract_user_from_event(event)
        
        if not user_email:
            return create_api_gateway_response(401, {
                'status': 'error',
                'message': 'Authentication required'
            })
        
        # Parse event
        params = parse_lambda_event(event)
        
        # Validate portfolio access
        if not validate_portfolio_access(params['id'], user_email, table):
            return create_api_gateway_response(403, {
                'status': 'error',
                'message': 'Access denied to this portfolio'
            })
        
        # Continue with update...
        
    except Exception as e:
        # Error handling...
```

**Key Point:** Lambda functions receive user email from API Gateway's authorizer context. API Gateway has already validated the JWT token, so Lambda functions can trust the user information.

#### 3.2.3 Read Table Lambda Updates

**File:** `app/ba-portal/lambda/read_table/read_table.py`

**Changes:**
- Extract user email from API Gateway authorizer context (already validated)
- Filter portfolios by user email (mandatory)
- Return 401 if no valid token
- Return 403 if user has no portfolios

```python
def extract_user_from_event(event: Dict[str, Any]) -> Optional[str]:
    """Extract user email from API Gateway authorizer context."""
    try:
        # API Gateway has already validated JWT and extracted claims
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # Extract email from claims
        email = claims.get('email')
        return email
    except Exception as e:
        logger.warning(f"Could not extract user from event: {e}")
        return None

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda function handler with mandatory user filtering."""
    try:
        # Extract user email from API Gateway context (already validated)
        user_email = extract_user_from_event(event)
        
        if not user_email:
            return create_api_gateway_response(401, {
                'status': 'error',
                'message': 'Authentication required'
            })
        
        params = parse_lambda_event(event)
        
        # For list_portfolios action, filter by user email
        if params.get('action') == 'list_portfolios':
            portfolios = reader.list_all_portfolio_ids(user_email)
            
            return create_api_gateway_response(200, {
                'status': 'success',
                'portfolios': portfolios,
                'filtered_by': user_email
            })
        
        # For read action, validate portfolio ownership
        if not validate_portfolio_access(params['id'], user_email, table):
            return create_api_gateway_response(403, {
                'status': 'error',
                'message': 'Access denied to this portfolio'
            })
        
        # Continue with read...
```

**Key Point:** Lambda functions receive user email from API Gateway's authorizer context. API Gateway has already validated JWT token, so Lambda functions can trust user information.

### 3.3 Dashboard Service Updates

**File:** `dashboard-frontend/src/services/dashboardService.ts`

**Changes:**
- Remove `authToken` parameter (tokens in HTTP-only cookies)
- Use `credentials: 'include'` to send cookies with requests
- Handle 401/403 responses gracefully
- Redirect to login on 401 errors
- User info received from API responses (not from frontend auth)

```typescript
// Helper function to handle auth errors
function handleAuthError(response: Response): void {
  if (response.status === 401) {
    // Token expired or invalid - redirect to login
    window.location.href = '/login';
    throw new Error('Authentication required. Please login.');
  }
  
  if (response.status === 403) {
    throw new Error('Access denied. You do not have permission to access this resource.');
  }
}

export async function fetchDashboardData(): Promise<DashboardApiResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // Include HTTP-only cookies
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: REACT_APP_APPSYNC_FINANCE_ID,
      region: App_SYNC_REGION,
    }),
  });

  handleAuthError(response);
  
  // ... rest of response handling
}

export async function fetchPortfolioList(): Promise<PortfolioListResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // Include HTTP-only cookies
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      action: 'list_portfolios',
      region: App_SYNC_REGION,
    }),
  });

  handleAuthError(response);
  
  // ... rest of response handling
}

export async function updateDashboardData(
  investors?: any[],
  properties?: any[],
  investmentYears?: number,
  executiveSummary?: string,
  ourAdvice?: string,
  portfolioId?: string
): Promise<void> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/update-table?t=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // Include HTTP-only cookies
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      attributes,
    }),
  });

  handleAuthError(response);
  
  // ... rest of response handling
}
```

**Key Point:** Frontend doesn't need to manage tokens. HTTP-only cookies are automatically included in requests. User info is received from API responses.

---

## 4. User Experience Flow

### 4.1 Unauthenticated User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits dashboard URL                               │
│  2. App checks for authorization code in URL                │
│  3. If no code → Show Login Page                            │
│  4. User clicks "Login" button                              │
│  5. Redirect to Cognito Hosted UI                           │
│  6. User authenticates with Cognito                         │
│  7. Cognito redirects back with authorization code          │
│  8. App exchanges code for tokens (sets HTTP-only cookie)   │
│  9. App redirects to Dashboard                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Authenticated User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits dashboard URL                               │
│  2. App checks for authorization code in URL                │
│  3. If code present → Exchange for tokens                   │
│  4. Tokens set as HTTP-only cookies                         │
│  5. App redirects to Dashboard                              │
│  6. Dashboard loads and fetches portfolios                  │
│  7. API Gateway validates JWT from cookie                   │
│  8. API Gateway extracts user email and passes to Lambda    │
│  9. Lambda filters portfolios by user email                 │
│ 10. Portfolio selector shows only user's portfolios         │
│ 11. All edit buttons are enabled                            │
│ 12. User can modify investors, properties, config           │
│ 13. Save operations include cookies automatically           │
│ 14. API Gateway validates JWT and passes user email         │
│ 15. Lambda validates portfolio ownership before update      │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Portfolio Filtering Flow

```
┌─────────────────────────────────────────────────────────────┐
│  AUTHENTICATED (user@example.com):                          │
│    - Query DynamoDB: adviser_name = "user@example.com"      │
│    - Show only matching portfolios                          │
│    - Portfolio selector: [User's Portfolio 1, ...]          │
│    - If no portfolios found → Show empty state message      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Considerations

### 5.1 Authentication Security

| Aspect | Implementation |
|--------|----------------|
| **Token Storage** | sessionStorage (JavaScript accessible - NOT HTTP-only cookies) ⚠️ |
| **Token Validation** | Done by FRONTEND only - NOT API Gateway ❌ |
| **Token Expiration** | Frontend checks with authService.isTokenExpired() |
| **CORS** | Configured with origins: ["*"] |
| **HTTPS** | Required for all API calls |
| **All Endpoints** | NO authentication required (API Gateway type: "NONE") ❌ |
| **XSS Protection** | Tokens in sessionStorage are vulnerable to XSS ⚠️ |
| **Authorization Point** | Frontend only (NOT API Gateway) ❌ |

**⚠️ SECURITY GAPS:**
1. Tokens stored in sessionStorage (vulnerable to XSS attacks)
2. No API Gateway authorization - endpoints publicly accessible
3. Frontend-only authentication - anyone can call API directly
4. adviser_name passed as parameter (not from validated JWT)

### 5.2 Authorization Security

| Aspect | Implementation |
|--------|----------------|
| **Portfolio Ownership** | Validated via `adviser_name` field ✅ (in Lambda) |
| **Email Matching** | Case-insensitive comparison ✅ |
| **Access Denial** | 403 Forbidden returned by Lambda ⚠️ (only if JWT validated - currently bypassed) |
| **Audit Logging** | NOT IMPLEMENTED ❌ |
| **Read Access** | Lambda filters by adviser_name parameter ⚠️ (not from JWT) |
| **Write Access** | Lambda validates ownership ⚠️ (only if JWT present - currently bypassed) |

**⚠️ CRITICAL ISSUE:** Without API Gateway authorizer, the validation in Lambda can be bypassed because:
1. User sends their own adviser_name parameter
2. Lambda trusts the parameter (if no JWT is validated by API Gateway)
3. Only the frontend properly enforces authentication

### 5.3 Data Protection

| Aspect | Implementation |
|--------|----------------|
| **Public Data** | ❌ ALL DATA IS PUBLICLY ACCESSIBLE without API Gateway auth! |
| **Private Data** | Users can access own portfolios (frontend auth) ⚠️ |
| **Input Validation** | Server-side validation in Lambda ✅ |
| **SQL Injection** | Parameterized DynamoDB queries ✅ |
| **Data Isolation** | Lambda filters by adviser_name parameter ⚠️ (not secure without API GW) |

**⚠️ CRITICAL SECURITY ISSUE:** The backend has NO authorization enforcement. Anyone with knowledge of the API URL and portfolio ID can read/update data. The frontend-only authentication is a UX feature, not a security feature.

---

## 6. DynamoDB Schema Updates

### 6.1 Current Schema

```json
{
  "id": "string (partition key)",
  "status": "string",
  "adviser_name": "string",
  "investors": "list",
  "properties": "list",
  "chart1": "list",
  "investment_years": "number",
  "executive_summary": "string",
  "our_advice": "string",
  "number_of_updates": "number",
  "last_updated_date": "string"
}
```

### 6.2 Required Field

The `adviser_name` field must contain the user's email address for portfolio filtering to work.

**Example:**
```json
{
  "id": "B57153AB-B66E-4085-A4C1-929EC158FC3E",
  "status": "active",
  "adviser_name": "john.smith@example.com",
  "investors": [...],
  "properties": [...],
  ...
}
```

---

## 7. API Gateway Configuration

### 7.1 Cognito Authorizer Setup

```yaml
Authorizer:
  Type: COGNITO_USER_POOLS
  Properties:
    Name: BA-Portal-Cognito-Authorizer
    IdentitySource: method.request.header.Authorization
    ProviderARNs:
      - arn:aws:cognito-idp:ap-southeast-2:ACCOUNT_ID:userpool/POOL_ID
```

**Key Configuration:**
- `IdentitySource`: Extracts JWT from Authorization header or cookies
- `ProviderARNs`: Cognito User Pool ARN for token validation
- API Gateway automatically validates JWT and extracts claims
- Claims are passed to Lambda via `requestContext.authorizer.claims`

### 7.2 Endpoint Authorization

| Endpoint | Auth Type | Description |
|----------|-----------|-------------|
| `POST /read-table` | COGNITO | Requires authentication |
| `POST /update-table` | COGNITO | Requires authentication |
| `POST /ba-agent` | COGNITO | Requires authentication |

---

## 8. Implementation Phases

### Phase 1: Frontend Authentication Gate (Week 1)

- [x] Create Login page component (IMPLEMENTED: Login UI embedded in Dashboard.tsx)
- [x] Update App component with authentication routing (IMPLEMENTED: Uses AuthContext)
- [x] Update `Header` to show user info and logout button (IMPLEMENTED: Header.tsx uses useAuth)
- [x] AuthContext and AuthService ARE NEEDED (IMPLEMENTED: Full implementation in contexts/AuthContext.tsx and services/authService.ts)

### Phase 2: Backend Authorization (Week 2)

- [ ] Configure API Gateway Cognito Authorizer (NOT IMPLEMENTED: api-config.json shows authentication type: "NONE")
- [x] Update `update_table.py` Lambda with auth validation (IMPLEMENTED: extract_user_from_event at lines 529-541)
- [x] Update `read_table.py` Lambda with user filtering (IMPLEMENTED: extract_user_from_event at lines 226-239)
- [x] Add portfolio ownership validation (IMPLEMENTED: validated in both read and update)
- [ ] Implement audit logging (NOT IMPLEMENTED)

### Phase 3: Portfolio Filtering (Week 3)

- [x] Update `fetchPortfolioList` to use user email (IMPLEMENTED: passes adviser_name to backend)
- [x] Modify Dashboard to load user-specific portfolios (IMPLEMENTED: checks isAuthenticated)
- [x] Update portfolio selector logic (IMPLEMENTED: Portfolio selector in Header)
- [ ] Test filtering with multiple users (NOT TESTED)

### Phase 4: Testing & Deployment (Week 4)

- [ ] Unit tests for auth logic
- [ ] Integration tests for API endpoints
- [ ] End-to-end testing with multiple users
- [ ] Security audit
- [ ] Production deployment

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// AuthContext tests
describe('AuthContext', () => {
  it('should set canEdit to false when not authenticated', () => {
    // Test implementation
  });
  
  it('should set canEdit to true when authenticated', () => {
    // Test implementation
  });
  
  it('should extract user email from ID token', () => {
    // Test implementation
  });
});
```

### 9.2 Integration Tests

```python
# Lambda authorization tests
def test_update_without_auth():
    """Test that update fails without authentication."""
    event = {
        'body': json.dumps({
            'table_name': 'BA-PORTAL-BASETABLE',
            'id': 'test-id',
            'attributes': {'test': 'value'}
        })
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 401

def test_update_with_wrong_user():
    """Test that update fails for wrong user."""
    event = {
        'requestContext': {
            'authorizer': {
                'claims': {
                    'email': 'wrong@example.com'
                }
            }
        },
        'body': json.dumps({
            'table_name': 'BA-PORTAL-BASETABLE',
            'id': 'test-id',
            'attributes': {'test': 'value'}
        })
    }
    response = lambda_handler(event, None)
    assert response['statusCode'] == 403
```

### 9.3 E2E Tests

```typescript
describe('Dashboard Access Control', () => {
  it('should show login button for unauthenticated users', () => {
    // Test implementation
  });
  
  it('should disable edit buttons when not logged in', () => {
    // Test implementation
  });
  
  it('should enable edit buttons after login', () => {
    // Test implementation
  });
  
  it('should filter portfolios by user email', () => {
    // Test implementation
  });
});
```

---

## 10. Monitoring & Logging

### 10.1 CloudWatch Metrics

| Metric | Description | Alarm Threshold |
|--------|-------------|-----------------|
| `AuthFailures` | Failed authentication attempts | > 10 in 5 min |
| `UnauthorizedAccess` | 403 responses | > 5 in 5 min |
| `UpdateAttempts` | Total update attempts | Monitor |
| `PortfolioFilterHits` | Filtered portfolio queries | Monitor |

### 10.2 Audit Logs

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "user_email": "john.smith@example.com",
  "action": "update_portfolio",
  "portfolio_id": "B57153AB-B66E-4085-A4C1-929EC158FC3E",
  "status": "success",
  "ip_address": "203.0.113.1",
  "user_agent": "Mozilla/5.0..."
}
```

---

## 11. Rollback Plan

### 11.1 Frontend Rollback

- Restore `AuthContext` and `AuthService`
- Remove authentication requirement from App component
- Restore original routing behavior
- Remove `credentials: 'include'` from API calls

### 11.2 Backend Rollback

- Remove Cognito Authorizer from API Gateway
- Revert Lambda function changes
- Restore original endpoint configuration

### 11.3 Database Rollback

- No schema changes required
- `adviser_name` field already exists

---

## 12. Success Criteria

### 12.1 Functional Requirements

- ✅ Unauthenticated users are redirected to login page
- ✅ Authenticated users can view and update their portfolios
- ✅ Authenticated users cannot access other users' portfolios
- ✅ Portfolio filtering works correctly by user email
- ✅ Dashboard loads only after successful authentication

### 12.2 Performance Requirements

- ✅ Authentication adds < 100ms to page load
- ✅ Portfolio filtering adds < 50ms to query time
- ✅ Update operations complete within 2 seconds

### 12.3 Security Requirements

- ✅ All update endpoints require authentication
- ✅ Portfolio ownership validated before updates
- ✅ JWT tokens validated on backend
- ✅ Audit logs capture all update attempts

---

## 13. Future Enhancements

### 13.1 Role-Based Access Control (RBAC)

- Add user roles (admin, advisor, viewer)
- Implement role-based permissions
- Support for team-based portfolio sharing

### 13.2 Multi-Factor Authentication (MFA)

- Enable MFA for sensitive operations
- SMS or authenticator app support
- Configurable MFA requirements

### 13.3 Session Management

- Implement session timeout
- Support for "Remember Me" functionality
- Concurrent session limits

### 13.4 Advanced Filtering

- Filter by portfolio status
- Filter by last updated date
- Search functionality for portfolios

---

## 14. References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [API Gateway Authorization](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access.html)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
- [React Context API](https://react.dev/reference/react/createContext)

---

## Implementation Status Summary (Updated: 2026-04-01)

### What Was Implemented ✅

| Component | Implementation | Status |
|-----------|---------------|--------|
| **Frontend Auth** | Full implementation with AuthContext and OAuth code flow | ✅ COMPLETE |
| **Login UI** | Embedded in Dashboard.tsx (inline login prompt) | ✅ COMPLETE |
| **Header Component** | Shows user info, login/logout, portfolio selector | ✅ COMPLETE |
| **AuthContext** | Full context in `contexts/AuthContext.tsx` | ✅ COMPLETE |
| **authService** | Full OAuth flow in `services/authService.ts` | ✅ COMPLETE |
| **Token Storage** | sessionStorage (NOT HTTP-only cookies as originally designed) | ✅ COMPLETE |
| **read_table Lambda** | User filtering by `adviser_name` from JWT claims | ✅ COMPLETE |
| **update_table Lambda** | Portfolio ownership validation | ✅ COMPLETE |

### Key Differences from Original Design ⚠️

1. **Login Page**: Instead of a separate `pages/Login.tsx`, login UI is embedded inline in [`Dashboard.tsx`](dashboard-frontend/src/components/Dashboard.tsx:36)
2. **Token Storage**: Uses sessionStorage (JavaScript-accessible) instead of HTTP-only cookies
3. **API Gateway Auth**: NOT enabled - endpoints still have `"authentication": {"type": "NONE"}` in api-config.json
4. **AuthContext**: REQUIRED - Not removed (opposite of design)
5. **App.tsx**: Minimal - just renders Dashboard directly (AuthContext wraps it elsewhere)

### What Was NOT Implemented ❌


| Component | Design Requirement | Status |
|-----------|----------------|--------|
| **API Gateway Cognito Authorizer** | All endpoints require Cognito auth | ❌ NOT IMPLEMENTED |
| **HTTP-only Cookies** | Tokens in cookies, not sessionStorage | ❌ NOT IMPLEMENTED |
| **Backend Auth Validation** | API Gateway validates JWT | ❌ NOT IMPLEMENTED |
| **Audit Logging** | Log all API attempts | ❌ NOT IMPLEMENTED |

### Critical Gaps ⚠️


1. **Security Issue**: API Gateway has NO Cognito authorizer configured - all endpoints are publicly accessible!
2. **Token Security**: Tokens are stored in sessionStorage (JavaScript accessible), not HTTP-only cookies
3. **Frontend-only Auth**: Authentication is only enforced on frontend - backend has NO authorization
4. **Portfolio Access**: Anyone with API URL can access any portfolio (no adviser_name validation)

### Required Actions to Close Gaps

1. **Enable API Gateway Cognito Authorizer** - Configure in AWS Console or update deploy_api.py
2. **Update api-config.json** - Change authentication.type from "NONE" to "COGNITO_USER_POOLS"
3. **Consider HTTP-only cookies** - For production-grade security (optional enhancement)
4. **Add audit logging** - CloudWatch logging for auth events

---

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 1.1 |
| **Author** | System Architect |
| **Date** | 2024-01-15 |
| **Status** | Updated with Implementation Status |
| **Last Updated** | 2026-04-01 |
| **Reviewers** | Development Team, Security Team |

---

## Appendix A: Environment Variables

```bash
# Cognito Configuration
VITE_COGNITO_CLIENT_ID=your_client_id
VITE_COGNITO_DOMAIN=your_domain.auth.ap-southeast-2.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:3000/
VITE_COGNITO_LOGOUT_URI=http://localhost:3000/
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX

# API Configuration
VITE_REACT_APP_FINANCE_URL=https://your-api-id.execute-api.ap-southeast-2.amazonaws.com/prod
VITE_REACT_APP_APPSYNC_REGION=ap-southeast-2
VITE_REACT_APP_APPSYNC_FINANCE_TABLE_NAME=BA-PORTAL-BASETABLE

# Cookie Configuration
VITE_COOKIE_DOMAIN=localhost  # or your domain
VITE_COOKIE_SECURE=true  # true for HTTPS, false for HTTP
VITE_COOKIE_SAMESITE=Strict  # Strict, Lax, or None
```

## Appendix B: DynamoDB Table Structure

```json
{
  "TableName": "BA-PORTAL-BASETABLE",
  "KeySchema": [
    {
      "AttributeName": "id",
      "KeyType": "HASH"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "id",
      "AttributeType": "S"
    }
  ]
}
```

## Appendix C: Cognito User Pool Attributes

```json
{
  "Attributes": [
    {
      "Name": "email",
      "Required": true
    },
    {
      "Name": "email_verified",
      "Required": false
    },
    {
      "Name": "name",
      "Required": false
    }
  ]
}
```
