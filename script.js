class NeoWeatherApp {
    constructor() {
        // REPLACE THIS WITH YOUR ACTUAL API KEY
        this.apiKey = '6ab76e2e7a6b17397d036fa526f0a259';
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.unit = 'metric';
        this.theme = 'light';
        this.recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
        
        this.initializeApp();
    }

    initializeApp() {
        this.loadTheme();
        this.bindEvents();
        this.updateDateTime();
        this.loadRecentSearches();
        
        // Load default city
        this.getWeatherByCity('London');
    }

    bindEvents() {
        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
        document.getElementById('location-btn').addEventListener('click', () => this.getWeatherByLocation());
        document.getElementById('city-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('unit-toggle').addEventListener('click', () => this.toggleUnit());
    }

    async handleSearch() {
        const cityInput = document.getElementById('city-input');
        const city = cityInput.value.trim();

        if (city) {
            await this.getWeatherByCity(city);
            cityInput.value = '';
        } else {
            this.showError('Please enter a city name');
        }
    }

    async getWeatherByCity(city) {
        this.showLoading();
        console.log('Searching for city:', city); // Debug log
        
        try {
            // First, get city coordinates
            const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${this.apiKey}`;
            console.log('Geo URL:', geoUrl); // Debug log
            
            const geoResponse = await fetch(geoUrl);
            console.log('Geo Response status:', geoResponse.status); // Debug log
            
            if (!geoResponse.ok) {
                throw new Error(`API error: ${geoResponse.status}`);
            }

            const geoData = await geoResponse.json();
            console.log('Geo Data:', geoData); // Debug log
            
            if (!geoData || geoData.length === 0) {
                throw new Error('City not found. Try: London, New York, Tokyo, Paris, Delhi');
            }

            const { lat, lon, name, country } = geoData[0];
            
            // Get weather data using coordinates
            const weatherUrl = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&units=${this.unit}&appid=${this.apiKey}`;
            const forecastUrl = `${this.baseUrl}/forecast?lat=${lat}&lon=${lon}&units=${this.unit}&appid=${this.apiKey}`;

            const [weatherResponse, forecastResponse] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            if (!weatherResponse.ok || !forecastResponse.ok) {
                throw new Error('Weather data unavailable');
            }

            const [weatherData, forecastData] = await Promise.all([
                weatherResponse.json(),
                forecastResponse.json()
            ]);

            this.displayWeather(weatherData, forecastData, `${name}, ${country}`);
            this.addToRecentSearches(name);
            
        } catch (error) {
            console.error('Error details:', error); // Debug log
            this.showError(error.message);
        }
    }

    async getWeatherByLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation not supported');
            return;
        }

        this.showLoading();

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    enableHighAccuracy: true
                });
            });

            const { latitude, longitude } = position.coords;
            
            const weatherUrl = `${this.baseUrl}/weather?lat=${latitude}&lon=${longitude}&units=${this.unit}&appid=${this.apiKey}`;
            const forecastUrl = `${this.baseUrl}/forecast?lat=${latitude}&lon=${longitude}&units=${this.unit}&appid=${this.apiKey}`;

            const [weatherResponse, forecastResponse] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            if (!weatherResponse.ok || !forecastResponse.ok) {
                throw new Error('Location weather unavailable');
            }

            const [weatherData, forecastData] = await Promise.all([
                weatherResponse.json(),
                forecastResponse.json()
            ]);

            this.displayWeather(weatherData, forecastData, `${weatherData.name}, ${weatherData.sys.country}`);
            this.addToRecentSearches(weatherData.name);
            
        } catch (error) {
            console.error('Geolocation error:', error);
            this.showError('Unable to get your location. Please enable location permissions.');
        }
    }

    displayWeather(currentData, forecastData, locationName) {
        const weatherMain = document.getElementById('weather-main');
        const errorMessage = document.getElementById('error-message');
        
        errorMessage.style.display = 'none';
        weatherMain.style.display = 'block';

        // Update display
        document.getElementById('city-name').textContent = locationName;
        document.getElementById('temp').textContent = Math.round(currentData.main.temp);
        document.getElementById('weather-desc').textContent = currentData.weather[0].description;
        document.getElementById('feels-like').textContent = Math.round(currentData.main.feels_like);
        document.getElementById('humidity').textContent = currentData.main.humidity;
        document.getElementById('wind-speed').textContent = Math.round(currentData.wind.speed * 3.6);
        document.getElementById('pressure').textContent = currentData.main.pressure;
        document.getElementById('visibility').textContent = (currentData.visibility / 1000).toFixed(1);
        document.getElementById('clouds').textContent = currentData.clouds.all;

        // Weather icon
        const iconUrl = `https://openweathermap.org/img/wn/${currentData.weather[0].icon}@2x.png`;
        document.getElementById('weather-img').src = iconUrl;

        // Sun times
        document.getElementById('sunrise').textContent = this.formatTime(currentData.sys.sunrise);
        document.getElementById('sunset').textContent = this.formatTime(currentData.sys.sunset);

        // Forecasts
        this.displayHourlyForecast(forecastData);
        this.display5DayForecast(forecastData);
        this.updateAirQuality();

        this.hideLoading();
    }

    displayHourlyForecast(forecastData) {
        const container = document.getElementById('hourly-forecast');
        container.innerHTML = '';

        forecastData.list.slice(0, 8).forEach(item => {
            const hourItem = document.createElement('div');
            hourItem.className = 'hourly-item';
            hourItem.innerHTML = `
                <div class="hourly-time">${this.formatHour(new Date(item.dt * 1000))}</div>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}">
                <div class="hourly-temp">${Math.round(item.main.temp)}°</div>
            `;
            container.appendChild(hourItem);
        });
    }

    display5DayForecast(forecastData) {
        const container = document.getElementById('forecast-list');
        container.innerHTML = '';

        // Get one reading per day
        const dailyData = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            if (!dailyData[day]) {
                dailyData[day] = item;
            }
        });

        Object.entries(dailyData).slice(0, 5).forEach(([day, item]) => {
            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <div class="forecast-day">${day}</div>
                <div class="forecast-weather">
                    <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}">
                    <span>${item.weather[0].description}</span>
                </div>
                <div class="forecast-temps">
                    <span class="forecast-high">${Math.round(item.main.temp_max)}°</span>
                    <span class="forecast-low">${Math.round(item.main.temp_min)}°</span>
                </div>
            `;
            container.appendChild(forecastItem);
        });
    }

    updateAirQuality() {
        // Mock AQI for demo
        const aqi = Math.floor(Math.random() * 50) + 1;
        document.getElementById('aqi-value').textContent = aqi;
        document.getElementById('aqi-label').textContent = 'Good';
        document.getElementById('aqi-label').style.color = '#00e676';
    }

    formatTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    formatHour(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            hour12: true
        });
    }

    updateDateTime() {
        const now = new Date();
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('weather-main').style.display = 'none';
        document.getElementById('error-message').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        this.hideLoading();
        document.getElementById('weather-main').style.display = 'none';
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').querySelector('p').textContent = message;
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    toggleUnit() {
        this.unit = this.unit === 'metric' ? 'imperial' : 'metric';
        const unitBtn = document.getElementById('unit-toggle');
        unitBtn.innerHTML = this.unit === 'metric' ? 
            '<span>°C</span>/<span>°F</span>' : 
            '<span>°F</span>/<span>°C</span>';
        
        const currentCity = document.getElementById('city-name').textContent.split(',')[0];
        if (currentCity && currentCity !== 'City Name') {
            this.getWeatherByCity(currentCity);
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    addToRecentSearches(city) {
        this.recentSearches = this.recentSearches.filter(item => 
            item.toLowerCase() !== city.toLowerCase()
        );
        this.recentSearches.unshift(city);
        this.recentSearches = this.recentSearches.slice(0, 5);
        localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
        this.loadRecentSearches();
    }

    loadRecentSearches() {
        const recentList = document.getElementById('recent-list');
        recentList.innerHTML = '';
        this.recentSearches.forEach(city => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.textContent = city;
            item.addEventListener('click', () => this.getWeatherByCity(city));
            recentList.appendChild(item);
        });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new NeoWeatherApp();
});