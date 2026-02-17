from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test with 72 character limit
test_password = "This_is_a_very_long_password_that_tests_the_bcrypt_72_byte_limit_12345"
print(f"Original password length: {len(test_password)}")

# Truncate to 72 bytes
truncated = test_password[:72]
print(f"Truncated password length: {len(truncated)}")

# Try to hash
try:
    hashed = pwd_context.hash(truncated)
    print(f"Hash succeeded: {hashed[:50]}...")
except Exception as e:
    print(f"Error with truncated: {e}")
    
# Now test without truncation to see the error
print("\n--- Testing without truncation ---")
try:
    hashed = pwd_context.hash(test_password)
    print(f"Hash succeeded: {hashed[:50]}...")
except Exception as e:
    print(f"Error without truncation: {e}")
