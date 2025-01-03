const express=require('express')
const app=express()
const cors=require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port=process.env.PORT || 5000

app.use(express.json())
app.use(cors({
  origin:['bistro-boss-1a12e.web.app','http://localhost:5173','http://localhost:5174']
}))

app.get('/',async(req,res)=>{
    res.send('bistro boss server is running')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USERS}:${process.env.DB_PASSWORD}@cluster0.vmhty.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const menuCollection=client.db("bistrodb").collection("menu")
    const userCollection=client.db("bistrodb").collection("users")
    const reviewCollection=client.db("bistrodb").collection("reviews")
    const cartsCollection=client.db("bistrodb").collection("carts")
    const paymentsCollection=client.db("bistrodb").collection("payments")

    //  ----------middleware ---------------
const verifyToken=(req,res,next)=>{
  // console.log('inside verify token',req.headers.authorization)
  if(!req.headers.authorization){
    return res.status(401).send({message:'unauthorized access'})
  }
  const token=req.headers.authorization.split(" ")[1]
  // console.log({token})
  jwt.verify(token,process.env.ACCESS_TOKEN_SECURES,(err,decoded)=>{
    if(err){
      // console.log(err)
     return res.status(401).send({message:'unauthorized  access after verify token'})
    }
    req.decoded=decoded;
     next()
  })

}
// ------------ jwt related token ---------------
app.post('/jwt',(req,res)=>{
  const user=req.body;
  const token=jwt.sign(user, process.env.ACCESS_TOKEN_SECURES, {expiresIn:'7d'})
  res.send({token})
})
// -----------admin related middleware -----------
const adminVerify=async(req,res,next)=>{
  const email=req.decoded.email;
  const query={email:email}
  const user=await userCollection.findOne(query)
  const isAdmin=user.role==='admin';
  if(!isAdmin){
    return res.status(403).send({message:'forbidden access'})
  }
  next()
}

//  ------------  user related api --------------

app.get('/users',verifyToken,adminVerify,async(req,res)=>{
  
  const result=await userCollection.find().toArray()
  res.send(result)
})

 app.post('/users',async(req,res)=>{
  const user=req.body;
  const query={email:user.email}
  const existingUser=await userCollection.findOne(query)
  if(existingUser){
    return  res.send({message:'your email already existed', insertedId:null})
  }
  const result=await userCollection.insertOne(user)
  res.send(result)
 });

 app.delete('/users/:id',verifyToken,adminVerify, async(req,res)=>{
  const id =req.params.id;
  const query={_id:new ObjectId(id)}
  const result=await userCollection.deleteOne(query)
  res.send(result)
 });

//  get admin user ------------
app.get('/users/admin/:email',verifyToken, async(req,res)=>{
  const email=req.params.email;
  if(email !==req.decoded.email){
    return res.status(403).send({message:'unauthorized access'})
  }
  const query={email:email}
  const user=await userCollection.findOne(query);
  let admin=false ;
  if(user){
    admin=user?.role==='admin'
  }
  res.send({admin})
})
// set admin user ----------------
 app.patch('/users/admin/:id',verifyToken,adminVerify, async(req,res)=>{
  const id=req.params.id
  const filter={_id:new ObjectId(id)}
  const updateDoc={
    $set:{
      role:'admin'
    }
  }
  const result=await userCollection.updateOne(filter,updateDoc)
  res.send(result)
 })


// ---------------- menu related Api -------------
  app.get('/menu',async(req,res)=>{
    const result=await menuCollection.find().toArray()
    res.send(result)
  })

  app.delete('/menu/:id',verifyToken,adminVerify, async(req,res)=>{
    const id=req.params.id
    const query={_id: new ObjectId(id)}
    const result=await menuCollection.deleteOne(query)
    res.send(result)
  })

app.get('/menu/:id',async(req,res)=>{
  const id=req.params.id;
  // console.log(id)
  // const query={_id: new ObjectId(id)}
  const query={_id:id}
  const result=await menuCollection.findOne(query)
  res.send(result)
})

app.patch('/menu/:id',verifyToken,adminVerify, async(req,res)=>{
  const item=req.body;
  const id=req.params.id;
  const filter={_id:id}
  const updateDoc={
   $set:{
    name:item.name,
    recipe:item.recipe,
    price:item.price,
    category:item.category,
    image:item.image,
   }
  }
  const result=await menuCollection.updateOne(filter,updateDoc)
  res.send(result)
})

  app.post('/menu',verifyToken,adminVerify, async(req,res)=>{
    const item=req.body;
    const result=await menuCollection.insertOne(item)
    res.send(result)
  })

  app.get('/reviews',async(req,res)=>{
    const result=await reviewCollection.find().toArray()
    res.send(result)
  })
  // ---------------------carts collection ----------
  app.get('/carts',async(req,res)=>{
    const email=req.query.email;
    const query={email:email}
    const result=await cartsCollection.find(query).toArray()
    res.send(result)
  })

 app.post('/carts',async(req,res)=>{
   const cartsItem=req.body;
   const result=await cartsCollection.insertOne(cartsItem)
   res.send(result)
 })

 app.delete('/carts/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id:new ObjectId(id)}
  const result=await cartsCollection.deleteOne(query)
  res.send(result)
 })

