const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const paymentCollection = client.db('CarDealer').collection('payments');
    const ReviewCollection = client.db('CarDealer').collection('reviews');
    const messagesCollection = client.db('CarDealer').collection('notifications');
    const verifyAdmin = async(req, res, next)=>{
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester})
      if(requesterAccount.role==='admin'){
        next();
      }
      else{
        return res.status(403).send({message: 'Forbidden Access'});
      }
    }

    app.get('/users', verifyJWT,verifyAdmin, async(req,res)=>{
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

        //Get perticular User
        app.get('/user/:email',verifyJWT, async(req, res)=>{
          const email= req.params.email;
          const filter = {email: email};
          const result = await userCollection.findOne(filter);
          res.send(result)
        })

    //verify user role
    app.get('/admin/:email',verifyJWT,verifyAdmin, async(req,res)=>{
      const email = req.params.email;
      const user = await userCollection.findOne({email:email})
      const isAdmin = user.role ==='admin';
      res.send({admin: isAdmin});
    })
    //add user role as ADMIN
    app.put('/user/admin/:email',verifyJWT,verifyAdmin, async(req,res)=>{
      const email= req.params.email;
      
      const filter= {email: email}
      //console.log(filter);
       const updatedDoc = {
        $set: {role: 'admin'}
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send({result}); 
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

    app.post('/vehicle',verifyJWT, verifyAdmin, async(req,res)=>{
      const vehicle = req.body;
      const result = await vehicleCollection.insertOne(vehicle);
      res.send(result)
    })

    //vehicle Update
    app.put('/vehicle/:id',verifyJWT,verifyAdmin, async(req,res)=>{
      const id= req.params.id;
      const vehicle = req.body;
      //console.log(vehicle);
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: vehicle,
      };
      const result = await vehicleCollection.updateOne(filter, updateDoc);
      res.send({result}); 
    })
    app.patch('/vehicle/:id',verifyJWT, async(req,res)=>{
      const id= req.params.id;
      const subQuantity = req.body;
      console.log(subQuantity);
      const filter = {_id: ObjectId(id)};
      if(subQuantity.quantity<0){
        return res.send({success: false})
      }
      const updateDoc = {
        $set: {
          quantity: subQuantity.quantity
        }
      };
      const result = await vehicleCollection.updateOne(filter, updateDoc);
      res.send({success: true,result}); 
    })

    //Delete a vehicle
    app.delete('/vehicle/:id',verifyJWT, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const filter = {_id:ObjectId(id)}
      const result = await vehicleCollection.deleteOne(filter);
      res.send(result);
    })
    //confirm a new vehicle
    app.post('/bookedVehicle',verifyJWT, async(req,res)=>{
      const confirmBooking = req.body;
      
      const query = {carId: confirmBooking.carId, userName: confirmBooking.userName};
      const exists = await confirmVehicleCollection.findOne(query);
       if(exists){
          console.log(exists)
           return res.send({success: false, confirmBooking: exists})
       }
      const result =await confirmVehicleCollection.insertOne(confirmBooking);
      return res.send({success: true,result});
    })
    app.delete('/bookedVehicle/:id',verifyJWT, async(req,res)=>{
      const id = req.params.id;
      const filter = {_id:ObjectId(id)}
      const result = await confirmVehicleCollection.deleteOne(filter);
      res.send(result);
    })

    app.put('/bookedVehicle/:id',verifyJWT, async(req,res)=>{
      const id= req.params.id;
      const vehicle = req.body;
      //console.log(vehicle);
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: vehicle,
      };
      const result = await confirmVehicleCollection.updateOne(filter, updateDoc);
      res.send({result}); 
    })

        //get user Booked Vehicle from DB

      app.get('/booking',verifyJWT, async(req,res)=>{
          const email = req.query.user;
          const decodedEmail = req.decoded.email;
          if(email === decodedEmail){
            const query = {userEmail: email};
            const bookings = await confirmVehicleCollection.find(query).toArray();
            return res.send(bookings);
          }
          else{
            return res.status(403).send({message: 'Forbidden Access'});
          }    
      }) 
      app.get('/booking/:id',verifyJWT, async(req,res)=>{
        const id= req.params.id;
        const query = {_id: ObjectId(id)}
        const confirmedVehicle = await confirmVehicleCollection.findOne(query);
        res.send(confirmedVehicle)
      })

      //Payment
     app.patch('/booking/:id',verifyJWT, async(req,res)=>{
      const id = req.params.id;
      const payment = req.body;
      const filter ={_id : ObjectId(id)};;
      const updatedDoc = {
        $set : {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await confirmVehicleCollection.updateOne(filter, updatedDoc);
      const booking = await confirmVehicleCollection.findOne(filter);
      //sendPaymentConfirmationEmail(booking);
      res.send(updatedDoc)
    })
    app.post('/create-payment-intent',verifyJWT, async(req,res)=>{
      const booking = req.body;
      const cost = booking.cost;
      console.log(cost);
      const amount = cost*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "eur",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    }) 

    // add a new Review
    app.post('/review',verifyJWT, async(req,res)=>{
      const review = req.body;
      const query = {carId: review.carId, reviewerEmail: review.reviewerEmail};
      const exists = await ReviewCollection.findOne(query);
       if(exists){
           return res.send({success: false, confirmBooking: exists})
       }
      const result =await ReviewCollection.insertOne(review);
      return res.send({success: true,result});
    })
    app.get('/review', async(req,res)=>{
      const carId = req.query.carId;
      const reviewerEmail = req.query.userEmail;
      const query = {carId: carId, reviewerEmail: reviewerEmail};
      const filter=  await ReviewCollection.findOne(query);
      
      //const count = await vehicleCollection.estimatedDocumentCount();
      //console.log(count)
      res.send(filter);
    })
    app.get('/review/:id', async(req,res)=>{
      const carId = req.params.id;
      const query = {carId: carId};
      const filter=  await ReviewCollection.find(query).toArray();

      res.send(filter);
    })
    app.post('/notification', async(req, res)=>{
      mail = req.body;
      const result = await messagesCollection.insertOne(mail);
      res.send(result);
    })
    app.get('/notifications',verifyJWT,verifyAdmin, async(req, res)=>{
      const result = await messagesCollection.find().toArray();
      res.send(result)
    })
    app.get('/notification/:id',verifyJWT,verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      //console.log(id);
      const query ={ _id: ObjectId(id)};
      const result =await messagesCollection.findOne(query);
      res.send(result)
    })
    app.patch('/notification/:id',verifyJWT, verifyAdmin, async(req, res)=>{
      const id= req.params.id;
      const status= req.body
      const filter ={_id : ObjectId(id)};;
      const updatedDoc = {
        $set : {
          unread: status.unread,
        }
      }
      const result = await messagesCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    app.delete('/notification/:id',verifyJWT, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const filter = {_id:ObjectId(id)}
      const result = await messagesCollection.deleteOne(filter);
      res.send(result);
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