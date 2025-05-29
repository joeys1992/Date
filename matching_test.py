import requests
import sys
import random
import string
import time
from datetime import datetime

class DatingAppMatchTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.user1 = {
            "email": f"test_user1_{int(time.time())}@example.com",
            "password": "TestPassword123!",
            "first_name": "TestUser1",
            "age": 30
        }
        self.user2 = {
            "email": f"test_user2_{int(time.time())}@example.com",
            "password": "TestPassword123!",
            "first_name": "TestUser2",
            "age": 28
        }
        self.user1_token = None
        self.user2_token = None
        self.user1_id = None
        self.user2_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

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

    def register_user(self, user_data):
        """Register a test user"""
        success, response = self.run_test(
            f"Register {user_data['first_name']}",
            "POST",
            "register",
            200,
            data=user_data
        )
        if success and 'access_token' in response:
            return response['access_token'], response['user']['id']
        return None, None

    def setup_user_profile(self, token, user_id):
        """Setup user profile with photos and answers"""
        # Get questions
        success, questions = self.run_test(
            "Get Profile Questions",
            "GET",
            "profile/questions",
            200,
            token=token
        )
        if not success:
            return False
        
        # Upload 3 photos
        test_image = self.create_test_image()
        if not test_image:
            return False
            
        for i in range(3):
            with open(test_image, 'rb') as f:
                files = {'file': ('test_photo.jpg', f, 'image/jpeg')}
                success, _ = self.run_test(
                    f"Upload Photo {i+1}",
                    "POST",
                    "profile/upload-photo",
                    200,
                    files=files,
                    token=token
                )
                if not success:
                    return False
        
        # Answer 3 questions
        selected_questions = random.sample(questions['questions'], 3)
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
            data={"question_answers": question_answers},
            token=token
        )
        
        # Clean up test image
        try:
            import os
            os.remove(test_image)
        except:
            pass
            
        return success

    def test_matching_flow(self):
        """Test the full matching flow between two users"""
        print("\n🔄 Testing full matching flow between two users...")
        
        # Register user 1
        self.user1_token, self.user1_id = self.register_user(self.user1)
        if not self.user1_token:
            print("❌ Failed to register user 1")
            return False
            
        # Register user 2
        self.user2_token, self.user2_id = self.register_user(self.user2)
        if not self.user2_token:
            print("❌ Failed to register user 2")
            return False
            
        # Setup user 1 profile
        if not self.setup_user_profile(self.user1_token, self.user1_id):
            print("❌ Failed to setup user 1 profile")
            return False
            
        # Setup user 2 profile
        if not self.setup_user_profile(self.user2_token, self.user2_id):
            print("❌ Failed to setup user 2 profile")
            return False
            
        # User 1 views user 2's profile
        success, _ = self.run_test(
            "User 1 views User 2",
            "POST",
            f"profile/{self.user2_id}/view",
            200,
            token=self.user1_token
        )
        if not success:
            print("❌ Failed: User 1 couldn't view User 2's profile")
            return False
            
        # User 1 likes user 2
        success, response = self.run_test(
            "User 1 likes User 2",
            "POST",
            f"profile/{self.user2_id}/like",
            200,
            token=self.user1_token
        )
        if not success:
            print("❌ Failed: User 1 couldn't like User 2")
            return False
            
        # User 2 views user 1's profile
        success, _ = self.run_test(
            "User 2 views User 1",
            "POST",
            f"profile/{self.user1_id}/view",
            200,
            token=self.user2_token
        )
        if not success:
            print("❌ Failed: User 2 couldn't view User 1's profile")
            return False
            
        # User 2 likes user 1 (should create a match)
        success, response = self.run_test(
            "User 2 likes User 1",
            "POST",
            f"profile/{self.user1_id}/like",
            200,
            token=self.user2_token
        )
        if not success:
            print("❌ Failed: User 2 couldn't like User 1")
            return False
            
        # Verify it's a match
        is_match = response.get('match', False)
        if not is_match:
            print("❌ Failed: No match was created when it should have been")
            return False
        else:
            print("✅ Match created successfully!")
            
        # User 1 checks matches
        success, matches = self.run_test(
            "User 1 checks matches",
            "GET",
            "matches",
            200,
            token=self.user1_token
        )
        if not success:
            print("❌ Failed: User 1 couldn't check matches")
            return False
            
        # Verify user 2 is in user 1's matches
        user1_has_match = any(match['id'] == self.user2_id for match in matches.get('matches', []))
        if not user1_has_match:
            print("❌ Failed: User 2 not found in User 1's matches")
            return False
        else:
            print("✅ User 2 found in User 1's matches!")
            
        # User 2 checks matches
        success, matches = self.run_test(
            "User 2 checks matches",
            "GET",
            "matches",
            200,
            token=self.user2_token
        )
        if not success:
            print("❌ Failed: User 2 couldn't check matches")
            return False
            
        # Verify user 1 is in user 2's matches
        user2_has_match = any(match['id'] == self.user1_id for match in matches.get('matches', []))
        if not user2_has_match:
            print("❌ Failed: User 1 not found in User 2's matches")
            return False
        else:
            print("✅ User 1 found in User 2's matches!")
            
        return True

def main():
    # Get backend URL from environment
    import os
    backend_url = "https://2f0cb9c3-ceef-48eb-a3b7-3e6e8cc088b0.preview.emergentagent.com"
    
    print(f"🚀 Starting Dating App Matching Tests against {backend_url}")
    
    # Setup tester
    tester = DatingAppMatchTester(backend_url)
    
    # Test the full matching flow
    success = tester.test_matching_flow()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())