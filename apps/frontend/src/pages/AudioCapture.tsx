import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, Settings, Activity, Pause, Play } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import GlassCard from '../components/GlassCard';

const AudioCapture = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [selectedMic, setSelectedMic] = useState('default');
  const [waveformData, setWaveformData] = useState<number[]>(Array(50).fill(0));

  // Mock microphone devices
  const micDevices = [
    { id: 'default', name: 'Default Microphone' },
    { id: 'external', name: 'External USB Microphone' },
    { id: 'headset', name: 'Bluetooth Headset' },
  ];

  // Simulate waveform animation
  useEffect(() => {
    if (isRecording && !isPaused) {
      const interval = setInterval(() => {
        setWaveformData(prev => {
          const newData = [...prev];
          for (let i = 0; i < newData.length; i++) {
            newData[i] = Math.random() * 100;
          }
          return newData;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isRecording, isPaused]);

  // Simulate transcription
  useEffect(() => {
    if (isRecording && !isPaused) {
      const mockTranscriptions = [
        "Today we're going to discuss React hooks and their implementation...",
        "State management is crucial for building scalable applications...",
        "Let's explore the useEffect hook and its dependency array...",
        "Component lifecycle methods can be replaced with hooks...",
        "Error boundaries are important for handling runtime errors..."
      ];

      const interval = setInterval(() => {
        const randomText = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
        setTranscription(prev => prev + " " + randomText);
        setConfidence(Math.random() * 30 + 70); // 70-100% confidence
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isRecording, isPaused]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setIsPaused(false);
    } else {
      setIsRecording(true);
      setTranscription('');
      setConfidence(0);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const clearTranscription = () => {
    setTranscription('');
    setConfidence(0);
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 "
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Audio Capture</h1>
            <p className="text-gray-400">Real-time audio recording and transcription</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isRecording
                ? isPaused
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
              }`}>
              {isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Stopped'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recording Controls */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Recording Controls</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center ${isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-primary-500 hover:bg-primary-600'
                    } transition-colors duration-200`}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 text-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </motion.button>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={togglePause}
                  disabled={!isRecording}
                  className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={clearTranscription}
                  className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors duration-200"
                >
                  Clear
                </motion.button>
              </div>
            </div>
          </GlassCard>

          {/* Microphone Settings */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Microphone Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Microphone
                </label>
                <select
                  value={selectedMic}
                  onChange={(e) => setSelectedMic(e.target.value)}
                  className="w-full bg-white/10 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {/* System Speaker Option */}
                  <option value="system-speaker" className="bg-gray-800">
                    System Speaker
                  </option>
                  {micDevices.map(device => (
                    <option key={device.id} value={device.id} className="bg-gray-800">
                      {device.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Volume Level
                </label>
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div className="bg-primary-500 rounded-full h-2 w-3/4" />
                  </div>
                  <span className="text-sm text-gray-400">75%</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Accuracy Indicator */}
          <GlassCard className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">Transcription Accuracy</h3>
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2"
                    strokeDasharray={`${confidence}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{Math.round(confidence)}%</span>
                </div>
              </div>
              <p className="text-gray-400">Real-time accuracy</p>
            </div>
          </GlassCard>
        </div>

        {/* Waveform Visualizer */}
        <GlassCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Audio Waveform</h3>
          <div className="bg-black/20 rounded-lg p-4 h-32 flex items-end justify-center space-x-1">
            {waveformData.map((height, index) => (
              <motion.div
                key={index}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.1 }}
                className="bg-gradient-to-t from-primary-500 to-secondary-500 w-2 rounded-t-sm min-h-[2px]"
              />
            ))}
          </div>
        </GlassCard>

        {/* Transcription Output */}
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h3 className="text-xl font-bold text-white">Real-time Transcription</h3>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {transcription ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-300 leading-relaxed"
              >
                {transcription}
              </motion.p>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  {isRecording
                    ? 'Listening for speech...'
                    : 'Click the microphone to start recording'
                  }
                </p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors duration-200"
          >
            Generate Questions
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors duration-200"
          >
            Export Transcript
          </motion.button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default AudioCapture;
