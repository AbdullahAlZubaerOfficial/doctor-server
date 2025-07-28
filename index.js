const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5100;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
  res.send('Server is running on port ' + port);
});

// MongoDB setup
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.obp5iwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// Verify admin middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await client.db("Doctor-House").collection("users").findOne(query);
  if (user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

// Database connection and routes
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("Doctor-House");
    const userCollection = db.collection("users");
    const cartCollection = db.collection("carts");
    const menuCollection = db.collection("menu");
    const appointmentCollection = db.collection("appointment");
    const userProfileCollection = db.collection("userprofile");

    // JWT API
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        { email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1h' }
      );
      res.send({ token });
    });

    // Users API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Forbidden access' });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        res.send({ admin: user?.role === 'admin' });
      } catch (error) {
        console.error("Error checking admin status:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: 'admin' } };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Username API
    app.get('/users/username/:username', async (req, res) => {
      try {
        const username = req.params.username;
        const user = await userCollection.findOne({ userName: username });
        if (!user) {
          return res.status(404).send({ message: 'Username not found' });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user by username:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // User profile API
    app.get('/updatemyprofile/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'Forbidden access' });
        }
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }
        res.send(user);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Cart API
    app.post('/carts', verifyToken, async (req, res) => {
      try {
        const cartItem = req.body;
        cartItem.userEmail = req.decoded.email;
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/carts', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const query = { userEmail: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/carts/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id), userEmail: req.decoded.email };
        const result = await cartCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Item not found in your cart' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error deleting cart item:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Menu API
    app.get('/menu', async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching menu:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/menu/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: 'Item not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching menu item:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const item = req.body;
        const result = await menuCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        console.error("Error adding menu item:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            name: item.name,
            image: item.image,
            price: item.price,
            specialist: item.specialist,
            location: item.location,
            available: item.available,
            details: item.details
          }
        };
        const result = await menuCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating menu item:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting menu item:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Appointment API
    app.get('/appointments', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const result = await appointmentCollection.find({ patientEmail: email }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.post('/appointments', verifyToken, async (req, res) => {
      try {
        const appointment = req.body;
        if (!appointment.doctorId || !appointment.appointmentDate) {
          return res.status(400).send({ message: 'Missing required fields' });
        }
        appointment.patientEmail = req.decoded.email;
        appointment.status = 'pending';
        const result = await appointmentCollection.insertOne(appointment);
        res.send(result);
      } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.patch('/appointments/:id', verifyToken, async (req, res) => {
      try {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id), patientEmail: req.decoded.email };
        const updateDoc = {
          $set: {
            patientName: item.name,
            patientAge: item.age,
            patientPhone: item.phone,
            appointmentDate: item.date,
            appointmentTime: item.time,
            message: item.message,
          }
        };
        const result = await appointmentCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Appointment not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/appointments/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id), patientEmail: req.decoded.email };
        const result = await appointmentCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Appointment not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // User Profile API
    app.get('/userprofile', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const profile = await userProfileCollection.findOne({ email });
        if (!profile) {
          return res.status(404).send({ message: 'Profile not found' });
        }
        res.send(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.get('/userprofile/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userProfileCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: 'Profile not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.post('/userprofile', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email;
        const profileData = req.body;
        profileData.email = email;
        
        const existingProfile = await userProfileCollection.findOne({ email });
        let result;
        
        if (existingProfile) {
          result = await userProfileCollection.updateOne(
            { email },
            { $set: profileData }
          );
        } else {
          result = await userProfileCollection.insertOne(profileData);
        }
        
        res.send(result);
      } catch (error) {
        console.error('Error saving user profile:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.patch('/userprofile/:id', verifyToken, async (req, res) => {
      try {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id), email: req.decoded.email };
        const updateDoc = {
          $set: {
            fullName: item.fullname,
            userName: item.username,
            userImage: item.userImage,
            Email: item.email,
            NID: item.nid,
            Gender: item.gender,
            bloodGroup: item.bloodGroup,
            EmergencyName: item.EmergencyName,
            EmergencyRelationship: item.EmergencyRelationship,
            EmergencyNumber: item.EmergencyNumber,
          }
        };
        const result = await userProfileCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Profile not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    app.delete('/userprofile/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id), email: req.decoded.email };
        const result = await userProfileCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Profile not found' });
        }
        res.send(result);
      } catch (error) {
        console.error("Error deleting profile:", error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).send({ message: 'Something broke!', error: err.message });
    });

    // Start server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

run().catch(console.error);