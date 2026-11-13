from .models import User

def format_name(name: str) -> str:
    return User(name).display()
