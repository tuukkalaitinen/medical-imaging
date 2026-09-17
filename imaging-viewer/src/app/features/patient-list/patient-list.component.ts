import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ManifestService } from '../../core/services/manifest.service';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [RouterLink, MatListModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule],
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss',
})
export class PatientListComponent implements OnInit {
  protected readonly manifestService = inject(ManifestService);

  ngOnInit(): void {
    this.manifestService.load();
  }

  shapeIcon(shape: string): string {
    switch (shape) {
      case 'sphere':
        return 'circle';
      case 'box':
        return 'crop_square';
      case 'cylinder':
        return 'crop_portrait';
      default:
        return 'help_outline';
    }
  }
}
