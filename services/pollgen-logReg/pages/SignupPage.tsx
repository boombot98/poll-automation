import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roles: ['student'] as ('host' | 'student')[], // Default to student
  });
  const navigate = useNavigate();

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const role = value as 'host' | 'student';
    
    if (checked) {
        setFormData(prev => ({ ...prev, roles: [...prev.roles, role] }));
    } else {
        setFormData(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0) {
        return toast.error("Please select at least one role.");
    }
    const loadingToast = toast.loading('Creating account...');
    try {
      await axios.post('http://localhost:5000/api/auth/signup', formData);
      toast.success("Account created successfully. Please login.", { id: loadingToast });
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to create account.', { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-gray-800">Sign Up</h2>
          <div>
            <label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</label>
            <input id="name" name="name" type="text" required onChange={handleTextChange} className="mt-1 block w-full ..."/>
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
            <input id="email" name="email" type="email" required onChange={handleTextChange} className="mt-1 block w-full ..."/>
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
            <input id="password" name="password" type="password" required onChange={handleTextChange} className="mt-1 block w-full ..."/>
          </div>
          {/* Checkboxes for Roles */}
          <div>
            <label className="text-sm font-medium text-gray-700">I want to be a:</label>
            <div className="mt-2 space-y-2">
                <div className="flex items-center">
                    <input id="role-student" name="roles" type="checkbox" value="student" checked={formData.roles.includes('student')} onChange={handleRoleChange} className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"/>
                    <label htmlFor="role-student" className="ml-3 block text-sm text-gray-900">Student</label>
                </div>
                <div className="flex items-center">
                    <input id="role-host" name="roles" type="checkbox" value="host" checked={formData.roles.includes('host')} onChange={handleRoleChange} className="h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"/>
                    <label htmlFor="role-host" className="ml-3 block text-sm text-gray-900">Host</label>
                </div>
            </div>
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 ...">
            Sign Up
          </button>
          <p className="text-sm text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-teal-600 hover:text-teal-500">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
export default SignupPage;