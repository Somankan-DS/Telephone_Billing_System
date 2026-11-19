import { prisma } from '../../shared/database';
import { Decimal } from 'decimal.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors';

export class NotificationService {
  /**
   * Get notifications for authenticated user/customer
   */
  public async getNotifications(customerIdOrUserId?: string, limit = 20) {
    let customerId = customerIdOrUserId;

    if (customerId) {
      // Check if it's a userId
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [{ id: customerId }, { userId: customerId }],
        },
      });
      if (customer) {
        customerId = customer.id;
      }
    }

    const where: any = {};
    if (customerId) {
      where.customerId = customerId;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, limit),
    });

    return notifications.map((n) => ({
      ...n,
      id: n.id,
      is_read: n.isRead,
      action_url: n.actionUrl,
      created_at: n.createdAt,
    }));
  }

  /**
   * Mark single notification as read
   */
  public async markAsRead(idOrIdentifier: string | number, callerCustomerId?: string) {
    const str = String(idOrIdentifier).trim();

    let notif = await prisma.notification.findUnique({
      where: { id: str },
    });

    if (!notif) {
      const num = parseInt(str, 10);
      if (!isNaN(num) && num > 0 && num <= 100) {
        const where: any = {};
        if (callerCustomerId) where.customerId = callerCustomerId;
        const notifs = await prisma.notification.findMany({
          where,
          take: 1,
          skip: num - 1,
          orderBy: { createdAt: 'desc' },
        });
        if (notifs.length > 0) notif = notifs[0];
      }
    }

    if (!notif) {
      throw new NotFoundError(`Notification '${str}' not found`, 'NOTIFICATION_NOT_FOUND');
    }

    if (callerCustomerId && notif.customerId !== callerCustomerId) {
      throw new ForbiddenError('Unauthorized: Cannot modify notification belonging to another customer', 'IDOR_VIOLATION');
    }

    await prisma.notification.update({
      where: { id: notif.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * Mark all notifications as read
   */
  public async markAllRead(customerIdOrUserId?: string) {
    let customerId = customerIdOrUserId;

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          OR: [{ id: customerId }, { userId: customerId }],
        },
      });
      if (customer) customerId = customer.id;
    }

    const where: any = { isRead: false };
    if (customerId) where.customerId = customerId;

    const res = await prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, count: res.count, message: 'All notifications marked as read' };
  }

  /**
   * Feature 42 & 43: Trigger automated bill due & low balance reminders with deduplication
   */
  public async triggerReminders() {
    const now = new Date();
    const fiveDaysAhead = new Date();
    fiveDaysAhead.setDate(fiveDaysAhead.getDate() + 5);

    let remindersCreated = 0;

    // 1. Upcoming and Overdue Invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      include: { customer: true },
    });

    for (const inv of unpaidInvoices) {
      const dueDate = new Date(inv.dueDate);
      const isOverdue = dueDate < now;
      const isUpcoming = dueDate >= now && dueDate <= fiveDaysAhead;

      if (!isOverdue && !isUpcoming) continue;

      const type = isOverdue ? 'OVERDUE' : 'BILL_DUE';
      const title = isOverdue ? `Overdue Alert: Bill ${inv.invoiceNumber}` : `Upcoming Bill Due: ${inv.invoiceNumber}`;
      const remainingAmount = new Decimal(inv.totalAmount.toString()).minus(new Decimal(inv.paidAmount.toString()));

      // Deduplication: check if alert sent in last 24h
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          customerId: inv.customerId,
          type,
          createdAt: { gte: dayAgo },
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            customerId: inv.customerId,
            title,
            message: `Invoice ${inv.invoiceNumber} for INR ${remainingAmount.toFixed(2)} is ${isOverdue ? 'OVERDUE' : 'due on ' + dueDate.toLocaleDateString()}. Please settle to avoid disruption.`,
            type,
            actionUrl: `/invoices/${inv.id}`,
          },
        });
        remindersCreated++;
      }
    }

    // 2. Low Prepaid Balances (< INR 50.00)
    const lowBalanceCustomers = await prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
        tariffPlan: { type: 'PREPAID' },
        prepaidBalance: { lte: 50.0 },
      },
    });

    for (const cust of lowBalanceCustomers) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          customerId: cust.id,
          type: 'LOW_BALANCE',
          createdAt: { gte: dayAgo },
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            customerId: cust.id,
            title: 'Low Prepaid Balance Alert',
            message: `Your prepaid balance is running low (INR ${parseFloat(cust.prepaidBalance.toString()).toFixed(2)}). Recharge now to ensure uninterrupted calling.`,
            type: 'LOW_BALANCE',
            actionUrl: '/payments',
          },
        });
        remindersCreated++;
      }
    }

    return {
      success: true,
      remindersCreated,
      message: `Triggered reminder evaluation loop. Created ${remindersCreated} new notifications.`,
    };
  }
}
