import os

# Treat this file module as a package so submodules in app/models/ folder can be imported
__path__ = [os.path.join(os.path.dirname(__file__), "models")]

from app.models.database import UserSettings, DocumentHistory
