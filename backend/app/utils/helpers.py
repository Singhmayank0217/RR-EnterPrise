import random
import string
from datetime import datetime


def generate_tracking_number(prefix: str = "RR") -> str:
    """Generate a unique tracking number."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}{timestamp}{random_part}"


def generate_invoice_number(prefix: str = "INV") -> str:
    """Generate a unique invoice number."""
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.digits, k=6))
    return f"{prefix}-{timestamp}-{random_part}"


def determine_pricing_zone(origin_pincode: str, destination_pincode: str) -> str:
    """
    Determine pricing zone based on pincodes.
    This is a simplified version - in production, would use a proper zone mapping.
    """
    origin_prefix = origin_pincode[:3]
    dest_prefix = destination_pincode[:3]
    
    # Same city (first 3 digits match)
    if origin_prefix == dest_prefix:
        return "local"
    
    # Same state (first 2 digits match for most states)
    if origin_pincode[:2] == destination_pincode[:2]:
        return "zonal"
    
    # Metro cities pincodes (simplified)
    metro_prefixes = ["110", "400", "560", "600", "700", "500"]  # Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad
    if origin_prefix in metro_prefixes and dest_prefix in metro_prefixes:
        return "metro"
    
    # Special zones (NE states, J&K, etc.)
    special_prefixes = ["79", "78", "18", "19"]  # Simplified
    if destination_pincode[:2] in special_prefixes:
        return "special"
    
    return "roi"  # Rest of India


def calculate_estimated_days(zone: str, service_type: str) -> int:
    """Calculate estimated delivery days based on zone and service."""
    base_days = {
        "local": 1,
        "zonal": 2,
        "metro": 3,
        "roi": 5,
        "special": 7
    }
    
    service_modifiers = {
        "same_day": -base_days.get(zone, 3) + 0,  # Same day (0 days)
        "overnight": -base_days.get(zone, 3) + 1,  # Next day
        "express": -1,
        "standard": 0
    }
    
    days = base_days.get(zone, 5) + service_modifiers.get(service_type, 0)
    return max(0, days)
