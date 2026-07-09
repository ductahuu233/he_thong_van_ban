from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.compat import apply_collections_compat
from app.core.config import BASE_DIR
from app.core.database import init_db
from app.api.endpoints import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    apply_collections_compat()
    init_db()
    yield


app = FastAPI(title="Administrative Document Generator", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.mount("/outputs", StaticFiles(directory=BASE_DIR / "outputs"), name="outputs")

app.include_router(router)
