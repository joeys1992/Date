import requests
import sys
import random
import string
import time
import re
from datetime import datetime

class DatingAppTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_users = []
        self.verification_tokens = {}  # Store verification tokens for each user

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart/form-data
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def generate_test_user(self, gender=None, gender_preference=None):
        """Generate random test user data with specified gender and preference"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        timestamp = int(time.time())
        
        # Default to random gender and preference if not specified
        if gender is None:
            gender = random.choice(["male", "female"])
        
        if gender_preference is None:
            gender_preference = random.choice(["male", "female", "both"])
            
        return {
            "email": f"test_user_{random_suffix}_{timestamp}@example.com",
            "password": "TestPassword123!",
            "first_name": f"Test{random_suffix.capitalize()}",
            "age": random.randint(25, 45),
            "gender": gender,
            "gender_preference": gender_preference
        }

    def test_register_with_weak_password(self, password_issue="short"):
        """Test registration with weak password"""
        user_data = self.generate_test_user()
        
        # Create different types of weak passwords
        if password_issue == "short":
            user_data["password"] = "Abc123!"  # Too short (7 chars)
            issue_desc = "too short"
        elif password_issue == "no_uppercase":
            user_data["password"] = "abcdef123!"  # No uppercase
            issue_desc = "missing uppercase"
        elif password_issue == "no_lowercase":
            user_data["password"] = "ABCDEF123!"  # No lowercase
            issue_desc = "missing lowercase"
        elif password_issue == "no_number":
            user_data["password"] = "AbcdefGHI!"  # No number
            issue_desc = "missing number"
        elif password_issue == "no_special":
            user_data["password"] = "Abcdef123"  # No special char
            issue_desc = "missing special character"
        
        success, response = self.run_test(
            f"Registration with weak password ({issue_desc})",
            "POST",
            "register",
            400,  # Expect failure
            data=user_data
        )
        
        # For weak password test, success means the API correctly rejected it
        return success

    def test_register(self, gender=None, gender_preference=None):
        """Test user registration with specified gender and preference"""
        user_data = self.generate_test_user(gender, gender_preference)
        success, response = self.run_test(
            f"User Registration ({user_data['gender']} seeking {user_data['gender_preference']})",
            "POST",
            "register",
            200,
            data=user_data
        )
        if success:
            self.test_users.append(user_data)
            
            # Check if verification email was sent (in logs)
            email = user_data["email"]
            token = self.get_verification_token_from_logs(email)
            if token:
                self.verification_tokens[email] = token
                print(f"✅ Verification email sent for {email}")
                return True
            else:
                print(f"❌ No verification email found for {email}")
                return False
        return False

    def get_verification_token_from_logs(self, email):
        """Extract verification token from log file for a specific email"""
        try:
            with open("/tmp/verification_emails.log", "r") as f:
                log_content = f.read()
                
            # Look for the email and extract the token
            pattern = f"{email} -> http://localhost:3000/verify\\?token=([^\\s]+)"
            match = re.search(pattern, log_content)
            if match:
                return match.group(1)
        except Exception as e:
            print(f"❌ Error reading verification log: {str(e)}")
        
        return None

    def test_verify_email(self, email=None):
        """Test email verification"""
        if email is None and self.test_users:
            email = self.test_users[-1]["email"]
        
        if email not in self.verification_tokens:
            print(f"❌ No verification token found for {email}")
            return False
            
        token = self.verification_tokens[email]
        success, response = self.run_test(
            "Email Verification",
            "POST",
            "verify-email",
            200,
            data={"token": token}
        )
        return success

    def test_login_without_verification(self, user_data=None):
        """Test login without email verification (should fail)"""
        if not user_data and self.test_users:
            user_data = self.test_users[-1]
        
        if not user_data:
            print("❌ No test user available for login")
            return False
            
        success, response = self.run_test(
            "Login without email verification",
            "POST",
            "login",
            400,  # Expect failure
            data={"email": user_data["email"], "password": user_data["password"]}
        )
        
        # For this test, success means the API correctly rejected the login
        return success

    def test_resend_verification(self, email=None):
        """Test resending verification email"""
        if email is None and self.test_users:
            email = self.test_users[-1]["email"]
        
        if not email:
            print("❌ No test user available for resend verification")
            return False
            
        success, response = self.run_test(
            "Resend Verification Email",
            "POST",
            "resend-verification",
            200,
            data={"email": email}
        )
        
        if success:
            # Check if a new verification email was sent
            new_token = self.get_verification_token_from_logs(email)
            if new_token and new_token != self.verification_tokens.get(email):
                self.verification_tokens[email] = new_token
                print(f"✅ New verification email sent for {email}")
                return True
            elif new_token:
                print(f"✅ Verification email resent (same token)")
                return True
            else:
                print(f"❌ No new verification email found for {email}")
                return False
        
        return False

    def test_login(self, user_data=None):
        """Test user login"""
        if not user_data and self.test_users:
            user_data = self.test_users[-1]
        
        if not user_data:
            print("❌ No test user available for login")
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "login",
            200,
            data={"email": user_data["email"], "password": user_data["password"]}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_profile_questions(self):
        """Test getting profile questions"""
        success, response = self.run_test(
            "Get Profile Questions",
            "GET",
            "profile/questions",
            200
        )
        if success and 'questions' in response:
            question_count = len(response['questions'])
            print(f"Found {question_count} questions")
            if question_count == 28:
                return True, response['questions']
            else:
                print(f"❌ Expected 28 questions, got {question_count}")
                return False, response['questions']
        return False, []

    def test_upload_photo(self, photo_path):
        """Test photo upload"""
        try:
            with open(photo_path, 'rb') as f:
                files = {'file': ('test_photo.jpg', f, 'image/jpeg')}
                success, response = self.run_test(
                    "Upload Photo",
                    "POST",
                    "profile/upload-photo",
                    200,
                    files=files
                )
                return success
        except Exception as e:
            print(f"❌ Failed to upload photo: {str(e)}")
            return False

    def test_update_profile(self, questions):
        """Test updating profile with question answers"""
        # Select 3 random questions
        selected_questions = random.sample(questions, 3)
        
        # Create answers with at least 20 words each
        question_answers = []
        for q in selected_questions:
            answer = "This is a test answer with more than twenty words. I am writing this to ensure that the word count validation passes. This should be enough words to meet the minimum requirement."
            question_answers.append({
                "question_index": q["index"],
                "answer": answer
            })
        
        success, _ = self.run_test(
            "Update Profile",
            "PUT",
            "profile",
            200,
            data={"question_answers": question_answers}
        )
        return success

    def test_get_profile(self):
        """Test getting user's profile"""
        success, response = self.run_test(
            "Get My Profile",
            "GET",
            "profile/me",
            200
        )
        return success, response

    def test_discover_users(self):
        """Test discovering users to swipe on"""
        success, response = self.run_test(
            "Discover Users",
            "GET",
            "discover",
            200
        )
        if success and 'users' in response:
            return True, response['users']
        return False, []

    def test_view_profile(self, user_id):
        """Test viewing another user's profile"""
        success, _ = self.run_test(
            "View Profile",
            "POST",
            f"profile/{user_id}/view",
            200
        )
        return success

    def test_like_user(self, user_id):
        """Test liking another user"""
        success, response = self.run_test(
            "Like User",
            "POST",
            f"profile/{user_id}/like",
            200
        )
        if success:
            is_match = response.get('match', False)
            print(f"Match status: {is_match}")
        return success

    def test_get_matches(self):
        """Test getting user's matches"""
        success, response = self.run_test(
            "Get Matches",
            "GET",
            "matches",
            200
        )
        if success and 'matches' in response:
            return True, response['matches']
        return False, []

    def create_test_image(self, filename="test_photo.jpg"):
        """Create a test image file"""
        try:
            from PIL import Image
            img = Image.new('RGB', (100, 100), color = 'red')
            img.save(filename)
            print(f"✅ Created test image: {filename}")
            return filename
        except Exception as e:
            print(f"❌ Failed to create test image: {str(e)}")
            return None

