function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function setQuoteLoading(isLoading) {
  const btn = document.getElementById("new-quote-btn");
  const status = document.getElementById("quote-status");
  if (isLoading) {
	btn.disabled = true;
	status.innerHTML = `
	  <span class="loading-pulse">
		Loading quote
		<span class="dot"></span><span class="dot"></span><span class="dot"></span>
	  </span>`;
  } else {
	btn.disabled = false;
	status.textContent = "";
  }
}

function mapWeatherCodeToInfo(code) {
  // Based on Open-Meteo weather codes
  // https://open-meteo.com/en/docs
  if (code === 0) return { icon: "☀️", desc: "clear sky" };
  if ([1,2].includes(code)) return { icon: "🌤️", desc: "mainly clear" };
  if (code === 3) return { icon: "☁️", desc: "overcast" };
  if ([45,48].includes(code)) return { icon: "🌫️", desc: "foggy" };
  if ([51,53,55].includes(code)) return { icon: "🌦️", desc: "drizzle" };
  if ([56,57].includes(code)) return { icon: "🌧️", desc: "freezing drizzle" };
  if ([61,63,65].includes(code)) return { icon: "🌧️", desc: "rain" };
  if ([66,67].includes(code)) return { icon: "🌧️", desc: "freezing rain" };
  if ([71,73,75,77].includes(code)) return { icon: "❄️", desc: "snow" };
  if ([80,81,82].includes(code)) return { icon: "🌧️", desc: "rain showers" };
  if ([95].includes(code)) return { icon: "⛈️", desc: "thunderstorm" };
  if ([96,99].includes(code)) return { icon: "⛈️", desc: "thunderstorm with hail" };
  return { icon: "🌡️", desc: "unknown" };
}

// -----------------------
// Quote logic
// -----------------------
async function fetchQuote() {
  setQuoteLoading(true);
  const quoteTextEl = document.getElementById("quote-text");
  const quoteAuthorEl = document.getElementById("quote-author");
  const quoteSourceEl = document.getElementById("quote-source");
  const quoteTimeEl = document.getElementById("quote-time");
  const statusEl = document.getElementById("quote-status");

  try {
    // Use ZenQuotes random quotes endpoint
    const res = await fetch("https://project2-worker.littlesheepdesign.workers.dev/quote");
    if (!res.ok) throw new Error("Quote API error");

    const data = await res.json();

    // The API returns an array of quote objects
    // We'll just take the first one
    const quoteObj = Array.isArray(data) && data.length > 0 ? data[0] : data;

    quoteTextEl.textContent = quoteObj.q || "No quote text found.";
    quoteAuthorEl.textContent = quoteObj.a ? `— ${quoteObj.a}` : "— Unknown";
    quoteTimeEl.textContent = `Updated at ${formatTime()}`;
    statusEl.classList.remove("error");
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    quoteTextEl.textContent = "Could not load a quote right now.";
    quoteAuthorEl.textContent = "— Please try again.";
    statusEl.classList.add("error");
    statusEl.textContent =
      "Error fetching quote. It might be a network or API issue.";
  } finally {
    setQuoteLoading(false);
  }
}

// -----------------------
// Weather logic
// -----------------------



async function fetchWeatherForCoords(lat, lon) {
  const statusEl = document.getElementById("weather-status");
  const tempEl = document.getElementById("temp");
  const descEl = document.getElementById("weather-desc");
  const iconEl = document.getElementById("weather-icon");
  const locationEl = document.getElementById("weather-location").querySelector("span");
  const feelsLikeEl = document.getElementById("feels-like-pill");
  const windEl = document.getElementById("wind-pill");
  const humidityEl = document.getElementById("humidity-pill");

  statusEl.innerHTML = `
	<span class="loading-pulse">
	  Fetching current weather
	  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
	</span>
  `;
  statusEl.classList.remove("error", "success");

  try {
	// Free Open‑Meteo API (no key required)
	const url = new URL("https://api.open-meteo.com/v1/forecast");
	url.searchParams.set("latitude", lat);
	url.searchParams.set("longitude", lon);
	url.searchParams.set("current_weather", "true");
	url.searchParams.set("hourly", "relativehumidity_2m");
	url.searchParams.set("timezone", "auto");

	const res = await fetch(url.toString());
	if (!res.ok) throw new Error("Weather API error");
	const data = await res.json();

	const cw = data.current_weather;
	if (!cw) throw new Error("No current weather data");

	const { icon, desc } = mapWeatherCodeToInfo(cw.weathercode);

	iconEl.textContent = icon;
	tempEl.innerHTML = `${Math.round(cw.temperature)}<span class="unit">°C</span>`;
	descEl.textContent = desc;

	// Get humidity from nearest hourly entry
	let humidity = "--";
	if (data.hourly && data.hourly.time && data.hourly.relativehumidity_2m) {
	  const nowIso = cw.time || new Date().toISOString();
	  const idx = data.hourly.time.indexOf(nowIso);
	  if (idx !== -1) {
		humidity = data.hourly.relativehumidity_2m[idx] + "%";
	  } else {
		// fallback: use the first
		humidity = data.hourly.relativehumidity_2m[0] + "%";
	  }
	}

	feelsLikeEl.textContent = `Feels like: ${Math.round(cw.temperature)}°C`;
	windEl.textContent = `Wind: ${cw.windspeed} km/h`;
	humidityEl.textContent = `Humidity: ${humidity}`;

	// Use Open-Meteo 
	  locationEl.textContent = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
	


	statusEl.classList.add("success");
	statusEl.textContent = "Weather loaded using your browser location.";
  } catch (err) {
	console.error(err);
	statusEl.classList.add("error");
	statusEl.textContent =
	  "Could not load weather. Please check your internet connection or try again later.";
  }
}

function initWeather() {
  const statusEl = document.getElementById("weather-status");
  const descEl = document.getElementById("weather-desc");
  const locationEl = document.getElementById("weather-location").querySelector("span");

  if (!navigator.geolocation) {
	statusEl.classList.add("error");
	statusEl.textContent = "Geolocation is not supported by your browser.";
	descEl.textContent = "Location unavailable.";
	locationEl.textContent = "Not supported";
	return;
  }

  statusEl.innerHTML = `
	<span class="loading-pulse">
	  Requesting your location
	  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
	</span>
  `;

  navigator.geolocation.getCurrentPosition(
	(pos) => {
	  const { latitude, longitude } = pos.coords;
	  fetchWeatherForCoords(latitude, longitude);
	},
	(err) => {
	  console.warn("Geolocation error:", err);
	  statusEl.classList.add("error");
	  if (err.code === err.PERMISSION_DENIED) {
		statusEl.textContent =
		  "Location permission denied. Weather cannot be shown without your approximate location.";
	  } else {
		statusEl.textContent = "Could not get your location.";
	  }
	  descEl.textContent = "Location access denied.";
	  locationEl.textContent = "Permission denied";
	},
	{
	  enableHighAccuracy: false,
	  timeout: 8000,
	  maximumAge: 5 * 60 * 1000
	}
  );
}

// -----------------------
// Init
// -----------------------
document.addEventListener("DOMContentLoaded", () => {
  // First quote & weather on load
  fetchQuote();
  initWeather();

  // Button for new quotes
  document.getElementById("new-quote-btn").addEventListener("click", () => {
	fetchQuote();
  });
});





