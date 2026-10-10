import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

let cachedPrisma = global.prisma;
if (!cachedPrisma) {
  global.prisma = prisma;
} else {
  prisma = cachedPrisma;
}

// POST: Submit enquiry
app.post('/api/enquiry', async (req, res) => {
  try {
    const { name, phone, email, eventType, eventDate, guestCount, venuePreference, budgetRange, services, message, consent } = req.body;

    if (!name || !phone || !email || !eventType || !eventDate || !guestCount || !consent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lead = await prisma.lead.create({
      data: {
        inquiryId: `AKM-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        name,
        phone,
        email,
        eventType,
        eventDate: new Date(eventDate),
        guestCount,
        venuePreference,
        budgetRange,
        services,
        message,
        leadStatus: 'New',
        priority: 'Normal',
        leadSource: 'Website',
        landingPage: req.headers['referer'] || '/',
        assignedTo: null,
        ...(consent && {}),
      },
    });

    // Also create a follow-up task
    await prisma.followUp.create({
      data: {
        leadId: lead.id,
        assignedTo: 'Sales Team',
        followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        notes: 'Initial follow-up for new enquiry',
        completed: false,
      },
    });

    res.status(201).json({ 
      success: true, 
      leadId: lead.id,
      inquiryId: lead.inquiryId,
      message: 'Enquiry submitted successfully' 
    });
  } catch (error) {
    console.error('Enquiry error:', error);
    res.status(500).json({ error: 'Failed to submit enquiry', details: error.message });
  }
});

// GET: Get all leads for admin
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, leads });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET: Get single lead
app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// PATCH: Update lead status
app.patch('/api/leads/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await prisma.lead.update({
      where: { id: parseInt(req.params.id) },
      data: { leadStatus: status },
    });
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

// GET: Get analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const total = await prisma.lead.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.lead.count({ where: { createdAt: { gte: today } } });
    
    res.json({ 
      success: true, 
      totalLeads: total,
      newLeadsToday: todayCount,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akshaya Milan API running on port ${PORT}`);
});

export default app;