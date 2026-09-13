FROM python:3.12-slim

WORKDIR /securedata/backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /securedata/backend/data
ENV SECUREDATA_DATABASE_URL=sqlite:///./data/securedata.db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
