# Movie Review Application — Database Documentation

## 1. Overview

The movie review application uses MongoDB as its database and Mongoose as its Object Document Mapper (ODM).

The database stores user accounts and their associated movie reviews. Both the React web application and the iOS application access the same database through a shared Node.js and Express backend API.

**Technology Stack:**
- Database: MongoDB 7.0
- ODM: Mongoose
- Backend: Node.js and Express
- Local Development: Docker Compose
- Automated Testing: Vitest and mongodb-memory-server
- Production Database (Planned): MongoDB Atlas

**Database Name:** `MovieReviewsDB`

## 2. Database Collections

The application currently uses two MongoDB collections: `users` and `reviews`.

### Users Collection

**Model:** `models/User.js`

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | Automatically generated |
| `login` | String | Required, unique, 3–30 characters |
| `password` | String | Required, bcrypt-hashed, excluded from default queries |
| `firstName` | String | Optional, maximum 50 characters |
| `lastName` | String | Optional, maximum 50 characters |
| `role` | String | `user` or `admin`, defaults to `user` |
| `createdAt` | Date | Automatically generated |
| `updatedAt` | Date | Automatically updated |

**Security Features:**
- Passwords are hashed using bcrypt with 10 salt rounds before saving.
- Password fields are excluded from standard queries using `select: false`.
- Password hashes are removed when user documents are serialized to JSON.
- Usernames must be unique.
- The model provides a `checkPassword()` method for login verification.

### Reviews Collection

**Model:** `models/Review.js`

| Field | Type | Constraints |
|---|---|---|
| `_id` | ObjectId | Automatically generated |
| `userId` | ObjectId | Required, references User |
| `movieTitle` | String | Required, maximum 200 characters |
| `rating` | Number | Required, 0–5 in increments of 0.5 |
| `description` | String | Required, maximum 5,000 characters |
| `type` | String | `movie` or `show`, defaults to `movie` |
| `year` | Number | Optional, 1870–2100 |
| `watchedOn` | Date | Optional |
| `createdAt` | Date | Automatically generated |
| `updatedAt` | Date | Automatically updated |

**Validation Rules:**
- Movie titles and descriptions cannot be empty.
- Ratings must fall between 0 and 5.
- Ratings must use half-star increments.
- Every review must contain a valid ObjectId in its `userId` field.
- Timestamps are handled automatically by Mongoose.

## 3. Database Relationships

The database implements a one-to-many relationship between users and reviews.

- One user can create multiple reviews.
- Each review belongs to one user.
- Each review stores its author's ObjectId in `userId`.
- The `userId` field references the `User` Mongoose model.

Example query to retrieve a user's reviews:

```javascript
const reviews = await Review.find({
  userId: userId
}).sort({ createdAt: -1 });
```

A compound index on `{ userId: 1, createdAt: -1 }` supports efficient retrieval of reviews belonging to a particular user in chronological order.

**Important:** Mongoose references do not automatically enforce foreign-key constraints. The backend must validate authorization and ensure that reviews are associated with legitimate users.

## 4. Local Database Setup

### Prerequisites

- Node.js and npm
- Docker Desktop with Docker Compose
- WSL2 for Windows development

### Environment Configuration

The application uses `MONGODB_URI` to establish its database connection.

The local Docker connection string is:

```text
mongodb://mongodb:27017/MovieReviewsDB
```

The hostname `mongodb` refers to the Docker Compose MongoDB service.

The connection string for tools running directly on the host is:

```text
mongodb://localhost:27017/MovieReviewsDB
```

The database URI and other environment-specific settings should be configured through environment variables.

### Starting the Database

From the backend repository root:

```bash
docker compose up --build -V -d
```

Verify the containers:

```bash
docker compose ps
```

Connect to MongoDB:

```bash
docker compose exec mongodb mongosh MovieReviewsDB
```

The Docker configuration uses a persistent named volume to preserve database records across normal container restarts.

**Warning:** Running `docker compose down -v` deletes the database volume and its contents.

## 5. Database Seeding

**File:** `seed.js`

The seed script populates the local database with three sample accounts and nine movie reviews.

| Username | Number of Reviews |
|---|---|
| john | 3 |
| jane | 3 |
| alex | 3 |

Each sample review is associated with its respective user through the `userId` field.

### Running the Seed Script

```bash
docker compose exec api npm run seed
```

The script:
1. Connects to MongoDB.
2. Checks whether each sample user already exists.
3. Creates missing users.
4. Checks whether each sample review already exists for that user and movie title.
5. Inserts missing reviews.
6. Disconnects from MongoDB.

