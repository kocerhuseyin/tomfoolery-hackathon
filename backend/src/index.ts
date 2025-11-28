import { PrismaClient, User, PostCategory, MeetupCategory } from '../prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import axios from 'axios';
import { load } from 'cheerio';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { URL } from 'node:url';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-change-me';
const DATABASE_URL = process.env.DATABASE_URL;
const USER_AGENT = 'TomfooleryCrawler/1.0 (+https://example.com)';
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Prisma');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const allowedOrigins = FRONTEND_ORIGIN.split(',').map((origin) => origin.trim());
const ALLOWED_CATEGORIES: PostCategory[] = ['market', 'qa', 'discussion'];
const ALLOWED_MEETUPS: MeetupCategory[] = ['hike', 'bike', 'food', 'code', 'study', 'social'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

type AuthenticatedRequest = express.Request & { user?: User };

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

type CrawlPage = {
  url: string;
  status?: number;
  title?: string;
  description?: string;
  links: string[];
  error?: string;
};

type ScrapeResult = {
  url: string;
  status?: number;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  textPreview?: string;
  headings: string[];
  links: string[];
  error?: string;
};

type TumEvent = {
  title: string;
  date?: string;
  url?: string;
  image?: string;
};

type ForumPost = {
  id: string;
  title: string;
  body: string;
  category: PostCategory;
  createdAt: Date;
  author: {
    id: string;
    fullName: string;
    email: string;
    faculty: string | null;
  };
  commentsCount: number;
};

type ForumPostWithComments = ForumPost & {
  comments: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author: {
      id: string;
      fullName: string;
      email: string;
    };
  }>;
};

type MeetupResponse = {
  id: string;
  title: string;
  description: string;
  category: MeetupCategory;
  timeInfo: string;
  location: string;
  maxAttendees?: number | null;
  host: {
    id: string;
    fullName: string;
  };
  memberCount: number;
  joined: boolean;
};

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toAbsoluteUrl(href: string | undefined, base: string) {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'student'}-${suffix}`;
}

function sanitizeUser(user: User) {
  return {
    ...user,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function issueToken(user: User) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      provider: user.authProvider,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

const authMiddleware: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub as string } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid token user' });
    }

    req.user = user;
    return next();
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Invalid token';
    return res.status(401).json({ error: reason });
  }
};

async function getUniqueSlug(base: string) {
  let attempt = 0;
  let slug = slugify(base);

  while (attempt < 5) {
    const existing = await prisma.user.findUnique({ where: { profileSlug: slug } });
    if (!existing) return slug;
    slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 4)}`;
    attempt += 1;
  }

  return `${slugify(base)}-${Date.now()}`;
}

function normalizeUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function isSameDomain(url: string, origin: URL) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === origin.hostname;
  } catch {
    return false;
  }
}

