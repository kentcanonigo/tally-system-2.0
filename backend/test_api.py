"""
Simple script to test the API endpoints
Run this after starting the backend server
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_endpoints():
    print("🚀 Testing Tally System API\n")
    
    # Test 1: Health check
    print("1. Testing health endpoint...")
    response = requests.get("http://localhost:8000/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}\n")
    
    # Test 2: Create Customer
    print("2. Creating customer...")
    customer_data = {"name": "Test Customer API"}
    response = requests.post(f"{BASE_URL}/customers", json=customer_data)
    if response.status_code == 201:
        customer = response.json()
        customer_id = customer["id"]
        print(f"   ✅ Customer created: ID={customer_id}, Name={customer['name']}\n")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}\n")
        return
    
    # Test 3: Create Plant
    print("3. Creating plant...")
    plant_data = {"name": "Test Plant API"}
    response = requests.post(f"{BASE_URL}/plants", json=plant_data)
    if response.status_code == 201:
        plant = response.json()
        plant_id = plant["id"]
        print(f"   ✅ Plant created: ID={plant_id}, Name={plant['name']}\n")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}\n")
        return
    
    # Test 4: Create Weight Classification
    print("4. Creating weight classification...")
    wc_data = {
        "plant_id": plant_id,
        "classification": "Whole Chicken",
        "min_weight": 1.0,
        "max_weight": 3.0,
        "category": "Dressed"
    }
    response = requests.post(f"{BASE_URL}/plants/{plant_id}/weight-classifications", json=wc_data)
    if response.status_code == 201:
        wc = response.json()
        wc_id = wc["id"]
        print(f"   ✅ Weight classification created: ID={wc_id}, Classification={wc['classification']}\n")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}\n")
        return
    
    # Test 5: Create Tally Session
    print("5. Creating tally session...")
    from datetime import date
    session_data = {
        "customer_id": customer_id,
        "plant_id": plant_id,
        "date": str(date.today()),
        "status": "ongoing"
    }
    response = requests.post(f"{BASE_URL}/tally-sessions", json=session_data)
    if response.status_code == 201:
        session = response.json()
        session_id = session["id"]
        print(f"   ✅ Tally session created: ID={session_id}, Status={session['status']}\n")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}\n")
        return
    
    # Test 6: Create Allocation
    print("6. Creating allocation detail...")
    allocation_data = {
        "tally_session_id": session_id,
        "weight_classification_id": wc_id,
        "required_bags": 100.0,
        "allocated_bags": 95.0
    }
    response = requests.post(f"{BASE_URL}/tally-sessions/{session_id}/allocations", json=allocation_data)
    if response.status_code == 201:
        allocation = response.json()
        print(f"   ✅ Allocation created: ID={allocation['id']}")
        print(f"      Required: {allocation['required_bags']}, Allocated: {allocation['allocated_bags']}\n")
    else:
        print(f"   ❌ Error: {response.status_code} - {response.text}\n")
        return
    
    # Test 7: Get all data
    print("7. Retrieving all data...")
    customers = requests.get(f"{BASE_URL}/customers").json()
    plants = requests.get(f"{BASE_URL}/plants").json()
    sessions = requests.get(f"{BASE_URL}/tally-sessions").json()
    allocations = requests.get(f"{BASE_URL}/tally-sessions/{session_id}/allocations").json()
    
    print(f"   ✅ Customers: {len(customers)}")
    print(f"   ✅ Plants: {len(plants)}")
    print(f"   ✅ Sessions: {len(sessions)}")
    print(f"   ✅ Allocations: {len(allocations)}\n")
    
    print("🎉 All tests passed! API is working correctly.")
    print(f"\n📊 View your data at: http://localhost:8000/docs")
    print(f"🌐 View dashboard at: http://localhost:3000")

if __name__ == "__main__":
    try:
        test_endpoints()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to API. Make sure the backend server is running:")
        print("   cd backend")
        print("   uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")

