const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app= express()
const port = process.env.PORT || 5000
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.73iqo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: 'Unauthorized Access'})
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if(err){
      return res.status(403).send({message:"Forbidden Access"})
    }
    req.decoded= decoded;
    next();
  });
}

async function run(){
  try{
    await client.connect();
    const userCollection = client.db('CarDealer').collection('users');
    const vehicleCollection = client.db('CarDealer').collection('vehicles');

    app.get('/users', async(req,res)=>{
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    app.put('/user/:email', async(req,res)=>{
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = {upsert : true};
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc,options);
      const token= jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({result, token});
    }) 



    //Vhicles
    app.get('/vehicles', async(req,res)=>{
      const query= {};
      const cursor= vehicleCollection.find(query);
      const vehicles =await cursor.toArray();
      res.send(vehicles);
    })
    
    app.post('/vehicle', async(req,res)=>{
      const vehicle = req.body;
      const result = await vehicleCollection.insertOne(vehicle);
      res.send(result)
    })
  }
  finally{

  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
  res.send('Hello from car dealer!')
})

app.listen(port, () => {
  console.log(`car dealer app listening on port ${port}`)
})