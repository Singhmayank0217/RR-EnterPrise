import requests
import time

def check():
    base = "http://localhost:8000/api"
    try:
        # Auth
        resp = requests.post(f"{base}/auth/token", data={"username": "admin@rrenterprise.com", "password": "admin123"})
        if resp.status_code != 200:
            print(f"Auth failed: {resp.status_code}")
            return
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Consignments
        r_cons = requests.get(f"{base}/consignments/", headers=headers)
        print(f"Consignments Status: {r_cons.status_code}, Count: {len(r_cons.json()) if r_cons.status_code == 200 else 'Error'}")

        # Invoices
        r_inv = requests.get(f"{base}/invoices/", headers=headers)
        if r_inv.status_code == 200:
            data = r_inv.json()
            print(f"Invoices Status: 200, Count: {len(data)}")
            if len(data) > 0:
                print(f"First Invoice: {data[0]['invoice_number']}")
        else:
            print(f"Invoices Error: {r_inv.status_code} {r_inv.text}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    check()
