# BA Dashboard Login System - Architecture Plan (Updated)

## Clarified Requirements (March 2026)

- **Authentication Type**: Passwordless login (no password required)
- **Login Code Expiry**: 5 minutes for verification code
- **Cognito User Pool**: NEW pool with "ba-dashboard-" prefix, redeployable Python script
- **advicer_name**: This IS the unique ID for the advisor
- **Duplicate Logic**: Entire user record duplicated to BA-PORTAL-BASETABLE on first login

## 1. System Overview

This document outlines the architecture for a secure, serverless login system integrated with AWS Cognito, API Gateway, Lambda, and DynamoDB. The system provides signup, login, and logout functionality with JWT token authentication.

### Key Requirements Summary:
- **Prefix**: All resources use "ba-dashboard-" prefix
- **Authentication**: AWS Cognito with JWT tokens
- **Storage**: DynamoDB for login details and attempt logging
- **API**: Existing API Gateway integration
- **Token Expiry**: 5 minutes for login codes
- **Special Feature**: Duplicate ID "B57153AB-B66E-4085-A4C1-929EC158FC3E" to BA-PORTAL-BASETABLE on new user login

---

## 2. Architecture Diagram

```mermaid
flowchart TB
    subgraph Frontend["React Frontend - Dashboard"]
        LoginPage["Login Page"]
        SignupPage["Signup Page"]
        Dashboard["Dashboard"]
        AuthContext["Auth Context"]
    end
    
    subgraph AWS["AWS Services"]
        subgraph Cognito["Cognito User Pool (ba-dashboard-)"]
            UserPool["User Pool"]
            AppClient["App Client"]
            HostedUI["Hosted UI"]
        end
        
        subgraph APIGateway["API Gateway (Existing)"]
            AuthAPI["Auth Endpoints"]
        end
        
        subgraph Lambda["Lambda Functions (ba-dashboard-)"]
            SignupLambda["signup-lambda"]
            RequestCodeLambda["request-code-lambda"]
            LoginLambda["login-lambda"]
            LogoutLambda["logout-lambda"]
            VerifyTokenLambda["verify-token-lambda"]
            BlockUserLambda["block-user-lambda"]
            UnblockUserLambda["unblock-user-lambda"]
            GetUsersLambda["get-users-lambda"]
        end
        
        subgraph DynamoDB["DynamoDB Tables (ba-dashboard-)"]
            UsersTable["users-table"]
            VerificationCodesTable["verification-codes-table"]
            LoginAttemptsTable["login-attempts-table"]
            BlockedUsersTable["blocked-users-table"]
            BaseTable["BA-PORTAL-BASETABLE (External)"]
        end
    end
    
    Frontend -->|"OAuth 2.0 / API Calls"| Cognito
    Frontend -->|"HTTP Requests"| APIGateway
    APIGateway -->|"Invoke"| Lambda
    Lambda -->|"Read/Write"| DynamoDB
    Lambda -->|"Verify Token"| Cognito
    
    style Lambda fill:#f9f,stroke:#333
    style DynamoDB fill:#ff9,stroke:#333
    style Cognito fill:#9ff,stroke:#333
```

---

