# Scaling Journey - JWT Authentication with NocoDB

A complete JWT authentication system with automatic user seeding for testing purposes.

## Features

- ✅ **Automatic User Seeding**: Seeds test users on first startup
- ✅ **Manual Seeding**: Run seed script independently with `npm run seed`
- ✅ **JWT Authentication**: Complete login/logout functionality
- ✅ **Role-based Authorization**: Admin, driver, customer, dispatcher, support roles
- ✅ **Password Hashing**: Secure bcryptjs hashing
- ✅ **Database Auto-migration**: Creates USERS table if missing
- ✅ **Force Override**: Use `--force` flag to overwrite existing users

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file with your NocoDB configuration:
```env
NOCODB_HOST=localhost
NOCODB_PORT=8080
NOCODB_DATABASE=scaling_journey
NOCODB_USERNAME=root
NOCODB_PASSWORD=password
JWT_SECRET=your-super-secret-jwt-key-here
PORT=3000
```

### 3. Start the Server
```bash
npm start
```

The server will automatically:
1. Connect to NocoDB
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

## Database Schema

### USERS Table
```sql
CREATE TABLE USERS (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  firstName VARCHAR(50),
  lastName VARCHAR(50),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NOCODB_HOST` | NocoDB host | `localhost` |
| `NOCODB_PORT` | NocoDB port | `8080` |
| `NOCODB_DATABASE` | Database name | `scaling_journey` |
| `NOCODB_USERNAME` | Database username | `root` |
| `NOCODB_PASSWORD` | Database password | `password` |
| `JWT_SECRET` | Secret key for JWT signing | `your-super-secret-jwt-key-here` |
| `JWT_EXPIRES_IN` | JWT token expiration | `24h` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## Seeding Logic

### Auto-Seeding (on startup)
1. Check if USERS table exists
2. If not, create table and seed users
3. If exists but empty, seed users
4. If has data, skip seeding

### Manual Seeding
- **Normal mode**: Only seeds if table is empty
- **Force mode** (`--force`): Overwrites existing users

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

# Start development server
npm start

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

## Troubleshooting

### Database Connection Issues
1. Check NocoDB is running
2. Verify database credentials in `.env`
3. Ensure database exists

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
- JWT authentication testing
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
