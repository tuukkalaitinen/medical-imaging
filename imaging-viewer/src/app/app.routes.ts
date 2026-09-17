import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/patient-list/patient-list.component').then((m) => m.PatientListComponent),
  },
  {
    path: 'viewer/:patientId',
    loadComponent: () =>
      import('./features/viewer/viewer.component').then((m) => m.ViewerComponent),
  },
  { path: '**', redirectTo: '' },
];