## 3. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Cognito
    participant APIGateway
    participant Lambda
    participant DynamoDB
    
    Note over User,Frontend: SIGNUP FLOW
    User->>Frontend: Enter signup details
    Frontend->>APIGateway: POST /signup
    APIGateway->>Lambda: Invoke signup-lambda
    Lambda->>Cognito: Create user in User Pool
    Lambda->>DynamoDB: Store user profile (advicer_name)
    Lambda-->>APIGateway: Return success
    APIGateway-->>Frontend: Signup success
    
    Note over User,Frontend: LOGIN FLOW (Passwordless)
    User->>Frontend: Enter email
    Frontend->>APIGateway: POST /request-code
    APIGateway->>Lambda: Invoke request-code-lambda
    Lambda->>DynamoDB: Store 6-digit code (5-min TTL)
    Lambda-->>APIGateway: Code sent
    APIGateway-->>Frontend: Show code entry
    User->>Frontend: Enter verification code
    Frontend->>APIGateway: POST /login (email + code)
    APIGateway->>Lambda: Invoke login-lambda
    Lambda->>DynamoDB: Validate code (check expiry)
    Lambda->>DynamoDB: Log login attempt
    Lambda->>DynamoDB: Check if user is blocked
    Lambda->>DynamoDB: Check if new user → duplicate record to BA-PORTAL-BASETABLE
    Lambda->>Cognito: Get tokens
    Lambda-->>APIGateway: Return JWT tokens
    APIGateway-->>Frontend: Return tokens
    Frontend->>Frontend: Store tokens
    
    Note over User,Frontend: LOGOUT FLOW
    User->>Frontend: Click Logout
    Frontend->>APIGateway: POST /logout
    APIGateway->>Lambda: Invoke logout-lambda
    Lambda->>DynamoDB: Log logout event
    Lambda-->>Frontend: Clear tokens
    Frontend->>Frontend: Redirect to login page
