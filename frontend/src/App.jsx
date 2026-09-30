import React, { useState, useRef } from 'react';
import TerrainViewer from './components/TerrainViewer';
import { UploadCloud, Download, Activity, Play, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [modelData, setModelData] = useState(null);
  
  const [flightSpeed, setFlightSpeed] = useState(50);
  const [floodLevel, setFloodLevel] = useState(0);
  const [displacementScale, setDisplacementScale] = useState(5);
  
  const [profileData, setProfileData] = useState([]);

  const handleFileUpload = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setImagePreview(URL.createObjectURL(selected));
    
    const formData = new FormData();
    formData.append('file', selected);
    formData.append('metric_calibration', true);

    setProcessing(true);
    try {
      const res = await axios.post('http://localhost:8000/api/process-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setModelData({
        ...data,
        heightmapUrl: 'http://localhost:8000/api/download-heightmap?' + Date.now(),
        textureUrl: URL.createObjectURL(selected)
      });
      setFloodLevel(data.min_elev);
    } catch (err) {
      console.error(err);
    }
    setProcessing(false);
  };

  const getProfile = async (x1, y1, x2, y2) => {
    try {
      const res = await axios.get(`http://localhost:8000/api/elevation-profile`, {
        params: { x1, y1, x2, y2 }
      });
      setProfileData(res.data.profile);
    } catch(err) {
      console.error(err);
    }
  };

  const handleImageClick = (e) => {
    if (modelData) {
      // Mock full diagonal transect profile on image click
      getProfile(0, 0, modelData.width, modelData.height);
    }
  };

  return (
    <div className="flex h-screen w-full bg-aerospace-dark text-white font-sans overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-80 border-r border-gray-800 bg-aerospace-slate p-6 flex flex-col gap-6 z-10 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-aerospace-cyan tracking-wider flex items-center gap-2">
            <Activity className="w-6 h-6" /> DEPTHWIZARD
          </h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">SIH 2026 Prototype</p>
        </div>

        {/* Upload Area */}
        <label className="border-2 border-dashed border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-aerospace-cyan transition-colors bg-black/20">
          <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
          <span className="text-sm text-gray-300">Upload JPG, PNG or GeoTIFF</span>
          <input type="file" className="hidden" accept=".jpg,.png,.tif,.tiff" onChange={handleFileUpload} />
        </label>
        
        {processing && (
          <div className="text-sm text-aerospace-amber flex items-center gap-2">
            <Settings className="w-4 h-4 animate-spin" /> Processing AI Depth & Calibration...
          </div>
        )}

        {/* Tools */}
        {modelData && (
          <div className="flex flex-col gap-6 mt-4">
            <div className="text-xs font-mono text-gray-400">
              <span className="block mb-1 text-aerospace-cyan">Mode: {modelData.mode}</span>
              Dimensions: {modelData.width}x{modelData.height}
            </div>
            
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Flight Speed</label>
              <input type="range" min="10" max="200" value={flightSpeed} onChange={e => setFlightSpeed(Number(e.target.value))} className="w-full accent-aerospace-cyan" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wider mb-1">
                <label>Elevation Scale (Z)</label>
                <span>{displacementScale}x</span>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={displacementScale}
                onChange={(e) => setDisplacementScale(Number(e.target.value))}
                className="w-full accent-aerospace-cyan h-1 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Flood Inundation (m)</label>
              <input type="range" min={modelData.min_elev} max={modelData.max_elev} step="0.5" value={floodLevel} onChange={e => setFloodLevel(Number(e.target.value))} className="w-full accent-aerospace-cyan" />
              <div className="text-right text-xs mt-1 font-mono text-aerospace-cyan">{Number(floodLevel).toFixed(1)} m</div>
            </div>
            
            <a href="http://localhost:8000/api/export-dsm" download className="mt-auto flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 py-3 rounded-lg text-sm font-semibold transition-colors border border-gray-700">
              <Download className="w-4 h-4" /> Export DSM (GeoTIFF)
            </a>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 flex h-full">
          {/* 2D Overview */}
          <div className="w-1/3 border-r border-gray-800 relative overflow-hidden bg-slate-900 flex items-center justify-center" onClick={handleImageClick}>
            {imagePreview ? (
              <img src={imagePreview} alt="2D Satellite Ortho" className="max-w-full max-h-full object-contain cursor-crosshair" />
            ) : (
              <span className="text-xs text-slate-500">No Orthomosaic Loaded</span>
            )}
            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-xs font-mono border border-gray-700 backdrop-blur-md">
              2D ORTHO
            </div>
          </div>
          
          {/* 3D Viewport */}
          <div className="flex-1 relative bg-black">
            {modelData ? (
              <TerrainViewer 
                heightmapUrl={modelData.heightmapUrl} 
                textureUrl={modelData.textureUrl} 
                minElev={modelData.min_elev}
                maxElev={modelData.max_elev}
                flightSpeed={flightSpeed}
                floodLevel={floodLevel}
                displacementScale={displacementScale}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <span className="text-sm">3D Viewport (Awaiting Data)</span>
              </div>
            )}
            <div className="absolute top-4 right-4 z-10 bg-black/60 px-3 py-1 rounded text-xs font-mono border border-gray-700 backdrop-blur-md">
              3D FLYTHROUGH
            </div>
          </div>
        </div>

        {/* Bottom Drawer: Elevation Profile */}
        {profileData.length > 0 && (
          <div className="h-48 border-t border-gray-800 bg-aerospace-slate p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
            <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Cross-Section Elevation Profile</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="x" stroke="#4b5563" tick={{fontSize: 10}} />
                <YAxis domain={['auto', 'auto']} stroke="#4b5563" tick={{fontSize: 10}} />
                <Tooltip contentStyle={{backgroundColor: '#0A0F1D', borderColor: '#1f2937'}} />
                <Line type="monotone" dataKey="elevation" stroke="#00F0FF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