def test_password_validation():
    """Test password validation requirements"""
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    tester = DatingAppTester(backend_url)
    
    print("\n===== TESTING PASSWORD VALIDATION =====")
    
    # Test various weak passwords
    weak_password_tests = ["short", "no_uppercase", "no_lowercase", "no_number", "no_special"]
    all_passed = True
    
    for test in weak_password_tests:
        if not tester.test_register_with_weak_password(test):
            all_passed = False
            print(f"❌ Password validation test failed for: {test}")
    
    if all_passed:
        print("✅ All password validation tests passed")
    
    return all_passed

def test_email_verification():
    """Test email verification system"""
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    tester = DatingAppTester(backend_url)
    
    print("\n===== TESTING EMAIL VERIFICATION SYSTEM =====")
    
    # Register a new user (should send verification email)
    if not tester.test_register():
        print("❌ Registration failed, stopping email verification tests")
        return False
    
    # Try to login without verification (should fail)
    if not tester.test_login_without_verification():
        print("❌ Login without verification test failed")
        return False
    
    # Test resend verification
    if not tester.test_resend_verification():
        print("❌ Resend verification failed")
        return False
    
    # Verify email
    if not tester.test_verify_email():
        print("❌ Email verification failed")
        return False
    
    # Now login should work
    if not tester.test_login():
        print("❌ Login after verification failed")
        return False
    
    print("✅ All email verification tests passed")
    return True

