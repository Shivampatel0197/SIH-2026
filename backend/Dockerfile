FROM python:3.9-slim
WORKDIR /app

# Ensure output directory exists and has permissions
RUN mkdir -p output && chmod 777 output

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces defaults to exposing port 7860
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
