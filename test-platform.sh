#!/bin/bash

# XNRT Platform Comprehensive Testing Script
# Test user: test@xnrt.org / test1234

BASE_URL="http://localhost:5000"
COOKIE_FILE="/tmp/test-cookies.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "XNRT PLATFORM COMPREHENSIVE TEST SUITE"
echo "========================================="
echo ""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# 1. Test Login
echo "1. Testing Authentication..."
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@xnrt.org","password":"test1234"}' \
  -c ${COOKIE_FILE})

if echo "$LOGIN_RESPONSE" | grep -q "Login successful"; then
    print_result 0 "Login successful"
    USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
    echo "  User ID: $USER_ID"
else
    print_result 1 "Login failed"
    exit 1
fi
echo ""

# 2. Test Dashboard Data
echo "2. Testing Dashboard..."
BALANCE=$(curl -s ${BASE_URL}/api/balance -b ${COOKIE_FILE})
STATS=$(curl -s ${BASE_URL}/api/stats -b ${COOKIE_FILE})

if echo "$BALANCE" | jq -e '.xnrtBalance' > /dev/null 2>&1; then
    XNRT_BAL=$(echo "$BALANCE" | jq -r '.xnrtBalance')
    print_result 0 "Balance fetched: $XNRT_BAL XNRT"
else
    print_result 1 "Balance fetch failed"
fi

if echo "$STATS" | jq -e '.activeStakes' > /dev/null 2>&1; then
    print_result 0 "Stats fetched successfully"
else
    print_result 1 "Stats fetch failed"
fi
echo ""

# 3. Test Staking
echo "3. Testing Staking System..."
STAKES=$(curl -s ${BASE_URL}/api/stakes -b ${COOKIE_FILE})

if echo "$STAKES" | jq -e '.' > /dev/null 2>&1; then
    STAKE_COUNT=$(echo "$STAKES" | jq 'length')
    print_result 0 "Stakes fetched: $STAKE_COUNT stakes"
else
    print_result 1 "Stakes fetch failed"
fi
echo ""

# 4. Test Mining
echo "4. Testing Mining System..."
MINING_CURRENT=$(curl -s ${BASE_URL}/api/mining/current -b ${COOKIE_FILE})
MINING_HISTORY=$(curl -s ${BASE_URL}/api/mining/history -b ${COOKIE_FILE})

if echo "$MINING_CURRENT" | jq -e '.' > /dev/null 2>&1; then
    print_result 0 "Mining current status fetched"
else
    print_result 1 "Mining current status failed"
fi

if echo "$MINING_HISTORY" | jq -e '.' > /dev/null 2>&1; then
    print_result 0 "Mining history fetched"
else
    print_result 1 "Mining history failed"
fi
echo ""

# 5. Test Referrals
echo "5. Testing Referral System..."
REFERRAL_STATS=$(curl -s ${BASE_URL}/api/referrals/stats -b ${COOKIE_FILE})
REFERRAL_TREE=$(curl -s ${BASE_URL}/api/referrals/tree -b ${COOKIE_FILE})

if echo "$REFERRAL_STATS" | jq -e '.level1Count' > /dev/null 2>&1; then
    L1=$(echo "$REFERRAL_STATS" | jq -r '.level1Count')
    L2=$(echo "$REFERRAL_STATS" | jq -r '.level2Count')
    L3=$(echo "$REFERRAL_STATS" | jq -r '.level3Count')
    print_result 0 "Referral stats: L1=$L1, L2=$L2, L3=$L3"
else
    print_result 1 "Referral stats failed"
fi
echo ""

# 6. Test Check-ins
echo "6. Testing Daily Check-in System..."
CHECKIN_HISTORY=$(curl -s ${BASE_URL}/api/checkin/history -b ${COOKIE_FILE})

if echo "$CHECKIN_HISTORY" | jq -e '.dates' > /dev/null 2>&1; then
    DATES=$(echo "$CHECKIN_HISTORY" | jq -r '.dates | length')
    print_result 0 "Check-in history fetched: $DATES days"
