# SentinelFlow API Security Implementation

This directory contains comprehensive security middleware and validation for the SentinelFlow API, implementing defense-in-depth security principles while maintaining SentinelFlow's architectural constraints.

## Architecture Compliance

All security implementations follow SentinelFlow's core architectural principles:

- **Deterministic Outputs**: All validation and security responses use structured JSON formats
- **No External Side Effects**: Security middleware performs no external actions or infrastructure mutations
- **Audit as First-Class Output**: All security events are logged for audit trail integrity
- **Governance Before Action**: Security validation respects workflow state constraints
- **Separation of Concerns**: Security is isolated from business logic

## Security Components

### 1. Input Validation (`validation/`)

**Purpose**: Comprehensive input validation and sanitization for all API endpoints.

**Features**:
- Schema-based validation with type checking
- String sanitization (HTML tag removal, entity escaping)
- Field-level validation with detailed error reporting
- UUID format validation
- Enum value validation
- Array and nested object validation

**Architecture Alignment**:
- Uses structured JSON schemas for deterministic validation
- Produces machine-readable error responses
- No external dependencies or side effects

### 2. Security Headers (`security/headers.ts`)

**Purpose**: HTTP security headers and protocol enforcement.

**Features**:
- Content Security Policy (CSP)
- X-Frame-Options, X-Content-Type-Options
- XSS Protection headers
- HTTPS enforcement in production
- Secure CORS configuration
- Content-Type validation

**Architecture Alignment**:
- Configurable security policies
- Environment-aware (development vs production)
- No infrastructure mutations

### 3. Rate Limiting (`security/rate-limiting.ts`)

**Purpose**: Request rate limiting and abuse prevention.

**Features**:
- Configurable time windows and request limits
- In-memory storage with automatic cleanup
- Enhanced key generation with user agent fingerprinting
- System endpoint exemptions
- Governance-specific rate limits

**Architecture Alignment**:
- Deterministic rate limit responses
- Audit logging of rate limit violations
- No external storage dependencies

### 4. Request Size Limiting (`security/request-size.ts`)

**Purpose**: Prevention of DoS attacks through large payloads.

**Features**:
- Dynamic size limits based on endpoint
- Request size monitoring and logging
- Configurable size thresholds
- Header size inclusion options

**Architecture Alignment**:
- Endpoint-specific size limits
- Structured error responses
- Security event logging

## Security Standards Implementation

### OWASP API Security Top 10 Compliance

1. **Broken Object Level Authorization**: UUID validation prevents object enumeration
2. **Broken User Authentication**: Secure header configuration
3. **Excessive Data Exposure**: Structured error responses prevent information leakage
4. **Lack of Resources & Rate Limiting**: Comprehensive rate limiting implementation
5. **Broken Function Level Authorization**: Role-based validation in governance
6. **Mass Assignment**: Schema-based validation prevents mass assignment
7. **Security Misconfiguration**: Secure defaults and environment-aware configuration
8. **Injection**: Input sanitization and validation
9. **Improper Assets Management**: Version information in responses
10. **Insufficient Logging & Monitoring**: Comprehensive security event logging

### Defense in Depth

**Layer 1: Network Security**
- HTTPS enforcement
- CORS configuration
- Origin validation

**Layer 2: Input Validation**
- Schema validation
- Type checking
- Sanitization

**Layer 3: Rate Limiting**
- Request frequency limits
- Size limits
- Abuse detection

**Layer 4: Security Headers**
- XSS protection
- Content type enforcement
- Frame options

**Layer 5: Audit & Monitoring**
- Security event logging
- Request monitoring
- Error tracking

## Usage Examples

### Basic Security Middleware

```typescript
import { securityMiddleware, rateLimitingMiddleware } from '../middleware';

// Apply all security measures
app.use(...securityMiddleware());

// Apply rate limiting
const rateLimits = rateLimitingMiddleware();
app.use('/api/governance', rateLimits.governance);
```

### Custom Validation

```typescript
import { createValidationMiddleware } from '../validation/validator';
import { WorkflowSchemas } from '../validation/schemas';

// Validate workflow creation
app.post('/workflows', 
  createValidationMiddleware(WorkflowSchemas.createWorkflow),
  handler
);
```

### Rate Limiting Configuration

```typescript
import { createRateLimit } from '../security/rate-limiting';

// Custom rate limit
const customLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests'
});
```

## Configuration

### Environment Variables

- `NODE_ENV`: Controls security strictness (development vs production)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `RATE_LIMIT_WINDOW`: Default rate limiting window (milliseconds)
- `MAX_REQUEST_SIZE`: Maximum request size (bytes)

### Security Presets

**Development**:
- Relaxed CORS (allow all origins)
- Detailed error messages
- No HTTPS enforcement

**Production**:
- Strict CORS (whitelist only)
- Sanitized error messages
- HTTPS enforcement
- Enhanced logging

## Testing

### Security Test Coverage

- Input validation edge cases
- Rate limiting functionality
- Security header verification
- HTTPS enforcement
- CORS configuration
- Request size limits
- Error handling security

### Integration Tests

- End-to-end security validation
- Attack simulation (XSS, injection)
- Rate limit enforcement
- Security header presence

## Monitoring & Alerting

### Security Events Logged

- Rate limit violations
- Oversized requests
- Validation failures
- Suspicious request patterns
- Security header violations

### Metrics Tracked

- Request sizes
- Rate limit hit rates
- Validation error rates
- Security event frequencies

## Compliance & Audit

### Audit Trail

All security events are logged with:
- Timestamp
- Request details (sanitized)
- Security violation type
- Response action taken

### Compliance Features

- Structured logging for audit requirements
- Deterministic security responses
- No sensitive data in logs
- Configurable security policies

## Future Enhancements

### Planned Features

1. **Advanced Threat Detection**
   - Pattern-based attack detection
   - Behavioral analysis
   - Automated blocking

2. **Enhanced Monitoring**
   - Real-time security dashboards
   - Alert integration
   - Metrics export

3. **Additional Validation**
   - Custom validation rules
   - Business logic validation
   - Cross-field validation

### Architecture Evolution

Security enhancements will maintain SentinelFlow's architectural principles:
- Deterministic behavior
- Structured outputs
- No external side effects
- Audit-first design
- Governance integration

## Security Contact

For security issues or questions about the security implementation, please refer to the main SentinelFlow documentation or create an issue following responsible disclosure practices.