//  -----------payment intend ------------
app.post('/create-payment-intent',async(req,res)=>{
  const {price}=req.body;
  const amount=parseInt(price*100)
  const paymentIntend=await stripe.paymentIntents.create({
    amount:amount,
    currency:'usd',
    payment_method_types:['card'],
  })
  res.send({
    clientSecret:paymentIntend.client_secret,
  })
})

app.get('/payment/:email',verifyToken, async(req,res)=>{
  const query={email:req.params.email}
  if(req.params.email!==req.decoded.email){
    return res.status(403).send({message:'forbidden access'})
  }
  const result= await paymentsCollection.find(query).toArray()
    res.send(result)
  
})

app.post('/payment',async(req,res)=>{
  const payments=req.body;
  const paymentResult=await paymentsCollection.insertOne(payments)
// carefully delete each item from the cart 
 console.log(payments)
const query={_id:{
  $in:payments.cartIds.map(id=> new ObjectId(id))
}}
const deleteResult=await cartsCollection.deleteMany(query)
res.send({paymentResult,deleteResult})

})

app.get('/admin-stats',verifyToken,adminVerify, async(req,res)=>{
  const users = await userCollection.estimatedDocumentCount();
  const menuItems = await menuCollection.estimatedDocumentCount() ;
  const orders = await paymentsCollection.estimatedDocumentCount();
 
  //  this is not best way -----------

  // const payments=await paymentsCollection.find().toArray()
  // const revenue=payments.reduce((total,payment)=>total+payment.price,0)

  const result=await paymentsCollection.aggregate([
    {
      $group:{_id:null,totalRevenue:{$sum:'$price'}}
    }
  ]).toArray()
const revenue=result.length>0 ? result[0].totalRevenue : 0;
  res.send({
    users,
    menuItems,
    orders,   
    revenue,
  })
}),

app.get('/order-stats',verifyToken,adminVerify, async(req,res)=>{
  const result=await paymentsCollection.aggregate([
{
  $unwind:'$menuItemIds'
},
{
  $lookup:{
    from:'menu',
    localField:'menuItemIds',
    foreignField:'_id',
    as:'itemsId'
  }
},
{
  $unwind:'$itemsId'
},
{
  $group:{
    _id:'$itemsId.category',
    quantity:{$sum:1},
    revenue:{$sum:'$itemsId.price'}
  }
},
{
  $project:{
    _id:0,
    category:'$_id',
    quantity:'$quantity',
    revenue:'$revenue'
  }
}
  ]).toArray()

  res.send(result)
})

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port,()=>{
    console.log(`the server is running , ${port}`)
})