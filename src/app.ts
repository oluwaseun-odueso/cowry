import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import { sequelize, testConnection } from './config/database'
import morgan from 'morgan'
// import './models'

dotenv.config()

const app: Application = express()
const PORT = process.env.PORT || 3000

app.use(helmet())

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    credentials: true,
    optionsSuccessStatus: 200
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

// Routes
// I should still put all these in an index.router file
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'The Bank API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    })
})

app.get('/', (req: Request, res: Response) => {
    res.json({
        name: 'The Bank API',
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

// app.use('/api/v1', router)

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

        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true })
            console.log('✅ Database synced successfully')
        }

        app.listen(PORT, () => {
            console.log(`
                🚀 The Bank API is running
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