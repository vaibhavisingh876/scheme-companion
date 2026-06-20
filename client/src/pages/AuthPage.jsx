import React, { useState, useContext } from 'react';
import { loginUser, registerUser } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const AuthPage = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setToken } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const data = await loginUser(email, password);
        if (data.success) {
          localStorage.setItem('userEmail', email);
          setToken(data.token);
          onAuthSuccess();
        }
      } else {
        const data = await registerUser(email, password);
        if (data.success) {
          setIsLogin(true);
          alert("Registration identity initialized successfully. Please sign in.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication layer processed exception loops.");
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white border border-[#d7ccc8] rounded-3xl shadow-xl transition-all">
      <h2 className="text-2xl font-black text-[#5d4037] text-center mb-6">
        {isLogin ? "Welcome Back" : "Create Account"}
      </h2>
      {error && <p className="text-red-500 text-xs font-bold mb-4 text-center">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#5d4037] mb-1">Email Address</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#fdfbf7] border border-[#d7ccc8] rounded-xl px-4 py-3 text-sm text-[#5d4037] focus:outline-none focus:border-[#5d4037] transition-all"
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#5d4037] mb-1">Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#fdfbf7] border border-[#d7ccc8] rounded-xl px-4 py-3 text-sm text-[#5d4037] focus:outline-none focus:border-[#5d4037] transition-all"
            required 
          />
        </div>
        <button type="submit" className="w-full bg-[#5d4037] text-white font-bold text-xs py-3.5 rounded-xl uppercase tracking-wider shadow-md hover:bg-[#4e342e] transition-all">
          {isLogin ? "Sign In" : "Sign Up"}
        </button>
      </form>
      <div className="text-center mt-6">
        <button onClick={() => setIsLogin(!isLogin)} className="text-xs font-bold text-[#5d4037] underline underline-offset-4 bg-transparent border-none cursor-pointer">
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;