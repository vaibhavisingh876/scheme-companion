# Scheme Companion

Scheme Companion is an AI-powered web application that helps users discover Indian government welfare schemes based on their personal profile and natural-language requirements.

The application combines large language models, semantic search, eligibility filtering, and a PostgreSQL-backed scheme database to provide relevant and personalized scheme recommendations.

## Live Demo

https://scheme-companion.vercel.app/

## Overview

Finding the right government scheme can be difficult because users often do not know the exact scheme name or the eligibility criteria they need to search for.

Scheme Companion allows users to describe their situation in natural language, for example:

> I am a student from Uttar Pradesh looking for scholarship schemes.

The system extracts relevant information from the user's message, searches the scheme database using semantic similarity, applies eligibility rules, and returns a ranked list of relevant schemes.

The application supports both English and Hinglish queries.

## Features

* Natural-language scheme discovery
* English and Hinglish profile extraction
* AI-powered personalized recommendations
* Semantic similarity search using text embeddings
* Eligibility-based filtering
* State, gender, education, income and caste filtering
* Occupation-aware recommendations
* Relevance thresholding
* Duplicate removal
* Category diversification
* Scheme bookmarking for authenticated users
* PostgreSQL database with Prisma ORM
* Automatic scheme data synchronization
* Responsive React frontend

## How It Works

The recommendation flow can be summarized as:

```text
User Query
    |
    v
Natural Language Profile Extraction
    |
    v
Zod Validation
    |
    v
Query Text Construction
    |
    v
MiniLM Embedding
    |
    v
Candidate Schemes from PostgreSQL
    |
    v
Cosine Similarity
    |
    v
Eligibility Filtering
    |
    v
Hybrid Scoring
    |
    v
Deduplication and Diversification
    |
    v
Ranked Recommendations
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

### 3. Semantic Search

Scheme Companion uses the `Xenova/all-MiniLM-L6-v2` embedding model to convert query and scheme text into numerical vectors.

The system calculates cosine similarity between the user's query embedding and scheme embeddings.

This allows semantically related schemes to be discovered even when the user does not use the exact terminology present in the scheme data.

### 4. Eligibility Filtering

Semantic similarity alone is not enough because a scheme may be highly relevant but still unavailable to a particular user.

The system therefore applies eligibility rules based on available scheme information, including:

* Age
* Income
* Gender
* Education
* Caste category
* State

These checks help remove schemes that clearly do not satisfy important eligibility requirements.

### 5. Hybrid Scoring

The final recommendation score combines semantic relevance with rule-based relevance.

```text
Final Score =
    80% Semantic Similarity
    +
    20% Rule-Based Relevance
```

This balances the user's intent with structured eligibility information.

### 6. Result Quality Controls

Before returning recommendations, the system also performs:

* Relevance thresholding
* Duplicate removal
* Category diversification
* Result ranking

The system returns up to 20 recommendations.

## Data Source and Ingestion

Scheme data is collected from the MyScheme data source.

The backend contains an ingestion pipeline that:

1. Fetches scheme data
2. Retrieves detailed scheme information
3. Normalizes the data
4. Stores schemes in PostgreSQL
5. Generates searchable text
6. Maintains source and synchronization information
7. Updates existing schemes when their source data changes

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
* `Xenova/all-MiniLM-L6-v2`
* Transformers.js
* Cosine similarity

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
  +---- Scoring
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
npx prisma db push
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
npx prisma db push
```

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
* More comprehensive automated testing
* Improved observability for ingestion and recommendation pipelines

## Deployment

The frontend is deployed using Vercel.

The backend can be deployed separately as a Node.js service with a PostgreSQL database.

Production deployments require the appropriate environment variables and database configuration.

## License

This project is developed as a personal/academic software project.

## Author

Vaibhavi Singh


