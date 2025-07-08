from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import base64
from PIL import Image
import io
import re
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from enum import Enum
import json
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email verification token service
TOKEN_SECRET = "email-verification-secret-key-change-in-production"
token_serializer = URLSafeTimedSerializer(TOKEN_SECRET, salt='email-verification')

# Create the main app without a prefix
app = FastAPI(title="Dating App API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Gender Enums
class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class GenderPreference(str, Enum):
    MALE = "male"
    FEMALE = "female"
    BOTH = "both"

# Profile Questions - 28 deep questions for users to answer
PROFILE_QUESTIONS = [
    # Personal Growth & Aspirations
    "Describe a moment when you completely changed your perspective on something important. What triggered this shift and how has it shaped who you are today?",
    "What's something you're working to improve about yourself right now, and what's driving that desire for change?",
    "If you could master any skill over the next five years, what would it be and how do you imagine it would transform your daily life?",
    
    # Values & Life Philosophy
    "Tell me about a time when you had to choose between what was easy and what was right. How did you navigate that decision?",
    "What's a belief or principle you hold that might surprise people who just met you, and why is it so important to you?",
    "Describe your ideal way to spend a completely free Saturday. What does this reveal about what you value most in life?",
    
    # Relationships & Connection
    "What's the most meaningful piece of advice someone has given you about relationships, and how has it influenced how you connect with others?",
    "Describe a friendship that has significantly shaped who you are. What did this person teach you about yourself?",
    "How do you show someone you care about them when they're going through a difficult time?",
    
    # Passions & Interests
    "What's something you could talk about for hours without getting bored, and what initially sparked your fascination with it?",
    "Describe your proudest creative or intellectual achievement. What challenges did you overcome to accomplish it?",
    "If you had unlimited resources to pursue any project or hobby, what would you create or explore?",
    
    # Life Experiences & Stories
    "Tell me about a travel experience (near or far) that genuinely changed your perspective on life or yourself.",
    "What's the most spontaneous thing you've ever done, and would you do it again? Why or why not?",
    "Describe a moment when you felt completely out of your comfort zone but grew from the experience.",
    
    # Future & Dreams
    "If you could have dinner with anyone (living or dead), who would it be and what would you most want to learn from them?",
    "What's something you hope to accomplish in the next ten years that would make you feel truly fulfilled?",
    "How do you imagine your ideal living situation in five years? What elements are most important for your happiness?",
    
    # Character & Personality
    "What's something you do when no one is watching that reveals your true character?",
    "Describe a time when you failed at something important. What did you learn and how did it change your approach to challenges?",
    "What makes you laugh until your stomach hurts? What does your sense of humor say about you?",
    
    # Childhood & Family
    "What's a family tradition or childhood memory that still influences how you approach life today?",
    "What lesson from your childhood do you think shaped your personality the most, and how do you see it playing out in your adult life?",
    
    # Random but Revealing
    "If you could instantly become an expert in any field of knowledge, what would you choose and what would you do with that expertise?",
    "What's something most people don't know about you that you wish they did? What would understanding this help them appreciate about who you are?",
    
    # Light-hearted & Fun
    "What's your most controversial food opinion that you're willing to defend passionately, and what life experiences led you to this culinary stance?",
    "If you could have any fictional character as your roommate for a month, who would you choose and what do you think would be the most entertaining or challenging part of living with them?",
    "What's the weirdest compliment you've ever received that actually made you really happy, and why did it resonate with you so much?"
]

# Password validation function
def validate_password(password: str) -> str:
    """Validate password meets security requirements"""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character")
    
    return password

# Email verification service (mock - logs to console)
class EmailService:
    @staticmethod
    async def send_verification_email(email: str, token: str) -> bool:
        """Mock email service - logs verification link to console"""
        try:
            verification_url = f"http://localhost:3000/verify?token={token}"
            
            # In production, replace this with actual email sending
            print(f"\n{'='*60}")
            print(f"📧 VERIFICATION EMAIL FOR: {email}")
            print(f"🔗 Verification URL: {verification_url}")
            print(f"⏰ This link expires in 24 hours")
            print(f"{'='*60}\n")
            
            # Log to file as well
            with open("/tmp/verification_emails.log", "a") as f:
                f.write(f"{datetime.utcnow()}: {email} -> {verification_url}\n")
            
            return True
        except Exception as e:
            print(f"❌ Failed to send verification email: {e}")
            return False

# Token generation and validation
def generate_verification_token(email: str) -> str:
    """Generate a secure verification token"""
    return token_serializer.dumps(email)

def validate_verification_token(token: str) -> Optional[str]:
    """Validate token and return email if valid"""
    try:
        email = token_serializer.loads(token, max_age=24*60*60)  # 24 hours
        return email
    except (SignatureExpired, BadSignature):
        return None

# Pydantic Models
class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    age: int
    gender: Gender
    gender_preference: GenderPreference

    @validator('password')
    def validate_password_strength(cls, v):
        return validate_password(v)

    @validator('age')
    def validate_age_range(cls, v):
        if v < 18 or v > 100:
            raise ValueError('Age must be between 18 and 100')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class EmailVerification(BaseModel):
    token: str

class ResendVerification(BaseModel):
    email: EmailStr

class QuestionAnswer(BaseModel):
    question_index: int
    answer: str

class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    question_answers: Optional[List[QuestionAnswer]] = None
    location: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    first_name: str
    age: int
    gender: Gender
    gender_preference: GenderPreference
    bio: Optional[str] = None
    photos: List[str] = []
    question_answers: List[QuestionAnswer] = []
    location: Optional[str] = None
    likes_given: List[str] = []  # User IDs this user has liked
    likes_received: List[str] = []  # User IDs who liked this user
    matches: List[str] = []  # Mutual matches
    profile_views: List[str] = []  # Who viewed this profile
    is_verified: bool = False
    email_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified_at: Optional[datetime] = None
    last_active: datetime = Field(default_factory=datetime.utcnow)

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user1_id: str
    user2_id: str
    matched_at: datetime = Field(default_factory=datetime.utcnow)
    conversation_started: bool = False

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    match_id: str
    sender_id: str
    content: str
    response_to_question: Optional[int] = None  # Index of question being responded to
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None

# Utility Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if user exists and is email verified
        user_doc = await db.users.find_one({"id": user_id})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user_doc.get("email_verified", False):
            raise HTTPException(status_code=401, detail="Email not verified")
        
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def count_words(text: str) -> int:
    return len(text.strip().split())

def can_users_match(user1: dict, user2: dict) -> bool:
    """Check if two users can see each other based on gender preferences"""
    user1_gender = user1.get("gender")
    user2_gender = user2.get("gender")
    user1_pref = user1.get("gender_preference")
    user2_pref = user2.get("gender_preference")
    
    # Check if user1 wants to see user2's gender
    user1_wants_user2 = (
        user1_pref == "both" or 
        user1_pref == user2_gender
    )
    
    # Check if user2 wants to see user1's gender
    user2_wants_user1 = (
        user2_pref == "both" or 
        user2_pref == user1_gender
    )
    
    return user1_wants_user2 and user2_wants_user1

# API Routes
@api_router.post("/register")
async def register(
    user_data: UserRegistration,
    background_tasks: BackgroundTasks
):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        age=user_data.age,
        gender=user_data.gender,
        gender_preference=user_data.gender_preference,
        email_verified=False
    )
    
    user_doc = user.dict()
    user_doc["password_hash"] = hashed_password
    
    await db.users.insert_one(user_doc)
    
    # Generate verification token and send email
    verification_token = generate_verification_token(user_data.email)
    background_tasks.add_task(
        EmailService.send_verification_email,
        user_data.email,
        verification_token
    )
    
    return {
        "message": "Registration successful! Please check your email for verification link.",
        "email": user.email,
        "user_id": user.id
    }

