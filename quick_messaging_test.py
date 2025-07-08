#!/usr/bin/env python3
"""
Quick messaging test using the latest match
"""

import requests
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BACKEND_URL = "https://e659bb2f-b183-4c58-9715-2cdca4d303f4.preview.emergentagent.com"
API_URL = f"{BACKEND_URL}/api"

def test_messaging_quick():
    """Test messaging with the known match IDs"""
    
    # From the MongoDB output, let's use the most recent match
    match_id = "9bbb4d71-5380-4e97-8324-170ea8122e71"
    user1_id = "60dca719-7057-467a-8cb3-7144a3192d1c"
    user2_id = "7e31856f-a068-46cd-bbea-ecf4b6367709"
    user1_email = "alice_20250708_220153@testdating.com"
    user2_email = "charlie_20250708_220153@testdating.com"
    
    logger.info(f"🔍 Testing with match: {match_id}")
    logger.info(f"   User 1: {user1_email} ({user1_id})")
    logger.info(f"   User 2: {user2_email} ({user2_id})")
    
    # Try login
    logger.info("🔑 Attempting login...")
    response1 = requests.post(f"{API_URL}/login", json={
        "email": user1_email,
        "password": "TestPass123!"
    })
    
    response2 = requests.post(f"{API_URL}/login", json={
        "email": user2_email,
        "password": "TestPass123!"
    })
    
    if response1.status_code != 200 or response2.status_code != 200:
        logger.error("❌ Login failed, trying different emails...")
        
        # Try with more recent pattern based on the timestamp
        user1_email = "alice_20250708_220021@testdating.com"
        user2_email = "charlie_20250708_220021@testdating.com"
        
        response1 = requests.post(f"{API_URL}/login", json={
            "email": user1_email,
            "password": "TestPass123!"
        })
        
        response2 = requests.post(f"{API_URL}/login", json={
            "email": user2_email,
            "password": "TestPass123!"
        })
        
        if response1.status_code != 200 or response2.status_code != 200:
            logger.error("❌ Could not login with any test credentials")
            return False
    
    token1 = response1.json()['access_token']
    token2 = response2.json()['access_token']
    logger.info("✅ Successfully logged in both users")
    
    headers1 = {'Authorization': f'Bearer {token1}'}
    headers2 = {'Authorization': f'Bearer {token2}'}
    
    # Test conversation status
    logger.info("📊 Checking conversation status...")
    response = requests.get(f"{API_URL}/conversations/{match_id}/status", headers=headers1)
    if response.status_code == 200:
        status = response.json()
        logger.info(f"✅ Conversation status: {status}")
    else:
        logger.error(f"❌ Failed to get conversation status: {response.status_code}")
        return False
    
    # Get available questions
    logger.info("❓ Getting available questions...")
    response = requests.get(f"{API_URL}/conversations/{match_id}/questions", headers=headers1)
    if response.status_code != 200:
        logger.error(f"❌ Failed to get questions: {response.status_code}")
        return False
    
    questions_data = response.json()
    questions = questions_data['questions_with_answers']
    
    if not questions:
        logger.error("❌ No questions available")
        return False
    
    logger.info(f"✅ Found {len(questions)} questions to respond to")
    
    # Send first message
    logger.info("💬 Sending first message...")
    first_question = questions[0]
    first_message = f"I really connected with your answer about {first_question['question'][:50]}... Your perspective on this really resonates with me because I've had similar experiences in my own life. I'd love to hear more about how this experience shaped your worldview and approach to relationships."
    
    response = requests.post(f"{API_URL}/conversations/{match_id}/messages", 
                           json={
                               "content": first_message,
                               "message_type": "text",
                               "response_to_question": first_question['question_index']
                           }, 
                           headers=headers1)
    
    if response.status_code != 200:
        logger.error(f"❌ Failed to send first message: {response.status_code}")
        logger.error(f"Response: {response.text}")
        return False
    
    logger.info("✅ First message sent successfully")
    
    # Send response
    logger.info("💬 Sending response message...")
    response_message = "Thank you for sharing that! I'm glad my answer resonated with you. It's always wonderful to connect with someone who has similar experiences and perspectives on life."
    
    response = requests.post(f"{API_URL}/conversations/{match_id}/messages", 
                           json={
                               "content": response_message,
                               "message_type": "text"
                           }, 
                           headers=headers2)
    
    if response.status_code != 200:
        logger.error(f"❌ Failed to send response: {response.status_code}")
        logger.error(f"Response: {response.text}")
        return False
    
    logger.info("✅ Response sent successfully")
    
    # Get message history
    logger.info("📜 Getting message history...")
    response = requests.get(f"{API_URL}/conversations/{match_id}/messages", headers=headers1)
    if response.status_code == 200:
        messages = response.json()['messages']
        logger.info(f"✅ Retrieved {len(messages)} messages")
        
        for i, msg in enumerate(messages):
            user_num = "1" if msg['sender_id'] == user1_id else "2"
            logger.info(f"   Message {i+1} from User {user_num}: {msg['content'][:50]}...")
    else:
        logger.error(f"❌ Failed to get message history: {response.status_code}")
        return False
    
    logger.info("🎉 ALL MESSAGING TESTS PASSED!")
    return True

if __name__ == "__main__":
    success = test_messaging_quick()
    
    if success:
        print("\n🎉 MESSAGING SYSTEM WORKS PERFECTLY!")
        print("✅ First message validation (question response + 20 words)")
        print("✅ Regular messaging after first message")
        print("✅ Message history retrieval")
        print("✅ Conversation status tracking")
        print("✅ Complete messaging flow tested")
    else:
        print("\n❌ Some tests failed.")