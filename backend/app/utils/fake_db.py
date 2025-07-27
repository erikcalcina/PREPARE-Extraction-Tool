
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
fake_vocabularies_db = []

uploaded_filenames = []

def reset_fake_db():
    global fake_users_db, fake_vocabularies_db, uploaded_filenames
    fake_users_db = {
        "admin": {
            "username": "admin",
            "password": "1234"
        }
    }
    fake_vocabularies_db = []
    uploaded_filenames = []
fake_datasets_db = [
    {"id": 1, "title": "Arabic Vocabulary"},
    {"id": 2, "title": "English Expressions"},
]