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
  const [step, setStep] = useState(1); // 1: location, 2: photos, 3: questions
  const [photos, setPhotos] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Location state
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
  const [searchRadius, setSearchRadius] = useState(25);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    fetchQuestions();
    if (currentUser?.photos) {
      setPhotos(currentUser.photos);
    }
    if (currentUser?.location) {
      setLocation(currentUser.location);
    }
    if (currentUser?.latitude && currentUser?.longitude) {
      setCoordinates({ lat: currentUser.latitude, lng: currentUser.longitude });
    }
    if (currentUser?.search_radius) {
      setSearchRadius(currentUser.search_radius);
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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      setLocationError('');
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const locationName = `${data.city}, ${data.principalSubdivision}`;
            setLocation(locationName);
          } catch (err) {
            setLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          }
          
          setLoading(false);
        },
        (error) => {
          setLocationError('Unable to get your location. Please enter it manually.');
          setLoading(false);
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }
  };

  const searchLocation = async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setLocationError('');
    
    try {
      // Using a free geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/forward-geocode-client?query=${encodeURIComponent(query)}&localityLanguage=en`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setCoordinates({ lat: result.latitude, lng: result.longitude });
        setLocation(query);
      } else {
        setLocationError('Location not found. Please try a different search.');
      }
    } catch (err) {
      setLocationError('Error searching for location. Please try again.');
    }
    
    setLoading(false);
  };

  const saveLocation = async () => {
    if (!location || !coordinates.lat || !coordinates.lng) {
      setLocationError('Please select a location first.');
      return false;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/profile/location`, {
        location: location,
        latitude: coordinates.lat,
        longitude: coordinates.lng
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Also save search radius
      await axios.put(`${API}/profile/search-preferences`, {
        search_radius: searchRadius
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLoading(false);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save location');
      setLoading(false);
      return false;
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

  const handleNextStep = async () => {
    if (step === 1) {
      // Location step
      const saved = await saveLocation();
      if (saved) {
        setStep(2);
      }
    } else if (step === 2) {
      // Photos step
      if (photos.length >= 3) {
        setStep(3);
      } else {
        setError('Please upload at least 3 photos');
      }
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Profile</h1>
          
          {/* Progress indicator */}
          <div className="flex justify-between items-center mb-8">
            <div className={`flex items-center ${step >= 1 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-pink-600 text-white' : 'bg-gray-300'}`}>
                1
              </div>
              <span className="ml-2 text-sm">Location</span>
            </div>
            <div className={`flex items-center ${step >= 2 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-pink-600 text-white' : 'bg-gray-300'}`}>
                2
              </div>
              <span className="ml-2 text-sm">Photos</span>
            </div>
            <div className={`flex items-center ${step >= 3 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-pink-600 text-white' : 'bg-gray-300'}`}>
                3
              </div>
              <span className="ml-2 text-sm">Questions</span>
            </div>
          </div>
          
          {step === 2 && (
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

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                >
                  Back to Location
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={photos.length < 3}
                  className="flex-1 bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600 disabled:opacity-50"
                >
                  Next: Answer Questions
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Set Your Location</h2>
              <p className="text-gray-600 mb-6">Help us find people near you by setting your location and search radius.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Location
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Enter city, state"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          searchLocation(location);
                        }
                      }}
                    />
                    <button
                      onClick={() => searchLocation(location)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      Search
                    </button>
                    <button
                      onClick={getCurrentLocation}
                      disabled={loading}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      Use Current
                    </button>
                  </div>
                  {locationError && (
                    <p className="text-red-500 text-sm mt-1">{locationError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Radius: {searchRadius} miles
                  </label>
                  <div className="px-3">
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                      className="location-slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1 mile</span>
                      <span>50 miles</span>
                    </div>
                  </div>
                </div>

                {coordinates.lat && coordinates.lng && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 text-sm">
                      ✅ Location set: {location}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={handleNextStep}
                  disabled={loading || !coordinates.lat || !coordinates.lng}
                  className="w-full bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Next: Add Photos'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
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

          {step === 3 && (
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
                  onClick={() => setStep(2)}
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
  const [activeTab, setActiveTab] = useState('discover'); // 'discover', 'matches', 'messages', 'profile'
  const [users, setUsers] = useState([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [websocket, setWebsocket] = useState(null);

  // WebSocket connection
  useEffect(() => {
    if (token && currentUser) {
      const backendUrl = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${backendUrl}/ws/${currentUser.id}?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWebsocket(ws);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          // Handle new message
          console.log('New message received:', data.message);
          // Refresh conversations if on messages tab
          if (activeTab === 'messages') {
            fetchConversations();
          }
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWebsocket(null);
      };
      
      return () => {
        ws.close();
      };
    }
  }, [token, currentUser, activeTab]);

  useEffect(() => {
    if (activeTab === 'discover') {
      fetchUsers();
    } else if (activeTab === 'matches') {
      fetchMatches();
    } else if (activeTab === 'messages') {
      fetchConversations();
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

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data.conversations);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
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

  const blockUser = async (userId) => {
    if (!confirm('Are you sure you want to block this user? They will no longer appear in your discover feed.')) {
      return;
    }

    try {
      await axios.post(`${API}/users/${userId}/block`, {
        user_id: userId,
        reason: 'Blocked from discover'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('User blocked successfully');
      setCurrentUserIndex(currentUserIndex + 1);
      setShowProfileDetail(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to block user');
    }
  };

  const reportUser = async (userId) => {
    const categories = [
      { value: 'harassment', label: 'Harassment' },
      { value: 'fake_profile', label: 'Fake Profile' },
      { value: 'inappropriate_content', label: 'Inappropriate Content' },
      { value: 'spam', label: 'Spam' },
      { value: 'other', label: 'Other' }
    ];

    const category = prompt(`Report this user for:\n${categories.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}\n\nEnter 1-5:`);
    if (!category || category < 1 || category > 5) return;

    const description = prompt('Please describe the issue:');
    if (!description) return;

    try {
      await axios.post(`${API}/users/${userId}/report`, {
        reported_user_id: userId,
        category: categories[category - 1].value,
        description: description,
        evidence_photos: []
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Report submitted successfully. Our team will review it shortly.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to report user');
    }
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
                        {currentDisplayUser.photo_verified && (
                          <span className="ml-2 text-blue-400" title="Verified">✅</span>
                        )}
                      </h2>
                      {currentDisplayUser.location && (
                        <p className="text-white/80 text-sm">
                          {currentDisplayUser.location}
                          {currentDisplayUser.distance && (
                            <span className="ml-2">• {currentDisplayUser.distance} miles away</span>
                          )}
                        </p>
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
                    <div className="absolute top-4 left-4 flex space-x-2">
                      <button
                        onClick={() => reportUser(currentDisplayUser.id)}
                        className="bg-red-500/80 backdrop-blur-sm text-white p-2 rounded-full text-sm"
                        title="Report User"
                      >
                        ⚠️
                      </button>
                      <button
                        onClick={() => blockUser(currentDisplayUser.id)}
                        className="bg-gray-500/80 backdrop-blur-sm text-white p-2 rounded-full text-sm"
                        title="Block User"
                      >
                        🚫
                      </button>
                    </div>
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
                        {currentDisplayUser.photo_verified && (
                          <span className="ml-2 text-blue-500" title="Verified">✅</span>
                        )}
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

        {activeTab === 'messages' && (
          <div>
            {selectedConversation ? (
              <ChatView
                conversation={selectedConversation}
                currentUser={currentUser}
                token={token}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div>
                <h2 className="text-xl font-bold mb-4">Messages</h2>
                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden">
                            {conv.other_user?.photos?.[0] && (
                              <img
                                src={conv.other_user.photos[0]}
                                alt={conv.other_user.first_name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">
                              {conv.other_user?.first_name}, {conv.other_user?.age}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">
                              {conv.last_message || 'Start a conversation...'}
                            </p>
                          </div>
                          <div className="text-xs text-gray-400">
                            {conv.last_message_at && new Date(conv.last_message_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No conversations yet. Start by matching with someone!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            {selectedConversation ? (
              <ChatView
                conversation={selectedConversation}
                currentUser={currentUser}
                token={token}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <div>
                <h2 className="text-xl font-bold mb-4">Messages</h2>
                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden">
                            {conv.other_user?.photos?.[0] && (
                              <img
                                src={conv.other_user.photos[0]}
                                alt={conv.other_user.first_name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">
                              {conv.other_user?.first_name}, {conv.other_user?.age}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">
                              {conv.last_message || 'Start a conversation...'}
                            </p>
                          </div>
                          <div className="text-xs text-gray-400">
                            {conv.last_message_at && new Date(conv.last_message_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No conversations yet. Start by matching with someone!</p>
                  </div>
                )}
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
                <strong>Location:</strong> {currentUser?.location || 'Not set'}
              </div>
              <div>
                <strong>Search Radius:</strong> {currentUser?.search_radius || 25} miles
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
              <div>
                <strong>Photo Verified:</strong> {currentUser?.photo_verified ? '✅' : '❌'}
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold mb-3">Location Settings</h3>
                <LocationSettings currentUser={currentUser} token={token} onUpdate={() => window.location.reload()} />
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-semibold mb-3">Safety & Security</h3>
                <SafetyCenter currentUser={currentUser} token={token} onUpdate={() => window.location.reload()} />
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
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-3 text-center ${activeTab === 'messages' ? 'text-pink-600 bg-pink-50' : 'text-gray-600'}`}
          >
            💬 Messages
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

// Chat View Component
const ChatView = ({ conversation, currentUser, token, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [showQuestionSelection, setShowQuestionSelection] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    fetchConversationStatus();
    fetchAvailableQuestions();
  }, [conversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/conversations/${conversation.match_id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchConversationStatus = async () => {
    try {
      const response = await axios.get(`${API}/conversations/${conversation.match_id}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversationStarted(response.data.conversation_started);
    } catch (err) {
      console.error('Failed to fetch conversation status:', err);
    }
  };

  const fetchAvailableQuestions = async () => {
    try {
      const response = await axios.get(`${API}/conversations/${conversation.match_id}/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableQuestions(response.data.questions_with_answers);
    } catch (err) {
      console.error('Failed to fetch available questions:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // For first message, ensure a question is selected
    if (!conversationStarted && !selectedQuestion) {
      alert('Please select a question to respond to for your first message');
      return;
    }

    // Check word count for first message
    if (!conversationStarted) {
      const wordCount = newMessage.trim().split(/\s+/).length;
      if (wordCount < 20) {
        alert(`First message must be at least 20 words (currently ${wordCount})`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        content: newMessage,
        message_type: 'text'
      };

      if (!conversationStarted && selectedQuestion) {
        payload.response_to_question = selectedQuestion.question_index;
      }

      await axios.post(`${API}/conversations/${conversation.match_id}/messages`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNewMessage('');
      setSelectedQuestion(null);
      setShowQuestionSelection(false);
      setConversationStarted(true);
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const getWordCount = (text) => {
    return text ? text.trim().split(/\s+/).length : 0;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4 flex items-center space-x-3">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-800">
          ← Back
        </button>
        <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden">
          {conversation.other_user?.photos?.[0] && (
            <img
              src={conversation.other_user.photos[0]}
              alt={conversation.other_user.first_name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div>
          <h3 className="font-medium">
            {conversation.other_user?.first_name}, {conversation.other_user?.age}
          </h3>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {!conversationStarted && (
          <div className="text-center py-4">
            <p className="text-gray-600 text-sm">
              Start the conversation by responding to one of {conversation.other_user?.first_name}'s profile questions.
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.sender_id === currentUser.id
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-gray-900'
              }`}
            >
              {message.response_to_question !== null && (
                <div className="text-xs opacity-75 mb-1">
                  Responding to: Question {message.response_to_question + 1}
                </div>
              )}
              <p className="text-sm">{message.content}</p>
              <div className="text-xs opacity-75 mt-1">
                {new Date(message.sent_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Question Selection for First Message */}
      {!conversationStarted && showQuestionSelection && (
        <div className="bg-white border-t p-4 max-h-60 overflow-y-auto">
          <h4 className="font-medium mb-2">Select a question to respond to:</h4>
          <div className="space-y-2">
            {availableQuestions.map((qa) => (
              <div
                key={qa.question_index}
                onClick={() => {
                  setSelectedQuestion(qa);
                  setShowQuestionSelection(false);
                }}
                className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedQuestion?.question_index === qa.question_index ? 'border-pink-500 bg-pink-50' : ''
                }`}
              >
                <p className="font-medium text-sm mb-1">Q: {qa.question}</p>
                <p className="text-gray-600 text-xs">{qa.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t p-4">
        {!conversationStarted && selectedQuestion && (
          <div className="mb-3 p-2 bg-pink-50 rounded-lg">
            <p className="text-sm font-medium">Responding to:</p>
            <p className="text-xs text-gray-600">{selectedQuestion.question}</p>
          </div>
        )}
        
        <div className="flex space-x-2">
          {!conversationStarted && (
            <button
              onClick={() => setShowQuestionSelection(!showQuestionSelection)}
              className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600"
            >
              {selectedQuestion ? 'Change' : 'Select'} Question
            </button>
          )}
          
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                !conversationStarted
                  ? "Write your response (minimum 20 words)..."
                  : "Type a message..."
              }
              className="w-full p-2 border rounded-lg resize-none focus:ring-2 focus:ring-pink-500"
              rows="2"
            />
            {!conversationStarted && (
              <div className="text-xs text-gray-500 mt-1">
                Words: {getWordCount(newMessage)} / 20 minimum
              </div>
            )}
          </div>
          
          <button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim() || (!conversationStarted && !selectedQuestion)}
            className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Location Settings Component
const LocationSettings = ({ currentUser, token, onUpdate }) => {
  const [location, setLocation] = useState(currentUser?.location || '');
  const [searchRadius, setSearchRadius] = useState(currentUser?.search_radius || 25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      setError('');
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const locationName = `${data.city}, ${data.principalSubdivision}`;
            
            // Update location in backend
            await axios.post(`${API}/profile/location`, {
              location: locationName,
              latitude: latitude,
              longitude: longitude
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            setLocation(locationName);
            setSuccess('Location updated successfully!');
            setTimeout(() => setSuccess(''), 3000);
            onUpdate();
          } catch (err) {
            setError('Failed to update location');
          }
          
          setLoading(false);
        },
        (error) => {
          setError('Unable to get your location');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
    }
  };

  const updateSearchRadius = async (newRadius) => {
    try {
      setLoading(true);
      await axios.put(`${API}/profile/search-preferences`, {
        search_radius: newRadius
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSearchRadius(newRadius);
      setSuccess('Search radius updated!');
      setTimeout(() => setSuccess(''), 3000);
      onUpdate();
    } catch (err) {
      setError('Failed to update search radius');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Location
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={location}
            readOnly
            placeholder="Location not set"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
          />
          <button
            onClick={getCurrentLocation}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Getting...' : 'Update Location'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Radius: {searchRadius} miles
        </label>
        <div className="px-3">
          <input
            type="range"
            min="1"
            max="50"
            value={searchRadius}
            onChange={(e) => {
              const newRadius = parseInt(e.target.value);
              setSearchRadius(newRadius);
              updateSearchRadius(newRadius);
            }}
            className="location-slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 mile</span>
            <span>50 miles</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
          {success}
        </div>
      )}
    </div>
  );
};

// Safety Center Component
const SafetyCenter = ({ currentUser, token, onUpdate }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [safetyTips, setSafetyTips] = useState([]);
  const [safetyStats, setSafetyStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchVerificationStatus();
    fetchBlockedUsers();
    fetchSafetyTips();
    fetchSafetyStats();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const response = await axios.get(`${API}/profile/verification-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerificationStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch verification status:', err);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const response = await axios.get(`${API}/users/blocked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlockedUsers(response.data.blocked_users);
    } catch (err) {
      console.error('Failed to fetch blocked users:', err);
    }
  };

  const fetchSafetyTips = async () => {
    try {
      const response = await axios.get(`${API}/safety/tips`);
      setSafetyTips(response.data.tips);
    } catch (err) {
      console.error('Failed to fetch safety tips:', err);
    }
  };

  const fetchSafetyStats = async () => {
    try {
      const response = await axios.get(`${API}/safety/stats`);
      setSafetyStats(response.data);
    } catch (err) {
      console.error('Failed to fetch safety stats:', err);
    }
  };

  const handlePhotoVerification = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        
        const response = await axios.post(`${API}/profile/verify-photo`, {
          verification_photo: base64String
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setSuccess(response.data.message);
        fetchVerificationStatus();
        onUpdate();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userId) => {
    try {
      setLoading(true);
      await axios.post(`${API}/users/${userId}/unblock`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('User unblocked successfully');
      fetchBlockedUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to unblock user');
    } finally {
      setLoading(false);
    }
  };

  const triggerPanicButton = async () => {
    if (!confirm('Are you sure you want to trigger the panic button? This will alert emergency contacts and log your location.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/safety/panic`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to trigger panic button');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Navigation */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-3 py-2 text-sm font-medium ${
            activeSection === 'overview' ? 'border-b-2 border-pink-500 text-pink-600' : 'text-gray-600'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection('verification')}
          className={`px-3 py-2 text-sm font-medium ${
            activeSection === 'verification' ? 'border-b-2 border-pink-500 text-pink-600' : 'text-gray-600'
          }`}
        >
          Verification
        </button>
        <button
          onClick={() => setActiveSection('blocked')}
          className={`px-3 py-2 text-sm font-medium ${
            activeSection === 'blocked' ? 'border-b-2 border-pink-500 text-pink-600' : 'text-gray-600'
          }`}
        >
          Blocked Users
        </button>
        <button
          onClick={() => setActiveSection('tips')}
          className={`px-3 py-2 text-sm font-medium ${
            activeSection === 'tips' ? 'border-b-2 border-pink-500 text-pink-600' : 'text-gray-600'
          }`}
        >
          Safety Tips
        </button>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Safety Statistics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Verified Users</div>
                <div className="text-blue-600">{safetyStats.verified_users || 0}</div>
              </div>
              <div>
                <div className="font-medium">Verification Rate</div>
                <div className="text-blue-600">{(safetyStats.verification_rate || 0).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">Your Safety Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Email Verified:</span>
                <span>{currentUser?.email_verified ? '✅' : '❌'}</span>
              </div>
              <div className="flex justify-between">
                <span>Photo Verified:</span>
                <span>{currentUser?.photo_verified ? '✅' : '❌'}</span>
              </div>
              <div className="flex justify-between">
                <span>Blocked Users:</span>
                <span>{blockedUsers.length}</span>
              </div>
            </div>
          </div>

          <button
            onClick={triggerPanicButton}
            disabled={loading}
            className="w-full bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
          >
            🚨 Emergency Panic Button
          </button>
        </div>
      )}

      {/* Verification Section */}
      {activeSection === 'verification' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Photo Verification</h4>
            <p className="text-sm text-yellow-700 mb-3">
              Verify your photos to increase trust and get more matches.
            </p>
            
            {verificationStatus && (
              <div className="mb-4">
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <span className={`capitalize ${
                    verificationStatus.verification_status === 'approved' ? 'text-green-600' :
                    verificationStatus.verification_status === 'pending' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {verificationStatus.verification_status}
                  </span>
                </div>
              </div>
            )}

            {!currentUser?.photo_verified && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoVerification}
                  className="hidden"
                  id="verification-photo"
                  disabled={loading}
                />
                <label
                  htmlFor="verification-photo"
                  className="inline-block w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 text-center cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Upload Verification Photo'}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Take a clear selfie that matches your profile photos
                </p>
              </div>
            )}

            {currentUser?.photo_verified && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-3">
                <p className="text-green-700 text-sm font-medium">
                  ✅ Your photos are verified!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocked Users Section */}
      {activeSection === 'blocked' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">Blocked Users</h4>
            <p className="text-sm text-red-700 mb-3">
              Users you've blocked won't appear in your discover feed or be able to message you.
            </p>
            
            {blockedUsers.length === 0 ? (
              <p className="text-gray-600 text-sm">No blocked users</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden">
                        {user.photos?.[0] && (
                          <img
                            src={user.photos[0]}
                            alt={user.first_name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{user.first_name}</div>
                        <div className="text-sm text-gray-500">{user.age} years old</div>
                      </div>
                    </div>
                    <button
                      onClick={() => unblockUser(user.id)}
                      disabled={loading}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety Tips Section */}
      {activeSection === 'tips' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-2">Safety Tips</h4>
            <div className="space-y-3">
              {safetyTips.map((tip, index) => (
                <div key={tip.id || index} className="bg-white p-3 rounded-lg">
                  <h5 className="font-medium text-purple-800 mb-1">{tip.title}</h5>
                  <p className="text-sm text-purple-700">{tip.content}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-semibold text-orange-800 mb-2">Need Help?</h4>
            <p className="text-sm text-orange-700 mb-3">
              If you're experiencing harassment or feel unsafe, don't hesitate to report users or contact our support team.
            </p>
            <div className="space-y-2">
              <button className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 text-sm">
                Report a User
              </button>
              <button className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 text-sm">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
          {success}
        </div>
      )}
    </div>
  );
};

export default App;
