import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription, switchMap } from 'rxjs';
import { LedColor, SensorService } from '../services/sensor.service';

interface Tip {
  type: string;
  reason: string;
  effect: string;
  action: string;
}

interface AIRecommendation {
  title: string;
  analysis: string;
  actions: string[];
}

interface StatusProfile {
  key: string;
  label: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number | null;
  humidityMax: number;
  mainGoal: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly isBrowser = typeof window !== 'undefined';

  // --- Sensor readings ---
  temperature = 0;
  humidity = 0;

  // --- Comfort ---
  comfortScore = 100;
  comfortMessage = 'Waiting for data...';

  // --- Navigation ---
  activeTab: string = 'dashboard';

  // --- Context ---
  contextMode: string = 'home';
  contextMessage: string = '';

  // --- Status profile ---
  readonly statusProfiles: StatusProfile[] = [
    {
      key: 'work_home',
      label: 'Home for work',
      temperatureMin: 20,
      temperatureMax: 24,
      humidityMin: 30,
      humidityMax: 50,
      mainGoal: 'Comfort and concentration'
    },
    {
      key: 'away_home',
      label: 'Left home',
      temperatureMin: 16,
      temperatureMax: 26,
      humidityMin: null,
      humidityMax: 60,
      mainGoal: 'Safety and prevention'
    },
    {
      key: 'evening_relaxation',
      label: 'Evening relaxation',
      temperatureMin: 19,
      temperatureMax: 23,
      humidityMin: 30,
      humidityMax: 50,
      mainGoal: 'Stress reduction'
    },
    {
      key: 'sleep',
      label: 'Sleeping',
      temperatureMin: 16,
      temperatureMax: 20,
      humidityMin: 30,
      humidityMax: 50,
      mainGoal: 'Quality of sleep'
    },
    {
      key: 'extreme_warning',
      label: 'Extreme warning',
      temperatureMin: 16,
      temperatureMax: 26,
      humidityMin: 30,
      humidityMax: 60,
      mainGoal: 'Immediate alert'
    }
  ];
  activeStatusKey = 'work_home';

  // --- Targets ---
  targetTemperatureMin = 20;
  targetTemperatureMax = 24;
  targetHumidityMin: number | null = 30;
  targetHumidityMax = 50;
  mainGoal = 'Comfort and concentration';

  // --- AI ---
  aiRecommendation: AIRecommendation | null = null;

  // --- Tips ---
  tips: Tip[] = [];

  // --- LED ---
  red = 0;
  green = 0;
  blue = 0;
  ledMode: 'auto' | 'manual' = 'auto';
  activeLedRule = 'Auto mode is waiting for sensor data';

  private lastAppliedLedColor: LedColor | null = null;

  // --- Sensor error ---
  sensorError: string | null = null;

  private sensorSubscription?: Subscription;
  private aiInterval: any;

  constructor(private sensorService: SensorService) {}

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.applyStatusProfile(this.activeStatusKey);

    // Initial load
    this.loadSensors();

    // Poll sensors every 2s via RxJS (replaces setInterval fetch)
    this.sensorSubscription = interval(2000)
      .pipe(switchMap(() => this.sensorService.getSensors()))
      .subscribe({
        next: data => {
          this.sensorError = data.error ?? null;

          if (data.temperature_c !== null) this.temperature = data.temperature_c;
          if (data.humidity !== null) this.humidity = data.humidity;

          this.detectContext();
          this.updateComfort();
          this.applyAutoLedColor();
        },
        error: () => {
          this.sensorError = 'Could not connect to smart_home backend API.';
        }
      });

