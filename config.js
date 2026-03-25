// config.js
const envBaseUrl =
	(typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) ||
	(typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE_URL) ||
	'';

const baseUrl = envBaseUrl.endsWith('/') ? envBaseUrl.slice(0, -1) : envBaseUrl;

export const API_URL = `${baseUrl}/api/rates`;
export const CONVERT_URL = `${baseUrl}/api/convert`;
export const HISTORY_URL = `${baseUrl}/api/history`;
export const AUTH_LOGIN_URL = `${baseUrl}/api/auth/login`;
export const AUTH_VERIFY_URL = `${baseUrl}/api/auth/verify`;
export const STORAGE_KEY = 'currencyFavorites';
export const AUTH_TOKEN_KEY = 'currencyAuthToken';