@api_router.post("/verify-email")
async def verify_email(verification_data: EmailVerification):
    """Verify user email with token"""
    email = validate_verification_token(verification_data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    # Update user verification status
    result = await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "email_verified": True,
                "verified_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Email verified successfully"}

@api_router.post("/resend-verification")
async def resend_verification(
    resend_data: ResendVerification,
    background_tasks: BackgroundTasks
):
    """Resend verification email"""
    user_doc = await db.users.find_one({"email": resend_data.email})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_doc.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Generate new token and send email
    verification_token = generate_verification_token(resend_data.email)
    background_tasks.add_task(
        EmailService.send_verification_email,
        resend_data.email,
        verification_token
    )
    
    return {"message": "Verification email resent"}

@api_router.post("/login")
async def login(login_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(login_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    # Check email verification
    if not user_doc.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Please verify your email before logging in")
    
    # Update last active
    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"last_active": datetime.utcnow()}}
    )
    
    # Generate token
    token = create_access_token(user_doc["id"])
    
    return {
        "access_token": token,
        "user": {
            "id": user_doc["id"],
            "email": user_doc["email"],
            "first_name": user_doc["first_name"],
            "age": user_doc["age"],
            "gender": user_doc["gender"],
            "gender_preference": user_doc["gender_preference"]
        }
    }

@api_router.get("/profile/questions")
async def get_profile_questions():
    """Get all available profile questions"""
    return {
        "questions": [{"index": i, "question": q} for i, q in enumerate(PROFILE_QUESTIONS)]
    }

