import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const StudentJoinPage: React.FC = () => {
  const [meetingId, setMeetingId] = useState('');
  const { user, socket } = useAuth(); 
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    const handleJoinSuccess = (joinedMeetingId: string) => {
      toast.success('Successfully joined the meeting!');
      navigate(`/student-dashboard/${joinedMeetingId}`);
    };

    const handleErrorJoining = (data: { message: string }) => {
      toast.error(data.message);
    };

    socket.on('join-success', handleJoinSuccess);
    socket.on('error-joining', handleErrorJoining);

    return () => {
      socket.off('join-success', handleJoinSuccess);
      socket.off('error-joining', handleErrorJoining);
    };
  }, [socket, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && meetingId.trim()) {
      socket.emit('student-join-meeting', meetingId.trim());
    } else {
      toast.error('Please enter a meeting ID.');
    }
  };

  return (
    <div className="p-8 min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Join a Meeting</h2>
            <p className="mt-2 text-gray-600">Welcome, {user?.name || 'Guest'}! Please enter the Meeting ID.</p>
          </div>
          <div>
            <label htmlFor="meetingId" className="sr-only">Meeting ID</label>
            <input 
              id="meetingId"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500"
              placeholder="e.g., a1b2c3d4-e5f6-..."
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
            Join Meeting
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentJoinPage;
