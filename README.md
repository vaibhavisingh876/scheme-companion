# Scheme Companion

Scheme Companion is an AI-powered web application that helps users discover Indian government welfare schemes based on their personal profile and natural-language requirements.

The application combines large language models, semantic search, eligibility filtering, and a PostgreSQL-backed scheme database to provide relevant and personalized scheme recommendations.

## Live Demo

https://scheme-companion.vercel.app/

For a custom frontend domain, add its origin to the backend's `CORS_ORIGINS`
environment variable as a comma-separated list (for example,
`https://app.example.com,https://staging.example.com`). The backend also allows
this project's Vercel preview deployments.

## Overview

Finding the right government scheme can be difficult because users often do not know the exact scheme name or the eligibility criteria they need to search for.

Scheme Companion allows users to describe their situation in natural language, for example:

> I am a student from Uttar Pradesh looking for scholarship schemes.

The system extracts relevant information from the user's message, retrieves candidates with semantic and PostgreSQL full-text search, fuses and reranks them, then verifies persisted per-scheme eligibility rules against the profile.

The application supports both English and Hinglish queries.

## Features

* Natural-language scheme discovery
* English and Hinglish profile extraction
* AI-powered personalized recommendations
* Semantic similarity search using text embeddings
* Eligibility-based filtering
* State, gender, education, income and caste filtering
* Occupation-aware recommendations
* Intent- and purpose-aware filtering for targeted requests
* Relevance thresholding
* Duplicate removal
* Scheme bookmarking for authenticated users
* PostgreSQL database with Prisma ORM
* MyScheme data ingestion and synchronization
* Automatic generation of missing scheme embeddings after synchronization
* Responsive React frontend

## How It Works

The recommendation flow can be summarized as:

```text
User query -> Groq profile extraction -> MiniLM query embedding
     |                                      |
     +------ PostgreSQL full-text search ---+
                        |
          RRF fusion (up to 200 candidates)
                        |
       Cross-encoder rerank (top 50 only)
                        |
        Intent / domain filters + dedupe
                        |
  GroqEligibilityRules (reuse, on-demand, queue)
                        |
     Deterministic match / no-match / unknown
                        |
      Eligibility-first ranking (up to 20)
```

## AI Recommendation Pipeline

### 1. Profile Extraction

The user can provide an unstructured query instead of manually filling a form.

For example:

```text
I am a 21 year old student from Delhi from an OBC family.
I want financial assistance for higher education.
```

The backend sends the natural-language input to a Groq-powered LLM which extracts structured information such as:

* Age
* Gender
* State
* Occupation
* Education level
* Income
* Caste category
* Primary intent

The extracted profile is then validated before being used by the recommendation system.

### 2. Query Construction

The structured profile and original user message are converted into a searchable text representation.

This allows the recommendation system to consider both explicit profile information and the user's original intent.

### 3. Hybrid Retrieval and Reranking

Scheme Companion uses the `Xenova/all-MiniLM-L6-v2` embedding model to convert query and scheme text into numerical vectors.

The system calculates cosine similarity between the user's query embedding and stored scheme embeddings. In parallel, PostgreSQL full-text search matches scheme names, eligibility text, descriptions, and benefits. Reciprocal Rank Fusion combines both ranked lists without comparing their raw scores.

This allows semantically related schemes to be discovered even when the user does not use the exact terminology present in the scheme data.

