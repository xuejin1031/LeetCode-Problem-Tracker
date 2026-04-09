import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql, { Pool, PoolOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const isDevelopment = process.env.NODE_ENV !== 'production';
const DATA_DIR = path.resolve(__dirname, '../data');
const JSON_STORAGE_PATH = path.join(DATA_DIR, 'problems.json');
const SQLITE_STORAGE_PATH = path.join(DATA_DIR, 'problems.sqlite');

app.use(cors());
app.use(express.json());

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type StorageMode = 'mysql' | 'sqlite' | 'json';

interface ProblemPayload {
  title: string;
  number: number;
  difficulty: Difficulty;
  tag: string | null;
  isSolved: boolean;
  note: string | null;
}

interface ProblemRecord extends ProblemPayload {
  id: number;
  date: string;
  updatedAt: string;
}

interface ProblemRow extends RowDataPacket {
  id: number;
  title: string;
  number: number;
  difficulty: Difficulty;
  tag: string | null;
  isSolved: 0 | 1;
  note: string | null;
  date: string;
  updatedAt: string;
}

interface ProblemFilters {
  q?: string | null;
  difficulty?: Difficulty | null;
  status?: 'solved' | 'unsolved' | null;
  tag?: string | null;
}

interface StorageStatus {
  mode: StorageMode | 'uninitialized';
  available: boolean;
  message: string;
  checkedAt: string | null;
}

interface StatisticsResponse {
  overall: {
    total: number;
    solved: number;
    easyTotal: number;
    easySolved: number;
    mediumTotal: number;
    mediumSolved: number;
    hardTotal: number;
    hardSolved: number;
  };
  byTag: Array<{ tag: string; count: number; solved: number }>;
  recent: ProblemRecord[];
}

interface StorageAdapter {
  readonly mode: StorageMode;
  initialize(): Promise<void>;
  listProblems(filters?: ProblemFilters): Promise<ProblemRecord[]>;
  getProblem(id: number): Promise<ProblemRecord | null>;
  createProblem(payload: ProblemPayload): Promise<ProblemRecord>;
  updateProblem(id: number, payload: ProblemPayload): Promise<ProblemRecord | null>;
  deleteProblem(id: number): Promise<boolean>;
  getStatistics(): Promise<StatisticsResponse>;
}

const storageStatus: StorageStatus = {
  mode: 'uninitialized',
  available: false,
  message: 'Storage not initialized',
  checkedAt: null,
};

let storage: StorageAdapter | null = null;

function updateStorageStatus(mode: StorageStatus['mode'], available: boolean, message: string) {
  storageStatus.mode = mode;
  storageStatus.available = available;
  storageStatus.message = message;
  storageStatus.checkedAt = new Date().toISOString();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: string }).code || 'Unknown error');
  }

  return 'Unknown error';
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseProblemPayload(body: unknown): { data?: ProblemPayload; error?: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }

  const raw = body as Record<string, unknown>;
  const title = cleanText(raw.title);
  const tag = cleanText(raw.tag);
  const note = cleanText(raw.note);
  const difficulty = raw.difficulty;
  const number = Number(raw.number);
  const isSolved = Boolean(raw.isSolved);

  if (!title) {
    return { error: 'Title is required' };
  }

  if (!Number.isInteger(number) || number <= 0) {
    return { error: 'Problem number must be a positive integer' };
  }

  if (difficulty !== 'Easy' && difficulty !== 'Medium' && difficulty !== 'Hard') {
    return { error: 'Difficulty must be Easy, Medium, or Hard' };
  }

  return {
    data: {
      title,
      number,
      difficulty,
      tag,
      isSolved,
      note,
    },
  };
}

function parseStatusFilter(value: unknown): 'solved' | 'unsolved' | null {
  if (value === 'solved' || value === 'unsolved') {
    return value;
  }

  return null;
}

function normalizeProblem(row: ProblemRow): ProblemRecord {
  return {
    id: row.id,
    title: row.title,
    number: row.number,
    difficulty: row.difficulty,
    tag: row.tag,
    isSolved: Boolean(row.isSolved),
    note: row.note,
    date: row.date,
    updatedAt: row.updatedAt,
  };
}

