import { Injectable } from '@angular/core';
import * as cornerstone3D from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';

const { volumeLoader, cornerstoneStreamingImageVolumeLoader } = cornerstone3D;

@Injectable({ providedIn: 'root' })
export class CornerstoneInitService {
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    await cornerstone3D.init();
    await cornerstoneTools.init();

    dicomImageLoaderInit({ maxWebWorkers: 1 });

    volumeLoader.registerVolumeLoader(
      'cornerstoneStreamingImageVolume',
      cornerstoneStreamingImageVolumeLoader as any
    );

    const { TrackballRotateTool, ZoomTool, PanTool, addTool } = cornerstoneTools;
    addTool(TrackballRotateTool);
    addTool(ZoomTool);
    addTool(PanTool);
  }
}
