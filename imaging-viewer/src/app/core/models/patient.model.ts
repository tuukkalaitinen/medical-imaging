export type ShapeType = 'sphere' | 'box' | 'cylinder';

export interface VolumeDimensions {
  x: number;
  y: number;
  z: number;
}

export interface Patient {
  patientId: string;
  patientName: string;
  shape: ShapeType;
  dimensions: VolumeDimensions;
  pixelSpacingMm: number;
  sliceThicknessMm: number;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  seriesDirectory: string;
  sliceCount: number;
}

export interface Manifest {
  generatedAt: string;
  volumeSize: number;
  pixelSpacingMm: number;
  sliceThicknessMm: number;
  patients: Patient[];
}
