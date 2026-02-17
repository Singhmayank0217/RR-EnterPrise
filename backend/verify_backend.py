import requests
import json

BASE_URL = "http://localhost:8000/api"

def main():
    # Login
    try:
        print("Attempting login...")
        # Try both form-data (standard OAuth2) and JSON
        # Standard OAuth2 uses form data
        r = requests.post(f"{BASE_URL}/auth/token", data={"username": "admin@rrenterprise.com", "password": "admin123"})
        
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}")
            return
            
        token = r.json().get("access_token")
        if not token:
            print("No access token in response")
            return
            
        print("Login successful.")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check consignments
        print("\nChecking Consignments List...")
        r = requests.get(f"{BASE_URL}/consignments/", headers=headers)
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Response: {r.text[:500]}...") # Limit output
        else:
            data = r.json()
            print(f"Success! Retrieved {len(data)} consignments.")

        # Check invoices
        print("\nChecking Invoices List...")
        r = requests.get(f"{BASE_URL}/invoices/", headers=headers)
        print(f"Status: {r.status_code}")
        if r.status_code != 200:
            print(f"Response: {r.text[:500]}...")
        else:
            data = r.json()
            print(f"Success! Retrieved {len(data)} invoices.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
