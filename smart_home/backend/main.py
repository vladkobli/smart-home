import json
import os

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SENSOR_API_BASE_URL = os.getenv("SENSOR_API_BASE_URL", "http://127.0.0.1:5000")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|[0-9]{1,3}(\.[0-9]{1,3}){3})(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


latest_sensor = {
    "temperature": 0,
    "humidity": 0,
}


def _sensor_url(path: str) -> str:
    return f"{SENSOR_API_BASE_URL.rstrip('/')}{path}"


@app.get("/api/sensors")
def get_sensors():
    try:
        response = requests.get(_sensor_url("/api/sensors"), timeout=5)
        response.raise_for_status()
        payload = response.json()

        latest_sensor["temperature"] = payload.get("temperature_c") or 0
        latest_sensor["humidity"] = payload.get("humidity") or 0

        return payload
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Sensor API unavailable") from exc


@app.post("/api/led")
def set_led(color: dict):
    try:
        response = requests.post(_sensor_url("/api/led"), json=color, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="LED API unavailable") from exc


@app.post("/api/led/off")
def turn_led_off():
    try:
        response = requests.post(_sensor_url("/api/led/off"), json={}, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="LED API unavailable") from exc


@app.get("/recommendation")
def get_recommendation():
    if not GROQ_API_KEY:
        return {
            "recommendation": {
                "title": "AI unavailable",
                "analysis": "GROQ_API_KEY is not configured.",
                "actions": ["Set GROQ_API_KEY in backend .env and restart backend."],
            }
        }

    prompt = f"""
You are a strict environmental monitoring system.

NEVER assume values are normal.

Rules:
- If temperature < 10 or > 30 -> NOT normal
- If humidity < 20 or > 80 -> NOT normal
- If any value = 0 -> sensor error or invalid data

Return ONLY JSON:

{{
  "title": "...",
  "analysis": "...",
  "actions": ["..."]
}}

Sensor data:
Temperature: {latest_sensor['temperature']} C
Humidity: {latest_sensor['humidity']}%
"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException:
        return {
            "recommendation": {
                "title": "AI unavailable",
                "analysis": "Could not reach the AI provider.",
                "actions": ["Try again later"],
            }
        }

    if "choices" not in data:
        return {
            "recommendation": {
                "title": "AI unavailable",
                "analysis": "Invalid API response",
                "actions": ["Try again later"],
            }
        }

    content = data["choices"][0]["message"]["content"]

    try:
        parsed = json.loads(content)
        return {"recommendation": parsed}
    except json.JSONDecodeError:
        return {"recommendation": content}

    