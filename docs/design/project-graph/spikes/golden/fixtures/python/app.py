from .helpers import format_name
from external_pkg import Client
from .missing import absent

def greet(name: str) -> str:
    return format_name(name)
