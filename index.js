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
    const confirmVehicleCollection = client.db('CarDealer').collection('bookedVehicles');
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
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const cons = req.query.condition;
      const com = req.query.company;
      const cat = req.query.category;
      let query
      if(cons && com && cat){
         query = {condition: cons, company:com, catagory:cat }
      }
      else if(cons && com){
        query = {condition: cons, company:com}
      }
      else if(cons && cat){
        query = {condition: cons, catagory:cat}
      }
      else if(com && cat){
        query = {company:com, catagory:cat}
      }
      else if(com){
        query = {company:com}
      }
      else if(cons){
        query = {condition: cons}
      }
      else if(cat){
        query = {catagory:cat}
      }
      else{
         query = {}
      } 
      const cursor=await vehicleCollection.find(query);
      let vehicles;
            if(page || size){
                vehicles = await cursor.skip(page*size).limit(size).toArray();
            }
            else{
                vehicles = await cursor.toArray();
            }
      res.send(vehicles);
    })

    app.get('/vehicle/:id', async(req,res)=>{
      const id = req.params.id;
      const query= {_id: ObjectId(id)};
      const vehicle = await vehicleCollection.findOne(query);
      res.send(vehicle);
    })
    
    app.get('/vehicleCount', async(req, res) =>{
      const cons = req.query.condition;
      const com = req.query.company;
      const cat = req.query.category;
      let query
      if(cons && com && cat){
         query = {condition: cons, company:com, catagory:cat }
      }
      else if(cons && com){
        query = {condition: cons, company:com}
      }
      else if(cons && cat){
        query = {condition: cons, catagory:cat}
      }
      else if(com && cat){
        query = {company:com, catagory:cat}
      }
      else if(com){
        query = {company:com}
      }
      else if(cons){
        query = {condition: cons}
      }
      else if(cat){
        query = {catagory:cat}
      }
      else{
         query = {}
      } 
      //console.log(query)
      const cursor= vehicleCollection.find(query);
      const count = await cursor.count();
      //const count = await vehicleCollection.estimatedDocumentCount();
      //console.log(count)
      res.send({count});
    });
    app.get('/vehicleCount/:condition', async(req, res) =>{
      const cons = req.params.condition;
      const query = {condition : cons}
      //console.log(query)
      const cursor= vehicleCollection.find(query);
      const count = await cursor.estimatedDocumentCount();
      //console.log(count)
      res.send({count}); 
    });

    app.post('/vehicle',verifyJWT, async(req,res)=>{
      const vehicle = req.body;
      const result = await vehicleCollection.insertOne(vehicle);
      res.send(result)
    })

    //confirm a new vehicle
    app.post('/bookedVehicle', async(req,res)=>{
      const confirmBooking = req.body;
      
      const query = {carId: confirmBooking.carId, userName: confirmBooking.userName};
      //console.log(query)
      const exists = await confirmVehicleCollection.findOne(query);
       if(exists){
          console.log(exists)
           return res.send({success: false, confirmBooking: exists})
       }
      const result =await confirmVehicleCollection.insertOne(confirmBooking);
      //sendConfirmBookingEmail(confirmBooking)
      return res.send({success: true,result});
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