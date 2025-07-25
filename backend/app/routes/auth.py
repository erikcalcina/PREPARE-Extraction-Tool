from fastapi import APIRouter, HTTPException, status, Form

router = APIRouter(prefix="/api/v1", tags=["auth"])

# Dummy user database
fake_users_db = {
    "admin": {
        "username": "admin",
        "password": "1234"
    }
}

@router.get("/login")
async def login_get():
    return {"message": "Please send username and password via POST request."}

@router.post("/login")
async def login_post(username: str = Form(...), password: str = Form(...)):
    user = fake_users_db.get(username)
    if not user or user["password"] != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    return {"message": f"Welcome, {username}!"}
