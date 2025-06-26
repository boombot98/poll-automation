// apps/frontend/src/App2.tsx
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { GuestRecorder } from './transcription';
import type { TranscriptionResult } from '@shared/types';
import './App.css';

function HomePage() {
  const [meetingId, setMeetingId] = useState('');
  const [guestId, setGuestId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const generateLink = () => {
    if (!meetingId) return;
    const id = crypto.randomUUID(); // Or use any custom ID strategy
    setGuestId(id);
    const link = `/guest?meetingId=${encodeURIComponent(meetingId)}&displayName=${encodeURIComponent(id)}`;
    setGeneratedLink(link);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Guest Page!</h1>
      <p>Enter Meeting ID to generate a unique guest invitation link:</p>

      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Meeting ID"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          style={{ padding: '10px', marginRight: '10px', borderRadius: '4px' }}
        />

        <button
          type="button"
          onClick={generateLink}
          style={{
            padding: '10px 20px',
            fontSize: '1em',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Generate Guest Invitation Link
        </button>
      </div>

      {generatedLink && (
        <div style={{ marginTop: '30px' }}>
          <p style={{ color: '#fff' }}>Guest ID: <code>{guestId}</code></p>
          <a
            href={generatedLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#61dafb', fontSize: '1.1em' }}
          >
            {window.location.origin + generatedLink}
          </a>
        </div>
      )}
    </div>
  );
}


function App() {
  const [guestTranscripts, setGuestTranscripts] = useState<TranscriptionResult[]>([]);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guest" element={<GuestRecorder setTranscriptions={setGuestTranscripts} />} />
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>

        {/* Live Global Transcript Viewer */}
        {guestTranscripts.length > 0 && (
          <div style={{ padding: '1rem', background: '#111', color: 'white' }}>
            <h2 style={{ borderBottom: '1px solid gray' }}>Live Guest Transcription</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {guestTranscripts.map((t, i) => (
                <li key={i} style={{ marginBottom: '8px' }}>
                  <strong>{t.speaker}</strong>: {t.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