```

---

## 4. DynamoDB Table Schemas

### 4.1 ba-dashboard-users-table

Stores user profiles with their unique advicer_name.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| user_id | String | PK | Cognito sub (UUID) |
| email | String | GSI1 | User email (indexed) |
| advicer_name | String | - | Advisor unique ID |
| cognito_username | String | - | Cognito username |
| name | String | - | Full name |
| created_at | String | - | ISO timestamp |
| updated_at | String | - | ISO timestamp |
| last_login | String | - | ISO timestamp |
| is_active | Boolean | - | Account status |

### 4.2 ba-dashboard-verification-codes-table

Stores verification codes with 5-minute TTL.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| email | String | PK | User email |
| code | String | - | 6-digit verification code |
| created_at | String | - | ISO timestamp |
| expires_at | Number | - | Unix timestamp (5 min TTL) |
| attempts | Number | - | Failed attempts |
| is_used | Boolean | - | Code used flag |

### 4.3 ba-dashboard-login-attempts-table

Logs all login attempts for security and auditing.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| attempt_id | String | PK | UUID for the attempt |
| user_id | String | GSI1 | User ID if exists |
| email | String | GSI2 | Email used (indexed) |
| ip_address | String | - | Client IP |
| user_agent | String | - | Browser/client info |
| status | String | - | success/failed/blocked |
| failure_reason | String | - | Reason for failure |
| timestamp | String | - | ISO timestamp |
| token_issued | Boolean | - | Whether token was issued |

### 4.4 ba-dashboard-blocked-users-table

Stores blocked users to prevent login.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| user_id | String | PK | Blocked user ID |
| email | String | - | Blocked email |
| blocked_at | String | - | When blocked |
| blocked_by | String | - | Admin who blocked |
| reason | String | - | Reason for blocking |
| expires_at | String | - | Optional expiration |

---

## 5. Lambda Functions Specification

All Lambda functions use the prefix "ba-dashboard-" and are designed to be generic.

### 5.1 ba-dashboard-signup-lambda

**Purpose**: Register a new user (passwordless - no password required)

**Input**:
```json
{
  "email": "user@example.com",
  "advicer_name": "ADVISOR001",
  "name": "John Doe"
}
```

**Output**:
```json
{
  "statusCode": 201,
  "body": {
    "user_id": "uuid",
    "email": "user@example.com",
    "advicer_name": "ADVISOR001",
    "message": "User registered successfully. Please check email for verification code."
  }
}
```

**Environment Variables**:
- COGNITO_USER_POOL_ID
- COGNITO_CLIENT_ID
- REGION
- DYNAMODB_USERS_TABLE

### 5.2 ba-dashboard-login-lambda

**Purpose**: Authenticate user via passwordless login (email + verification code)

**Input**:
```json
{
  "email": "user@example.com",
  "verification_code": "123456"  // 5-minute expiry
}
```

**Output**:
```json
{
  "statusCode": 200,
  "body": {
    "access_token": "eyJ...",
    "id_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 3600,
    "user_id": "uuid",
    "advicer_name": "ADVISOR001"
  }
}
```

**Features**:
- Validates verification code against stored code in DynamoDB
- Checks if user is blocked
- Logs attempt to DynamoDB
- Generates JWT tokens after verification
- Duplicates entire user record to BA-PORTAL-BASETABLE for new users
- **Verification code expires in 5 minutes**

**Environment Variables**:
- COGNITO_USER_POOL_ID
- COGNITO_CLIENT_ID
- REGION
- DYNAMODB_USERS_TABLE
- DYNAMODB_LOGIN_ATTEMPTS_TABLE
- DYNAMODB_BLOCKED_USERS_TABLE
- JWT_SECRET_KEY
- BA_PORTAL_BASE_TABLE
- VERIFICATION_CODE_EXPIRY_SECONDS=300

### 5.3 ba-dashboard-request-code-lambda

**Purpose**: Request a new verification code (passwordless flow)

**Input**:
```json
{
  "email": "user@example.com"
}
```

**Output**:
```json
{
  "statusCode": 200,
  "body": {
    "message": "Verification code sent. Code expires in 5 minutes."
  }
}
```

**Features**:
- Generates 6-digit verification code
- Stores code in DynamoDB with 5-minute TTL
- Logs the request

### 5.3 ba-dashboard-logout-lambda

**Purpose**: Handle user logout

**Input**:
```json
{
  "user_id": "uuid",
  "refresh_token": "token"
}
```

**Output**:
```json
{
  "statusCode": 200,
  "body": {
    "message": "Logged out successfully"
  }
}
```

### 5.4 ba-dashboard-verify-token-lambda

**Purpose**: Verify JWT token and return user info

**Input**:
```json
{
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

**Output**:
```json
{
  "statusCode": 200,
  "body": {
    "user_id": "uuid",
    "email": "user@example.com",
    "advicer_name": "ADVISOR001",
    "is_valid": true
  }
}
```

### 5.5 ba-dashboard-block-user-lambda

**Purpose**: Block a user from logging in

**Input**:
```json
{
  "user_id": "uuid",
  "reason": "Policy violation",
  "blocked_by": "admin@example.com"
}
```

### 5.6 ba-dashboard-unblock-user-lambda

**Purpose**: Unblock a previously blocked user

### 5.7 ba-dashboard-get-users-lambda

**Purpose**: List all users (admin function)

---

## 6. API Gateway Endpoints

All endpoints added to the existing API Gateway.

### 6.1 Endpoints Configuration (Passwordless Login)

| Method | Path | Lambda | Auth | Description |
|--------|------|--------|------|-------------|
| POST | /auth/signup | ba-dashboard-signup-lambda | NONE | User registration (no password) |
| POST | /auth/request-code | ba-dashboard-request-code-lambda | NONE | Request 5-min verification code |
| POST | /auth/login | ba-dashboard-login-lambda | NONE | Login with email + verification code |
| POST | /auth/logout | ba-dashboard-logout-lambda | COGNITO | User logout |
| POST | /auth/verify-token | ba-dashboard-verify-token-lambda | NONE | Verify JWT |
| POST | /auth/block-user | ba-dashboard-block-user-lambda | COGNITO | Block user |
| POST | /auth/unblock-user | ba-dashboard-unblock-user-lambda | COGNITO | Unblock user |
| GET | /auth/users | ba-dashboard-get-users-lambda | COGNITO | List users |

---

## 7. JWT Token Configuration

### Passwordless Login Flow (5-minute code expiry)

1. User enters email → `/auth/request-code` → 6-digit code generated, stored in DynamoDB with 5-min TTL
2. User enters code → `/auth/login` → Code validated, JWT tokens issued
3. Tokens used for subsequent API calls

### Verification Code (stored in DynamoDB)
```json
{
  "email": "user@example.com",
  "code": "123456",
  "created_at": "2026-03-08T04:30:00Z",
  "expires_at": "2026-03-08T04:35:00Z",  // 5 minutes later
  "attempts": 0
}
```

### Standard Access Token (from Cognito)
- Expiry: 1 hour (from Cognito)
- Contains: user claims, groups, advicer_name

---

## 8. New User Record Duplication Logic

When a new user successfully logs in for the first time (no previous last_login):

1. Check if user exists in `ba-dashboard-users-table`
2. If `last_login` is null (new user):
   - Read item with ID "B57153AB-B66E-4085-A4C1-929EC158FC3E" from `BA-PORTAL-BASETABLE`
   - **Duplicate the ENTIRE RECORD** to the same table (BA-PORTAL-BASETABLE) with user's identifier
   - Update user's `last_login` timestamp in `ba-dashboard-users-table`

### Implementation Steps in ba-dashboard-login-lambda:
```python
def handle_new_user_login(user):
    if not user.get('last_login'):
        # This is a new user - duplicate record to BA-PORTAL-BASETABLE
        source_item = get_item_from_dynamodb(
            table_name='BA-PORTAL-BASETABLE',
            key={'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E'}
        )
        
        # Create new item with user's identifier
        new_item = source_item.copy()
        new_item['id'] = user['user_id']
        new_item['advicer_name'] = user['advicer_name']
        new_item['email'] = user['email']
        
        # Write to BA-PORTAL-BASETABLE
        put_item_to_dynamodb(
            table_name='BA-PORTAL-BASETABLE',
            item=new_item
        )
        
        # Update user's last_login
        update_user_last_login(user['user_id'])
```

---

## 9. Frontend Integration

### 9.1 Updated Auth Context Flow

```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  tokens: Tokens | null;
  isLoading: boolean;
}

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  advicerName: string;
  groups: string[];
}
```

### 9.2 API Service Updates

```typescript
// New auth API calls
authAPI.signup(data: SignupData): Promise<AuthResponse>
authAPI.login(credentials: LoginCredentials): Promise<LoginResponse>
authAPI.logout(): Promise<void>
authAPI.verifyToken(token: string): Promise<VerifyResponse>
authAPI.blockUser(userId: string, reason: string): Promise<void>
authAPI.unblockUser(userId: string): Promise<void>
```

---

## 10. Security Considerations

1. **Password Requirements**: Minimum 8 characters, uppercase, lowercase, number, special char
2. **Rate Limiting**: Implement at API Gateway level (see Section 10.1)
3. **Token Storage**: Use httpOnly cookies for JWT, not localStorage
4. **HTTPS Only**: All traffic must be over HTTPS in production
5. **CORS**: Configure specific origins, not "*"
6. **Input Validation**: Validate all inputs in Lambda functions
7. **Logging**: All authentication events logged to CloudWatch

### 10.1 API Gateway Rate Limiting (Endpoint-Specific)

| Endpoint | Method | Rate Limit | Burst Limit | Description |
|----------|--------|------------|-------------|-------------|
| /auth/request-code | POST | 5 requests/min | 10 | Prevent code spam |
| /auth/login | POST | 10 requests/min | 20 | Prevent brute force |
| /auth/signup | POST | 5 requests/min | 10 | Prevent account enumeration |
| /auth/block-user | POST | 10 requests/min | 20 | Admin endpoint |
| /auth/unblock-user | POST | 10 requests/min | 20 | Admin endpoint |
| /auth/logout | POST | 60 requests/min | 100 | Normal usage |
| /auth/verify-token | POST | 60 requests/min | 100 | Normal usage |
| /auth/users | GET | 30 requests/min | 50 | Admin endpoint |
| /update-table | POST | 60 requests/min | 100 | Data operations |
| /read-table | POST | 120 requests/min | 200 | Dashboard reads |

#### Implementation via API Gateway Usage Plans:

```python
# AWS CLI commands to set up rate limiting
# Create usage plan
aws apigateway create-usage-plan \
  --name ba-dashboard-auth-usage-plan \
  --api-stages apiId=YOUR_API_ID,stage=prod \
  --quota settings='{ "limit": 1000, "period": "DAY" }' \
  --throttle settings='{ "rateLimit": 10, "burstLimit": 20 }' \
  --region ap-southeast-2
```

---

## 11. Implementation Order

1. **Create Cognito User Pool** (Python script with "ba-dashboard-" prefix)
   - Script: `app/ba-portal/IaC/cognito_setup.py`
   - Should be redeployable (idempotent)
2. **Create DynamoDB Tables** (Python script)
   - Script: `app/ba-portal/IaC/create_auth_tables.py`
   - Tables: users, verification-codes, login-attempts, blocked-users
3. **Deploy Lambda Functions** (7 functions with "ba-dashboard-" prefix)
4. **Configure API Gateway Endpoints**
   - Update `app/ba-portal/IaC/api-config.json`
5. **Update Frontend Authentication Code**
6. **Test End-to-End Flow**

---

## 12. Files to Create/Modify

### New Files - IaC Setup
- `app/ba-portal/IaC/cognito_setup.py` - Create/recreate Cognito User Pool with "ba-dashboard-" prefix (redeployable)
- `app/ba-portal/IaC/create_auth_tables.py` - Create all DynamoDB tables with "ba-dashboard-" prefix

### New Files - Lambda Functions (prefix: ba-dashboard-)
- `app/ba-portal/lambda/auth_signup/signup.py` - User registration
- `app/ba-portal/lambda/auth_request_code/request_code.py` - Generate 5-min verification code
- `app/ba-portal/lambda/auth_login/login.py` - Login with verification code
- `app/ba-portal/lambda/auth_logout/logout.py` - User logout
- `app/ba-portal/lambda/auth_verify_token/verify_token.py` - Verify JWT token
- `app/ba-portal/lambda/auth_block_user/block_user.py` - Block user
- `app/ba-portal/lambda/auth_unblock_user/unblock_user.py` - Unblock user
- `app/ba-portal/lambda/auth_get_users/get_users.py` - List users (admin)

### New Files - Lambda Deployment
- `app/ba-portal/lambda/auth_signup/deploy.config` - Lambda configuration
- `app/ba-portal/lambda/auth_signup/requirements.txt` - Python dependencies

### Modify Existing Files
- `app/ba-portal/dashboard-frontend/src/contexts/AuthContext.tsx` - Update for passwordless login
- `app/ba-portal/dashboard-frontend/src/services/authService.ts` - Add passwordless auth methods
- `app/ba-portal/dashboard-frontend/src/config/cognitoConfig.ts` - Update for new Cognito pool
- `app/ba-portal/IaC/api-config.json` - Add auth endpoints to existing API Gateway

---

## 13. Configuration Summary

| Resource | Prefix | Example Name |
|----------|--------|--------------|
| Lambda Functions | ba-dashboard- | ba-dashboard-login-lambda |
| DynamoDB Tables | ba-dashboard- | ba-dashboard-users-table |
| Cognito User Pool | ba-dashboard- | ba-dashboard-user-pool |
| Cognito App Client | ba-dashboard- | ba-dashboard-spa-client |

---

## 14. Assumptions & Clarifications

The following assumptions were made during the design. Please verify:

### 14.1 Authentication & Verification

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **Verification Code Delivery** | Currently stored in DynamoDB. Not sent via email/SMS yet - displayed in UI for testing | Yes - How should codes be delivered in production? |
| **No Password Required** | This is a passwordless login system using 6-digit codes | Verified |
| **5-Minute Code Expiry** | Verification codes expire after 5 minutes | Verified |

### 14.2 Cognito Integration

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **New User Pool** | Create NEW Cognito User Pool with "ba-dashboard-" prefix | Verified |
| **User Pool Type** | Using Cognito User Pool for user management | What about federated identities? |
| **Token Exchange** | Lambda handles token exchange with Cognito | Is this correct? |

### 14.3 DynamoDB & Data

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **advicer_name Source** | Stored as unique ID for advisor | Should this come from Cognito custom attribute? |
| **Base Table Access** | Lambda has read/write access to BA-PORTAL-BASETABLE | Verify IAM permissions |
| **Record Duplication** | Entire record from source ID is duplicated | Which fields to update with user data? |

### 14.4 Frontend

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **Existing Frontend** | Modifying existing dashboard frontend | Any new pages needed? |
| **Token Storage** | Using sessionStorage for tokens | Should use httpOnly cookies? |
| **Callback Handling** | Using code flow for verification | Is this the desired flow? |

### 14.5 Security

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **Rate Limiting** | Not implemented yet | Add at API Gateway? |
| **Code Attempts** | Tracking failed verification attempts | Max attempts before lockout? |
| **HTTPS** | Assumed in production | Verify deployment environment |

### 14.6 Lambda Functions

| Assumption | Description | Needs Clarification? |
|-----------|-------------|---------------------|
| **Generic Design** | Functions designed to be reusable | Verify environment variable configuration |
| **Python Runtime** | Using Python 3.13 | OK? |
| **Prefix** | All functions start with "ba-dashboard-" | Verified |

---

## 15. Integration with Existing Lambda Functions

### 15.1 New Requirement: Read-Only Before Login, Edit After Login

The ba-dashboard should work as follows:
- **Before Login**: Dashboard is READ-ONLY (can view data)
- **After Login**: User can EDIT their own data only

### 15.2 Existing Lambdas to Update

| Lambda Function | Current Behavior | Required Changes |
|----------------|------------------|------------------|
| ba-portal-update-table-lambda | Updates any data | Check auth + ownership by advicer_name |
| ba-portal-insert-table-lambda | Inserts any data | Check auth + ownership by advicer_name |
| ba-portal-read-table-lambda | Reads any data | Already works (read is allowed) |

### 15.3 Authorization Logic

```python
def authorize_edit(event, user_info):
    # Check if user is authenticated
    if not user_info or not user_info.get('is_authenticated'):
        return {
            'authorized': False,
            'reason': 'User not authenticated'
        }
    
    # Get user's advicer_name from token
    user_advicer_name = user_info.get('advicer_name')
    
    # Get the data being edited
    target_advicer_name = event.get('body', {}).get('advicer_name')
    
    # Check ownership - user can only edit their own data
    if user_advicer_name != target_advicer_name:
        return {
            'authorized': False,
            'reason': 'User can only edit their own data'
        }
    
    return {'authorized': True}
```

### 15.4 Lambda Integration Flow

```mermaid
flowchart LR
    subgraph Request["API Request"]
        Frontend[Frontend]
        APIG[API Gateway]
    end
    
    subgraph Auth["Auth Check"]
        Token[Verify JWT Token]
        Extract[Extract advicer_name]
    end
    
    subgraph Business["Business Logic"]
        UpdateLambda[update-table-lambda]
        InsertLambda[insert-table-lambda]
    end
    
    subgraph Data["Data Layer"]
        DynamoDB[DynamoDB]
    end
    
    Frontend -->|HTTP Request| APIG
    APIG -->|Invoke| Token
    Token -->|User Info| Extract
    Extract -->|auth check| UpdateLambda
    UpdateLambda -->|validate ownership| DynamoDB
    
    style Auth fill:#f96,stroke:#333
    style Business fill:#9f9,stroke:#333
```

### 15.5 Implementation Approach

1. **Create a Generic Auth Decorator/Library**:
   - Python module that can be imported into existing Lambdas
   - Validates JWT token from Authorization header
   - Extracts user info (user_id, email, advicer_name)
   
2. **Update Existing Lambdas**:
   - Add auth check at the beginning of handler
   - For write operations: verify ownership by comparing advicer_name
   
3. **Environment Variables for Existing Lambdas**:
   - COGNITO_USER_POOL_ID
   - JWT_SECRET_KEY (for custom token verification)

---

This plan provides a comprehensive architecture for the login system. Once approved, I will proceed with implementation in Code mode.
