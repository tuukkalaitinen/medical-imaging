import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  cache,
  type Types,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { ManifestService } from '../../core/services/manifest.service';
import { CornerstoneInitService } from '../../core/services/cornerstone-init.service';
import { Patient } from '../../core/models/patient.model';

const RENDERING_ENGINE_ID = 'imagingViewerEngine';
const VIEWPORT_ID = 'volume3d';
const TOOL_GROUP_ID = 'volume3dTools';

const PRESETS = ['CT-Bone', 'CT-Soft-Tissue', 'CT-Muscle'] as const;
type Preset = (typeof PRESETS)[number];

type Status = 'loading' | 'error' | 'ready';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './viewer.component.html',
  styleUrl: './viewer.component.scss',
})
export class ViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportElement', { static: true })
  private readonly viewportElementRef!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly manifestService = inject(ManifestService);
  private readonly cornerstoneInit = inject(CornerstoneInitService);

  protected readonly patient = signal<Patient | undefined>(undefined);
  protected readonly status = signal<Status>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly presets = PRESETS;
  protected readonly activePreset = signal<Preset>('CT-Bone');

  private renderingEngine: RenderingEngine | undefined;
  private volumeId = '';

  async ngAfterViewInit(): Promise<void> {
    try {
      const patientId = this.route.snapshot.paramMap.get('patientId');
      if (!patientId) {
        throw new Error('No patient specified.');
      }

      await this.manifestService.load();
      const patient = this.manifestService.getPatient(patientId);
      if (!patient) {
        throw new Error(`Patient "${patientId}" was not found in the manifest.`);
      }
      this.patient.set(patient);

      await this.cornerstoneInit.init();
      await this.buildVolume(patient);

      this.status.set('ready');
    } catch (err) {
      console.error(err);
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to render volume.');
      this.status.set('error');
    }
  }

  ngOnDestroy(): void {
    try {
      cornerstoneTools.ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
    } catch {
      // tool group may not have been created if init failed early
    }

    this.renderingEngine?.destroy();

    if (this.volumeId) {
      try {
        cache.removeVolumeLoadObject(this.volumeId);
      } catch {
        // already removed / never cached
      }
    }
  }

  protected setPreset(preset: Preset): void {
    this.activePreset.set(preset);
    const viewport = this.renderingEngine?.getViewport(VIEWPORT_ID) as
      | Types.IVolumeViewport
      | undefined;
    if (!viewport) {
      return;
    }
    viewport.setProperties({ preset });
    viewport.render();
  }

  protected resetCamera(): void {
    const viewport = this.renderingEngine?.getViewport(VIEWPORT_ID) as
      | Types.IVolumeViewport
      | undefined;
    viewport?.resetCamera();
    viewport?.render();
  }

  private async buildVolume(patient: Patient): Promise<void> {
    const imageIds = Array.from(
      { length: patient.sliceCount },
      (_, i) => `wadouri:test-data/${patient.seriesDirectory}/slice_${String(i).padStart(4, '0')}.dcm`
    );

    this.volumeId = `cornerstoneStreamingImageVolume:${patient.patientId}`;

    const volume = await volumeLoader.createAndCacheVolume(this.volumeId, { imageIds });

    await new Promise<void>((resolve, reject) => {
      volume.load((...args: unknown[]) => {
        const progress = args[0] as { success: boolean; error?: unknown };
        if (!progress.success) {
          reject(progress.error instanceof Error ? progress.error : new Error('Volume load failed.'));
          return;
        }
        resolve();
      });
    });

    const element = this.viewportElementRef.nativeElement;

    this.renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    this.renderingEngine.setViewports([
      {
        viewportId: VIEWPORT_ID,
        type: Enums.ViewportType.VOLUME_3D,
        element,
        defaultOptions: { background: [0, 0, 0] as Types.Point3 },
      },
    ]);

    await setVolumesForViewports(this.renderingEngine, [{ volumeId: this.volumeId }], [VIEWPORT_ID]);

    const viewport = this.renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport;
    viewport.setProperties({ preset: this.activePreset() });
    viewport.render();

    this.setupTools();
  }

  private setupTools(): void {
    const { ToolGroupManager, TrackballRotateTool, ZoomTool, PanTool, Enums: ToolEnums } =
      cornerstoneTools;

    let toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
    if (!toolGroup) {
      toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
    }
    if (!toolGroup) {
      throw new Error('Failed to create Cornerstone tool group.');
    }

    toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

    toolGroup.addTool(TrackballRotateTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(PanTool.toolName);

    toolGroup.setToolActive(TrackballRotateTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
    });
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
    });
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
    });
  }
}