Repeated sequential executions should not duplicate the sample users or their seed reviews.

**Important:** The seed data contains known development credentials and should not be inserted into a production database containing real user accounts.

### Verifying Seed Data

```javascript
db.users.countDocuments()
db.reviews.countDocuments()
```

For a freshly initialized and seeded database, the expected counts are three users and nine reviews.

## 6. Automated Database Testing

**File:** `tests/database.test.mjs`

The database test suite uses Vitest and `mongodb-memory-server`.

It runs against a temporary MongoDB instance rather than the development database.

### Running Tests

```bash
npm test
```

To run tests continuously:

```bash
npm run test:watch
```

### User Model Tests

Seven tests cover:
- User creation
- Duplicate username rejection
- Required username validation
- Minimum username length
- Password hashing and verification
- Password exclusion from default queries
- Password exclusion from JSON serialization

### Review Model Tests

Twelve tests cover:
- Review creation
- Required movie title
- Required description
- Maximum rating validation
- Minimum rating validation
- Valid half-star ratings
- Invalid rating increments
- Required userId
- User-specific review retrieval
- Review updates
- Review deletion
- Automatic timestamps

**Expected Result:** 19 passing tests.

The test environment creates and destroys a temporary MongoDB instance, keeping local development records isolated.

## 7. Backend API Integration

The backend should import database models using:

```javascript
const { User, Review } = require('./models');
```

### Proposed API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/users` | Register a new user |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/reviews` | Retrieve the authenticated user's reviews |
| POST | `/api/reviews` | Create a review |
| GET | `/api/reviews/:id` | Retrieve an individual review |
| PATCH | `/api/reviews/:id` | Update an existing review |
| DELETE | `/api/reviews/:id` | Delete a review |

The review endpoints are implemented in `routes/reviews.js`.

### Authentication

`POST /api/auth/login` returns the user record plus a signed `token`. Send it
on every review request as `Authorization: Bearer <token>`. Review endpoints
return `401` without a valid token, take the author from the token, and answer
`404` for reviews owned by someone else. Set `JWT_SECRET` in the environment
(required when `NODE_ENV=production`).

### Review Creation Request

```json
{
  "movieTitle": "Interstellar",
  "rating": 4.5,
  "description": "An incredible science fiction movie."
}
```

The backend must obtain the review author's `userId` from the authenticated request rather than accepting it directly from the client.

### Review Retrieval

To retrieve all reviews belonging to the authenticated user:

```javascript
const reviews = await Review.find({
  userId: req.userId
}).sort({ createdAt: -1 });
```

### Review Updates and Deletion

The backend must verify review ownership before allowing modification or deletion.

A valid authentication token alone does not authorize a user to modify arbitrary reviews.

The API should also restrict which fields clients may modify. In particular, clients should not be allowed to change a review's `userId`.

## 8. Security Considerations

- Never commit `.env` files or database credentials.
- Store user passwords as bcrypt hashes.
- Restrict MongoDB access to trusted services.
- Validate incoming review data using Mongoose.
- Authenticate protected API requests using JWT middleware.
- Enforce review ownership in controllers.
- Reject unauthorized access to another user's reviews.
- Avoid exposing password hashes in API responses.
- Use HTTPS for deployed API communication.

Database model validation does not replace API authentication or authorization.

## 9. Production Deployment

Production deployment will use MongoDB Atlas.

Planned deployment tasks include:

1. Creating a MongoDB Atlas cluster.
2. Configuring a dedicated application database user.
3. Restricting network access to the backend server.
4. Setting a secure production `MONGODB_URI`.
5. Verifying connectivity from the deployed Express API.
6. Testing production database operations.
7. Establishing an appropriate backup and recovery procedure.

The web and iOS applications will communicate with the same deployed Express API rather than connecting directly to MongoDB.

## 10. Future Database Improvements

Potential improvements beyond the MVP include:

- Introducing a `movies` collection with stable movie identifiers.
- Integrating movie metadata from TMDB.
- Adding average movie ratings.
- Implementing pagination for large review histories.
- Supporting repeat viewings and review history.
- Defining account deletion and related review cleanup behavior.
- Adding additional indexes as application query patterns evolve.

## 11. Current Implementation Status

**Completed:**
- Local MongoDB configuration
- Mongoose User and Review models
- One-to-many user-review relationship
- Database validation
- Password hashing
- Database seed script
- Nineteen automated model tests

**Pending:**
- Official backend repository integration
- Authentication and review API integration
- API-level security and integration testing
- MongoDB Atlas production deployment
