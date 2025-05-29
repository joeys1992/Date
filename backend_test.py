import requests
import sys
import random
import string
import time
from datetime import datetime

class DatingAppTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_users = []

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

    def generate_test_user(self):
        """Generate random test user data"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        timestamp = int(time.time())
        return {
            "email": f"test_user_{random_suffix}_{timestamp}@example.com",
            "password": "TestPassword123!",
            "first_name": f"Test{random_suffix.capitalize()}",
            "age": random.randint(25, 45)
        }

    def test_register(self):
        """Test user registration"""
        user_data = self.generate_test_user()
        success, response = self.run_test(
            "User Registration",
            "POST",
            "register",
            200,
            data=user_data
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.test_users.append(user_data)
            return True
        return False

    def test_login(self, user_data=None):
        """Test user login"""
        if not user_data and self.test_users:
            user_data = self.test_users[0]
        
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

def main():
    # Get backend URL from environment
    import os
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    
    print(f"🚀 Starting Dating App API Tests against {backend_url}")
    
    # Setup tester
    tester = DatingAppTester(backend_url)
    
    # Create test image
    test_image = tester.create_test_image()
    if not test_image:
        print("❌ Cannot proceed without test image")
        return 1
    
    print("\n===== TESTING USER AUTHENTICATION =====")
    # Test registration
    if not tester.test_register():
        print("❌ Registration failed, stopping tests")
        return 1
    
    # Test login
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1
    
    print("\n===== TESTING PHOTO UPLOAD (FIXED FUNCTIONALITY) =====")
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
    print("✅ PHOTO UPLOAD FUNCTIONALITY IS WORKING CORRECTLY")
    print("✅ COMPLETE USER JOURNEY TESTED SUCCESSFULLY")
    
    # Clean up test image
    try:
        import os
        os.remove(test_image)
        print(f"✅ Cleaned up test image")
    except:
        pass
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())