function sortProblems(items: ProblemRecord[]) {
  return [...items].sort((a, b) => a.number - b.number);
}

function matchesFilters(problem: ProblemRecord, filters?: ProblemFilters) {
  if (!filters) {
    return true;
  }

  const keyword = (filters.q || '').trim().toLowerCase();
  const searchable = [problem.title, problem.note || '', problem.tag || ''].join(' ').toLowerCase();

  if (keyword && !searchable.includes(keyword)) {
    return false;
  }

  if (filters.difficulty && problem.difficulty !== filters.difficulty) {
    return false;
  }

  if (filters.status === 'solved' && !problem.isSolved) {
    return false;
  }

  if (filters.status === 'unsolved' && problem.isSolved) {
    return false;
  }

  if (filters.tag) {
    const tags = (problem.tag || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!tags.some((tag) => tag.toLowerCase().includes(filters.tag!.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

function accumulateTagStats(rows: ProblemRecord[]) {
  const tagMap = new Map<string, { tag: string; count: number; solved: number }>();

  for (const row of rows) {
    const parts = (row.tag || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const current = tagMap.get(part) || { tag: part, count: 0, solved: 0 };
      current.count += 1;
      current.solved += row.isSolved ? 1 : 0;
      tagMap.set(part, current);
    }
  }

  return [...tagMap.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function buildStatistics(rows: ProblemRecord[]): StatisticsResponse {
  const overall = {
    total: rows.length,
    solved: rows.filter((row) => row.isSolved).length,
    easyTotal: rows.filter((row) => row.difficulty === 'Easy').length,
    easySolved: rows.filter((row) => row.difficulty === 'Easy' && row.isSolved).length,
    mediumTotal: rows.filter((row) => row.difficulty === 'Medium').length,
    mediumSolved: rows.filter((row) => row.difficulty === 'Medium' && row.isSolved).length,
    hardTotal: rows.filter((row) => row.difficulty === 'Hard').length,
    hardSolved: rows.filter((row) => row.difficulty === 'Hard' && row.isSolved).length,
  };

  const recent = [...rows]
    .sort((a, b) => {
      const left = new Date(a.updatedAt || a.date).getTime();
      const right = new Date(b.updatedAt || b.date).getTime();
      return right - left || a.number - b.number;
    })
    .slice(0, 10);

  return {
    overall,
    byTag: accumulateTagStats(rows),
    recent,
  };
}

function createDuplicateError() {
  const error = new Error('Problem number already exists') as Error & { code?: string };
  error.code = 'ER_DUP_ENTRY';
  return error;
}

function createNotFoundError() {
  const error = new Error('Problem not found') as Error & { code?: string };
  error.code = 'NOT_FOUND';
  return error;
}

class MySqlStorageAdapter implements StorageAdapter {
  readonly mode = 'mysql' as const;
  private readonly pool: Pool;

  constructor(config: PoolOptions) {
    this.pool = mysql.createPool(config);
  }

  private async withConnection<T>(callback: (conn: mysql.PoolConnection) => Promise<T>) {
    const connection = await this.pool.getConnection();
    try {
      return await callback(connection);
    } finally {
      connection.release();
    }
  }

  async initialize() {
    await this.withConnection(async (connection) => {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS problems (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          number INT NOT NULL UNIQUE,
          difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL,
          tag VARCHAR(255),
          isSolved BOOLEAN DEFAULT FALSE,
          note LONGTEXT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_difficulty (difficulty),
          INDEX idx_solved (isSolved),
          INDEX idx_number (number)
        )
      `);
    });
  }

  async listProblems(filters?: ProblemFilters) {
    const conditions: string[] = [];
    const params: Array<string | number | boolean> = [];

    if (filters?.q) {
      const pattern = `%${filters.q}%`;
      conditions.push('(title LIKE ? OR note LIKE ? OR tag LIKE ?)');
      params.push(pattern, pattern, pattern);
    }

    if (filters?.difficulty) {
      conditions.push('difficulty = ?');
      params.push(filters.difficulty);
    }

    if (filters?.status === 'solved') {
      conditions.push('isSolved = ?');
      params.push(true);
    }

    if (filters?.status === 'unsolved') {
      conditions.push('isSolved = ?');
      params.push(false);
    }

    if (filters?.tag) {
      conditions.push('tag LIKE ?');
      params.push(`%${filters.tag}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.withConnection((connection) =>
      connection.execute<ProblemRow[]>(`SELECT * FROM problems ${whereClause} ORDER BY number ASC`, params)
    );

    return rows.map(normalizeProblem);
  }

  async getProblem(id: number) {
    const [rows] = await this.withConnection((connection) =>
      connection.execute<ProblemRow[]>('SELECT * FROM problems WHERE id = ?', [id])
    );

    return rows[0] ? normalizeProblem(rows[0]) : null;
  }

  async createProblem(payload: ProblemPayload) {
    try {
      const [result] = await this.withConnection((connection) =>
        connection.execute<ResultSetHeader>(
          'INSERT INTO problems (title, number, difficulty, tag, isSolved, note) VALUES (?, ?, ?, ?, ?, ?)',
          [payload.title, payload.number, payload.difficulty, payload.tag, payload.isSolved, payload.note]
        )
      );

      const created = await this.getProblem(result.insertId);
      if (!created) {
        throw new Error('Created problem could not be loaded');
      }

      return created;
    } catch (error) {
      const mysqlError = error as { code?: string };
      if (mysqlError.code === 'ER_DUP_ENTRY') {
        throw createDuplicateError();
      }
      throw error;
    }
  }

  async updateProblem(id: number, payload: ProblemPayload) {
    try {
      const [result] = await this.withConnection((connection) =>
        connection.execute<ResultSetHeader>(
          `UPDATE problems
           SET title = ?, number = ?, difficulty = ?, tag = ?, isSolved = ?, note = ?
           WHERE id = ?`,
          [payload.title, payload.number, payload.difficulty, payload.tag, payload.isSolved, payload.note, id]
        )
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return this.getProblem(id);
    } catch (error) {
      const mysqlError = error as { code?: string };
      if (mysqlError.code === 'ER_DUP_ENTRY') {
        throw createDuplicateError();
      }
      throw error;
    }
  }

  async deleteProblem(id: number) {
    const [result] = await this.withConnection((connection) =>
      connection.execute<ResultSetHeader>('DELETE FROM problems WHERE id = ?', [id])
    );

    return result.affectedRows > 0;
  }

  async getStatistics() {
    return buildStatistics(await this.listProblems());
  }
}

class JsonStorageAdapter implements StorageAdapter {
  readonly mode = 'json' as const;
  private readonly filePath: string;
  private writeQueue = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await this.writeData([]);
    }
  }

  private async readData() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? (parsed as ProblemRecord[]) : [];
    } catch {
      return [];
    }
  }

  private async writeData(data: ProblemRecord[]) {
    this.writeQueue = this.writeQueue.then(() =>
      fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    );
    await this.writeQueue;
  }

  async listProblems(filters?: ProblemFilters) {
    const items = await this.readData();
    return sortProblems(items.filter((item) => matchesFilters(item, filters)));
  }

  async getProblem(id: number) {
    const items = await this.readData();
    return items.find((item) => item.id === id) || null;
  }

  async createProblem(payload: ProblemPayload) {
    const items = await this.readData();

    if (items.some((item) => item.number === payload.number)) {
      throw createDuplicateError();
    }

    const now = new Date().toISOString();
    const nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const created: ProblemRecord = {
      id: nextId,
      ...payload,
      date: now,
      updatedAt: now,
    };

    items.push(created);
    await this.writeData(sortProblems(items));
    return created;
  }

  async updateProblem(id: number, payload: ProblemPayload) {
    const items = await this.readData();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    if (items.some((item) => item.id !== id && item.number === payload.number)) {
      throw createDuplicateError();
    }

    const updated: ProblemRecord = {
      ...items[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    await this.writeData(sortProblems(items));
    return updated;
  }

  async deleteProblem(id: number) {
    const items = await this.readData();
    const nextItems = items.filter((item) => item.id !== id);

    if (nextItems.length === items.length) {
      return false;
    }

    await this.writeData(sortProblems(nextItems));
    return true;
  }

  async getStatistics() {
    return buildStatistics(await this.readData());
  }
}

class SqliteStorageAdapter implements StorageAdapter {
  readonly mode = 'sqlite' as const;
  private readonly filePath: string;
  private db: any;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    const sqliteModule = require('node:sqlite') as { DatabaseSync?: new (filename: string) => any };
    if (!sqliteModule.DatabaseSync) {
      throw new Error('node:sqlite is not available');
    }

    this.db = new sqliteModule.DatabaseSync(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS problems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        number INTEGER NOT NULL UNIQUE,
        difficulty TEXT NOT NULL,
        tag TEXT,
        isSolved INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        date TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  }

  private ensureDatabase() {
    if (!this.db) {
      throw new Error('SQLite database not initialized');
    }

    return this.db;
  }

  private mapRow(row: any): ProblemRecord {
    return {
      id: Number(row.id),
      title: String(row.title),
      number: Number(row.number),
      difficulty: row.difficulty as Difficulty,
      tag: row.tag === null ? null : String(row.tag),
      isSolved: Boolean(row.isSolved),
      note: row.note === null ? null : String(row.note),
      date: String(row.date),
      updatedAt: String(row.updatedAt),
    };
  }

  async listProblems(filters?: ProblemFilters) {
    const db = this.ensureDatabase();
    const rows = db.prepare('SELECT * FROM problems ORDER BY number ASC').all() as any[];
    const problems = rows.map((row) => this.mapRow(row));
    return problems.filter((problem) => matchesFilters(problem, filters));
  }

  async getProblem(id: number) {
    const db = this.ensureDatabase();
    const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  async createProblem(payload: ProblemPayload) {
    const db = this.ensureDatabase();
    const now = new Date().toISOString();

    try {
      const result = db
        .prepare(
          'INSERT INTO problems (title, number, difficulty, tag, isSolved, note, date, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          payload.title,
          payload.number,
          payload.difficulty,
          payload.tag,
          payload.isSolved ? 1 : 0,
          payload.note,
          now,
          now
        );

      const created = await this.getProblem(Number(result.lastInsertRowid));
      if (!created) {
        throw new Error('Created problem could not be loaded');
      }

      return created;
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('UNIQUE')) {
        throw createDuplicateError();
      }
      throw error;
    }
  }

  async updateProblem(id: number, payload: ProblemPayload) {
    const db = this.ensureDatabase();

    try {
      const result = db
        .prepare(
          `UPDATE problems
           SET title = ?, number = ?, difficulty = ?, tag = ?, isSolved = ?, note = ?, updatedAt = ?
           WHERE id = ?`
        )
        .run(
          payload.title,
          payload.number,
          payload.difficulty,
          payload.tag,
          payload.isSolved ? 1 : 0,
          payload.note,
          new Date().toISOString(),
          id
        );

      if (!Number(result.changes)) {
        return null;
      }

      return this.getProblem(id);
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes('UNIQUE')) {
        throw createDuplicateError();
      }
      throw error;
    }
  }

  async deleteProblem(id: number) {
    const db = this.ensureDatabase();
    const result = db.prepare('DELETE FROM problems WHERE id = ?').run(id);
    return Boolean(result.changes);
  }

  async getStatistics() {
    return buildStatistics(await this.listProblems());
  }
}

async function initializeStorage() {
  const mysqlStorage = new MySqlStorageAdapter({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'leetcode_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    await mysqlStorage.initialize();
    storage = mysqlStorage;
    updateStorageStatus('mysql', true, 'Using MySQL storage');
    console.log('Storage initialized with MySQL');
    return;
  } catch (error) {
    console.warn(`MySQL unavailable, falling back to SQLite: ${getErrorMessage(error)}`);
  }

  const sqliteStorage = new SqliteStorageAdapter(SQLITE_STORAGE_PATH);

  try {
    await sqliteStorage.initialize();
    storage = sqliteStorage;
    updateStorageStatus('sqlite', true, 'Using SQLite fallback storage');
    console.log(`Storage initialized with SQLite at ${SQLITE_STORAGE_PATH}`);
    return;
  } catch (error) {
    console.warn(`SQLite unavailable, falling back to JSON: ${getErrorMessage(error)}`);
  }

  const jsonStorage = new JsonStorageAdapter(JSON_STORAGE_PATH);
  await jsonStorage.initialize();
  storage = jsonStorage;
  updateStorageStatus('json', true, 'Using JSON fallback storage');
  console.log(`Storage initialized with JSON at ${JSON_STORAGE_PATH}`);
}

function requireStorage() {
  if (!storage) {
    throw new Error('Storage is not initialized');
  }

  return storage;
}

function handleApiError(res: Response, action: string, error: unknown, fallbackMessage: string) {
  console.error(`${action}:`, error);

  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: string }).code || '')
    : '';

  if (code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ error: 'Problem number already exists' });
  }

  if (code === 'NOT_FOUND') {
    return res.status(404).json({ error: 'Problem not found' });
  }

  return res.status(500).json({
    error: fallbackMessage,
    detail: isDevelopment ? getErrorMessage(error) : undefined,
  });
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(storageStatus.available ? 200 : 503).json({
    status: storageStatus.available ? 'OK' : 'DEGRADED',
    message: 'Backend is running',
    storage: storageStatus,
  });
});

app.get('/api/problems', async (req: Request, res: Response) => {
  try {
    const problems = await requireStorage().listProblems({
      q: cleanText(req.query.q),
      difficulty:
        req.query.difficulty === 'Easy' || req.query.difficulty === 'Medium' || req.query.difficulty === 'Hard'
          ? req.query.difficulty
          : null,
      status: parseStatusFilter(req.query.status),
      tag: cleanText(req.query.tag),
    });

    res.json(problems);
  } catch (error) {
    handleApiError(res, 'Fetch problems error', error, 'Failed to fetch problems');
  }
});

app.get('/api/problems/:id', async (req: Request, res: Response) => {
  try {
    const problem = await requireStorage().getProblem(Number(req.params.id));

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    res.json(problem);
  } catch (error) {
    handleApiError(res, 'Fetch single problem error', error, 'Failed to fetch problem');
  }
});

app.post('/api/problems', async (req: Request, res: Response) => {
  const parsed = parseProblemPayload(req.body);
  if (!parsed.data) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const problem = await requireStorage().createProblem(parsed.data);
    res.status(201).json({ message: 'Problem created', problem });
  } catch (error) {
    handleApiError(res, 'Create problem error', error, 'Failed to create problem');
  }
});

app.put('/api/problems/:id', async (req: Request, res: Response) => {
  const parsed = parseProblemPayload(req.body);
  if (!parsed.data) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const problem = await requireStorage().updateProblem(Number(req.params.id), parsed.data);

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    res.json({ message: 'Problem updated', problem });
  } catch (error) {
    handleApiError(res, 'Update problem error', error, 'Failed to update problem');
  }
});

app.delete('/api/problems/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await requireStorage().deleteProblem(Number(req.params.id));

    if (!deleted) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    res.json({ message: 'Problem deleted' });
  } catch (error) {
    handleApiError(res, 'Delete problem error', error, 'Failed to delete problem');
  }
});

app.get('/api/statistics', async (_req: Request, res: Response) => {
  try {
    res.json(await requireStorage().getStatistics());
  } catch (error) {
    handleApiError(res, 'Fetch statistics error', error, 'Failed to fetch statistics');
  }
});

initializeStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    updateStorageStatus('uninitialized', false, getErrorMessage(error));
    console.error('Storage initialization error:', error);
    process.exit(1);
  });
