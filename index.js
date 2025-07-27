



const express = require('express');
const app = express();

const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config()

const port = process.env.PORT || 5100;

// middleware
app.use(cors());
app.use(express.json());
app.get("/",(req,res)=>{
    res.send('boss is sitting on port 5100');
})

app.listen(port,()=>{
    console.log(`Boss is sitting on port ${port}`);
})


// mongodb+srv://zubaerislam703:vhaDZyizwjRL3tES@cluster0.obp5iwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.obp5iwu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,

  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    

    const userCollection = client.db("Doctor-House").collection("users");
    const cartCollection = client.db("Doctor-House").collection("carts");
    const menuCollection = client.db("Doctor-House").collection("menu")
    const appointmentCollection = client.db("Doctor-House").collection("appointment")
    const userProfileCollection = client.db("Doctor-House").collection("userprofile")


   // jwt related api
app.post('/jwt', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(
        { email: user.email }, // Only store necessary user info in token
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1h' }
    );
    
    // Set secure HTTP-only cookie
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
    });
    
    res.send({ success: true });
});

// Token verification middleware
const verifyToken = (req, res, next) => {
    // Check for token in cookies first, then Authorization header
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Invalid or expired token" });
        }
        req.user = decoded; // Attach decoded user to request
        next();
    });
};




// Now you can use:
// verifyRole('admin'), verifyRole('doctor'), etc.


    // use verify admin after verify token
    const verifyAdmin = async(req,res,next)=> {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message:'forbidden access'});
      }
      next();
    }

    // users related api
    app.get('/users',verifyToken,verifyAdmin,async(req,res)=> {
        const result = await userCollection.find().toArray();
        console.log(req.headers);
        res.send(result);
    })

    app.get('/users/admin/:email',verifyToken,async(req,res)=>{
      const email = req.params.email;
      if(email!=req.decoded.email){
        return res.status(403).send({message:'forbidden access'});
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })

    app.post('/users',async(req,res)=> {
        const user = req.body;
        // insert email if user does not exists
        // you can do this many ways(1.email uniqye, 2.upsert , 3.simple checking)
        const query = {email: user.email}
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
            return res.send({message: 'user already exists', insertedId:null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    })


    app.patch('/users/admin/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role:'admin'
        }
      }
      const result = await userCollection.updateOne(filter,updateDoc)
      res.send(result);
    })
 

    app.delete('/users/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })



    // userName

    app.get('/users/username/:username',async(req,res)=>{
      const username = req.params.username;
      try{
        const user = await userCollection.findOne({userName:username});

        if(!user){
          return res.status(404).send({message:'Username not found'})
        }
        res.send(user);   // return matched email
        // res.send({email: user.email});   // return matched email

      }
      catch(error){
        console.error("Error fatching email by username: ",error);
        res.status(500).send({message:'Internal Server Error'});
      }
    })


    // ⛑️ get user by email
app.get('/updatemyprofile/:email', async (req, res) => {
  const email = req.params.email;
  try {
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



    // carts collection

    app.post('/carts',async(req,res)=> {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })

    app.delete('/carts/:id',async(req,res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/carts',async(req,res)=> {
      // const result = await cartCollection.find().toArray();
      const email = req.query.email;
      const query = {email: email}
      const result = await cartCollection.find(query).toArray();
      res.send(result);

    })


    // menu related api
    app.get('/menu',async(req,res)=> {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get('/menu/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    app.post('/menu',async(req,res)=>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })

    app.patch('/menu/:id',async(req,res)=> {
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          name:item.name,
          image:item.image,
          price:item.price,
          specialist:item.specialist,
          locationn:item.locationn,
          available: item.available,
          details:item.details
        }
      }
      const result = await menuCollection.updateOne(filter,updateDoc)
      res.send(result);
    })

    app.delete('/menu/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result);
    })



// appointment Collection api
// Get all appointments for the logged-in user
// Appointment API endpoints
app.get('/appointments', verifyToken, async (req, res) => {
  try {
    const email = req.decoded.email;
    const result = await appointmentCollection.find({ patientEmail: email }).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.post('/appointments', verifyToken, async (req, res) => {
  try {
    const appointment = req.body;
    
    // Validate required fields
    if (!appointment.doctorId || !appointment.appointmentDate) {
      return res.status(400).send({ error: "Missing required fields" });
    }
    
    // Set patient email from authenticated user
    appointment.patientEmail = req.decoded.email;
    appointment.status = 'pending';
    
    const result = await appointmentCollection.insertOne(appointment);
    res.send(result);
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.patch('/appointments/:id', verifyToken, async (req, res) => {
  try {
    const item = req.body;
    const id = req.params.id;
    const email = req.decoded.email;
    
    // Verify appointment belongs to user
    const existingAppointment = await appointmentCollection.findOne({ 
      _id: new ObjectId(id),
      patientEmail: email
    });
    
    if (!existingAppointment) {
      return res.status(403).send({ error: "Access denied" });
    }

    const filter = { _id: new ObjectId(id) };
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
    res.send(result);
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.delete('/appointments/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const email = req.decoded.email;
    
    // Verify appointment belongs to user
    const existingAppointment = await appointmentCollection.findOne({ 
      _id: new ObjectId(id),
      patientEmail: email
    });
    
    if (!existingAppointment) {
      return res.status(403).send({ error: "Access denied" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await appointmentCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});




// userProfile collection
app.get('/userprofile', verifyToken, async (req, res) => {
  try {
    const email = req.user.email; // From verified token
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

app.get('/userprofile/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await userProfileCollection.findOne(query);
  res.send(result);
})


app.post('/userprofile', verifyToken, async (req, res) => {
  try {
    const email = req.user.email; // From verified token
    const profileData = req.body;
    
    // Check if profile already exists
    const existingProfile = await userProfileCollection.findOne({ email });
    
    let result;
    if (existingProfile) {
      // Update existing profile
      result = await userProfileCollection.updateOne(
        { email },
        { $set: profileData }
      );
    } else {
      // Create new profile
      profileData.email = email;
      profileData.submissionDate = new Date().toISOString();
      result = await userProfileCollection.insertOne(profileData);
    }
    
    res.send(result);
  } catch (error) {
    console.error('Error saving user profile:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});



app.patch('/userprofile/:id',async(req,res)=>{
  const item = req.body;
  const id = req.params.id;
  const filter = {_id: new ObjectId(id)}
  const updateDoc = {
   
    $set: {
       fullName : item.fullname,
    userName : item.username,
    userImage: userImage,
    Email: item.email,
    NID: item.nid,
    Gender: item.gender,
    bloodGroup: item.bloodGroup,
    EmergencyName: item.EmergencyName,
    EmergencyRelationship: item.EmergencyRelationship,
    EmergencyNumber: item.EmergencyNumber,
    }



  }

  const result = await userProfileCollection.updateOne(filter,updateDoc)
  res.send(result);

})


app.patch('/userprofile', verifyToken, async (req, res) => {
    try {
        const email = req.user.email;
        const profileData = req.body;
        
        const result = await userProfileCollection.updateOne(
            { email },
            { $set: profileData }
        );
        
        res.send(result);
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});


app.delete('/userprofile/:id',async(req,res,async(req,res)=> {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await userProfileCollection.deleteOne(query)
  res.send(result);
}))



   
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    //  module.exports = app;
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


