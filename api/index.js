const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5100;

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend-domain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection with enhanced options
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.obp5iwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 50,
  wtimeoutMS: 2500,
  connectTimeoutMS: 10000
});

// JWT Middleware with enhanced security
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  if (!authHeader) {
    return res.status(401).json({ 
      success: false,
      message: "Authorization token missing"
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "Malformed token"
    });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid or expired token"
      });
    }
    req.decoded = decoded;
    next();
  });
};

// Admin verification middleware
const verifyAdmin = async (req, res, next) => {
  try {
    const user = await client.db("Doctor-House")
      .collection("users")
      .findOne({ email: req.decoded.email });
      
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: "Admin privileges required"
      });
    }
    next();
  } catch (error) {
    console.error("Admin verification error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error during admin verification"
    });
  }
};

// Database connection and route setup
async function setupDatabaseAndRoutes() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    const db = client.db("Doctor-House");
    const userCollection = db.collection("users");
    const cartCollection = db.collection("carts");
    const menuCollection = db.collection("menu");

    // JWT Authentication
    app.post('/api/jwt', async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(
          { email: user.email }, 
          process.env.ACCESS_TOKEN_SECRET, 
          { expiresIn: '1h' }
        );
        
        res.json({ 
          success: true,
          token,
          expiresIn: 3600
        });
      } catch (error) {
        console.error("JWT generation error:", error);
        res.status(500).json({ 
          success: false,
          message: "Failed to generate token"
        });
      }
    });

    // User Management Endpoints
    app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.json({ 
          success: true,
          data: users 
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ 
          success: false,
          message: "Failed to fetch users"
        });
      }
    });

    // Cart Endpoints
    app.get('/api/carts', verifyToken, async (req, res) => {
      try {
        if (req.query.email !== req.decoded.email) {
          return res.status(403).json({ 
            success: false,
            message: "Unauthorized access to cart"
          });
        }

        const carts = await cartCollection.find({ 
          email: req.query.email 
        }).toArray();

        res.json({ 
          success: true,
          data: carts 
        });
      } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ 
          success: false,
          message: "Failed to fetch cart items"
        });
      }
    });

    // Menu Endpoints
    app.get('/api/menu', async (req, res) => {
      try {
        let query = {};
        if (req.query.specialist) {
          query.specialist = req.query.specialist;
        }
        
        const menuItems = await menuCollection.find(query).toArray();
        res.json({ 
          success: true,
          data: menuItems 
        });
      } catch (error) {
        console.error("Error fetching menu:", error);
        res.status(500).json({ 
          success: false,
          message: "Failed to fetch menu items"
        });
      }
    });

    // Health Check Endpoint
    app.get('/api/health', async (req, res) => {
      try {
        await db.command({ ping: 1 });
        res.json({ 
          success: true,
          message: "Server and database are healthy",
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Health check failed:", error);
        res.status(500).json({ 
          success: false,
          message: "Database connection failed"
        });
      }
    });

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({ 
        success: true,
        message: "Doctor House API is running",
        version: "1.0.0",
        documentation: "https://your-docs-url.com"
      });
    });

    // Handle 404
    app.use((req, res) => {
      res.status(404).json({ 
        success: false,
        message: "Endpoint not found" 
      });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error("Global error:", err);
      res.status(500).json({ 
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

// Initialize the application
setupDatabaseAndRoutes().catch(console.error);

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Docs available at http://localhost:${port}`);
  });
}