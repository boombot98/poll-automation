import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Logging in...');
    try {
      const { data } = await axios.post('http://localhost:5000/api/auth/login', formData);
      toast.success(`Welcome back, ${data.result.name}!`, { id: loadingToast });
      login(data.result, data.token); // This will handle navigation
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid credentials.', { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-gray-800">Login</h2>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
            <input id="email" name="email" type="email" required onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500"/>
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
            <input id="password" name="password" type="password" required onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500"/>
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
            Login
          </button>
          <p className="text-sm text-center text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-teal-600 hover:text-teal-500">
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;