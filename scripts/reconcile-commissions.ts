import { prisma } from '../server/db';

async function reconcileCommissions() {
  try {
    console.log('[RECONCILE] Starting referral commission reconciliation...');
    
    // Get all approved deposits
    const approvedDeposits = await prisma.transaction.findMany({
      where: {
        type: 'deposit',
        status: 'approved',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`[RECONCILE] Found ${approvedDeposits.length} approved deposits`);

    // For each deposit, get the referrer chain and distribute commissions
    for (const deposit of approvedDeposits) {
      const depositAmount = parseFloat(deposit.amount.toString());
      console.log(`\n[RECONCILE] Processing deposit ${deposit.id}: ${depositAmount} XNRT for user ${deposit.userId}`);
      
      const COMMISSION_RATES = {
        1: 0.06,  // 6%
        2: 0.03,  // 3%
        3: 0.01,  // 1%
      };

      // Get referrer chain
      const referrerChain: any[] = [];
      let currentUserId = deposit.userId;

      for (let i = 0; i < 3; i++) {
        const currentUser = await prisma.user.findUnique({
          where: { id: currentUserId },
        });
        
        if (!currentUser || !currentUser.referredBy) break;

        const referrer = await prisma.user.findUnique({
          where: { id: currentUser.referredBy },
        });
        
        if (!referrer) break;

        referrerChain.push(referrer);
        currentUserId = referrer.id;
      }

      console.log(`[RECONCILE] Referrer chain length: ${referrerChain.length}`);
      
      // Distribute commissions for each level
      for (let level = 1; level <= 3; level++) {
        const referrer = referrerChain[level - 1];
        const commission = depositAmount * COMMISSION_RATES[level as 1 | 2 | 3];
        
        if (!referrer) {
          console.log(`[RECONCILE] No referrer at level ${level}, commission would go to company: ${commission.toFixed(2)} XNRT`);
          
          // Credit to admin account
          const admin = await prisma.user.findFirst({
            where: {
              email: 'noahkeaneowen@hotmail.com',
              isAdmin: true,
            },
          });

          if (admin) {
            const adminBalance = await prisma.balance.findUnique({
              where: { userId: admin.id },
            });

            if (adminBalance) {
              const newReferralBalance = parseFloat(adminBalance.referralBalance.toString()) + commission;
              const newTotalEarned = parseFloat(adminBalance.totalEarned.toString()) + commission;
              
              await prisma.balance.update({
                where: { userId: admin.id },
                data: {
                  referralBalance: newReferralBalance,
                  totalEarned: newTotalEarned,
                },
              });
              console.log(`[RECONCILE] Credited ${commission.toFixed(2)} XNRT to admin account`);
            }
          }
          continue;
        }

        console.log(`[RECONCILE] Level ${level}: ${referrer.email} gets ${commission.toFixed(2)} XNRT`);

        // Check if referral record exists
        const existingReferral = await prisma.referral.findFirst({
          where: {
            referrerId: referrer.id,
            referredUserId: deposit.userId,
          },
        });

        if (existingReferral) {
          const newCommission = parseFloat(existingReferral.totalCommission.toString()) + commission;
          await prisma.referral.update({
            where: { id: existingReferral.id },
            data: {
              totalCommission: newCommission,
            },
          });
        } else {
          await prisma.referral.create({
            data: {
              referrerId: referrer.id,
              referredUserId: deposit.userId,
              level,
              totalCommission: commission,
            },
          });
        }

        // Update referrer balance
        const referrerBalance = await prisma.balance.findUnique({
          where: { userId: referrer.id },
        });

        if (referrerBalance) {
          const newReferralBalance = parseFloat(referrerBalance.referralBalance.toString()) + commission;
          const newTotalEarned = parseFloat(referrerBalance.totalEarned.toString()) + commission;
          
          await prisma.balance.update({
            where: { userId: referrer.id },
            data: {
              referralBalance: newReferralBalance,
              totalEarned: newTotalEarned,
            },
          });
          
          console.log(`[RECONCILE] Updated ${referrer.email} balance: referral ${newReferralBalance.toFixed(2)} XNRT`);
        }
      }
    }

    console.log('\n[RECONCILE] Reconciliation complete!');
    
    // Show final balances
    const balances = await prisma.balance.findMany({
      include: {
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });

    console.log('\n[RECONCILE] Final balances:');
    for (const balance of balances) {
      if (parseFloat(balance.referralBalance.toString()) > 0) {
        console.log(`  ${balance.user.username} (${balance.user.email}): Referral Balance = ${parseFloat(balance.referralBalance.toString()).toFixed(2)} XNRT`);
      }
    }

  } catch (error) {
    console.error('[RECONCILE] Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reconcileCommissions();
