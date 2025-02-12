import React, { useEffect, useRef, useState } from 'react';
import { CircleSimulation } from './CircleSimulation';
import { Pause, Play, RotateCcw, Video, Type, Plus, X, Music, Music2, Upload } from 'lucide-react';
import { MidiNotePlayer } from './MidiNotePlayer';
import { AudioManager } from './AudioManager';
import { TextElement } from './types';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<CircleSimulation | null>(null);
  const midiPlayerRef = useRef<MidiNotePlayer | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [gravity, setGravity] = useState(0.4);
  const [velocityIncrease, setVelocityIncrease] = useState(0.02);
  const [velocityDecay, setVelocityDecay] = useState(0.998);
  const [ballGrowth, setBallGrowth] = useState(0.015);
  const [batchRecordingCount, setBatchRecordingCount] = useState<string>('1');
  const [recordingDuration, setRecordingDuration] = useState<string>('10');
  const [audioSegmentDuration, setAudioSegmentDuration] = useState<string>('0.3');
  const [isRecordingBatch, setIsRecordingBatch] = useState(false);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [showMidiPanel, setShowMidiPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [midiNotes, setMidiNotes] = useState('');
  const [customFont, setCustomFont] = useState('');
  const [textElements, setTextElements] = useState<TextElement[]>([
    {
      id: 'default',
      text: '@singing.ball',
      x: 540,
      y: 960,
      font: 'Montserrat',
      size: 30,
      color: '#FFFFFF',
      isDragging: false,
      isBold: false
    }
  ]);
  const recordingCountRef = useRef(0);
  const recordingsRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const simulation = new CircleSimulation(canvasRef.current, textElements, () => {
      audioManagerRef.current?.playNextSegment();
    });
    simulationRef.current = simulation;
    simulation.start();

    audioManagerRef.current = new AudioManager(simulation.getAudioDestination());

    return () => simulation.stop();
  }, []);

  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.updateTextElements(textElements);
    }
  }, [textElements]);

  useEffect(() => {
    if (midiPlayerRef.current && midiNotes) {
      const notes = midiPlayerRef.current.parseMidiNotes(midiNotes);
      midiPlayerRef.current.setNotes(notes);
      midiPlayerRef.current.start();
    }
  }, [midiNotes]);

  useEffect(() => {
    if (customFont) {
      const fontFace = new FontFace(customFont, `url(${customFont})`);
      fontFace.load().then(font => {
        document.fonts.add(font);
      }).catch(error => {
        console.error('Error loading font:', error);
      });
    }
  }, [customFont]);

  const handlePlayPause = () => {
    if (!simulationRef.current) return;
    
    if (simulationRef.current.isRunning()) {
      simulationRef.current.stop();
      setIsRunning(false);
    } else {
      simulationRef.current.start();
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    if (!simulationRef.current) return;
    simulationRef.current.reset();
    if (audioManagerRef.current) {
      audioManagerRef.current.reset();
    }
  };

  const handleRecording = async () => {
    if (!simulationRef.current || !canvasRef.current) return;

    if (!isRecording) {
      try {
        const audioStream = audioManagerRef.current?.getAudioStream();
        
        simulationRef.current.startRecording((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `simulation-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        }, audioStream);
        
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    } else {
      simulationRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handleGravityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setGravity(value);
    if (simulationRef.current) {
      simulationRef.current.setGravity(value);
    }
  };

  const handleVelocityIncreaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVelocityIncrease(value);
    if (simulationRef.current) {
      simulationRef.current.setVelocityIncrease(value);
    }
  };

  const handleVelocityDecayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVelocityDecay(value);
    if (simulationRef.current) {
      simulationRef.current.setVelocityDecay(value);
    }
  };

  const handleBallGrowthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setBallGrowth(value);
    if (simulationRef.current) {
      simulationRef.current.setBallGrowthRate(value);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !audioManagerRef.current) return;

    setAudioError(null);
    setIsProcessingAudio(true);

    try {
      const maxTracks = audioManagerRef.current.getMaxTracks();
      const currentTracks = audioManagerRef.current.getTracksCount();
      
      for (let i = 0; i < files.length && currentTracks + i < maxTracks; i++) {
        await audioManagerRef.current.processAudioFile(files[i]);
      }
      
      if (currentTracks + files.length > maxTracks) {
        setAudioError(`Only ${maxTracks} tracks maximum allowed. Some files were not processed.`);
      }
      
      setIsProcessingAudio(false);
    } catch (error) {
      setAudioError(error.message);
      setIsProcessingAudio(false);
    }
  };

  const addNewText = () => {
    const newText: TextElement = {
      id: Date.now().toString(),
      text: 'New Text',
      x: 540,
      y: 960,
      font: 'Arial',
      size: 30,
      color: '#FFFFFF',
      isDragging: false,
      isBold: false
    };
    setTextElements([...textElements, newText]);
  };

  const updateText = (id: string, updates: Partial<TextElement>) => {
    setTextElements(texts => 
      texts.map(text => 
        text.id === id ? { ...text, ...updates } : text
      )
    );
  };

  const removeText = (id: string) => {
    setTextElements(texts => texts.filter(text => text.id !== id));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !simulationRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    simulationRef.current.handleMouseDown(x, y);

    setTextElements(texts =>
      texts.map(text => {
        const textWidth = text.text.length * (text.size / 2);
        const textHeight = text.size;
        if (
          x >= text.x - textWidth / 2 &&
          x <= text.x + textWidth / 2 &&
          y >= text.y - textHeight / 2 &&
          y <= text.y + textHeight / 2
        ) {
          return { ...text, isDragging: true };
        }
        return text;
      })
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !simulationRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    simulationRef.current.handleMouseMove(x, y);

    setTextElements(texts =>
      texts.map(text =>
        text.isDragging ? { ...text, x, y } : text
      )
    );
  };

  const handleMouseUp = () => {
    if (simulationRef.current) {
      simulationRef.current.handleMouseUp();
    }

    setTextElements(texts =>
      texts.map(text => ({ ...text, isDragging: false }))
    );
  };

  const handleCustomFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fontUrl = event.target?.result as string;
        setCustomFont(fontUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRecordingDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(Number(value)) && Number(value) > 0)) {
      setRecordingDuration(value);
    }
  };

  const handleBatchCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(Number(value)) && Number(value) > 0)) {
      setBatchRecordingCount(value);
    }
  };

  const handleAudioSegmentDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAudioSegmentDuration(value);
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        if (audioManagerRef.current) {
          audioManagerRef.current.setSegmentDuration(numValue);
        }
      }
    }
  };

  const startBatchRecording = async () => {
    if (!simulationRef.current || isRecordingBatch) return;
    
    const duration = Number(recordingDuration);
    const count = Number(batchRecordingCount);
    
    if (isNaN(duration) || duration <= 0 || isNaN(count) || count <= 0) {
      alert('Por favor, insira valores válidos para duração e quantidade de gravações.');
      return;
    }
    
    setIsRecordingBatch(true);
    recordingCountRef.current = 0;

    const recordNextSimulation = async () => {
      if (recordingCountRef.current >= count) {
        setIsRecordingBatch(false);
        return;
      }

      try {
        simulationRef.current?.reset();
        if (audioManagerRef.current) {
          audioManagerRef.current.reset();
        }

        const currentRecordingNumber = recordingCountRef.current + 1;
        const audioStream = audioManagerRef.current?.getAudioStream();
        
        simulationRef.current?.startRecording(async (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `simulation-${currentRecordingNumber}.webm`;
          a.click();
          
          URL.revokeObjectURL(url);
          
          setTimeout(() => {
            blob = null;
          }, 100);
        }, audioStream);
        
        await new Promise(resolve => setTimeout(resolve, duration * 1000));
        
        simulationRef.current?.stopRecording();
        recordingCountRef.current++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setTimeout(() => {
          recordNextSimulation();
        }, 500);
      } catch (error) {
        console.error('Failed to record batch:', error);
        setIsRecordingBatch(false);
      }
    };

    recordNextSimulation();
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
      <canvas 
        ref={canvasRef}
        width={1080}
        height={1920}
        className="max-h-screen w-auto cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm p-4 rounded-lg space-y-4">
        <div className="flex gap-2">
          <button
            onClick={handlePlayPause}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            {isRunning ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <RotateCcw className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={handleRecording}
            className={`p-2 rounded-lg transition-colors font-sans text-base ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-white/30 hover:bg-white/40 text-black'
            }`}
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: '16px',
            }}
          >
            <Video className={`w-6 h-6 ${isRecording ? 'text-white' : 'text-black'}`} />
          </button>
          <button
            onClick={() => setShowTextPanel(!showTextPanel)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <Type className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => setShowMidiPanel(!showMidiPanel)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <Music className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => setShowAudioPanel(!showAudioPanel)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <Music2 className="w-6 h-6 text-white" />
          </button>
        </div>

        {showTextPanel && (
          <div className="space-y-4 border-t border-white/20 pt-4">
            <button
              onClick={addNewText}
              className="flex items-center gap-2 text-white bg-white/20 px-3 py-1 rounded hover:bg-white/30"
            >
              <Plus className="w-4 h-4" />
              Add Text
            </button>
            
            <div>
              <label className="text-white text-sm block mb-1">Custom Font</label>
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleCustomFontUpload}
                className="text-white text-sm"
              />
            </div>
            
            {textElements.map((text) => (
              <div key={text.id} className="space-y-2 bg-white/5 p-2 rounded">
                <div className="flex justify-between items-center">
                  <input
                    type="text"
                    value={text.text}
                    onChange={(e) => updateText(text.id, { text: e.target.value })}
                    className="bg-white/20 text-white rounded px-2 py-1 w-full mr-2"
                  />
                  <button
                    onClick={() => removeText(text.id)}
                    className="text-white hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 flex gap-2">
                    <select
                      value={text.font}
                      onChange={(e) => updateText(text.id, { font: e.target.value })}
                      className="bg-white/20 text-white rounded px-2 py-1 flex-1"
                    >
                      <option value="Montserrat">Montserrat</option>
                      <option value="Montserrat Bold">Montserrat Bold</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                      {customFont && <option value={customFont}>Custom Font</option>}
                    </select>
                    
                    <button
                      onClick={() => updateText(text.id, { isBold: !text.isBold })}
                      className={`px-3 py-1 rounded ${
                        text.isBold 
                          ? 'bg-white/40 text-black' 
                          : 'bg-white/20 text-white'
                      } hover:bg-white/30 transition-colors`}
                    >
                      B
                    </button>
                  </div>
                  
                  <input
                    type="number"
                    value={text.size}
                    onChange={(e) => updateText(text.id, { size: Number(e.target.value) })}
                    className="bg-white/20 text-white rounded px-2 py-1"
                    min="10"
                    max="100"
                  />
                  
                  <input
                    type="color"
                    value={text.color}
                    onChange={(e) => updateText(text.id, { color: e.target.value })}
                    className="w-full bg-white/20 rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {showMidiPanel && (
          <div className="space-y-4 border-t border-white/20 pt-4">
            <div>
              <label className="text-white text-sm block mb-1">MIDI Notes</label>
              <textarea
                value={midiNotes}
                onChange={(e) => setMidiNotes(e.target.value)}
                placeholder="Enter notes like: C5,D5,E5,F5"
                className="w-full bg-white/20 text-white rounded px-2 py-1 h-24"
              />
              <p className="text-white/60 text-xs mt-1">
                Format: C5,Cs5,D5,Ds5,E5,F5,Fs5,G5,Gs5,A5,As5,B5
              </p>
            </div>
          </div>
        )}

        {showAudioPanel && (
          <div className="space-y-4 border-t border-white/20 pt-4">
            <div className="flex gap-2">
              <label className="relative flex gap-2 items-center p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-black" />
                <span className="text-black font-sans text-base">Upload Audio (Max 10)</span>
                <input
                  type="file"
                  accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
                  onChange={handleAudioUpload}
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isProcessingAudio}
                />
              </label>
              {isProcessingAudio && (
                <span className="text-white text-sm self-center">Processing...</span>
              )}
            </div>
            
            <div>
              <label className="text-white text-sm block mb-1">Duração do Segmento (segundos)</label>
              <input
                type="text"
                value={audioSegmentDuration}
                onChange={handleAudioSegmentDurationChange}
                className="w-24 bg-white/20 text-white rounded px-2 py-1"
                placeholder="0.3"
                pattern="^\d*\.?\d*$"
              />
              <p className="text-white/60 text-xs mt-1">
                Ex: 0.3, 0.5, 1.5, etc
              </p>
            </div>
            
            {audioError && (
              <div className="text-red-500 text-sm bg-red-500/10 p-2 rounded">
                {audioError}
              </div>
            )}
            
            <div className="text-white text-sm">
              {audioManagerRef.current && (
                <p>Tracks: {audioManagerRef.current.getTracksCount()} / {audioManagerRef.current.getMaxTracks()}</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <label className="text-white text-sm block mb-1">Gravity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={gravity}
              onChange={handleGravityChange}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm block mb-1">Velocity Increase</label>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.01"
              value={velocityIncrease}
              onChange={handleVelocityIncreaseChange}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm block mb-1">Velocity Decay</label>
            <input
              type="range"
              min="0.99"
              max="1"
              step="0.001"
              value={velocityDecay}
              onChange={handleVelocityDecayChange}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white text-sm block mb-1">Ball Growth Rate</label>
            <input
              type="range"
              min="0"
              max="0.2"
              step="0.001"
              value={ballGrowth}
              onChange={handleBallGrowthChange}
              className="w-full"
            />
          </div>

          <div className="pt-4 border-t border-white/20 space-y-2">
            <div>
              <label className="text-white text-sm block mb-1">Duração da Gravação (segundos)</label>
              <input
                type="text"
                value={recordingDuration}
                onChange={handleRecordingDurationChange}
                className="w-24 bg-white/20 text-white rounded px-2 py-1"
                placeholder="10"
              />
            </div>

            <div>
              <label className="text-white text-sm block mb-1">Quantidade de Gravações</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchRecordingCount}
                  onChange={handleBatchCountChange}
                  className="w-24 bg-white/20 text-white rounded px-2 py-1"
                  placeholder="1"
                />
                <button
                  onClick={startBatchRecording}
                  disabled={isRecordingBatch}
                  className={`px-3 py-1 rounded ${
                    isRecordingBatch
                      ? 'bg-red-500'
                      : 'bg-white/20 hover:bg-white/30'
                  } text-white text-sm`}
                >
                  {isRecordingBatch ? 'Gravando...' : 'Iniciar Lote'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
