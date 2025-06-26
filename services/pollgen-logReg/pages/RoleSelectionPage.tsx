import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const RoleSelectionPage: React.FC = () => {
    const { user, setActiveRole, logout } = useAuth();
    const navigate = useNavigate();

    // --- THIS IS THE FIX ---
    // This effect handles the case where the user object from localStorage might be malformed.
    // If the user exists but the 'roles' array doesn't, it forces a logout to clear the bad state.
    useEffect(() => {
        if (user && !Array.isArray(user.roles)) {
            toast.error("User data is outdated. Please log in again.");
            logout();
        }
    }, [user, logout]);


    // This guard now safely protects the render logic below.
    // If `user` or `user.roles` is not present, this will prevent rendering.
    if (!user || !user.roles) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500"></div>
            </div>
        );
    }

    const handleRoleSelect = (role: 'host' | 'student') => {
        if (user.roles.includes(role)) {
            setActiveRole(role);
            if (role === 'host') {
                navigate('/host-dashboard');
            } else {
                navigate('/join-meeting');
            }
        } else {
            toast.error("You are not authorized to act as a " + role);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-xl text-center">
                <h1 className="text-3xl font-bold text-gray-800">Welcome, {user.name}!</h1>
                <p className="mt-2 text-gray-600">How would you like to proceed?</p>

                <div className="mt-8 space-y-4">
                    {user.roles.includes('host') && (
                        <button
                            onClick={() => handleRoleSelect('host')}
                            className="w-full py-4 px-6 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-lg transform hover:-translate-y-1 transition-all"
                        >
                            Act as a Host
                        </button>
                    )}
                    
                    {user.roles.includes('student') && (
                         <button
                            onClick={() => handleRoleSelect('student')}
                            className="w-full py-4 px-6 text-lg font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-lg transform hover:-translate-y-1 transition-all"
                        >
                            Act as a Student
                        </button>
                    )}
                </div>

                <button onClick={logout} className="mt-8 text-sm text-gray-500 hover:text-red-600">
                    Logout
                </button>
            </div>
        </div>
    );
};

export default RoleSelectionPage;