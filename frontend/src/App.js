import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Main App Component
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('auth'); // 'auth', 'email-verification', 'profile-setup', 'main'
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      
      // Check if profile is complete
      const hasPhotos = response.data.photos && response.data.photos.length >= 3;
      const hasAnswers = response.data.question_answers && response.data.question_answers.length >= 3;
      
      if (hasPhotos && hasAnswers) {
        setCurrentView('main');
      } else {
        setCurrentView('profile-setup');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
        setCurrentView('auth');
      }
    }
  };

  const handleLogin = (userData, userToken) => {
    setCurrentUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
  };

  const handleRegistration = (registrationData) => {
    // Store registration email for verification flow
    if (registrationData && registrationData.email) {
      localStorage.setItem('pending-verification-email', registrationData.email);
    }
    setCurrentView('email-verification');
  };

  const handleEmailVerified = () => {
    // Clear pending verification email
    localStorage.removeItem('pending-verification-email');
    setCurrentView('auth');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setCurrentView('auth');
  };

  // Check URL for verification token
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verificationToken = urlParams.get('token');
    if (verificationToken) {
      setCurrentView('email-verification');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100">
      {currentView === 'auth' && (
        <AuthView onLogin={handleLogin} onRegistration={handleRegistration} />
      )}
      {currentView === 'email-verification' && (
        <EmailVerificationView onEmailVerified={handleEmailVerified} />
      )}
      {currentView === 'profile-setup' && (
        <ProfileSetupView 
          token={token} 
          currentUser={currentUser}
          onComplete={fetchUserProfile}
        />
      )}
      {currentView === 'main' && (
        <MainView 
          token={token} 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

// Email Verification View Component
const EmailVerificationView = ({ onEmailVerified }) => {
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'error', 'pending'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    // Check if we have a pending verification email from registration
    const pendingEmail = localStorage.getItem('pending-verification-email');
    if (pendingEmail) {
      setEmail(pendingEmail);
    }
    
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('pending');
      if (pendingEmail) {
        setMessage(`Please check your email (${pendingEmail}) for the verification link.`);
      } else {
        setMessage('Please check your email for the verification link.');
      }
    }
  }, []);

  const verifyEmail = async (token) => {
    try {
      setStatus('checking');
      setMessage('Verifying your email...');
      
      const response = await axios.post(`${API}/verify-email`, { token });
      
      setStatus('success');
      setMessage(response.data.message);
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        onEmailVerified();
      }, 3000);
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.detail || 'Verification failed');
    }
  };

  const resendVerification = async () => {
    if (!email) {
      alert('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/resend-verification`, { email });
      setMessage('Verification email resent! Please check your inbox.');
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to resend verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">💕 DateConnect</h1>
          <h2 className="text-xl font-semibold text-gray-700">Email Verification</h2>
        </div>

        {status === 'checking' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-green-600 mb-4">{message}</p>
            <p className="text-gray-600">Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-600 mb-6">{message}</p>
            <button
              onClick={onEmailVerified}
              className="w-full bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600"
            >
              Back to Login
            </button>
          </div>
        )}

        {status === 'pending' && (
          <div className="text-center">
            <div className="text-6xl mb-4">📧</div>
            <p className="text-gray-600 mb-6">{message}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder={email || "Enter your email to resend verification"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <button
                onClick={resendVerification}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>
              
              <button
                onClick={onEmailVerified}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Authentication View Component
const AuthView = ({ onLogin, onRegistration }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    age: '',
    gender: '',
    gender_preference: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const response = await axios.post(`${API}/login`, {
          email: formData.email,
          password: formData.password
        });
        onLogin(response.data.user, response.data.access_token);
      } else {
        // Validate required fields for registration
        if (!formData.email || !formData.password || !formData.first_name || 
            !formData.age || !formData.gender || !formData.gender_preference) {
          setError('Please fill in all required fields');
          return;
        }

        const payload = {
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          age: parseInt(formData.age),
          gender: formData.gender,
          gender_preference: formData.gender_preference
        };
        
        const response = await axios.post(`${API}/register`, payload);
        // Registration successful, show verification message
        setError(''); // Clear any previous errors
        onRegistration({ email: formData.email, message: response.data.message });
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">💕 DateConnect</h1>
          <p className="text-gray-600">Find meaningful connections</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">
                Must contain 8+ characters, uppercase, lowercase, number, and special character
              </p>
            )}
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  required
                  min="18"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="">Select your gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Looking for
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  value={formData.gender_preference}
                  onChange={(e) => setFormData({...formData, gender_preference: e.target.value})}
                >
                  <option value="">Who would you like to meet?</option>
                  <option value="male">Men</option>
                  <option value="female">Women</option>
                  <option value="both">Everyone</option>
                </select>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 transition duration-200"
          >
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-pink-600 hover:text-pink-700 text-sm"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Profile Setup View Component (keeping previous implementation with slight updates)
const ProfileSetupView = ({ token, currentUser, onComplete }) => {
  const [step, setStep] = useState(1); // 1: photos, 2: questions
  const [photos, setPhotos] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchQuestions();
    if (currentUser?.photos) {
      setPhotos(currentUser.photos);
    }
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${API}/profile/questions`);
      setQuestions(response.data.questions);
    } catch (err) {
      setError('Failed to load questions');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Please select an image under 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API}/profile/upload-photo`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Refresh user profile to get updated photos
      const profileResponse = await axios.get(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPhotos(profileResponse.data.photos || []);
      
      // Show success message
      console.log(`Photo uploaded successfully! Total photos: ${response.data.photo_count}`);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || 'Failed to upload photo. Please try again.');
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleQuestionSelect = (questionIndex) => {
    if (selectedQuestions.includes(questionIndex)) {
      setSelectedQuestions(selectedQuestions.filter(q => q !== questionIndex));
      const newAnswers = {...answers};
      delete newAnswers[questionIndex];
      setAnswers(newAnswers);
    } else if (selectedQuestions.length < 5) {
      setSelectedQuestions([...selectedQuestions, questionIndex]);
    }
  };

  const handleAnswerChange = (questionIndex, answer) => {
    setAnswers({...answers, [questionIndex]: answer});
  };

  const getWordCount = (text) => {
    return text ? text.trim().split(/\s+/).length : 0;
  };

  const handleComplete = async () => {
    if (photos.length < 3) {
      setError('Please upload at least 3 photos');
      return;
    }

    if (selectedQuestions.length < 3) {
      setError('Please answer at least 3 questions');
      return;
    }

    // Validate word counts
    for (const questionIndex of selectedQuestions) {
      const answer = answers[questionIndex];
      if (!answer || getWordCount(answer) < 20) {
        setError(`Answer to question ${questionIndex + 1} must be at least 20 words`);
        return;
      }
    }

    try {
      setLoading(true);
      const questionAnswers = selectedQuestions.map(questionIndex => ({
        question_index: questionIndex,
        answer: answers[questionIndex]
      }));

      await axios.put(`${API}/profile`, {
        question_answers: questionAnswers
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onComplete();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Profile</h1>
          
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Add Your Photos</h2>
              <p className="text-gray-600 mb-6">Upload at least 3 photos to continue</p>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                {photos.map((photo, index) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                {photos.length < 10 && (
                  <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-pink-400">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={loading}
                    />
                    <div className="text-center">
                      {loading ? (
                        <div className="text-2xl">⏳</div>
                      ) : (
                        <>
                          <div className="text-3xl text-gray-400 mb-2">+</div>
                          <div className="text-sm text-gray-500">Add Photo</div>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Debug info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <p>Photos uploaded: {photos.length} / 3 required</p>
                {loading && <p className="text-blue-600">Uploading photo...</p>}
                {error && <p className="text-red-600">Error: {error}</p>}
              </div>

              {photos.length >= 3 && (
                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600"
                >
                  Next: Answer Questions
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Answer Questions</h2>
              <p className="text-gray-600 mb-6">Select and answer at least 3 questions (minimum 20 words each)</p>
              
              <div className="space-y-4 mb-6">
                {questions.map((q) => (
                  <div key={q.index} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(q.index)}
                        onChange={() => handleQuestionSelect(q.index)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 mb-2">{q.question}</p>
                        {selectedQuestions.includes(q.index) && (
                          <div>
                            <textarea
                              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500"
                              rows="3"
                              placeholder="Your answer (minimum 20 words)..."
                              value={answers[q.index] || ''}
                              onChange={(e) => handleAnswerChange(q.index, e.target.value)}
                            />
                            <div className="text-sm text-gray-500 mt-1">
                              Words: {getWordCount(answers[q.index])} / 20 minimum
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                >
                  Back to Photos
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading || selectedQuestions.length < 3}
                  className="flex-1 bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Complete Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App View Component (keeping previous implementation)
const MainView = ({ token, currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'matches', 'profile'
  const [users, setUsers] = useState([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [showProfileDetail, setShowProfileDetail] = useState(false);

  useEffect(() => {
    if (activeTab === 'discover') {
      fetchUsers();
    } else if (activeTab === 'matches') {
      fetchMatches();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/discover`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data.users);
      setCurrentUserIndex(0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  };

  const viewProfile = async (userId) => {
    try {
      await axios.post(`${API}/profile/${userId}/view`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowProfileDetail(true);
    } catch (err) {
      console.error('Failed to record profile view:', err);
    }
  };

  const likeUser = async (userId) => {
    try {
      const response = await axios.post(`${API}/profile/${userId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.match) {
        alert("🎉 It's a match!");
        fetchMatches();
      }
      
      // Move to next user
      setCurrentUserIndex(currentUserIndex + 1);
      setShowProfileDetail(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to like user');
    }
  };

  const passUser = () => {
    setCurrentUserIndex(currentUserIndex + 1);
    setShowProfileDetail(false);
  };

  const currentDisplayUser = users[currentUserIndex];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">💕 DateConnect</h1>
          <button
            onClick={onLogout}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto p-4">
        {activeTab === 'discover' && (
          <div>
            {currentDisplayUser && currentUserIndex < users.length ? (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                {!showProfileDetail ? (
                  // Card Preview
                  <div className="relative">
                    <div className="aspect-[3/4] bg-gray-100">
                      {currentDisplayUser.photos?.[0] && (
                        <img 
                          src={currentDisplayUser.photos[0]} 
                          alt={currentDisplayUser.first_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <h2 className="text-white text-xl font-bold">
                        {currentDisplayUser.first_name}, {currentDisplayUser.age}
                      </h2>
                      {currentDisplayUser.location && (
                        <p className="text-white/80 text-sm">{currentDisplayUser.location}</p>
                      )}
                      <p className="text-white/60 text-xs mt-1">
                        {currentDisplayUser.gender} • Looking for {currentDisplayUser.gender_preference}
                      </p>
                    </div>
                    <button
                      onClick={() => viewProfile(currentDisplayUser.id)}
                      className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white p-2 rounded-full"
                    >
                      ℹ️
                    </button>
                  </div>
                ) : (
                  // Full Profile Detail
                  <div className="max-h-96 overflow-y-auto">
                    <div className="aspect-[3/4] bg-gray-100">
                      {currentDisplayUser.photos?.[0] && (
                        <img 
                          src={currentDisplayUser.photos[0]} 
                          alt={currentDisplayUser.first_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="text-xl font-bold mb-2">
                        {currentDisplayUser.first_name}, {currentDisplayUser.age}
                      </h2>
                      <p className="text-gray-600 text-sm mb-4">
                        {currentDisplayUser.gender} • Looking for {currentDisplayUser.gender_preference}
                      </p>
                      
                      {currentDisplayUser.question_answers?.map((qa, index) => (
                        <div key={index} className="mb-4">
                          <p className="font-medium text-gray-800 mb-1 text-sm">
                            Q: {qa.question_index !== undefined ? `Question ${qa.question_index + 1}` : 'Question'}
                          </p>
                          <p className="text-gray-700 text-sm">{qa.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="p-4 flex space-x-4">
                  <button
                    onClick={passUser}
                    className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl hover:bg-gray-600"
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => likeUser(currentDisplayUser.id)}
                    disabled={!showProfileDetail}
                    className="flex-1 bg-pink-500 text-white py-3 px-4 rounded-xl hover:bg-pink-600 disabled:opacity-50"
                  >
                    {showProfileDetail ? '💕 Like' : 'View Profile First'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No more users to discover!</p>
                <button
                  onClick={fetchUsers}
                  className="mt-4 bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Your Matches</h2>
            {matches.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {matches.map((match) => (
                  <div key={match.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="aspect-square bg-gray-100">
                      {match.photos?.[0] && (
                        <img 
                          src={match.photos[0]} 
                          alt={match.first_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium">{match.first_name}</h3>
                      <p className="text-sm text-gray-600">Start chatting!</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No matches yet. Keep swiping!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">Your Profile</h2>
            <div className="space-y-4">
              <div>
                <strong>Name:</strong> {currentUser?.first_name}
              </div>
              <div>
                <strong>Age:</strong> {currentUser?.age}
              </div>
              <div>
                <strong>Gender:</strong> {currentUser?.gender}
              </div>
              <div>
                <strong>Looking for:</strong> {currentUser?.gender_preference}
              </div>
              <div>
                <strong>Photos:</strong> {currentUser?.photos?.length || 0}
              </div>
              <div>
                <strong>Questions Answered:</strong> {currentUser?.question_answers?.length || 0}
              </div>
              <div>
                <strong>Email Verified:</strong> {currentUser?.email_verified ? '✅' : '❌'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-3 text-center ${activeTab === 'discover' ? 'text-pink-600 bg-pink-50' : 'text-gray-600'}`}
          >
            🔍 Discover
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-3 text-center ${activeTab === 'matches' ? 'text-pink-600 bg-pink-50' : 'text-gray-600'}`}
          >
            💕 Matches
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center ${activeTab === 'profile' ? 'text-pink-600 bg-pink-50' : 'text-gray-600'}`}
          >
            👤 Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
