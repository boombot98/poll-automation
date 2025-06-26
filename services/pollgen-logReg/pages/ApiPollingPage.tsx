import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import toast from 'react-hot-toast';
import { FaPlus, FaTrash, FaArrowLeft } from 'react-icons/fa';
import Icon from '../components/Icon';

interface PollResults {
  [key: string]: number;
}

const ApiPollingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const meetingId = location.state?.meetingId;
  const { socket } = useAuth(); 

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isPollActive, setIsPollActive] = useState(false);
  const [results, setResults] = useState<PollResults>({});
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (!socket || !meetingId) {
      if (!meetingId) toast.error('No meeting ID found. Redirecting...');
      navigate('/host-dashboard');
      return;
    }

    // Already joined from previous navigation; just set up listeners
    const handleUpdateResults = (newResults: PollResults) => setResults(newResults);
    const handleUpdateCount = (count: number) => setStudentCount(count);
    const handlePollEnded = () => {
      setIsPollActive(false);
      setQuestion('');
      setOptions(['', '']);
      toast("Poll has ended.");
    };

    socket.on('update-results', handleUpdateResults);
    socket.on('update-student-count', handleUpdateCount);
    socket.on('poll-ended', handlePollEnded);

    return () => {
      socket.off('update-results', handleUpdateResults);
      socket.off('update-student-count', handleUpdateCount);
      socket.off('poll-ended', handlePollEnded);
    };
  }, [socket, meetingId, navigate]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      toast.error('A poll must have at least two options.');
    }
  };

  const startPoll = () => {
    if (!question.trim()) {
      return toast.error('Please enter a question.');
    }
    if (options.some(opt => !opt.trim())) {
      return toast.error('All options must be filled out.');
    }
    if (socket) {
      const poll = { question, options };
      socket.emit('host-start-poll', { meetingId, poll });
      setIsPollActive(true);
      toast.success('Poll started!');
    }
  };

  const endPoll = () => {
    if (socket) {
      socket.emit('host-end-poll', { meetingId });
    }
  };

  const totalVotes = Object.values(results).reduce((sum, count) => sum + count, 0);

  return (
    <div className="p-8 bg-gray-100 min-h-[calc(100vh-64px)]">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/host-dashboard')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <Icon as={FaArrowLeft} /> Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">API Polling Session</h1>
            <span className="text-lg font-medium text-gray-600">Connected Students: {studentCount}</span>
          </div>

          {!isPollActive ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-lg font-medium text-gray-700">
                  Poll Question
                </label>
                <input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="mt-1 block w-full text-xl p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-700">Options</label>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 mt-2">
                    <input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                    <button
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded-full"
                    >
                      <Icon as={FaTrash} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Icon as={FaPlus} /> Add Option
                </button>
              </div>

              <button
                onClick={startPoll}
                className="w-full py-3 px-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
              >
                Start Poll
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">{question}</h2>
              <p className="text-gray-600">Live results... Total Votes: {totalVotes}</p>

              <div className="space-y-3">
                {Object.entries(results).map(([option, votes]) => {
                  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  return (
                    <div key={option}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-700">{option}</span>
                        <span className="text-sm font-bold text-gray-600">{votes} vote(s)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-blue-500 h-6 rounded-full text-center text-white font-bold transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 10 && `${percentage.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={endPoll}
                className="w-full mt-4 py-3 px-4 text-lg font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm"
              >
                End Poll
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiPollingPage;
