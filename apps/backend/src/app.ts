import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import morgan from 'morgan';
import passport from 'passport';
import { testConnection } from './config/database'
import { initializeDatabase } from './models'
import './config/passport'
import router from './routers/index.router'

dotenv.config()

const app: Application = express()
const PORT = process.env.PORT || 3000

// Trust the first proxy hop (Nginx / load balancer) so req.ip returns the real client IP.
// Set TRUST_PROXY=1 in production (or a specific IP/CIDR for tighter control).
app.set('trust proxy', process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : false))

const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
  // HSTS: tell browsers to always use HTTPS for this origin.
  // Only enforced in production — local dev runs over HTTP.
  strictTransportSecurity: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // CSP: tighten script rules in production by dropping unsafe-eval.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: isProd
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },

  // Stop the browser leaking the full URL to third-party origins.
  referrerPolicy: { policy: 'no-referrer' },
}))

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['X-Token-Expiring']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

app.use(compression())

if(process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'))
} else {
    app.use(morgan('combined'))
}

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
})
app.use('/api', limiter)
app.use(passport.initialize())

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'Cowry API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    })
})

app.get('/', (req: Request, res: Response) => {
    res.json({
        name: 'Cowry API',
        version: '1.0.0',
        documentation: '/api-docs', // swagger
        endpoints: {
            health: '/health',
            auth: '/api/v1/auth',
            accounts: '/api/v1/accounts',
            transactions: '/api/v1/transactions'
        }
    })
})

app.use('/api/v1', router)

app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

interface ErrorWithStatus extends Error {
    status?: number;
    code?: string
}

app.use((err: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500
    const message = err.message || 'Interna; Server Error'

    console.error(`[ERROR] ${new Date().toISOString()}:`, err)

    res.status(status).json({
        status: 'error',
        message,...(process.env.NODE_ENV === 'development' && { stack: err.stack})
    })
})

const startServer = async (): Promise<void> => {
    try {
        await testConnection();
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`
🚀 Cowry API is running
📡 Server: http://localhost:${PORT}
🔄 Environment: ${process.env.NODE_ENV || 'development'}
📝 Logging: ${process.env.NODE_ENV === 'development' ? 'dev' : 'combined'}
            `)
        })
    } catch (error) {
        console.log('❌ Failed to start server:', error)
        process.exit(1)
    }
}

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error)
    process.exit(1)
})

startServer()