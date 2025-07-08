import requests
import time
import uuid
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL from frontend .env
BACKEND_URL = "https://e659bb2f-b183-4c58-9715-2cdca4d303f4.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

class DatingAppTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.email = None
        self.verification_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{API_URL}/{endpoint}"
        
        if headers is None:
            headers = {}
            
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        headers['Content-Type'] = 'application/json'
        
        self.tests_run += 1
        logger.info(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                logger.info(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                logger.error(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    logger.error(f"Response: {response.json()}")
                except:
                    logger.error(f"Response: {response.text}")
                return False, {}
                
        except Exception as e:
            logger.error(f"❌ Failed - Error: {str(e)}")
            return False, {}
    
    def register_user(self):
        """Register a new user"""
        # Generate unique email
        self.email = f"test_user_{self.test_timestamp}_{uuid.uuid4().hex[:8]}@example.com"
        
        data = {
            "email": self.email,
            "password": "TestPass123!",
            "first_name": "Test",
            "age": 25,
            "gender": "male",
            "gender_preference": "female"
        }
        
        success, response = self.run_test(
            "Register User",
            "POST",
            "register",
            200,
            data=data
        )
        
        if success:
            self.user_id = response.get('user_id')
            logger.info(f"Registered user with email: {self.email}")
            return True
        return False
    
    def extract_verification_token(self):
        """Check for verification token in log file"""
        try:
            with open("/tmp/verification_emails.log", "r") as f:
                lines = f.readlines()
                for line in reversed(lines):  # Start from the most recent
                    if self.email in line:
                        # Extract token from URL
                        token_start = line.find("token=") + 6
                        token_end = line.find("\n", token_start)
                        if token_end == -1:
                            token_end = len(line)
                        self.verification_token = line[token_start:token_end]
                        logger.info(f"Found verification token: {self.verification_token}")
                        return True
            logger.error(f"No verification token found for {self.email}")
            return False
        except Exception as e:
            logger.error(f"Error reading verification log: {str(e)}")
            return False
    
    def verify_email(self):
        """Verify email with token"""
        if not self.verification_token:
            logger.error("No verification token available")
            return False
        
        success, _ = self.run_test(
            "Verify Email",
            "POST",
            "verify-email",
            200,
            data={"token": self.verification_token}
        )
        
        return success
    
    def login(self):
        """Login with registered user"""
        success, response = self.run_test(
            "Login",
            "POST",
            "login",
            200,
            data={"email": self.email, "password": "TestPass123!"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            logger.info("Login successful, token received")
            return True
        return False
    
    def get_profile(self):
        """Get user profile"""
        success, response = self.run_test(
            "Get Profile",
            "GET",
            "profile/me",
            200
        )
        
        return success, response
    
    def get_questions(self):
        """Get profile questions"""
        success, response = self.run_test(
            "Get Questions",
            "GET",
            "profile/questions",
            200
        )
        
        return success, response
    
    def update_profile(self, question_answers):
        """Update profile with question answers"""
        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "profile",
            200,
            data={"question_answers": question_answers}
        )
        
        return success
    
    def test_unverified_login(self):
        """Test that unverified users cannot login"""
        # Register a new user but don't verify
        email = f"unverified_{self.test_timestamp}_{uuid.uuid4().hex[:8]}@example.com"
        
        data = {
            "email": email,
            "password": "TestPass123!",
            "first_name": "Unverified",
            "age": 25,
            "gender": "male",
            "gender_preference": "female"
        }
        
        success, _ = self.run_test(
            "Register Unverified User",
            "POST",
            "register",
            200,
            data=data
        )
        
        if not success:
            return False
        
        # Try to login (should fail)
        success, response = self.run_test(
            "Login with Unverified Email",
            "POST",
            "login",
            400,  # Expect 400 Bad Request
            data={"email": email, "password": "TestPass123!"}
        )
        
        # For this test, success means the login was rejected
        return success
    
    def test_resend_verification(self):
        """Test resending verification email"""
        if not self.email:
            logger.error("No email available for resend test")
            return False
        
        success, _ = self.run_test(
            "Resend Verification",
            "POST",
            "resend-verification",
            200,
            data={"email": self.email}
        )
        
        return success
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        logger.info("🚀 Starting Dating App API Tests")
        
        # Test 1: Registration Flow
        if not self.register_user():
            logger.error("❌ Registration failed, stopping tests")
            return False
        
        # Check for verification token in log
        logger.info("Waiting for verification email to be logged...")
        time.sleep(2)  # Wait for email to be logged
        
        # Test 2: Email Verification Flow
        if not self.extract_verification_token():
            logger.error("❌ Could not find verification token, stopping tests")
            return False
        
        if not self.verify_email():
            logger.error("❌ Email verification failed, stopping tests")
            return False
        
        # Test 3: Login Flow
        if not self.login():
            logger.error("❌ Login failed, stopping tests")
            return False
        
        # Test 4: Get Profile
        profile_success, profile = self.get_profile()
        if not profile_success:
            logger.error("❌ Get profile failed, stopping tests")
            return False
        
        # Test 5: Get Questions
        questions_success, questions_data = self.get_questions()
        if not questions_success or 'questions' not in questions_data:
            logger.error("❌ Get questions failed, stopping tests")
            return False
        
        # Test 6: Update Profile
        # Create sample question answers
        sample_answers = []
        for i in range(3):  # Answer 3 questions
            if i < len(questions_data['questions']):
                sample_answers.append({
                    "question_index": questions_data['questions'][i]['index'],
                    "answer": "This is a detailed answer that is at least twenty words long so that it passes the validation check in the backend API. Testing is important."
                })
        
        if not self.update_profile(sample_answers):
            logger.error("❌ Update profile failed, stopping tests")
            return False
        
        # Test 7: Test Unverified Login
        if not self.test_unverified_login():
            logger.error("❌ Unverified login test failed")
            # Continue with other tests
        
        # Test 8: Test Resend Verification
        if not self.test_resend_verification():
            logger.error("❌ Resend verification test failed")
            # Continue with other tests
        
        # Print results
        logger.info(f"\n📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = DatingAppTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
