import board
import adafruit_dht
from gpiozero import RGBLED
from flask import Flask, jsonify, request

app = Flask(__name__)

# DHT11 data pin on GPIO4
dht_sensor = adafruit_dht.DHT11(board.D4)

# RGB LED pins
rgb_led = RGBLED(red=17, green=27, blue=22, active_high=True)

latest_data = {
    "temperature_c": None,
    "humidity": None,
    "error": None
}


def read_dht11():
    global latest_data

    try:
        temperature_c = dht_sensor.temperature
        humidity = dht_sensor.humidity

        latest_data = {
            "temperature_c": temperature_c,
            "humidity": humidity,
            "error": None
        }

    except RuntimeError as error:
        latest_data["error"] = str(error)

    return latest_data


@app.route("/api/sensors")
def get_sensors():
    return jsonify(read_dht11())


@app.route("/api/led", methods=["POST"])
def set_led():
    data = request.get_json()

    red = int(data.get("red", 0))
    green = int(data.get("green", 0))
    blue = int(data.get("blue", 0))

    red = max(0, min(255, red))
    green = max(0, min(255, green))
    blue = max(0, min(255, blue))

    rgb_led.color = (
        red / 255,
        green / 255,
        blue / 255
    )

    return jsonify({
        "status": "ok",
        "red": red,
        "green": green,
        "blue": blue
    })


@app.route("/api/led/off", methods=["POST"])
def led_off():
    rgb_led.off()
    return jsonify({"status": "off"})


if __name__ == "__main__":
    try:
        # Localhost only
        # app.run(host="127.0.0.1", port=5000, debug=False)
        app.run(host="0.0.0.0", port=5000, debug=False)
        
    finally:
        dht_sensor.exit()
        rgb_led.off()