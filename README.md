# Global Finance Corp - Online Currency Converter

A professional web-based currency converter application built for Global Finance Corp, featuring real-time exchange rates, favorites, and a clean corporate UI with backend API.

## Features

- Real-time currency conversion using custom backend API
- Swap currencies with one click
- Display current exchange rates with last update time
- Add and manage favorite currency pairs
- Responsive design suitable for desktop and mobile
- Modular JavaScript architecture for maintainability
- Backend caching for improved performance
- Environment-driven API base URL configuration
- API abuse protection with rate limiting
- Schema-based request validation with clear error messages
- Jest unit tests for frontend conversion logic
- Supertest integration tests for backend endpoints
- Sentry runtime error tracking support
- Pino structured logging

## Architecture

### Frontend
- Built with vanilla HTML, CSS, and JavaScript (ES6 Modules)
- Modular code structure for maintainability
- Local storage for favorites
- Responsive design

### Backend
- Node.js with Express.js
- Caching layer (10-minute cache duration)
- CORS enabled for frontend communication
- RESTful API endpoints
- Error handling and fallback mechanisms
- dotenv-based environment variable loading
- express-rate-limit for API protection
- Zod validation for robust query parsing
- Sentry error telemetry support
- Pino structured application logs

## API Endpoints

### GET /api/rates
Returns the latest exchange rates from the external API.

**Response:**
```json
{
  "base": "USD",
  "date": "2026-03-14",
  "rates": {
    "EUR": 0.85,
    "GBP": 0.73,
    // ... more currencies
  }
}
```

### GET /api/convert?amount=100&from=USD&to=EUR
Converts a specific amount between currencies.

**Response:**
```json
{
  "amount": 100,
  "from": "USD",
  "to": "EUR",
  "result": 85,
  "rate": 0.85,
  "timestamp": "2026-03-14T12:00:00.000Z"
}
```

### GET /api/health
Health check endpoint with cache status.

## How Real-Time Data Works

1. **External API**: The backend fetches data from exchangerate-api.com, which provides exchange rates against USD as the base currency.

2. **Caching**: To optimize performance and reduce external API calls, the backend caches rates for 10 minutes. This ensures:
   - Faster response times for users
   - Reduced load on the external API
   - Cost savings (if using a paid API tier)

3. **Data Flow**:
   - Frontend requests rates from `/api/rates`
   - Backend checks cache; if expired, fetches from external API
   - Rates are stored in memory and served to frontend
   - Conversion calculations happen on the backend for accuracy

4. **Real-Time Updates**: While not truly "real-time" (rates update every few hours), the app fetches fresh data on load and caches it appropriately.

## Usage

### Running the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   copy .env.example .env
   ```
   Then edit `.env` and provide a valid `EXCHANGE_RATE_API_KEY`.

3. **Start the backend server:**
   ```bash
   npm start
   ```
   Server runs on http://localhost:3000

4. **Open the frontend:**
   Open http://localhost:3000 in your browser (served by the backend)

### Development
For development with auto-restart:
```bash
npm run dev
```

### Testing
Run all unit and integration tests:
```bash
npm test
```

## Project Structure

- `index.html`: Main HTML structure with corporate branding
- `style.css`: Professional styling with header and footer
- `config.js`: Configuration constants
- `api.js`: Frontend API interaction
- `ui.js`: User interface update functions
- `main.js`: Main application logic and event handlers
- `server.js`: Node.js Express backend server
- `package.json`: Node.js dependencies and scripts
- `README.md`: This documentation

## Technologies

### Frontend
- HTML5
- CSS3
- JavaScript (ES6 Modules)
- Local Storage API

### Backend
- Node.js
- Express.js
- node-fetch for HTTP requests
- CORS for cross-origin requests
- dotenv for environment variable management
- express-rate-limit for request throttling
- Zod for schema validation
- Jest and Supertest for automated testing
- Sentry for runtime error monitoring
- Pino for structured JSON logging

## Browser Support

Works in all modern browsers that support ES6 modules and Fetch API.

## External API

Uses ExchangeRate API (v6): https://www.exchangerate-api.com/

- API key required (provided via `EXCHANGE_RATE_API_KEY` in `.env`)
- Rates are quoted against USD
- Updates approximately every hour
- Supports 160+ currencies

## Environment Variables

- `API_BASE_URL`: Base URL used by the frontend for backend API calls (for example `http://localhost:3000`)
- `EXCHANGE_RATE_API_KEY`: API key used by the backend to fetch exchange rates
- `PORT`: Port used by Express server (defaults to 3000)
- `SENTRY_DSN`: Optional DSN to enable Sentry error reporting
- `SENTRY_TRACES_SAMPLE_RATE`: Trace sampling ratio for Sentry performance telemetry
- `LOG_LEVEL`: Pino log level (for example `info`, `warn`, `error`, `debug`)