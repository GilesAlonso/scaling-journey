# Scaling Journey - JWT Authentication with NocoDB (PostgreSQL)

A complete JWT authentication system with automatic user seeding for NocoDB PostgreSQL testing.

## Features

- ✅ **Automatic User Seeding**: Seeds test users on first startup
- ✅ **Manual Seeding**: Run seed script independently with `npm run seed`
- ✅ **JWT Authentication**: Complete login/logout functionality
- ✅ **Role-based Authorization**: Admin, driver, customer, dispatcher, support roles
- ✅ **Password Hashing**: Secure bcryptjs hashing
- ✅ **Database Auto-migration**: Creates USERS table if missing
- ✅ **PostgreSQL Support**: Native PostgreSQL support for NocoDB
- ✅ **SQLite Support**: Fallback for testing
- ✅ **Force Override**: Use `--force` flag to overwrite existing users

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment for NocoDB PostgreSQL
Copy `.env.example` to `.env` and configure with your settings:
```bash
cp .env.example .env
```

Edit `.env` file with your NocoDB PostgreSQL configuration:
```env
# NocoDB PostgreSQL Configuration
NOCODB_HOST=localhost
NOCODB_PORT=5432
NOCODB_DATABASE=nocodb
NOCODB_USERNAME=postgres
NOCODB_PASSWORD=your_postgres_password

# Database Type
DB_TYPE=postgres

# JWT Configuration (IMPORTANT: Change JWT_SECRET in production!)
# JWT_SECRET must be at least 32 characters for security
JWT_SECRET=your-super-secret-key-min-32-chars-change-this-in-production
JWT_EXPIRY=7d

# Server Configuration
PORT=3000
NODE_ENV=development
```

**⚠️ Security Note:** For production, generate a secure JWT_SECRET:
```bash
# Generate secure random secret (64 bytes = 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Start the Server
```bash
npm start
```

The server will automatically:
1. Connect to NocoDB PostgreSQL
2. Create USERS table if it doesn't exist
3. Seed initial test users if table is empty
4. Start HTTP server on port 3000

### 4. Manual Seeding (Optional)
```bash
# Seed users (skip if users already exist)
npm run seed

# Force seed (overwrite existing users)
npm run seed:force
# or
node seed-users.js --force
```

## For Development/Testing (SQLite)
```bash
# Use SQLite for testing
DB_TYPE=sqlite npm start
DB_TYPE=sqlite node seed-users.js
```

## Test Users

The following test users are automatically seeded:

| Username | Password | Role | Email |
|----------|----------|------|-------|
| admin | admin123 | admin | admin@example.com |
| driver1 | driver123 | driver | driver1@example.com |
| customer1 | customer123 | customer | customer1@example.com |
| dispatcher1 | dispatch123 | dispatcher | dispatcher1@example.com |
| support1 | support123 | support | support1@example.com |

## API Endpoints

### Authentication

#### POST `/api/auth/login`
Login with username/email and password.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

### Protected Endpoints

All endpoints below require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### GET `/api/me`
Get current user information.

#### GET `/api/users` (Admin only)
Get all users in the system.

#### GET `/api/admin/test-jwt` (Admin only)
Test admin JWT authentication.

#### GET `/api/driver/test-jwt` (Driver/Admin only)
Test driver JWT authentication.

#### GET `/health`
Health check endpoint (no auth required).

## Testing JWT Flow

### 1. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. Use Token for Authenticated Requests
```bash
# Get current user info
curl -X GET http://localhost:3000/api/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test admin endpoint
curl -X GET http://localhost:3000/api/admin/test-jwt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Test Role-based Access
```bash
# Login as driver
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"driver1","password":"driver123"}'

# Test driver endpoint (should work)
curl -X GET http://localhost:3000/api/driver/test-jwt \
  -H "Authorization: Bearer DRIVER_JWT_TOKEN"

# Test admin endpoint (should fail - insufficient permissions)
curl -X GET http://localhost:3000/api/admin/test-jwt \
  -H "Authorization: Bearer DRIVER_JWT_TOKEN"
```

## Database Schema (PostgreSQL)

### USERS Table
```sql
CREATE TABLE USERS (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  firstName VARCHAR(50),
  lastName VARCHAR(50),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NOCODB_HOST` | NocoDB PostgreSQL host | `localhost` |
