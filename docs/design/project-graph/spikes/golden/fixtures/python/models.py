class User:
    def __init__(self, name: str):
        self.name = name

    def display(self) -> str:
        return self.name
