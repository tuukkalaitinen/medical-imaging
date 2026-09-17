#!/usr/bin/env python3
"""Generate synthetic DICOM patient volumes for the medical-imaging feasibility spike.

Each patient gets a small 3D CT-like volume (one DICOM file per axial slice)
containing a single randomly placed/sized shape (sphere, box, or cylinder)
with an intensity clearly distinct from the background. A manifest.json is
written alongside the series describing each patient.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "test-data"

BACKGROUND_HU = -1000  # air-like background
SHAPE_HU = 300  # bone-like intensity, clearly distinct from background
NOISE_STD_HU = 5

SHAPES = ["sphere", "box", "cylinder"]


def make_shape_mask(shape: str, dims: tuple[int, int, int], rng: np.random.Generator) -> np.ndarray:
    """Return a boolean mask of `dims` (z, y, x) with a randomly placed/sized shape."""
    nz, ny, nx = dims
    zz, yy, xx = np.mgrid[0:nz, 0:ny, 0:nx]

    margin = min(dims) // 6
    center = np.array(
        [
            rng.integers(margin, nz - margin),
            rng.integers(margin, ny - margin),
            rng.integers(margin, nx - margin),
        ]
    )

    min_radius = min(dims) // 8
    max_radius = min(dims) // 4

    if shape == "sphere":
        radius = rng.integers(min_radius, max_radius)
        dist = np.sqrt((zz - center[0]) ** 2 + (yy - center[1]) ** 2 + (xx - center[2]) ** 2)
        mask = dist <= radius
    elif shape == "box":
        half = np.array(
            [
                rng.integers(min_radius, max_radius),
                rng.integers(min_radius, max_radius),
                rng.integers(min_radius, max_radius),
            ]
        )
        mask = (
            (np.abs(zz - center[0]) <= half[0])
            & (np.abs(yy - center[1]) <= half[1])
            & (np.abs(xx - center[2]) <= half[2])
        )
    elif shape == "cylinder":
        radius = rng.integers(min_radius, max_radius)
        half_height = rng.integers(min_radius, max_radius)
        axis = rng.choice(["z", "y", "x"])
        if axis == "z":
            radial = np.sqrt((yy - center[1]) ** 2 + (xx - center[2]) ** 2)
            mask = (radial <= radius) & (np.abs(zz - center[0]) <= half_height)
        elif axis == "y":
            radial = np.sqrt((zz - center[0]) ** 2 + (xx - center[2]) ** 2)
            mask = (radial <= radius) & (np.abs(yy - center[1]) <= half_height)
        else:
            radial = np.sqrt((zz - center[0]) ** 2 + (yy - center[1]) ** 2)
            mask = (radial <= radius) & (np.abs(xx - center[2]) <= half_height)
    else:
        raise ValueError(f"unknown shape {shape}")

    return mask


def build_volume(shape: str, dims: tuple[int, int, int], rng: np.random.Generator) -> np.ndarray:
    volume = np.full(dims, BACKGROUND_HU, dtype=np.float32)
    mask = make_shape_mask(shape, dims, rng)
    volume[mask] = SHAPE_HU
    volume += rng.normal(0, NOISE_STD_HU, size=dims)
    return volume.astype(np.int16)


def write_dicom_series(
    patient_id: str,
    patient_name: str,
    volume: np.ndarray,
    out_dir: Path,
    pixel_spacing_mm: float,
    slice_thickness_mm: float,
) -> tuple[str, str]:
    out_dir.mkdir(parents=True, exist_ok=True)

    study_uid = generate_uid()
    series_uid = generate_uid()
    frame_of_reference_uid = generate_uid()

    nz, ny, nx = volume.shape

    for z in range(nz):
        slice_pixels = np.ascontiguousarray(volume[z, :, :])

        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = pydicom.uid.CTImageStorage
        sop_instance_uid = generate_uid()
        file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        file_meta.ImplementationClassUID = generate_uid()

        ds = FileDataset(
            None,
            {},
            file_meta=file_meta,
            preamble=b"\x00" * 128,
            is_implicit_VR=False,
            is_little_endian=True,
        )

        ds.SOPClassUID = pydicom.uid.CTImageStorage
        ds.SOPInstanceUID = sop_instance_uid
        ds.StudyInstanceUID = study_uid
        ds.SeriesInstanceUID = series_uid
        ds.FrameOfReferenceUID = frame_of_reference_uid

        ds.PatientName = patient_name
        ds.PatientID = patient_id
        ds.PatientBirthDate = ""
        ds.PatientSex = ""
        ds.PatientPosition = "HFS"

        ds.Modality = "CT"
        ds.ImageType = ["ORIGINAL", "PRIMARY", "AXIAL"]
        ds.SeriesNumber = 1
        ds.InstanceNumber = z + 1
        ds.StudyID = "1"
        ds.StudyDate = "20240101"
        ds.SeriesDate = "20240101"
        ds.ContentDate = "20240101"
        ds.AccessionNumber = ""

        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.Rows = ny
        ds.Columns = nx
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1  # signed, since background is -1000 HU

        ds.PixelSpacing = [pixel_spacing_mm, pixel_spacing_mm]
        ds.SliceThickness = slice_thickness_mm
        ds.SpacingBetweenSlices = slice_thickness_mm

        ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
        ds.ImagePositionPatient = [0, 0, float(z) * slice_thickness_mm]
        ds.SliceLocation = float(z) * slice_thickness_mm

        ds.RescaleIntercept = 0
        ds.RescaleSlope = 1
        ds.RescaleType = "HU"

        ds.WindowCenter = 40
        ds.WindowWidth = 500

        ds.PixelData = slice_pixels.tobytes()

        filename = out_dir / f"slice_{z:04d}.dcm"
        ds.save_as(filename, enforce_file_format=True)

    return study_uid, series_uid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--num-patients", type=int, default=10)
    parser.add_argument("--size", type=int, default=64, help="cube edge length in voxels")
    parser.add_argument("--pixel-spacing-mm", type=float, default=2.0)
    parser.add_argument("--slice-thickness-mm", type=float, default=2.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    dims = (args.size, args.size, args.size)

    manifest = {
        "generatedAt": "2026-09-17",
        "volumeSize": args.size,
        "pixelSpacingMm": args.pixel_spacing_mm,
        "sliceThicknessMm": args.slice_thickness_mm,
        "patients": [],
    }

    for i in range(1, args.num_patients + 1):
        patient_id = f"patient-{i:02d}"
        patient_name = f"Synthetic^Patient{i:02d}"
        shape = rng.choice(SHAPES)

        volume = build_volume(shape, dims, rng)

        out_dir = args.output_dir / patient_id
        study_uid, series_uid = write_dicom_series(
            patient_id,
            patient_name,
            volume,
            out_dir,
            args.pixel_spacing_mm,
            args.slice_thickness_mm,
        )

        manifest["patients"].append(
            {
                "patientId": patient_id,
                "patientName": patient_name,
                "shape": shape,
                "dimensions": {"x": dims[2], "y": dims[1], "z": dims[0]},
                "pixelSpacingMm": args.pixel_spacing_mm,
                "sliceThicknessMm": args.slice_thickness_mm,
                "studyInstanceUID": study_uid,
                "seriesInstanceUID": series_uid,
                "seriesDirectory": patient_id,
                "sliceCount": dims[0],
            }
        )

        print(f"Generated {patient_id}: shape={shape}, dims={dims}")

    manifest_path = args.output_dir / "manifest.json"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nWrote manifest to {manifest_path}")


if __name__ == "__main__":
    main()
