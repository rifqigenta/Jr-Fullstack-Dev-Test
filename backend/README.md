# JMC Kepegawaian Management System

A fullstack employee management application developed as part of the JMC Junior Fullstack JavaScript technical test.

## Overview

This project provides backend APIs for employee management, authentication, role-based access control, dashboard information, and transportation allowance calculations.

The backend is developed using Express.js, TypeScript, and MariaDB. API documentation is available through Swagger/OpenAPI.

**Project status:** Backend implementation and automated testing completed. Frontend integration and production deployment should be verified separately.

## Technology Stack

### Backend

- Node.js
- Express.js
- TypeScript
- MariaDB
- JWT authentication and HTTP-only cookies
- Role-Based Access Control (RBAC)
- Cloudflare Turnstile
- CSRF protection
- Swagger / OpenAPI
- Vitest and Supertest
- Docker

### Frontend

- Nuxt.js (integration planned)

## Main Features

- Authentication and session management
- User and role management
- Employee management
- Employee photo handling
- Employee data export
- Dashboard and supporting APIs
- Activity logging
- Transportation allowance settings
- Monthly attendance management
- Transportation allowance calculations
- API documentation
- Security middleware and automated tests

## Project Structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── docs/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   └── package.json
└── README.md
```

The directory structure may change as the frontend implementation progresses.

## Prerequisites

- Node.js compatible with the project's dependencies
- npm
- MariaDB
- Docker (optional)
- Cloudflare Turnstile credentials

## Local Setup

### 1. Clone the repository

```bash
git clone <REPOSITORY_URL>
cd <REPOSITORY_NAME>/backend
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and update the values according to your local environment.

Do not commit `.env` to version control.

### 4. Prepare the database

Create the MariaDB database and apply the SQL schema or migrations provided with the project.

Ensure required master data, roles, and permissions are initialized.

### 5. Start development server

```bash
npm run dev
```

The backend port is configured using the `PORT` environment variable.

## API Documentation

When the backend is running, Swagger UI is available at:

```text
http://localhost:3001/api/docs/
```

OpenAPI JSON:

```text
http://localhost:3001/api/docs/openapi.json
```

Adjust the host and port according to the environment.

## Authentication and Security

The application implements:

- JWT-based authentication
- HTTP-only session cookies
- Role-based permissions
- CSRF token validation
- Cloudflare Turnstile CAPTCHA
- CORS origin restrictions
- Login rate limiting
- Request validation

For authenticated mutation requests, clients must follow the CSRF token flow implemented by the backend.

## Testing

Run TypeScript validation:

```bash
npm run typecheck
```

Build the application:

```bash
npm run build
```

Run automated tests:

```bash
npm test
```

Generate test coverage:

```bash
npm run test:coverage
```

The backend automated test suite contains 24 tests covering health endpoints, OpenAPI documentation, authentication security, and transportation calculation rules.

## Production Build

```bash
npm ci
npm run build
npm run start
```

Make sure the `start` script matches the compiled server entry point.

## Docker

Build the backend image:

```bash
docker build -t jmc-backend ./backend
```

Run the container with the required environment variables:

```bash
docker run --rm -p 3001:3001 --env-file ./backend/.env jmc-backend
```

Database hostnames and network configuration must be adjusted when running inside Docker.

## Deployment Notes

- Use a production MariaDB database.
- Store secrets in hosting environment variables.
- Use HTTPS.
- Configure the correct frontend origin.
- Use production Cloudflare Turnstile credentials.
- Disable Turnstile test mode in production.
- Use persistent storage for uploaded files if applicable.
- Apply database migrations before serving traffic.
- Verify health checks and authentication after deployment.

## Project Scope

This repository is developed for a technical assessment. The implementation is intended to demonstrate backend architecture, REST API design, database integration, authorization, security practices, documentation, and testing.

## License

This project was created for technical assessment purposes.
