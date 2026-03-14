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

2. **Start the backend server:**
   ```bash
   npm start
   ```
   Server runs on http://localhost:3000

3. **Open the frontend:**
   Open http://localhost:3000 in your browser (served by the backend)

### Development
For development with auto-restart:
```bash
npm run dev
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

## Browser Support

Works in all modern browsers that support ES6 modules and Fetch API.

## External API

Uses the free ExchangeRate API: https://api.exchangerate-api.com/

- No API key required for basic usage
- Rates are quoted against USD
- Updates approximately every hour
- Supports 160+ currencies