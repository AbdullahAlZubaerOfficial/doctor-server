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
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.obp5iwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// API Routes
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("Doctor-House");
    const userCollection = db.collection("users");
    const cartCollection = db.collection("carts");
    const menuCollection = db.collection("menu");

    // JWT API
    app.post('/api/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Middleware
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeader.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) return res.status(401).send({ message: "Unauthorized" });
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // Users API
    app.get('/api/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/api/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      const user = await userCollection.findOne({ email });
      res.send({ admin: user?.role === 'admin' });
    });

    app.post('/api/users', async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/api/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: 'admin' } }
      );
      res.send(result);
    });

    app.delete('/api/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/api/users/username/:username', async (req, res) => {
      try {
        const user = await userCollection.findOne({ userName: req.params.username });
        if (!user) return res.status(404).send({ message: 'Username not found' });
        res.send({ email: user.email });
      } catch (error) {
        console.error("Error fetching email by username:", error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Carts API
    app.post('/api/carts', async (req, res) => {
      const result = await cartCollection.insertOne(req.body);
      res.send(result);
    });

    app.delete('/api/carts/:id', async (req, res) => {
      const result = await cartCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.get('/api/carts', async (req, res) => {
      const result = await cartCollection.find({ email: req.query.email }).toArray();
      res.send(result);
    });

    // Menu API
    app.get('/api/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get('/api/menu/:id', async (req, res) => {
      const result = await menuCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.post('/api/menu', verifyToken, verifyAdmin, async (req, res) => {
      const result = await menuCollection.insertOne(req.body);
      res.send(result);
    });

    app.patch('/api/menu/:id', async (req, res) => {
      const result = await menuCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete('/api/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const result = await menuCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Health check
    app.get('/', (req, res) => {
      res.send('Server is running');
    });

    await db.command({ ping: 1 });
    console.log("Pinged MongoDB deployment");
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.error);

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}