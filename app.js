const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jwt-then");
const bcrypt = require("bcrypt");
const path = require('path');
mongoose.connect("mongodb://localhost:27017/gfg");
const db = mongoose.connection;
db.on("error", console.log.bind(console, "connection error"));
db.once("open", function(callback) {
  console.log("connection succeeded");
  const secret = "mywebsiteisverygood";

  const app = express();

  app.set("view engine", "ejs");
  app.use(cookieParser());
  app.use(bodyParser.json());
  app.use(express.static("public"));
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );

  const islogin = async (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = await jwt.verify(token, secret);
        console.log(decoded);
        db.collection("details").findOne({email:decoded.email}, async function(err, record) {
          if (err) throw err;
          if (record) {
			req.user = record;
			next();
          } else {
            return res.redirect("login");
          }
        });
      } catch (error) {
        console.log(error);
      }
    } else {
      res.redirect("/login");
    }
  };

  app.post("/sign_up",async function(req, res,next) {
    var name = req.body.name;
    var email = req.body.email;
    var pass = req.body.password;

    const hashedPassword = await bcrypt.hash(pass,10)
    var data = {
      name: name,
      email: email,
      password: hashedPassword,
   
    };
    

    db.collection("details").insertOne(data, function(err, collection) {
      if (err) throw err;
      console.log("Record inserted Successfully");
      return res.redirect("signup_success.html");
    });
  });

  app.get("/login", (req, res) => {
    res.render("login");
  });

  app.post("/login", function(req,res ,next) {
    var email = req.body.email;
    var pass = req.body.password;

    var data = {
      email: email
    };
    db.collection("details").findOne(data, async function(err, record) {
      if (err) throw err;
      if (record) {
        const isVerified = await bcrypt.compare(pass, record.password);
        if(!isVerified){
          console.log("password not matched")
          return res.redirect("login");
        }
        const token = await jwt.sign({ email: record.email }, secret, {
          expiresIn: "1d"
        });
        res.cookie("token", token);
        console.log("Record Found");
        return res.redirect("dashboard");
      } else {
        console.log("Record not Found");
        return res.redirect("login");
      }
    });
  });

  app.get("/dashboard", islogin, async (req, res) => {
    const books = await db.collection("books").find({}).toArray();

    res.render("dashboard", { name: req.user.name, books: books });
  });
  app.get("/library", islogin, async (req, res) => {
    const books = await db.collection("books").find({}).toArray();
    const recentBooks = await db.collection("recent").find({userId:req.user._id}).toArray();
    const recentBooksids = recentBooks.map(book=>book.bookId.toString());
    const recentBooksComplete = books.filter(book=>{
      return recentBooksids.includes(book._id.toString());
    })
    // console.log(recentBooks,recentBooksids,recentBooksComplete)
    // console.log(books);
    res.render("library", { name: req.user.name, books: recentBooksComplete });
  });
m
  app.get('/logout',(req,res)=>{
	  res.clearCookie('token');
	  res.redirect('/login')
  });
 
  

  app.get("/books/:bookName", islogin, async (req,res)=>{
    const book = await db.collection("books").findOne({slug:req.params.bookName});
    console.log(book);
    if(book){
      await db.collection("recent").findOneAndUpdate({userId:req.user._id, bookId:book._id},{$inc:{count:1}},{upsert:true});
      res.render('book',{bookName: book.name})
    }else{
      res.redirect("/dashboard")
    }

  })
  app.get('/file/:name', islogin, function (req, res, next) {
    var options = {
      root: path.join(__dirname, 'public', 'downloads'),
      dotfiles: 'deny',
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
      }
    }
  
    var fileName = req.params.name
    res.sendFile(fileName, options, function (err) {
      if (err) {
        next(err)
      } else {
        console.log('Sent:', fileName)
      }
    })
  })

  app
    .get("/", function(req, res) {
      res.set({
        "Access-control-Allow-Origin": "*"
      });
      return res.redirect("index.html");
    })
    .listen(process.env.PORT || 3000);

  console.log("server listening at port 3000");
});