async function crawl(startUrl: string, options: { maxPages: number; maxDepth: number; sameDomain: boolean; }) {
  const { maxPages, maxDepth, sameDomain } = options;
  const origin = new URL(startUrl);
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const visited = new Set<string>();
  const pages: CrawlPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift();
    if (!current) break;
    const normalized = normalizeUrl(current.url);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    let page: CrawlPage = { url: normalized, links: [] };

    try {
      const response = await axios.get(normalized, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      const contentType = response.headers['content-type'] || '';
      page.status = response.status;

      if (!contentType.includes('text/html')) {
        page.error = 'Skipped non-HTML response';
        pages.push(page);
        continue;
      }

      const $ = load(response.data);
      page.title = $('title').first().text().trim() || undefined;
      page.description = $('meta[name="description"]').attr('content') || undefined;

      const links: string[] = [];
      $('a[href]')
        .slice(0, 50)
        .each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const absolute = new URL(href, normalized).toString();
            links.push(normalizeUrl(absolute) || absolute);
          } catch {
            return;
          }
        });

      page.links = Array.from(new Set(links)).slice(0, 50);
      pages.push(page);

      const nextDepth = current.depth + 1;
      if (nextDepth <= maxDepth) {
        for (const link of page.links) {
          if (!link) continue;
          if (sameDomain && !isSameDomain(link, origin)) continue;
          if (!visited.has(link)) {
            queue.push({ url: link, depth: nextDepth });
          }
        }
      }
    } catch (err) {
      page.error = err instanceof Error ? err.message : 'Request failed';
      pages.push(page);
    }
  }

  return pages;
}

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', docs: '/api/health' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.get('/api/tum-events', async (_req, res) => {
  const EVENTS_URL = 'https://chn.tum.de/events';
  try {
    const response = await axios.get(EVENTS_URL, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      timeout: 10000,
    });
    const $ = load(response.data);
    const events: TumEvent[] = [];

    const seen = new Set<string>();
    const links = $('a[href*="/event/"]')
      .slice(0, 30)
      .toArray()
      .map((linkEl) => {
        const href = $(linkEl).attr('href');
        const absolute = toAbsoluteUrl(href, EVENTS_URL);
        if (!absolute || seen.has(absolute)) return null;
        seen.add(absolute);
        const container = $(linkEl).closest('article, li, .event, .event-item, .event-list__item');
        const title =
          container.find('h3, h2, .event-title').first().text().trim() ||
          $(linkEl).text().trim();
        if (!title) return null;
        const date =
          container.find('time').attr('datetime') ||
          container.find('time').text().trim() ||
          container.find('.date, .event-date').first().text().trim() ||
          undefined;
        return { title, date, url: absolute };
      })
      .filter(Boolean) as TumEvent[];

    const limited = links.slice(0, 5);

    // Fetch images from event detail pages (best-effort).
    const withImages = await Promise.all(
      limited.map(async (event) => {
        if (!event.url) return event;
        try {
          const detail = await axios.get(event.url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
            timeout: 8000,
          });
          const $$ = load(detail.data);
          const ogImage = $$('meta[property="og:image"]').attr('content');
          const hero = $$('img').first().attr('src');
          const image = toAbsoluteUrl(ogImage || hero, event.url);
          return { ...event, image };
        } catch {
          return event;
        }
      }),
    );

    return res.json({
      source: EVENTS_URL,
      count: withImages.length,
      events: withImages,
    });
  } catch (err) {
    console.error('Failed to fetch TUM events', err);
    return res.status(500).json({ error: 'Failed to fetch TUM events' });
  }
});

app.post('/auth/mock-login', async (req, res) => {
  const { email, fullName, tumId = null, faculty = null, semester = null } = req.body ?? {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!fullName || typeof fullName !== 'string') {
    return res.status(400).json({ error: 'Full name is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSemester =
    semester === undefined || semester === null || semester === ''
      ? null
      : Number(semester);

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const parsedSemester = Number.isNaN(normalizedSemester) ? null : normalizedSemester;

    let user: User;
    if (!existing) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: fullName.trim(),
          tumId: tumId ? String(tumId) : null,
          faculty: faculty ? String(faculty) : null,
          semester: parsedSemester,
          profileSlug: await getUniqueSlug(fullName),
          authProvider: 'mock',
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: fullName.trim(),
          tumId: tumId ? String(tumId) : null,
          faculty: faculty ? String(faculty) : null,
          semester: parsedSemester,
        },
      });
    }

    const token = issueToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('mock-login failed', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!fresh) {
      return res.status(401).json({ error: 'User not found' });
    }
    return res.json({ user: sanitizeUser(fresh) });
  } catch (err) {
    console.error('/me failed', err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.get('/forum/posts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const filterCategory = category && ALLOWED_CATEGORIES.includes(category as PostCategory) ? (category as PostCategory) : undefined;

  try {
    const posts = await prisma.post.findMany({
      where: filterCategory ? { category: filterCategory } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: true,
        _count: { select: { comments: true } },
      },
    });

    const payload: ForumPost[] = posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      category: p.category,
      createdAt: p.createdAt,
      author: {
        id: p.authorId,
        fullName: p.author.fullName,
        email: p.author.email,
        faculty: p.author.faculty,
      },
      commentsCount: p._count.comments,
    }));

    return res.json({ posts: payload });
  } catch (err) {
    console.error('Failed to list posts', err);
    return res.status(500).json({ error: 'Failed to load posts' });
  }
});

