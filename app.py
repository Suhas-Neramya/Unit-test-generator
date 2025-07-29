from flask import Flask, request, jsonify
import os
import pathlib
from dotenv import load_dotenv
import openai
import httpx
from datetime import datetime, timedelta
from collections import defaultdict
import time

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Simple rate limiting (in production, use Redis or proper rate limiting)
request_counts = defaultdict(list)
RATE_LIMIT_REQUESTS = 10  # requests per window
RATE_LIMIT_WINDOW = 300   # 5 minutes in seconds

def is_rate_limited(ip):
    now = time.time()
    # Clean old requests
    request_counts[ip] = [req_time for req_time in request_counts[ip] if now - req_time < RATE_LIMIT_WINDOW]
    
    if len(request_counts[ip]) >= RATE_LIMIT_REQUESTS:
        return True
    
    request_counts[ip].append(now)
    return False

# Load knowledge base and examples
# In a production app, consider more robust configuration management
KNOWLEDGE_BASE_PATH = pathlib.Path(__file__).parent / 'resources' / 'knowledge_base.txt'
EXAMPLES_PATH = pathlib.Path(__file__).parent / 'resources' / 'examples.sql'

try:
    with open(KNOWLEDGE_BASE_PATH, 'r') as f:
        knowledge_base = f.read()
except FileNotFoundError:
    knowledge_base = ""
    print(f"Warning: Knowledge base file not found at {KNOWLEDGE_BASE_PATH}")
    
try:
    with open(EXAMPLES_PATH, 'r') as f:
        examples = f.read()
except FileNotFoundError:
    examples = ""
    print(f"Warning: Examples file not found at {EXAMPLES_PATH}")

@app.route('/')
def index():
    # Serve the index.html file
    return app.send_static_file('index.html')

# Add a route to serve static files (like CSS and JS)
@app.route('/<path:filename>')
def static_files(filename):
    return app.send_static_file(filename)

@app.route('/generate', methods=['POST'])
def generate_test():
    # Rate limiting
    client_ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
    if is_rate_limited(client_ip):
        return jsonify({'error': 'Rate limit exceeded. Please try again in a few minutes.'}), 429
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data'}), 400
        
    plsql_code = data.get('code')
    
    if not plsql_code:
        return jsonify({'error': 'No PLSQL code provided'}), 400
    
    # Input validation
    if len(plsql_code) > 50000:  # Limit input size
        return jsonify({'error': 'Code too long. Please limit to 50,000 characters.'}), 400
    
    if not plsql_code.strip():
        return jsonify({'error': 'Please provide valid PLSQL code'}), 400

    openai_api_key = os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        print("ERROR: OPENAI_API_KEY environment variable is not set")
        return jsonify({'error': 'OpenAI API key not configured. Set the OPENAI_API_KEY environment variable.'}), 500

    print(f"INFO: OpenAI API key found (length: {len(openai_api_key)} characters)")
    print(f"INFO: API key starts with: {openai_api_key[:10]}...")

    # Create a custom httpx client that does not use environment variables for proxies
    try:
        http_client = httpx.Client(trust_env=False, timeout=60.0)
        print("INFO: HTTP client created successfully")
    except Exception as e:
        print(f"ERROR: Failed to create HTTP client: {e}")
        return jsonify({'error': f'Failed to create HTTP client: {str(e)}'}), 500

    try:
        openai_client = openai.OpenAI(api_key=openai_api_key, http_client=http_client)
        print("INFO: OpenAI client created successfully")
    except Exception as e:
        print(f"ERROR: Failed to create OpenAI client: {e}")
        return jsonify({'error': f'Failed to create OpenAI client: {str(e)}'}), 500
    
    try:
        print("INFO: Starting OpenAI API request...")
        print(f"INFO: Using model: gpt-4o-mini")
        print(f"INFO: Input code length: {len(plsql_code)} characters")
        
        prompt = [
            {
                'role': 'system',
                'content': 'You are an AI assistant specialized in generating PLSQL unit tests.'
            },
            {
                'role': 'user',
                'content': f"Here is some relevant knowledge about PLSQL standards and practices:\n\n{knowledge_base}"
            },
            {
                'role': 'user',
                'content': f"Here are some examples of PLSQL unit tests:\n\n{examples}"
            },
            {
                'role': 'user',
                'content': f"Generate a comprehensive PLSQL unit test suite for the following code:\n\n```sql\n{plsql_code}\n```\n\nThe tests should cover different scenarios, including edge cases and error handling, only give me the unit test and dont include alt 172 similar charater for spaces."
            }
        ]

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini", # Or the model you prefer
            messages=prompt,
            timeout=30  # 30 second timeout
        )
        
        print("INFO: OpenAI API request completed successfully")
        generated_test = completion.choices[0].message.content

        return jsonify({'test': generated_test})

    except openai.AuthenticationError as e:
        error_msg = f"OpenAI Authentication Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': 'Invalid OpenAI API key. Please check your API key configuration.'}), 401
    except openai.PermissionDeniedError as e:
        error_msg = f"OpenAI Permission Denied: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': 'OpenAI API access denied. Check your API key permissions.'}), 403
    except openai.RateLimitError as e:
        error_msg = f"OpenAI Rate Limit Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': 'OpenAI API rate limit exceeded. Please try again later.'}), 429
    except openai.APITimeoutError as e:
        error_msg = f"OpenAI Timeout Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': 'Request timed out. Please try again.'}), 408
    except openai.APIConnectionError as e:
        error_msg = f"OpenAI Connection Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': f'Connection error: {str(e)}. Check your internet connection.'}), 503
    except openai.APIError as e:
        error_msg = f"OpenAI API Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': f'AI service error: {str(e)}'}), 503
    except httpx.ConnectError as e:
        error_msg = f"HTTP Connection Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': f'Network connection error: {str(e)}'}), 503
    except httpx.TimeoutException as e:
        error_msg = f"HTTP Timeout Error: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({'error': f'Request timeout: {str(e)}'}), 408
    except Exception as e:
        error_msg = f"Unexpected Error: {str(e)} (Type: {type(e).__name__})"
        print(f"ERROR: {error_msg}")
        import traceback
        print(f"ERROR: Full traceback:\n{traceback.format_exc()}")
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    # In a production environment, use a production-ready WSGI server
    # and configure the host and port appropriately.
    # Example: gunicorn -w 4 'app:app'
    app.run(debug=True)