fake_users_db = {
    "admin": {
        "username": "admin",
        "password": "1234"
    }
}

def reset_fake_db():
    global fake_users_db
    fake_users_db = {
        "admin": {
            "username": "admin",
            "password": "1234"
        }
    }