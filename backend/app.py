import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import numpy as np
import cv2
import rasterio
from rasterio.transform import from_bounds
from PIL import Image
import io
from calibration import GeoCalibrationEngine
import gradio as gr
import spaces

def suppress_water_body_elevation(optical_rgb: np.ndarray, heightmap: np.ndarray) -> np.ndarray:
    """
    Identifies dark/turbid water bodies using color thresholding and forces them
    to sit completely flat at the ground base elevation.
    """
    hsv = cv2.cvtColor(optical_rgb, cv2.COLOR_RGB2HSV)
    lower_water = np.array([80, 20, 10])
    upper_water = np.array([130, 255, 100])
    water_mask = cv2.inRange(hsv, lower_water, upper_water)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel)
    
    valid_terrain = heightmap[water_mask == 0]
    min_elev = np.percentile(valid_terrain, 2) if len(valid_terrain) > 0 else 0
    
    flattened_height = heightmap.copy()
    flattened_height[water_mask > 0] = min_elev
    
    return cv2.GaussianBlur(flattened_height, (3, 3), 0.8)

app = FastAPI()

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = GeoCalibrationEngine()
os.makedirs("output", exist_ok=True)
global_dsm_cache = {}

@app.post("/api/process-image")
@spaces.GPU(duration=60)
async def process_image(file: UploadFile = File(...), metric_calibration: bool = Form(False)):
    contents = await file.read()
    
    bounds = None
    crs = None
    is_geotiff = False
    
    try:
        with rasterio.MemoryFile(contents) as memfile:
            with memfile.open() as dataset:
                if dataset.bounds and dataset.crs:
                    bounds = dataset.bounds
                    crs = dataset.crs
                    is_geotiff = True
                
                image_array = dataset.read()
                if image_array.shape[0] >= 3:
                    image_array = np.transpose(image_array[:3], (1, 2, 0))
                else:
                    image_array = np.stack((image_array[0],)*3, axis=-1)
    except Exception:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        image_array = np.array(image)
        
    mode = "Metric Absolute Mode" if is_geotiff and metric_calibration else "Relative Mode (rDSM)"
    
    relative_depth = engine.run_mock_inference(image_array)
    metric_dsm, _, _ = engine.apply_gasc_calibration(relative_depth, bounds=bounds)
    
    H, W = metric_dsm.shape
    d_min, d_max = np.min(metric_dsm), np.max(metric_dsm)
    norm = (metric_dsm - d_min) / (d_max - d_min + 1e-8)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    macro_terrain = cv2.morphologyEx(norm, cv2.MORPH_OPEN, kernel)
    structures = cv2.subtract(norm, macro_terrain)
    structures = np.clip(structures * 0.35, 0.0, 1.0)
    
    final_height = macro_terrain + structures
    final_height = cv2.GaussianBlur(final_height, (5, 5), sigmaX=1.0)
    final_height = suppress_water_body_elevation(image_array, final_height)
    
    final_height = (final_height - np.min(final_height)) / (np.max(final_height) - np.min(final_height) + 1e-8)
    dsm_normalized = (final_height * 65535.0).astype(np.uint16)
    
    png_path = os.path.join("output", "heightmap.png")
    cv2.imwrite(png_path, dsm_normalized)
    
    tiff_path = os.path.join("output", "dsm.tif")
    transform = from_bounds(*bounds, W, H) if bounds else from_bounds(0, H, W, 0, W, H)
    
    with rasterio.open(
        tiff_path, 'w',
        driver='GTiff',
        height=H, width=W,
        count=1, dtype=str(metric_dsm.dtype),
        crs=crs or "EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(metric_dsm, 1)
        
    global_dsm_cache['latest'] = metric_dsm
    
    return {
        "status": "success",
        "mode": mode,
        "width": W,
        "height": H,
        "min_elev": float(d_min),
        "max_elev": float(d_max)
    }

@app.get("/api/elevation-profile")
def get_elevation_profile(x1: float, y1: float, x2: float, y2: float, samples: int = 100):
    if 'latest' not in global_dsm_cache:
        return JSONResponse({"error": "No active DSM found"}, status_code=400)
    
    dsm = global_dsm_cache['latest']
    H, W = dsm.shape
    
    x_coords = np.linspace(x1, x2, samples)
    y_coords = np.linspace(y1, y2, samples)
    
    profile = []
    for x, y in zip(x_coords, y_coords):
        ix, iy = int(round(x)), int(round(y))
        ix = max(0, min(W - 1, ix))
        iy = max(0, min(H - 1, iy))
        profile.append({"x": ix, "y": iy, "elevation": float(dsm[iy, ix])})
        
    return {"profile": profile}

@app.get("/api/download-heightmap")
def download_heightmap():
    return FileResponse(os.path.join("output", "heightmap.png"))

@app.get("/api/export-dsm")
def export_dsm():
    return FileResponse(os.path.join("output", "dsm.tif"))

@spaces.GPU(duration=60)
def test_inference(image):
    """ Gradio UI handler for quick testing """
    if image is None:
        return None
    relative_depth = engine.run_mock_inference(image)
    metric_dsm, _, _ = engine.apply_gasc_calibration(relative_depth, bounds=None)
    
    d_min, d_max = np.min(metric_dsm), np.max(metric_dsm)
    norm = (metric_dsm - d_min) / (d_max - d_min + 1e-8)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    macro_terrain = cv2.morphologyEx(norm, cv2.MORPH_OPEN, kernel)
    structures = cv2.subtract(norm, macro_terrain)
    structures = np.clip(structures * 0.35, 0.0, 1.0)
    
    final_height = macro_terrain + structures
    final_height = cv2.GaussianBlur(final_height, (5, 5), sigmaX=1.0)
    final_height = suppress_water_body_elevation(image, final_height)
    
    final_height = (final_height - np.min(final_height)) / (np.max(final_height) - np.min(final_height) + 1e-8)
    dsm_normalized = (final_height * 65535.0).astype(np.uint16)
    
    return dsm_normalized

demo = gr.Interface(
    fn=test_inference,
    inputs=gr.Image(type="numpy", label="Input Satellite Image"),
    outputs=gr.Image(type="numpy", label="Generated Heightmap (16-bit)"),
    title="DepthWizard API Tester",
    description="Upload an aerial image to test the topographical depth extraction pipeline."
)

app = gr.mount_gradio_app(app, demo, path="/")


