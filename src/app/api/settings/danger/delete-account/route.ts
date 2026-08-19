import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/api-guard";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * POST /api/settings/danger/delete-account
 * 
 * Permanently deletes the owner's account and associated business data in an ACID transaction:
 * - Requires password verification
 * - Requires explicit confirmation phrase
 * - Deletes all business records (orders, products, customers, messages, events, platform connections)
 * - Deletes user account and all active sessions
 * - Clears session cookie
 */
export async function POST(req: NextRequest) {
  try {
    const { user: authUser, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const body = await req.json();
    const { password, confirmationText } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Please enter your password to confirm account deletion." },
        { status: 400 }
      );
    }

    if (confirmationText !== "DELETE") {
      return NextResponse.json(
        { error: 'Please type "DELETE" in all caps to confirm deletion.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser!.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "The password you entered is incorrect." },
        { status: 400 }
      );
    }

    // ─── LAST-ADMIN DELETE PROTECTION ───
    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: "You cannot delete the only administrator account. Create another administrator first.",
            code: "LAST_ADMIN_PROTECTED",
          },
          { status: 400 }
        );
      }
    }

    const businessId = user.businessId;

    await prisma.$transaction(async (tx) => {
      if (businessId) {
        // 1. Delete Order Items (linked to orders of this business)
        await tx.orderItem.deleteMany({
          where: { order: { businessId } },
        });

        // 2. Delete Payments
        await tx.payment.deleteMany({
          where: { businessId },
        });

        // 3. Delete Calendar Events
        await tx.calendarEvent.deleteMany({
          where: { businessId },
        });

        // 4. Delete Orders
        await tx.order.deleteMany({
          where: { businessId },
        });

        // 5. Delete Messages
        await tx.message.deleteMany({
          where: { conversation: { businessId } },
        });

        // 6. Delete Leads
        await tx.lead.deleteMany({
          where: { businessId },
        });

        // 7. Delete Conversations
        await tx.conversation.deleteMany({
          where: { businessId },
        });

        // 8. Delete Customer Identity Links
        await tx.customerIdentityLink.deleteMany({
          where: { customer: { businessId } },
        });

        // 9. Delete Customers
        await tx.customer.deleteMany({
          where: { businessId },
        });

        // 10. Delete Categories
        await tx.category.deleteMany({
          where: { businessId },
        });

        // 11. Delete Products
        await tx.product.deleteMany({
          where: { businessId },
        });

        // 12. Delete Platform Connections
        await tx.platformConnection.deleteMany({
          where: { businessId },
        });

        // 13. Delete Calendar Connections
        await tx.calendarConnection.deleteMany({
          where: { businessId },
        });

        // 14. Delete AI Insights
        await tx.aiInsight.deleteMany({
          where: { businessId },
        });

        // 15. Delete Audit Logs
        await tx.auditLog.deleteMany({
          where: { businessId },
        });

        // 16. Delete Business
        await tx.business.delete({
          where: { id: businessId },
        });
      }

      // Delete user sessions and user
      await tx.session.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.delete({
        where: { id: user.id },
      });
    });

    const response = NextResponse.json({
      status: "success",
      message: "Your account and all associated data have been permanently deleted.",
    });

    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Could not delete your account. Please try again or contact support." },
      { status: 500 }
    );
  }
}