| `NOCODB_PORT` | NocoDB PostgreSQL port | `5432` |
| `NOCODB_DATABASE` | PostgreSQL database name | `nocodb` |
| `NOCODB_USERNAME` | PostgreSQL username | `postgres` |
| `NOCODB_PASSWORD` | PostgreSQL password | `password` |
| `DB_TYPE` | Database type (`postgres` or `sqlite`) | `postgres` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-super-secret-jwt-key-here` |
| `JWT_EXPIRY` | JWT token expiration | `7d` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### JWT Configuration Details

The JWT authentication system requires proper configuration for security:

#### JWT_SECRET
- **Minimum Length:** 32 characters (recommended: 64+ characters)
- **Production:** Use cryptographically random string
- **Development:** Use the example secret from `.env.example`

**Generate Secure Secret:**
```bash
# Node.js built-in crypto
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

#### JWT_EXPIRY
Token expiration time using [vercel/ms](https://github.com/vercel/ms) format:
- `60s` = 60 seconds
- `5m` = 5 minutes
- `2h` = 2 hours
- `7d` = 7 days (recommended)
- `30d` = 30 days

**Security Considerations:**
- Shorter expiry = More secure but more frequent logins
- Longer expiry = Better UX but higher risk if token is compromised
- Recommended: `7d` for development, `2h` with refresh tokens for production

#### Middleware Location
JWT middleware is in `middleware/authMiddleware.js` with three main functions:
- `authenticateToken`: Validates JWT tokens
- `requireRole`: Checks user roles
- `generateToken`: Creates new tokens

## Seeding Logic

### Auto-Seeding (on startup)
1. Check if USERS table exists in PostgreSQL
2. If not, create table and seed users
3. If exists but empty, seed users
4. If has data, skip seeding

### Manual Seeding
- **Normal mode**: Only seeds if table is empty
- **Force mode** (`--force`): Overwrites existing users

## Database Differences

### PostgreSQL (Production - NocoDB)
- Uses `$1, $2, $3` parameter placeholders
- `SERIAL PRIMARY KEY` for auto-increment
- `TIMESTAMP WITH TIME ZONE` for timestamps
- `BOOLEAN DEFAULT TRUE/FALSE` for booleans
- `ON CONFLICT` for upsert operations

### SQLite (Testing)
- Uses `?` parameter placeholders
- `INTEGER PRIMARY KEY` for auto-increment
- `DATETIME` for timestamps
- `BOOLEAN DEFAULT 1/0` for booleans
- `INSERT OR REPLACE` for upsert operations

## Error Handling

- Invalid credentials return 401
- Missing/invalid tokens return 401/403
- Insufficient permissions return 403
- Server errors return 500

## Security Features

- ✅ Passwords hashed with bcryptjs (10 rounds)
- ✅ JWT tokens with configurable expiration
- ✅ Role-based access control
- ✅ SQL injection protection (prepared statements)
- ✅ Input validation and sanitization

## Development

### Running Tests
```bash
# Install dependencies
npm install

# Start development server (PostgreSQL)
npm start

# Start development server (SQLite for testing)
DB_TYPE=sqlite npm start

# In another terminal, run tests
node test-jwt.js
```

### Adding New Users
Edit the `testUsers` array in `seed-users.js` to add more test users:

```javascript
const testUsers = [
  {
    username: 'newuser',
    password: 'password123',
    role: 'customer',
    email: 'newuser@example.com',
    firstName: 'New',
    lastName: 'User'
  }
  // ... more users
];
```

## PostgreSQL Connection Issues

### Common Solutions
1. **Check PostgreSQL service is running**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Verify connection credentials**
   ```bash
   psql -h localhost -U postgres -d nocodb
   ```

3. **Check firewall settings**
   ```bash
   sudo ufw status
   ```

4. **Verify NocoDB PostgreSQL configuration**
   - Ensure NocoDB is configured to use PostgreSQL
   - Check NocoDB database connection settings

## Troubleshooting

### Database Connection Issues
1. Check PostgreSQL is running and accessible
2. Verify database credentials in `.env`
3. Ensure `nocodb` database exists
4. Check network connectivity and firewall rules

### Seeding Issues
1. Check database write permissions
2. Verify USERS table can be created
3. Look for existing data conflicts

### JWT Issues
1. Verify JWT_SECRET is set in `.env`
2. Check token expiration settings
3. Ensure proper Bearer token format

## Next Steps

This setup provides a solid foundation for:
- JWT authentication testing with NocoDB
- Role-based authorization
- User management systems
- API testing and development

You can extend this by adding:
- Refresh tokens
- Password reset functionality
- User registration endpoints
- More granular permissions
- Rate limiting
- Request logging

## License

MIT License - feel free to use and modify for your projects.
