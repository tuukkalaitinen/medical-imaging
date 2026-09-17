import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Manifest, Patient } from '../models/patient.model';

const MANIFEST_URL = 'test-data/manifest.json';

@Injectable({ providedIn: 'root' })
export class ManifestService {
  private readonly http = inject(HttpClient);

  private readonly manifestSignal = signal<Manifest | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private loadPromise: Promise<Manifest> | null = null;

  readonly patients = computed(() => this.manifestSignal()?.patients ?? []);
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  load(): Promise<Manifest> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.loadPromise = firstValueFrom(this.http.get<Manifest>(MANIFEST_URL))
      .then((manifest) => {
        this.manifestSignal.set(manifest);
        return manifest;
      })
      .catch((err) => {
        this.errorSignal.set('Failed to load patient manifest.');
        throw err;
      })
      .finally(() => {
        this.loadingSignal.set(false);
      });

    return this.loadPromise;
  }

  getPatient(patientId: string): Patient | undefined {
    return this.patients().find((p) => p.patientId === patientId);
  }
}
