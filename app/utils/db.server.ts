import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use local MongoDB URI if available, otherwise use remote URI
const uri = process.env.MONGODB_LOCAL_URI || process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

console.log('Connection URI:', uri, 'DB Name:', dbName);

if (!uri) {
    throw new Error('MongoDB URI is not defined in environment variables');
}

if (!dbName) {
    throw new Error('MongoDB database name is not defined in environment variables');
}

let clientPromise: Promise<MongoClient>;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

// Configure MongoDB client options based on whether connection is local or remote
const getClientOptions = () => {
    // For local connections, we can use simpler options
    if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
        console.log('Using local MongoDB connection');
        return {};
    }

    // For remote connections, use more robust options
    console.log('Using remote MongoDB connection');
    return {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    };
};

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!(global as any)._mongoClientPromise) {
        const client = new MongoClient(uri, getClientOptions());
        (global as any)._mongoClientPromise = client.connect();
    }
    clientPromise = (global as any)._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    const client = new MongoClient(uri, getClientOptions());
    clientPromise = client.connect();
}

export async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = await clientPromise;
    const db = client.db(dbName);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
}

// Helper functions
export async function getCollection(collectionName: string) {
    const { db } = await connectToDatabase();
    return db.collection(collectionName);
}

export default clientPromise; 