app.post('/forum/posts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { title, body, category } = req.body ?? {};
  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({ error: 'Title must be at least 3 characters' });
  }
  if (!body || typeof body !== 'string' || body.trim().length < 3) {
    return res.status(400).json({ error: 'Body must be at least 3 characters' });
  }
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  try {
    const created = await prisma.post.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        category,
        authorId: req.user.id,
      },
      include: {
        author: true,
        _count: { select: { comments: true } },
      },
    });

    const payload: ForumPost = {
      id: created.id,
      title: created.title,
      body: created.body,
      category: created.category,
      createdAt: created.createdAt,
      author: {
        id: created.authorId,
        fullName: created.author.fullName,
        email: created.author.email,
        faculty: created.author.faculty,
      },
      commentsCount: created._count.comments,
    };

    return res.status(201).json({ post: payload });
  } catch (err) {
    console.error('Failed to create post', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

app.get('/forum/posts/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const postId = req.params.id;
  if (!postId) return res.status(400).json({ error: 'Missing post id' });

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
        _count: { select: { comments: true } },
      },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    const payload: ForumPostWithComments = {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      createdAt: post.createdAt,
      author: {
        id: post.authorId,
        fullName: post.author.fullName,
        email: post.author.email,
        faculty: post.author.faculty,
      },
      commentsCount: post._count.comments,
      comments: post.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: {
          id: c.authorId,
          fullName: c.author.fullName,
          email: c.author.email,
        },
      })),
    };

    return res.json({ post: payload });
  } catch (err) {
    console.error('Failed to load post detail', err);
    return res.status(500).json({ error: 'Failed to load post detail' });
  }
});

app.post('/forum/posts/:id/comments', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const postId = req.params.id;
  const { body } = req.body ?? {};
  if (!body || typeof body !== 'string' || body.trim().length < 1) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  try {
    const created = await prisma.comment.create({
      data: {
        body: body.trim(),
        postId,
        authorId: req.user.id,
      },
      include: { author: true, post: true },
    });

    return res.status(201).json({
      comment: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt,
        author: {
          id: created.authorId,
          fullName: created.author.fullName,
          email: created.author.email,
        },
      },
    });
  } catch (err) {
    console.error('Failed to create comment', err);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

app.get('/meetups', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const filterCategory =
    category && ALLOWED_MEETUPS.includes(category as MeetupCategory) ? (category as MeetupCategory) : undefined;

  try {
    const meetups = await prisma.meetup.findMany({
      where: filterCategory ? { category: filterCategory } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        host: true,
        members: { select: { userId: true } },
      },
    });

    const payload: MeetupResponse[] = meetups.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      timeInfo: m.timeInfo,
      location: m.location,
      maxAttendees: m.maxAttendees,
      host: {
        id: m.hostId,
        fullName: m.host.fullName,
      },
      memberCount: m.members.length,
      joined: m.members.some((mem) => mem.userId === req.user?.id),
    }));

    return res.json({ meetups: payload });
  } catch (err) {
    console.error('Failed to list meetups', err);
    return res.status(500).json({ error: 'Failed to load meetups' });
  }
});

app.post('/meetups', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { title, description, category, timeInfo, location, maxAttendees } = req.body ?? {};

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({ error: 'Title must be at least 3 characters' });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 3) {
    return res.status(400).json({ error: 'Description must be at least 3 characters' });
  }
  if (!category || !ALLOWED_MEETUPS.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!timeInfo || typeof timeInfo !== 'string') {
    return res.status(400).json({ error: 'Time info is required' });
  }
  if (!location || typeof location !== 'string') {
    return res.status(400).json({ error: 'Location is required' });
  }

  try {
    const created = await prisma.meetup.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category,
        timeInfo: timeInfo.trim(),
        location: location.trim(),
        maxAttendees: maxAttendees ?? null,
        hostId: req.user.id,
        members: {
          create: { userId: req.user.id },
        },
      },
      include: { host: true, members: { select: { userId: true } } },
    });

    const payload: MeetupResponse = {
      id: created.id,
      title: created.title,
      description: created.description,
      category: created.category,
      timeInfo: created.timeInfo,
      location: created.location,
      maxAttendees: created.maxAttendees,
      host: {
        id: created.hostId,
        fullName: created.host.fullName,
      },
      memberCount: created.members.length,
      joined: true,
    };

    return res.status(201).json({ meetup: payload });
  } catch (err) {
    console.error('Failed to create meetup', err);
    return res.status(500).json({ error: 'Failed to create meetup' });
  }
});