    // AI recommendation — fetch immediately then every 15 min
    this.fetchAIRecommendation();
    this.aiInterval = setInterval(() => {
      this.fetchAIRecommendation();
    }, 15 * 60 * 1000);
  }

  ngOnDestroy(): void {
    this.sensorSubscription?.unsubscribe();
    clearInterval(this.aiInterval);
  }

  // ---------------- SENSOR ----------------

  loadSensors(): void {
    this.sensorService.getSensors().subscribe({
      next: data => {
        this.sensorError = data.error ?? null;
        if (data.temperature_c !== null) this.temperature = data.temperature_c;
        if (data.humidity !== null) this.humidity = data.humidity;
        this.detectContext();
        this.updateComfort();
        this.applyAutoLedColor();
      },
      error: () => {
        this.sensorError = 'Could not connect to smart_home backend API.';
      }
    });
  }

  // ---------------- LED ----------------

  setLedMode(mode: 'auto' | 'manual'): void {
    this.ledMode = mode;

    if (mode === 'auto') {
      this.applyAutoLedColor();
      return;
    }

    this.activeLedRule = 'Manual mode enabled';
  }

  private applyLedColorIfChanged(color: LedColor, ruleName: string): void {
    const isSameColor =
      this.lastAppliedLedColor?.red === color.red &&
      this.lastAppliedLedColor?.green === color.green &&
      this.lastAppliedLedColor?.blue === color.blue;

    this.red = color.red;
    this.green = color.green;
    this.blue = color.blue;
    this.activeLedRule = ruleName;

    if (isSameColor) {
      return;
    }

    this.lastAppliedLedColor = color;
    this.sensorService.setLed(color).subscribe();
  }

  private applyAutoLedColor(): void {
    if (this.ledMode !== 'auto') {
      return;
    }

    const isTempHigh = this.temperature > this.targetTemperatureMax;
    const isTempLow = this.temperature < this.targetTemperatureMin;
    const isHumidityHigh = this.humidity > this.targetHumidityMax;
    const isHumidityLow = this.targetHumidityMin !== null && this.humidity < this.targetHumidityMin;

    const severeTemperatureDeviation =
      this.temperature > this.targetTemperatureMax + 3 || this.temperature < this.targetTemperatureMin - 3;
    const severeHumidityDeviation =
      this.humidity > this.targetHumidityMax + 10 ||
      (this.targetHumidityMin !== null && this.humidity < this.targetHumidityMin - 10);

    const isVeryUncomfortable =
      this.comfortScore < 50 || severeTemperatureDeviation || severeHumidityDeviation;

    if (isVeryUncomfortable) {
      this.applyLedColorIfChanged({ red: 170, green: 35, blue: 255 }, 'Very uncomfortable condition -> Purple');
      return;
    }

    if (isTempHigh) {
      this.applyLedColorIfChanged({ red: 255, green: 0, blue: 0 }, 'High temperature -> Red');
      return;
    }

    if (isTempLow) {
      this.applyLedColorIfChanged({ red: 30, green: 100, blue: 255 }, 'Low temperature -> Blue');
      return;
    }

    if (isHumidityHigh || isHumidityLow) {
      this.applyLedColorIfChanged({ red: 255, green: 210, blue: 0 }, 'Humidity alert -> Yellow');
      return;
    }

    if (this.activeStatusKey === 'sleep') {
      this.applyLedColorIfChanged({ red: 255, green: 140, blue: 60 }, 'Sleep preparation -> Warm orange');
      return;
    }

    this.applyLedColorIfChanged({ red: 0, green: 200, blue: 80 }, 'Normal condition -> Green');
  }

  setLed(): void {
    this.ledMode = 'manual';
    this.activeLedRule = 'Manual custom color';

    this.sensorService.setLed({
      red: this.red,
      green: this.green,
      blue: this.blue
    }).subscribe();

    this.lastAppliedLedColor = {
      red: this.red,
      green: this.green,
      blue: this.blue
    };
  }

  turnOff(): void {
    this.red = 0;
    this.green = 0;
    this.blue = 0;
    this.sensorService.turnLedOff().subscribe();
    this.lastAppliedLedColor = { red: 0, green: 0, blue: 0 };
    this.activeLedRule = 'LED is off';
  }

  // ---------------- AI ----------------

  fetchAIRecommendation(): void {
    if (!this.isBrowser) {
      this.aiRecommendation = null;
      return;
    }

    const backendHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    fetch(`http://${backendHost}:8000/recommendation`)
      .then(res => res.json())
      .then(data => {
        try {
          this.aiRecommendation =
            typeof data.recommendation === 'string'
              ? JSON.parse(data.recommendation)
              : data.recommendation;
        } catch {
          this.aiRecommendation = null;
        }
      })
      .catch(() => {
        this.aiRecommendation = null;
      });
  }

  // ---------------- CONTEXT ----------------

  detectContext(): void {
    const hour = new Date().getHours();

    if (hour >= 22 || hour < 6) {
      this.contextMode = 'night';
      this.contextMessage = `Night mode active | Profile: ${this.activeStatusProfile?.label}`;
    } else if (hour >= 6 && hour < 9) {
      this.contextMode = 'morning';
      this.contextMessage = `Morning mode active | Profile: ${this.activeStatusProfile?.label}`;
    } else if (hour >= 9 && hour < 17) {
      this.contextMode = 'away';
      this.contextMessage = `Daytime mode active | Profile: ${this.activeStatusProfile?.label}`;
    } else {
      this.contextMode = 'home';
      this.contextMessage = `Home mode active | Profile: ${this.activeStatusProfile?.label}`;
    }
  }

  // ---------------- COMFORT ----------------

  updateComfort(): void {
    this.comfortScore = 100;

    if (this.temperature < this.targetTemperatureMin) this.comfortScore -= 30;
    if (this.temperature > this.targetTemperatureMax) this.comfortScore -= 30;
    if (this.targetHumidityMin !== null && this.humidity < this.targetHumidityMin) this.comfortScore -= 20;
    if (this.humidity > this.targetHumidityMax) this.comfortScore -= 20;

    if (this.comfortScore >= 85) {
      this.comfortMessage = 'Excellent comfort 🌿';
    } else if (this.comfortScore >= 70) {
      this.comfortMessage = 'Good comfort 😊';
    } else if (this.comfortScore >= 50) {
      this.comfortMessage = 'Moderate ⚠️';
    } else {
      this.comfortMessage = 'Poor ❌';
    }
  }

  // ---------------- NAV ----------------

  get activeStatusProfile(): StatusProfile | undefined {
    return this.statusProfiles.find(profile => profile.key === this.activeStatusKey);
  }

  get humidityTargetLabel(): string {
    return this.targetHumidityMin === null
      ? `< ${this.targetHumidityMax}%`
      : `${this.targetHumidityMin}-${this.targetHumidityMax}%`;
  }

  applyStatusProfile(profileKey: string): void {
    const selectedProfile = this.statusProfiles.find(profile => profile.key === profileKey);

    if (!selectedProfile) {
      return;
    }

    this.activeStatusKey = selectedProfile.key;
    this.targetTemperatureMin = selectedProfile.temperatureMin;
    this.targetTemperatureMax = selectedProfile.temperatureMax;
    this.targetHumidityMin = selectedProfile.humidityMin;
    this.targetHumidityMax = selectedProfile.humidityMax;
    this.mainGoal = selectedProfile.mainGoal;

    this.detectContext();
    this.updateComfort();
    this.applyAutoLedColor();
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }
}