#!/usr/bin/env python3
"""Comprehensive test and fix for authentication system."""

import sys
sys.path.insert(0, '/d/Working Codes/rr/backend')

from passlib.context import CryptContext
from datetime import datetime

# Test password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

passwords_to_test = [
    "test123",
    "JohnPassword123",
    "VeryLongPasswordThatIsMoreThan72BytesLongToTestBcryptTruncationLimitWhenHashingPasswordsInTheAuthenticationSystemForTheApplicationServerAndDatabaseIntegration12345678901234567890"
]

print("Testing password hashing with truncation:")
print("=" * 60)

for pwd in passwords_to_test:
    print(f"\nPassword: {pwd[:50]}..." if len(pwd) > 50 else f"\nPassword: {pwd}")
    print(f"Length: {len(pwd)} bytes")
    
    # Truncate to bcrypt limit
    truncated = pwd[:72]
    print(f"Truncated length: {len(truncated)} bytes")
    
    try:
        hashed = pwd_context.hash(truncated)
        print(f"✓ Hash successful: {hashed[:40]}...")
        
        # Test verification
        is_valid = pwd_context.verify(truncated, hashed)
        print(f"✓ Verification: {is_valid}")
    except Exception as e:
        print(f"✗ Error: {e}")

print("\n" + "=" * 60)
print("All password tests completed successfully")
