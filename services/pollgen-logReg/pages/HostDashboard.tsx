import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FaCopy, FaCheck } from 'react-icons/fa';
import Icon from '../components/Icon';

const HostDashboard: React.FC = () => {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const { user, socket } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    socket.emit('host-create-meeting');

    const handleMeetingCreated = (id: string) => {
      setMeetingId(id);
    };
    const handleStudentJoined = () => {
      toast.success('A student has joined your meeting!', { icon: '👋' });
    };

    // Attach listeners
    socket.on('meeting-created', handleMeetingCreated);
    socket.on('student-joined', handleStudentJoined);


    return () => {
      socket.off('meeting-created', handleMeetingCreated);
      socket.off('student-joined', handleStudentJoined);
    };
  }, [socket]); // The effect now depends only on the shared socket

  const handleCopy = () => {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <div className="p-8 text-center bg-gray-50 min-h-[calc(100vh-64px)] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-800">Welcome, Host {user?.name}!</h1>
        <p className="text-xl text-gray-600">Your meeting is ready. Share the ID with your students.</p>

        {meetingId ? (
          <div className="p-6 border-2 border-dashed border-teal-500 rounded-lg bg-white shadow-sm">
            <p className="text-lg mb-2 text-gray-700">Your Unique Meeting ID:</p>
            <div className="flex justify-center items-center gap-4">
              <h2 className="text-4xl font-mono text-teal-600 tracking-wider">{meetingId}</h2>
              <button
                onClick={handleCopy}
                className="p-3 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
                aria-label="Copy meeting ID"
              >
                {hasCopied ? <Icon as={FaCheck} className="text-green-500" /> : <Icon as={FaCopy} className="text-gray-600" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500"></div>
        )}

        <p className="text-gray-600">Once students join, you can start polling.</p>

        <div className="flex flex-col md:flex-row gap-8">
          <button
            className="flex flex-col items-center justify-center bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transform hover:-translate-y-1 transition-all duration-300 h-40 w-64 text-2xl font-semibold"
            onClick={() => navigate('/api-polling', { state: { meetingId } })}
            disabled={!meetingId}
          >
            Start API Polling
          </button>
          <button
            className="flex flex-col items-center justify-center bg-purple-500 text-white rounded-lg shadow-lg hover:bg-purple-600 transform hover:-translate-y-1 transition-all duration-300 h-40 w-64 text-2xl font-semibold"
            onClick={() => navigate('/llm-polling', { state: { meetingId } })}
            disabled={!meetingId}
          >
            Start LLM Polling
          </button>
        </div>
      </div>
    </div>
  );
};

export default HostDashboard;