The fused candidate pool is reranked with the local `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder. It loads on first use and runs through the Transformers.js dependency already used for embeddings. Only the top 50 fused candidates are reranked; the remaining RRF tail is dropped rather than appended, so weakly relevant schemes cannot re-enter the shortlist. Set `RERANKER_ENABLED=false` to disable it or `RERANKER_MODEL` to select another compatible model. If model loading fails, recommendations fall back to the RRF ranking.

### 4. Eligibility Filtering

Semantic similarity alone is not enough because a scheme may be highly relevant but still unavailable to a particular user.

The system therefore applies eligibility rules based on available scheme information, including:

* Age
* Income
* Gender
* Education
* Caste category
* State

Structured catalogue checks remove clear conflicts. Detailed rules are extracted by Groq from each scheme's raw eligibility text and persisted in the `GroqEligibilityRules` table (one row per scheme, keyed by a hash of that text). Rows are created only when Groq is actually called; bulk normalization never populates the table.

The request path reuses persisted rules whose source hash still matches. A bounded synchronous extraction warms up to five missing schemes, and the remainder join a paced background queue, so repeated requests and repeated users do not trigger repeat Groq calls. Validation happens before persistence; extraction failures are recorded as attempts and eventually stop retrying.

Tuning knobs: `ELIGIBILITY_ON_DEMAND=false` disables synchronous extraction, `ELIGIBILITY_ON_DEMAND_BATCH` (default 5), `ELIGIBILITY_ON_DEMAND_TIMEOUT_MS` (8000), `ELIGIBILITY_MIN_INTERVAL_MS` (20000, background pacing), `ELIGIBILITY_RETRY_COOLDOWN_MS` (1800000, retry window after exhausted failures), and `GROQ_ELIGIBILITY_MODEL` (defaults to `openai/gpt-oss-120b`).

Ingestion invalidates only the rule rows whose eligibility text changed. Description, image, and other unrelated updates keep the rules. Deleting a scheme cascades to its rules through the foreign key.

Verification is deterministic. A scheme is labeled `match` only when a stated rule is confirmed; missing, ambiguous, or non-machine-checkable criteria produce `unknown` and are never treated as confirmed eligibility. Confirmed conflicts produce `no_match` and are excluded.

### 5. Eligibility-First Ranking

There is no composite scoring formula. Final order is:

```text
1. Exclude no_match
2. Confirmed match before unknown
3. Within each status group, cross-encoder score decides
4. Fall back to RRF order when the reranker is unavailable
```

The UI relevance percentage is display-only: it maps the cross-encoder logit through a sigmoid, or normalizes the RRF score when reranking is inactive.

### 6. Result Quality Controls

Before returning recommendations, the system also performs:

* Intent and domain filtering (study abroad, widow support, medical/cancer, loans, startup, etc.)
* Duplicate removal
* Eligibility-first ranking

The system returns up to 20 recommendations, or fewer when the shortlist is smaller.

## Data Source and Ingestion

Scheme data is collected from the MyScheme data source.

The backend contains an ingestion pipeline that:

1. Fetches scheme listings and detailed records
2. Retrieves detailed scheme information
3. Normalizes the data
4. Stores schemes in PostgreSQL
5. Tracks source metadata and synchronization state
6. Updates existing schemes when their source data changes
7. Generates embeddings for schemes that are missing them

A scheduled synchronization job runs periodically to keep the database updated.

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* React Router
* Axios
* Lucide React

### Backend

* Node.js
* Express.js
* Prisma
* PostgreSQL

### AI and Machine Learning

* Groq API
* `openai/gpt-oss-120b`
* `Xenova/all-MiniLM-L6-v2` embeddings (384 dimensions)
* `Xenova/ms-marco-MiniLM-L-6-v2` local cross-encoder reranking
* PostgreSQL full-text search and Reciprocal Rank Fusion
* Cosine similarity with separate eligibility verification
* Persisted per-scheme Groq eligibility rules (`GroqEligibilityRules`) with source-hash invalidation

### Authentication

* JWT-based authentication
* bcrypt password hashing

### Data and Background Processing

* MyScheme data source
* Prisma ORM
* node-cron

## Project Structure

```text
scheme-companion/
|
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── context/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   │   └── ai/
│   │   ├── validators/
│   │   ├── ingestion/
│   │   └── index.js
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── package.json
│
└── README.md
```

## Backend Architecture

The backend follows a layered architecture:

```text
Routes
  |
  v
Controllers
  |
  v
Services
  |
  +---- AI Services
  |
  +---- Filtering
  |
  +---- Ranking
  |
  +---- Database
  |
  v
