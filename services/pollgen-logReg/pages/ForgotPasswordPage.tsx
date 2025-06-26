import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        const loadingToast = toast.loading('Sending reset link...');
        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/forgot-password', { email });
            toast.success('Request sent successfully.', { id: loadingToast });
            setMessage(data.message);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not send reset link.', { id: loadingToast });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-md">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <h2 className="text-2xl font-bold text-center text-gray-800">Forgot Password</h2>
                    <p className="text-center text-gray-600">Enter your email address and we will send you a link to reset your password.</p>
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                        <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"/>
                    </div>
                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                        Send Reset Link
                    </button>
                    {message && <p className="text-center text-green-600">{message}</p>}
                    <p className="text-sm text-center text-gray-600">
                        Remember your password?{' '}
                        <Link to="/login" className="font-medium text-teal-600 hover:text-teal-500">
                            Login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;