else
    print_result 1 "Check-in history failed"
fi
echo ""

# 7. Test Achievements
echo "7. Testing Achievement System..."
ACHIEVEMENTS=$(curl -s ${BASE_URL}/api/achievements -b ${COOKIE_FILE})

if echo "$ACHIEVEMENTS" | jq -e '.' > /dev/null 2>&1; then
    UNLOCKED=$(echo "$ACHIEVEMENTS" | jq '[.[] | select(.unlocked == true)] | length')
    TOTAL=$(echo "$ACHIEVEMENTS" | jq 'length')
    print_result 0 "Achievements: $UNLOCKED/$TOTAL unlocked"
else
    print_result 1 "Achievements fetch failed"
fi
echo ""

# 8. Test Leaderboard
echo "8. Testing XP Leaderboard..."
LEADERBOARD=$(curl -s "${BASE_URL}/api/leaderboard/xp?period=weekly&category=overall" -b ${COOKIE_FILE})

if echo "$LEADERBOARD" | jq -e '.leaderboard' > /dev/null 2>&1; then
    COUNT=$(echo "$LEADERBOARD" | jq '.leaderboard | length')
    print_result 0 "Leaderboard fetched: $COUNT users"
else
    print_result 1 "Leaderboard fetch failed"
fi
echo ""

# 9. Test Notifications
echo "9. Testing Notification System..."
NOTIF_COUNT=$(curl -s ${BASE_URL}/api/notifications/unread-count -b ${COOKIE_FILE})
NOTIFICATIONS=$(curl -s ${BASE_URL}/api/notifications -b ${COOKIE_FILE})

if echo "$NOTIF_COUNT" | jq -e '.count' > /dev/null 2>&1; then
    COUNT=$(echo "$NOTIF_COUNT" | jq -r '.count')
    print_result 0 "Unread notifications: $COUNT"
else
    print_result 1 "Notification count failed"
fi
echo ""

# 10. Test Transactions
echo "10. Testing Transaction History..."
DEPOSITS=$(curl -s ${BASE_URL}/api/transactions/deposits -b ${COOKIE_FILE})
WITHDRAWALS=$(curl -s ${BASE_URL}/api/transactions/withdrawals -b ${COOKIE_FILE})

if echo "$DEPOSITS" | jq -e '.' > /dev/null 2>&1; then
    DEP_COUNT=$(echo "$DEPOSITS" | jq 'length')
    print_result 0 "Deposits fetched: $DEP_COUNT"
else
    print_result 1 "Deposits fetch failed"
fi

if echo "$WITHDRAWALS" | jq -e '.' > /dev/null 2>&1; then
    WITH_COUNT=$(echo "$WITHDRAWALS" | jq 'length')
    print_result 0 "Withdrawals fetched: $WITH_COUNT"
else
    print_result 1 "Withdrawals fetch failed"
fi
echo ""

# 11. Test Profile Stats
echo "11. Testing Profile Stats..."
PROFILE_STATS=$(curl -s ${BASE_URL}/api/profile/stats -b ${COOKIE_FILE})

if echo "$PROFILE_STATS" | jq -e '.totalReferrals' > /dev/null 2>&1; then
    print_result 0 "Profile stats fetched"
else
    print_result 1 "Profile stats failed"
fi
echo ""

# 12. Test Push Notifications
echo "12. Testing Push Notification Endpoints..."
VAPID_KEY=$(curl -s ${BASE_URL}/api/push/vapid-public-key -b ${COOKIE_FILE})

if echo "$VAPID_KEY" | jq -e '.publicKey' > /dev/null 2>&1; then
    print_result 0 "VAPID public key fetched"
else
    print_result 1 "VAPID key fetch failed"
fi
echo ""

echo "========================================="
echo "TEST SUITE COMPLETED"
echo "========================================="