@api_router.post("/profile/upload-photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user_id: str = Depends(get_current_user)
):
    """Upload a profile photo"""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read and validate image
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    
    try:
        # Verify it's a valid image and create a new copy to avoid image verification issues
        image = Image.open(io.BytesIO(contents))
        # Convert to RGB if needed and create a copy
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        
        # Create a new image buffer
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=85)
        processed_contents = output_buffer.getvalue()
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
    
    # Convert to base64 for storage (in production, use cloud storage)
    photo_data = base64.b64encode(processed_contents).decode('utf-8')
    photo_url = f"data:image/jpeg;base64,{photo_data}"
    
    # Update user photos
    user_doc = await db.users.find_one({"id": current_user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    photos = user_doc.get("photos", [])
    if len(photos) >= 10:  # Limit to 10 photos
        raise HTTPException(status_code=400, detail="Maximum 10 photos allowed")
    
    photos.append(photo_url)
    
    await db.users.update_one(
        {"id": current_user_id},
        {"$set": {"photos": photos}}
    )
    
    return {"message": "Photo uploaded successfully", "photo_count": len(photos), "photo_url": photo_url}

@api_router.put("/profile")
async def update_profile(
    profile_data: ProfileUpdate,
    current_user_id: str = Depends(get_current_user)
):
    """Update user profile"""
    update_data = {}
    
    if profile_data.bio is not None:
        update_data["bio"] = profile_data.bio
    
    if profile_data.location is not None:
        update_data["location"] = profile_data.location
    
    if profile_data.question_answers is not None:
        # Validate question answers
        for qa in profile_data.question_answers:
            if qa.question_index < 0 or qa.question_index >= len(PROFILE_QUESTIONS):
                raise HTTPException(status_code=400, detail=f"Invalid question index: {qa.question_index}")
            
            word_count = count_words(qa.answer)
            if word_count < 20:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Answer to question {qa.question_index} must be at least 20 words (currently {word_count})"
                )
        
        update_data["question_answers"] = [qa.dict() for qa in profile_data.question_answers]
    
    if update_data:
        await db.users.update_one(
            {"id": current_user_id},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated successfully"}

@api_router.get("/profile/me")
async def get_my_profile(current_user_id: str = Depends(get_current_user)):
    """Get current user's profile"""
    user_doc = await db.users.find_one({"id": current_user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove sensitive data
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    
    return user_doc

@api_router.get("/discover")
async def discover_users(
    current_user_id: str = Depends(get_current_user),
    limit: int = 10
):
    """Get users to swipe on (exclude already liked/passed users and apply gender filtering)"""
    current_user = await db.users.find_one({"id": current_user_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get users to exclude (already liked + self)
    exclude_ids = current_user.get("likes_given", []) + [current_user_id]
    
    # Find all potential matches first (must have photos and answers)
    cursor = db.users.find({
        "id": {"$nin": exclude_ids},
        "photos": {"$exists": True, "$not": {"$size": 0}},  # Must have photos
        "question_answers": {"$exists": True, "$not": {"$size": 0}},  # Must have answered questions
        "email_verified": True  # Must be email verified
    })
    
    # Filter by gender preferences
    compatible_users = []
    async for user_doc in cursor:
        if can_users_match(current_user, user_doc):
            user_doc.pop("password_hash", None)
            user_doc.pop("_id", None)
            user_doc.pop("likes_given", None)
            user_doc.pop("likes_received", None)
            user_doc.pop("matches", None)
            compatible_users.append(user_doc)
            
            if len(compatible_users) >= limit:
                break
    
    return {"users": compatible_users}

@api_router.post("/profile/{user_id}/view")
async def view_profile(
    user_id: str,
    current_user_id: str = Depends(get_current_user)
):
    """Record that current user viewed another user's profile"""
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="Cannot view your own profile")
    
    # Add to profile views
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"profile_views": current_user_id}}
    )
    
    return {"message": "Profile view recorded"}

@api_router.post("/profile/{user_id}/like")
async def like_user(
    user_id: str,
    current_user_id: str = Depends(get_current_user)
):
    """Like another user (only after viewing their profile)"""
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="Cannot like yourself")
    
    # Check if current user has viewed the profile
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile_views = target_user.get("profile_views", [])
    if current_user_id not in profile_views:
        raise HTTPException(status_code=400, detail="Must view profile before liking")
    
    # Verify users are compatible (gender preferences)
    current_user = await db.users.find_one({"id": current_user_id})
    if not can_users_match(current_user, target_user):
        raise HTTPException(status_code=400, detail="Users are not compatible")
    
    # Add like
    await db.users.update_one(
        {"id": current_user_id},
        {"$addToSet": {"likes_given": user_id}}
    )
    
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"likes_received": current_user_id}}
    )
    
    # Check for mutual match
    target_user_likes = target_user.get("likes_given", [])
    is_match = current_user_id in target_user_likes
    
    if is_match:
        # Create match
        match = Match(user1_id=current_user_id, user2_id=user_id)
        await db.matches.insert_one(match.dict())
        
        # Update both users' matches
        await db.users.update_one(
            {"id": current_user_id},
            {"$addToSet": {"matches": user_id}}
        )
        await db.users.update_one(
            {"id": user_id},
            {"$addToSet": {"matches": current_user_id}}
        )
        
        return {"message": "It's a match!", "match": True}
    
    return {"message": "Like sent", "match": False}

@api_router.get("/matches")
async def get_matches(current_user_id: str = Depends(get_current_user)):
    """Get user's matches"""
    user_doc = await db.users.find_one({"id": current_user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    match_ids = user_doc.get("matches", [])
    
    # Get match details
    matches = []
    async for match_user in db.users.find({"id": {"$in": match_ids}}):
        match_user.pop("password_hash", None)
        match_user.pop("_id", None)
        match_user.pop("likes_given", None)
        match_user.pop("likes_received", None)
        matches.append(match_user)
    
    return {"matches": matches}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