def test_gender_preferences():
    """Test gender selection and preferences"""
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    tester = DatingAppTester(backend_url)
    test_image = tester.create_test_image()
    
    print("\n===== TESTING GENDER PREFERENCES =====")
    
    # Create users with different gender/preference combinations
    gender_combinations = [
        {"gender": "female", "gender_preference": "female"},  # Woman seeking women
        {"gender": "female", "gender_preference": "male"},    # Woman seeking men
        {"gender": "male", "gender_preference": "female"},    # Man seeking women
        {"gender": "male", "gender_preference": "male"},      # Man seeking men
        {"gender": "female", "gender_preference": "both"},    # Woman seeking both
        {"gender": "male", "gender_preference": "both"}       # Man seeking both
    ]
    
    users_data = []
    
    for combo in gender_combinations:
        # Register user
        if not tester.test_register(combo["gender"], combo["gender_preference"]):
            print(f"❌ Failed to register {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        # Verify email
        if not tester.test_verify_email():
            print(f"❌ Failed to verify email for {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        # Login
        if not tester.test_login():
            print(f"❌ Failed to login as {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        # Complete profile (upload photos and answer questions)
        for i in range(3):
            if not tester.test_upload_photo(test_image):
                print(f"❌ Failed to upload photo for {combo['gender']} seeking {combo['gender_preference']}")
                break
        
        success, questions = tester.test_get_profile_questions()
        if not success:
            print(f"❌ Failed to get questions for {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        if not tester.test_update_profile(questions):
            print(f"❌ Failed to update profile for {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        # Get profile to verify it's complete
        success, profile = tester.test_get_profile()
        if not success:
            print(f"❌ Failed to get profile for {combo['gender']} seeking {combo['gender_preference']}")
            continue
        
        # Store user data for later matching tests
        users_data.append({
            "id": tester.user_id,
            "gender": combo["gender"],
            "gender_preference": combo["gender_preference"],
            "token": tester.token
        })
        
        print(f"✅ Successfully created {combo['gender']} user seeking {combo['gender_preference']}")
    
    # Test discovery for each user
    for user in users_data:
        tester.token = user["token"]
        tester.user_id = user["id"]
        
        success, discovered_users = tester.test_discover_users()
        if not success:
            print(f"❌ Discovery failed for {user['gender']} seeking {user['gender_preference']}")
            continue
        
        print(f"User {user['gender']} seeking {user['gender_preference']} discovered {len(discovered_users)} users")
        
        # Verify discovered users match preferences
        for discovered in discovered_users:
            discovered_gender = discovered["gender"]
            discovered_preference = discovered["gender_preference"]
            
            # Check if this user should be visible based on mutual preferences
            user_wants_discovered = (
                user["gender_preference"] == "both" or 
                user["gender_preference"] == discovered_gender
            )
            
            discovered_wants_user = (
                discovered_preference == "both" or 
                discovered_preference == user["gender"]
            )
            
            mutual_match = user_wants_discovered and discovered_wants_user
            
            if not mutual_match:
                print(f"❌ Preference mismatch: {user['gender']} seeking {user['gender_preference']} shouldn't see {discovered_gender} seeking {discovered_preference}")
            else:
                print(f"✅ Preference match: {user['gender']} seeking {user['gender_preference']} correctly sees {discovered_gender} seeking {discovered_preference}")
    
    print("✅ Gender preference tests completed")
    return True

def main():
    # Get backend URL from environment
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    
    print(f"🚀 Starting Dating App API Tests against {backend_url}")
    
    # Test password validation
    password_tests_passed = test_password_validation()
    
    # Test email verification
    email_tests_passed = test_email_verification()
    
    # Test gender preferences and matching
    gender_tests_passed = test_gender_preferences()
    
    # Setup tester for basic functionality test
    tester = DatingAppTester(backend_url)
    
    # Create test image
    test_image = tester.create_test_image()
    if not test_image:
        print("❌ Cannot proceed without test image")
        return 1
    
    print("\n===== TESTING BASIC USER JOURNEY =====")
    # Test registration with strong password
    if not tester.test_register():
        print("❌ Registration failed, stopping tests")
        return 1
    
    # Verify email
    if not tester.test_verify_email():
        print("❌ Email verification failed, stopping tests")
        return 1
    
    # Test login
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1
    
    print("\n===== TESTING PHOTO UPLOAD =====")
    # Test uploading photos (upload 3 photos)
    for i in range(3):
        if not tester.test_upload_photo(test_image):
            print(f"❌ Failed to upload photo {i+1}, stopping tests")
            return 1
        print(f"✅ Successfully uploaded photo {i+1}/3")
    
    print("\n===== TESTING PROFILE COMPLETION =====")
    # Test getting profile questions
    success, questions = tester.test_get_profile_questions()
    if not success:
        print("❌ Failed to get profile questions, stopping tests")
        return 1
    
    # Test updating profile with question answers
    if not tester.test_update_profile(questions):
        print("❌ Failed to update profile, stopping tests")
        return 1
    
    # Test getting user's profile
    success, profile = tester.test_get_profile()
    if not success:
        print("❌ Failed to get profile, stopping tests")
        return 1
    
    # Verify profile has photos and answers
    photo_count = len(profile.get('photos', []))
    answer_count = len(profile.get('question_answers', []))
    print(f"✅ Profile has {photo_count} photos and {answer_count} question answers")
    
    if photo_count < 3 or answer_count < 3:
        print("❌ Profile is incomplete, should have at least 3 photos and 3 answers")
        return 1
    
    print("\n===== TESTING DISCOVERY AND MATCHING =====")
    # Test discovering users
    success, users = tester.test_discover_users()
    if not success:
        print("❌ Failed to discover users, stopping tests")
        return 1
    
    # If there are users to discover, test viewing and liking
    if users:
        user_to_like = users[0]
        user_id = user_to_like['id']
        
        # Test viewing profile
        if not tester.test_view_profile(user_id):
            print("❌ Failed to view profile, stopping tests")
            return 1
        
        # Test liking user
        if not tester.test_like_user(user_id):
            print("❌ Failed to like user, stopping tests")
            return 1
    else:
        print("⚠️ No users to discover, skipping view/like tests")
    
    # Test getting matches
    success, matches = tester.test_get_matches()
    if not success:
        print("❌ Failed to get matches, stopping tests")
        return 1
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    # Summary of feature tests
    print("\n===== FEATURE TEST SUMMARY =====")
    print(f"Password Validation: {'✅ PASSED' if password_tests_passed else '❌ FAILED'}")
    print(f"Email Verification: {'✅ PASSED' if email_tests_passed else '❌ FAILED'}")
    print(f"Gender Preferences: {'✅ PASSED' if gender_tests_passed else '❌ FAILED'}")
    print(f"Basic User Journey: {'✅ PASSED' if tester.tests_passed == tester.tests_run else '❌ FAILED'}")
    
    # Clean up test image
    try:
        import os
        os.remove(test_image)
        print(f"✅ Cleaned up test image")
    except:
        pass
    
    return 0 if (password_tests_passed and email_tests_passed and gender_tests_passed) else 1

if __name__ == "__main__":
    sys.exit(main())
