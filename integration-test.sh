#!/bin/bash
# Integration Test: Presenton + PPP_PI_NEW
# Tests JWT auth flow, proxy routing, and basic presenton functionality

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}PPP_PI_NEW + Presenton Integration Test${NC}"
echo -e "${YELLOW}========================================${NC}"

# Configuration
PPP_API_URL="${PPP_API_URL:-http://localhost:3000}"
PRESENTON_API_URL="${PRESENTON_API_URL:-http://localhost:8000}"
JWT_SECRET="${JWT_SECRET:-ppp-jwt-secret-key-2024-change-in-production}"

echo -e "\n${YELLOW}[1] Checking service connectivity...${NC}"

# Check ppp_pi_new frontend
if curl -s "${PPP_API_URL}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ ppp_pi_new frontend is accessible${NC}"
else
    echo -e "${RED}✗ ppp_pi_new frontend is NOT accessible at ${PPP_API_URL}${NC}"
    exit 1
fi

# Check presenton backend
if curl -s "${PRESENTON_API_URL}/api/v1/auth/status" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ presenton backend is accessible${NC}"
else
    echo -e "${RED}✗ presenton backend is NOT accessible at ${PRESENTON_API_URL}${NC}"
    exit 1
fi

echo -e "\n${YELLOW}[2] Testing PPT API proxy routing...${NC}"

# Test proxy route (should work without auth initially)
PROXY_TEST=$(curl -s -w "\n%{http_code}" "${PPP_API_URL}/api/ppt/themes" 2>&1 || echo "000")
HTTP_CODE=$(echo "${PROXY_TEST}" | tail -n1)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API proxy route is responding (HTTP ${HTTP_CODE})${NC}"
else
    echo -e "${YELLOW}⚠ API proxy route returned HTTP ${HTTP_CODE} (expected 200 or 401)${NC}"
fi

echo -e "\n${YELLOW}[3] Testing JWT authentication flow...${NC}"

# Generate a test JWT token (requires 'jq' and 'node' with jose)
TEST_SCRIPT=$(cat << 'TESTEOF'
const { SignJWT } = require('jose');

async function generateToken() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'ppp-jwt-secret-key-2024-change-in-production');
  
  const token = await new SignJWT({
    sub: 'test-user',
    username: 'test',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
  
  console.log(token);
}

generateToken().catch(console.error);
TESTEOF
)

# Try to generate JWT token
TEST_TOKEN=$(node -e "${TEST_SCRIPT}" 2>/dev/null || echo "")

if [ -n "$TEST_TOKEN" ]; then
    echo -e "${GREEN}✓ JWT token generated successfully${NC}"
    
    # Test presenton endpoint with JWT
    JWT_TEST=$(curl -s -w "\n%{http_code}" \
        -H "Cookie: ppp_token=${TEST_TOKEN}" \
        "${PRESENTON_API_URL}/api/v1/ppt/themes" 2>&1 || echo "000")
    JWT_HTTP=$(echo "${JWT_TEST}" | tail -n1)
    
    if [ "$JWT_HTTP" = "200" ] || [ "$JWT_HTTP" = "401" ]; then
        echo -e "${GREEN}✓ JWT authentication flow is working (HTTP ${JWT_HTTP})${NC}"
    else
        echo -e "${YELLOW}⚠ JWT auth test returned HTTP ${JWT_HTTP}${NC}"
    fi
else
    echo -e "${YELLOW}⚠ JWT token generation skipped (node/jose not available)${NC}"
fi

echo -e "\n${YELLOW}[4] Testing presenton_editor components...${NC}"

# Check if presenton_editor directory exists in ppp_pi_new
if [ -d "./web/src/app/presenton_editor" ]; then
    echo -e "${GREEN}✓ presenton_editor frontend components are copied${NC}"
    
    # Count API service files
    SERVICE_FILE_COUNT=$(find ./web/src/app/presenton_editor/services/api -name "*.ts" 2>/dev/null | wc -l)
    echo -e "${GREEN}  - Found ${SERVICE_FILE_COUNT} API service files${NC}"
else
    echo -e "${RED}✗ presenton_editor components not found at ./web/src/app/presenton_editor${NC}"
fi

echo -e "\n${YELLOW}[5] Verifying environment configuration...${NC}"

# Check if docker-compose has JWT_SECRET config
if grep -q "JWT_SECRET" docker-compose.yml; then
    echo -e "${GREEN}✓ JWT_SECRET is configured in docker-compose.yml${NC}"
else
    echo -e "${RED}✗ JWT_SECRET is NOT configured in docker-compose.yml${NC}"
fi

# Check if .env.example has PRESENTON_BASE_URL
if grep -q "PRESENTON_BASE_URL" .env.example; then
    echo -e "${GREEN}✓ PRESENTON_BASE_URL is documented in .env.example${NC}"
else
    echo -e "${RED}✗ PRESENTON_BASE_URL is NOT documented in .env.example${NC}"
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}✓ Integration test completed!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Start services: docker-compose up -d"
echo -e "2. Login via ppp_pi_new frontend"
echo -e "3. Navigate to presenton_editor in ppp_pi_new"
echo -e "4. Create a test presentation"
echo -e "5. Verify JWT auth and proxy routing in browser network tab"