Prisma / PostgreSQL
```

Routes handle incoming requests, controllers coordinate application logic, and services contain the recommendation, filtering, AI, and ingestion logic.

## API Endpoints

### Schemes

| Method | Endpoint              | Description                  |
| ------ | --------------------- | ---------------------------- |
| GET    | `/api/schemes`        | Fetch schemes                |
| POST   | `/api/schemes/search` | Search schemes using filters |

### AI

| Method | Endpoint                  | Description                                              |
| ------ | ------------------------- | -------------------------------------------------------- |
| POST   | `/api/ai/extract-profile` | Extract a structured profile from natural-language input |

### Authentication

| Method | Endpoint             | Description                   |
| ------ | -------------------- | ----------------------------- |
| POST   | `/api/auth/register` | Register a new user           |
| POST   | `/api/auth/login`    | Authenticate an existing user |

### Bookmarks

| Method | Endpoint                   | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| GET    | `/api/bookmarks`           | Get the authenticated user's bookmarks |
| POST   | `/api/bookmarks`           | Save a scheme                          |
| DELETE | `/api/bookmarks/:schemeId` | Remove a saved scheme                  |

## Database

The application uses PostgreSQL with Prisma ORM.

The database contains models for core application entities such as:

* Users
* Schemes
* Bookmarks
* Scheme sources
* Raw scheme data
* Synchronization jobs

Scheme records contain structured eligibility information as well as searchable text and embeddings used by the recommendation system.

Bookmarks use a user-scheme relationship so that authenticated users can save and manage schemes.

## Authentication and Security

The application uses JWT-based authentication for protected operations.

Authentication flow:

```text
Register / Login
      |
      v
JWT Token
      |
      v
Client Storage
      |
      v
Authorization Header
      |
      v
JWT Verification Middleware
      |
      v
Protected Routes
```

Passwords are hashed before being stored.

Protected bookmark routes require a valid authentication token.

The backend also validates AI-extracted profile data before using it in the recommendation pipeline.

## Environment Variables

### Server

Create a `.env` file inside the `server` directory.

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
MYSCHEME_API_KEY=your_myscheme_api_key
PORT=5000
ENABLE_CRON=false
NODE_ENV=development
```

### Client

Create a `.env` file inside the `client` directory.

```env
VITE_API_URL=http://localhost:5000/api
```

Do not commit real API keys, database credentials, or JWT secrets to the repository.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/vaibhavisingh876/scheme-companion.git
cd scheme-companion
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

```bash
cd ../server
npm install
```

### 4. Configure environment variables

Create the required `.env` files in `client` and `server`.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Apply the database schema

```bash
npx prisma migrate deploy
npm run setup:hybrid
```

### 7. Start the backend

```bash
npm run dev
```

### 8. Start the frontend

Open another terminal:

```bash
cd client
npm run dev
```

The frontend will be available through the Vite development server.

## Useful Commands

### Frontend

```bash
cd client

npm install
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend

```bash
cd server

npm install
npm run dev
npm start
npx prisma generate
npx prisma migrate deploy
npm run setup:hybrid
npm run warm:eligibility -- 100
npm test
```

`npm start` applies reviewed Prisma migrations, then runs `setup:hybrid` to ensure the weighted PostgreSQL GIN full-text index before starting the server. The `GroqEligibilityRules` table is created by the Prisma migrations, not by the setup script. Eligibility warming makes Groq extraction calls, so run it deliberately and use a limit when evaluating; it fills the table opportunistically and never during bulk normalization.

`npm test` runs the backend unit suite with the Node.js test runner. It uses fake database and LLM adapters, so it does not need a live PostgreSQL instance or a Groq API key.

## Background Synchronization

The backend contains a scheduled MyScheme synchronization job.

The synchronization process is designed to periodically update scheme information and maintain the local database.

The cron configuration runs the synchronization every six hours when enabled.

For local development, cron execution can be disabled through the environment configuration.

## Design Goals

Scheme Companion is designed around three main principles:

### Accessibility

Users should not need to know the exact name of a government scheme to find relevant assistance.

### Personalization

Recommendations should consider the user's individual circumstances rather than relying only on keyword matching.

### Reliability

AI-generated information is combined with structured eligibility rules and database-backed scheme information to reduce irrelevant recommendations.

## Future Improvements

Potential future improvements include:

* Improved multilingual support
* More detailed eligibility explanations
* Better recommendation feedback loops
* Additional government data sources
* Improved scheme freshness monitoring
* Advanced recommendation personalization
* Integration tests against a live database and Groq API
* Improved observability for ingestion and recommendation pipelines

## Deployment

The frontend is deployed using Vercel.

The backend can be deployed separately as a Node.js service with a PostgreSQL database.

Production deployments require the appropriate environment variables and database configuration.

## License

This project is developed as a personal/academic software project.

## Author

Vaibhavi Singh


