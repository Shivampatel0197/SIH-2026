# DepthWizard - Single-View Height Estimation and 3D Flythrough

**Smart India Hackathon (SIH) 2026**
**ISRO Problem Statement ID:** 26175

DepthWizard is an advanced prototype designed to ingest single-view monocular optical imagery (such as drone or satellite captures) and reconstruct it into a highly accurate, interactive 3D topographical map. It combines state-of-the-art AI depth extraction with robust morphological geo-calibration to generate high-fidelity 3D flythroughs and dynamic flood inundation simulations.

## 🚀 Features

- **AI-Powered Depth Extraction**: Leverages ONNX Runtime models to extract dense relative depth maps from standard 2D RGB imagery.
- **Geo-Affine Sparse Calibration (GASC)**: Differentiates ground macro-topography from high-frequency urban structures (buildings, bridges), ensuring accurate topographical scaling without "bed-of-nails" spike artifacts.
- **Intelligent Water Masking**: Detects dark, turbid water bodies (rivers, oceans) and enforces structural flatness so that shorelines integrate naturally into the elevation model.
- **Interactive 3D Flythrough Engine**: A 60-FPS React + Three.js client featuring dynamic camera controls, tactical aerospace telemetry (Altitude AGL, Speed), and real-time mesh displacement.
- **Dynamic Flood Simulation**: Evaluate disaster scenarios using an interactive water plane that realistically sinks the valley floor, scaling dynamically to the terrain dimensions.
- **Cross-Section Profiling**: Extracts transect elevation data for structural analysis.

## 🏗️ System Architecture

The prototype is decoupled into a robust REST API and an interactive frontend client:

1. **Backend Pipeline (`/backend`)**
   - **Stack**: Python, FastAPI, OpenCV, Rasterio, NumPy, ONNX
   - **Role**: Handles image ingestion (GeoTIFF/PNG), AI depth inference, morphological noise filtering, and outputs 16-bit displacement PNGs and 32-bit Float GeoTIFFs.

2. **3D Interactive Client (`/frontend`)**
   - **Stack**: Vite, React, Three.js (WebGL), Tailwind CSS, Lucide Icons
   - **Role**: Renders the generated displacement maps dynamically. Implements real-time lighting, atmospheric fog, flood controls, and WASD/Mouse flight mechanics.

## 🛠️ Setup & Installation

### 1. Backend Setup

Ensure you have Python 3.9+ installed.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run the backend development server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The API will be available at http://localhost:8000*

### 2. Frontend Setup

Ensure you have Node.js 18+ installed.

```bash
cd frontend
npm install
```

Run the Vite development server:
```bash
npm run dev
```
*The UI will be accessible at http://localhost:5173*

## 🎮 Usage Instructions

1. Start both the backend and frontend servers.
2. Open the web interface.
3. Click the **Upload Image** button in the control panel to provide a single-view orthomosaic or aerial photograph.
4. Toggle **Metric Calibration** if the image is a GeoTIFF with bounds.
5. Click **Generate 3D Terrain** to process the heightmap.
6. **Flythrough Controls**: Use `W`, `A`, `S`, `D` to move horizontally, `Q` and `E` to adjust altitude, and click/drag the mouse to look around.
7. Adjust the **Elevation Scale (Z)** slider for visual exaggeration (default 5x for coastal/urban, higher for mountainous).
8. Adjust the **Flood Inundation** slider to simulate rising water levels dynamically over the terrain geometry.

## 📜 License
Developed for SIH 2026. All rights reserved.
