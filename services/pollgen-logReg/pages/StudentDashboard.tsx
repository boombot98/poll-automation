import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface Poll {
  question: string;
  options: string[];
}

const StudentDashboard: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { socket } = useAuth(); 
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!socket || !meetingId) return;

    socket.emit('student-join-meeting', meetingId);

    const handlePollStarted = (pollData: Poll) => {
      setPoll(pollData);
      setHasVoted(false);
      toast.success('A new poll has started!');
    };

    const handlePollEnded = () => {
      setPoll(null);
      toast('The host has ended the poll.');
    };

    const handleMeetingEnded = () => {
      toast.error('The host has ended the meeting.');
      navigate('/select-role');
    };

    socket.on('poll-started', handlePollStarted);
    socket.on('poll-ended', handlePollEnded);
    socket.on('meeting-ended', handleMeetingEnded);

    return () => {
      socket.off('poll-started', handlePollStarted);
      socket.off('poll-ended', handlePollEnded);
      socket.off('meeting-ended', handleMeetingEnded);
    };
  }, [socket, meetingId, navigate]);

  const handleVote = (option: string) => {
    if (socket) {
      socket.emit('student-vote', { meetingId, option });
      setHasVoted(true);
      toast.success(`You voted for: ${option}`);
    } else {
      toast.error('Not connected to the server.');
    }
  };

  return (
    <div className="p-8 text-center min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
        {poll ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">{poll.question}</h1>

            {hasVoted ? (
              <p className="text-xl text-green-600 font-semibold">Thank you for voting!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {poll.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleVote(option)}
                    disabled={hasVoted}
                    className="w-full p-4 bg-teal-500 text-white font-semibold rounded-lg shadow hover:bg-teal-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Welcome to the Meeting!</h1>
            <div className="flex items-center justify-center space-x-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-teal-500"></div>
              <p className="text-xl text-gray-600">You are connected...</p>
            </div>
            <p className="text-lg text-gray-700">
              Meeting ID: <span className="font-mono font-bold text-teal-600">{meetingId}</span>
            </p>
            <p className="text-gray-600">Please wait for the host to start the poll.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
