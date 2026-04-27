# smart-home
**Smart Home** is an IoT-based household monitoring service with a friendly web interface designed to improve indoor comfort and environmental awareness.

The application uses a Raspberry Pi connected to temperature and humidity sensors to monitor room conditions in real time. Sensor data is displayed through a local Angular web dashboard, while a Python Flask backend handles communication with the embedded hardware.

The system analyzes indoor temperature and humidity values and provides context-aware recommendations for improving the local environment. These suggestions can support better comfort, sleep quality, and general well-being by helping the user identify conditions such as excessive humidity, dry air, overheating, or low room temperature.

The application can also control an RGB LED connected to the Raspberry Pi. The LED may be used as a visual alert for uncomfortable or extreme room conditions, or as a relaxing ambient light during evening and sleep periods.

## Setup
Clone the repository locally:
```
cd ~/
git clone https://github.com/vladkobli/smart-home.git
```
Create a python environment to install all the prerequisites:
```
# Install required Linux packages
sudo apt update
sudo apt install -y python3-full python3-pip python3-venv libgpiod2

# Create and activate Python virtual environment
cd ~/smart-home
python3 -m venv venv
source venv/bin/activate

# Upgrade pip inside the virtual environment
pip install --upgrade pip

# Install Python dependencies inside the virtual environment
pip install flask adafruit-circuitpython-dht gpiozero
```

## Launch
Launch the website, using three different terminals.

Terminal 1:
```
cd ~/smart-home
source venv/bin/activate
python3 api.py
```

Terminal 2:
```
cd ~/smart-home/smart_home/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 3:
```
cd ~/smart-home/smart_home/frontend
source venv/bin/activate
npm run start
```

After having ran the sensor API, the backend and the frontend, access the website via the local network, at [smart-home](http://localhost:4200/)