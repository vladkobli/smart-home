import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SensorData {
  temperature_c: number | null;
  humidity: number | null;
  error: string | null;
}

export interface LedColor {
  red: number;
  green: number;
  blue: number;
}

@Injectable({
  providedIn: 'root'
})
export class SensorService {
  private readonly backendHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  private readonly apiBaseUrl = `http://${this.backendHost}:8000`;

  constructor(private http: HttpClient) {}

  getSensors(): Observable<SensorData> {
    return this.http.get<SensorData>(`${this.apiBaseUrl}/api/sensors`);
  }

  setLed(color: LedColor): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/api/led`, color);
  }

  turnLedOff(): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/api/led/off`, {});
  }
}