app.post('/meetups/:id/join', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const meetupId = req.params.id;
  if (!meetupId) return res.status(400).json({ error: 'Missing meetup id' });

  try {
    const meetup = await prisma.meetup.findUnique({
      where: { id: meetupId },
      include: { members: true },
    });
    if (!meetup) return res.status(404).json({ error: 'Meetup not found' });

    if (meetup.maxAttendees && meetup.members.length >= meetup.maxAttendees) {
      return res.status(400).json({ error: 'Meetup is full' });
    }

    await prisma.meetupMember.upsert({
      where: { meetupId_userId: { meetupId, userId: req.user.id } },
      update: {},
      create: { meetupId, userId: req.user.id },
    });

    return res.json({ status: 'joined' });
  } catch (err) {
    console.error('Failed to join meetup', err);
    return res.status(500).json({ error: 'Failed to join meetup' });
  }
});

app.post('/meetups/:id/leave', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const meetupId = req.params.id;
  if (!meetupId) return res.status(400).json({ error: 'Missing meetup id' });

  try {
    await prisma.meetupMember.deleteMany({
      where: { meetupId, userId: req.user.id },
    });
    return res.json({ status: 'left' });
  } catch (err) {
    console.error('Failed to leave meetup', err);
    return res.status(500).json({ error: 'Failed to leave meetup' });
  }
});

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body ?? {};

  if (!url || typeof url !== 'string' || !isHttpUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  const target = normalizeUrl(url);
  if (!target) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const result: ScrapeResult = {
    url: target,
    headings: [],
    links: [],
  };

  try {
    const response = await axios.get(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    result.status = response.status;
    const contentType = response.headers['content-type'] || '';

    if (!contentType.includes('text/html')) {
      result.error = 'Skipped non-HTML response';
      return res.json(result);
    }

    const $ = load(response.data);
    const getMeta = (name: string) =>
      $(`meta[name="${name}"]`).attr('content') || $(`meta[property="${name}"]`).attr('content');

    result.title = $('title').first().text().trim() || undefined;
    result.description = getMeta('description') || undefined;
    result.ogTitle = getMeta('og:title') || undefined;
    result.ogDescription = getMeta('og:description') || undefined;
    result.ogImage = getMeta('og:image') || undefined;

    const headings: string[] = [];
    $('h1, h2, h3')
      .slice(0, 20)
      .each((_, el) => {
        const text = $(el).text().trim();
        if (text) headings.push(text);
      });
    result.headings = headings;

    const firstParagraph = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .find((text) => text.length > 40);
    if (firstParagraph) {
      result.textPreview = firstParagraph.slice(0, 280);
    }

    const links: string[] = [];
    $('a[href]')
      .slice(0, 50)
      .each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const absolute = new URL(href, target).toString();
          links.push(normalizeUrl(absolute) || absolute);
        } catch {
          return;
        }
      });
    result.links = Array.from(new Set(links)).slice(0, 50);

    return res.json(result);
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Request failed';
    return res.status(500).json(result);
  }
});

app.post('/api/crawl', async (req, res) => {
  const { url, maxPages = 5, maxDepth = 1, sameDomain = true } = req.body ?? {};

  if (!url || typeof url !== 'string' || !isHttpUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL' });
  }

  const safeMaxPages = Math.min(Math.max(Number(maxPages) || 1, 1), 20);
  const safeMaxDepth = Math.min(Math.max(Number(maxDepth) || 0, 0), 3);
  const enforceSameDomain = Boolean(sameDomain);

  try {
    const pages = await crawl(url, {
      maxPages: safeMaxPages,
      maxDepth: safeMaxDepth,
      sameDomain: enforceSameDomain,
    });

    res.json({
      startUrl: url,
      maxPages: safeMaxPages,
      maxDepth: safeMaxDepth,
      sameDomain: enforceSameDomain,
      pages,
    });
  } catch (err) {
    console.error('Crawl failed', err);
    return res.status(500).json({ error: 'Crawl failed' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
